import type { Readable } from "stream";
import type { Response } from "express";
import {
  IStorageProvider,
  StorageProviderType,
  AzureBlobStorageConfig,
  StorageMetadata,
  UploadOptions,
  DownloadOptions,
  SignedUrlOptions,
  ListOptions,
  ListResult,
  ObjectVisibility,
  ObjectAclPolicy,
  ObjectPermission,
  StorageError,
  StorageErrorCode,
} from "./types";
import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

export class AzureBlobStorageProvider implements IStorageProvider {
  readonly name = "Azure Blob Storage";
  readonly type = StorageProviderType.AZURE_BLOB;
  readonly supportsInPlaceVisibilityChange = false;
  
  private client: BlobServiceClient | null = null;
  private publicContainer: ContainerClient | null = null;
  private privateContainer: ContainerClient | null = null;
  private config: AzureBlobStorageConfig;
  private credential: StorageSharedKeyCredential | null = null;
  private aclPolicies: Map<string, ObjectAclPolicy> = new Map();

  constructor(config: AzureBlobStorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.config.connectionString) {
      this.client = BlobServiceClient.fromConnectionString(this.config.connectionString);
    } else if (this.config.accountName && this.config.accountKey) {
      this.credential = new StorageSharedKeyCredential(
        this.config.accountName,
        this.config.accountKey
      );
      this.client = new BlobServiceClient(
        `https://${this.config.accountName}.blob.core.windows.net`,
        this.credential
      );
    } else {
      throw new StorageError(
        "Azure Blob requires connectionString or accountName+accountKey",
        StorageErrorCode.CONFIGURATION_ERROR,
        undefined,
        this.name
      );
    }

    const publicContainerName = this.config.publicBucket || "public";
    const privateContainerName = this.config.privateBucket || "private";

    this.publicContainer = this.client.getContainerClient(publicContainerName);
    this.privateContainer = this.client.getContainerClient(privateContainerName);

    await this.publicContainer.createIfNotExists({ access: "blob" });
    await this.privateContainer.createIfNotExists();
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const iter = this.client.listContainers().byPage({ maxPageSize: 1 });
      await iter.next();
      return true;
    } catch {
      return false;
    }
  }

  private getContainer(key: string): ContainerClient {
    if (!this.publicContainer || !this.privateContainer) {
      throw new StorageError("Azure Blob not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }
    return key.startsWith(".private/") ? this.privateContainer : this.publicContainer;
  }

  private getBlobName(key: string): string {
    if (key.startsWith(".private/")) {
      return key.substring(9);
    }
    if (key.startsWith("public/")) {
      return key.substring(7);
    }
    return key;
  }

  async upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string> {
    const container = this.getContainer(key);
    const blobName = this.getBlobName(key);
    const blockBlobClient = container.getBlockBlobClient(blobName);

    try {
      let buffer: Buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      }

      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: options?.contentType,
        },
        metadata: options?.metadata,
      });

      return key;
    } catch (error) {
      throw new StorageError(
        `Failed to upload: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.UPLOAD_FAILED,
        key,
        this.name
      );
    }
  }

  async download(key: string): Promise<{ data: Readable; metadata: StorageMetadata }> {
    const container = this.getContainer(key);
    const blobName = this.getBlobName(key);
    const blobClient = container.getBlobClient(blobName);

    try {
      const downloadResponse = await blobClient.download();

      if (!downloadResponse.readableStreamBody) {
        throw new StorageError("Empty response body", StorageErrorCode.DOWNLOAD_FAILED, key, this.name);
      }

      return {
        data: downloadResponse.readableStreamBody as Readable,
        metadata: {
          contentType: downloadResponse.contentType,
          size: downloadResponse.contentLength,
          lastModified: downloadResponse.lastModified,
          etag: downloadResponse.etag,
          customMetadata: downloadResponse.metadata,
        },
      };
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to download: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        key,
        this.name
      );
    }
  }

  async streamToResponse(key: string, res: Response, options?: DownloadOptions): Promise<void> {
    const { data, metadata } = await this.download(key);
    
    if (metadata.contentType) {
      res.setHeader("Content-Type", metadata.contentType);
    }
    if (metadata.size) {
      res.setHeader("Content-Length", metadata.size);
    }
    if (options?.cacheTtlSec) {
      res.setHeader("Cache-Control", `max-age=${options.cacheTtlSec}`);
    }

    data.pipe(res);
  }

  async delete(key: string): Promise<void> {
    const container = this.getContainer(key);
    const blobName = this.getBlobName(key);
    const blobClient = container.getBlobClient(blobName);

    try {
      await blobClient.delete();
      this.aclPolicies.delete(key);
    } catch (error) {
      throw new StorageError(
        `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.DELETE_FAILED,
        key,
        this.name
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const container = this.getContainer(key);
      const blobName = this.getBlobName(key);
      const blobClient = container.getBlobClient(blobName);
      return await blobClient.exists();
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    const container = this.getContainer(key);
    const blobName = this.getBlobName(key);
    const blobClient = container.getBlobClient(blobName);

    try {
      const properties = await blobClient.getProperties();

      return {
        contentType: properties.contentType,
        size: properties.contentLength,
        lastModified: properties.lastModified,
        etag: properties.etag,
        customMetadata: properties.metadata,
      };
    } catch {
      throw new StorageError("Object not found", StorageErrorCode.NOT_FOUND, key, this.name);
    }
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    if (!this.credential) {
      throw new StorageError(
        "SAS generation requires accountKey credential",
        StorageErrorCode.CONFIGURATION_ERROR,
        key,
        this.name
      );
    }

    const container = this.getContainer(key);
    const blobName = this.getBlobName(key);
    const blobClient = container.getBlobClient(blobName);

    const permissions = new BlobSASPermissions();
    switch (options.method) {
      case "GET":
        permissions.read = true;
        break;
      case "PUT":
        permissions.write = true;
        permissions.create = true;
        break;
      case "DELETE":
        permissions.delete = true;
        break;
      case "HEAD":
        permissions.read = true;
        break;
    }

    const expiresOn = new Date(Date.now() + options.ttlSec * 1000);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: container.containerName,
        blobName,
        permissions,
        expiresOn,
        contentType: options.contentType,
      },
      this.credential
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }

  async getUploadUrl(prefix?: string, ttlSec: number = 3600): Promise<{ uploadUrl: string; objectKey: string }> {
    const objectKey = prefix ? `${prefix}/${uuidv4()}` : uuidv4();
    const fullKey = `.private/${objectKey}`;
    
    const uploadUrl = await this.getSignedUrl(fullKey, {
      method: "PUT",
      ttlSec,
    });

    return { uploadUrl, objectKey: fullKey };
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix || "";
    const isPublic = prefix.startsWith("public/");
    const isPrivate = prefix.startsWith(".private/") || !isPublic;
    const container = isPrivate ? this.privateContainer : this.publicContainer;
    const keyPrefix = isPrivate ? ".private/" : "public/";

    if (!container) {
      throw new StorageError("Azure Blob not initialized", StorageErrorCode.CONFIGURATION_ERROR, undefined, this.name);
    }

    const blobPrefix = this.getBlobName(prefix);
    const objects: { key: string; metadata: StorageMetadata }[] = [];
    let nextCursor: string | undefined;

    try {
      const maxResults = options?.maxResults || 1000;
      const pages = container.listBlobsFlat({
        prefix: blobPrefix || undefined,
      }).byPage({ 
        maxPageSize: maxResults,
        continuationToken: options?.cursor,
      });

      const firstPage = await pages.next();
      if (!firstPage.done && firstPage.value) {
        const segment = firstPage.value;
        for (const blob of segment.segment.blobItems) {
          objects.push({
            key: `${keyPrefix}${blob.name}`,
            metadata: {
              size: blob.properties.contentLength,
              lastModified: blob.properties.lastModified,
              etag: blob.properties.etag,
              contentType: blob.properties.contentType,
            },
          });
        }
        nextCursor = segment.continuationToken;
      }

      return { objects, nextCursor };
    } catch (error) {
      throw new StorageError(
        `Failed to list: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.CONNECTION_ERROR,
        undefined,
        this.name
      );
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const sourceContainer = this.getContainer(sourceKey);
    const destContainer = this.getContainer(destinationKey);
    const sourceBlobName = this.getBlobName(sourceKey);
    const destBlobName = this.getBlobName(destinationKey);

    const sourceBlob = sourceContainer.getBlobClient(sourceBlobName);
    const destBlob = destContainer.getBlobClient(destBlobName);

    try {
      const poller = await destBlob.beginCopyFromURL(sourceBlob.url);
      await poller.pollUntilDone();

      const sourceAcl = await this.getAclPolicy(sourceKey);
      if (sourceAcl) {
        this.aclPolicies.set(destinationKey, { ...sourceAcl });
      }
    } catch (error) {
      throw new StorageError(
        `Failed to copy: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.UPLOAD_FAILED,
        sourceKey,
        this.name
      );
    }
  }

  async setVisibility(key: string, visibility: ObjectVisibility): Promise<void> {
    const isCurrentlyPublic = key.startsWith("public/");
    const isCurrentlyPrivate = key.startsWith(".private/") || !isCurrentlyPublic;
    const targetIsPublic = visibility === ObjectVisibility.PUBLIC;
    const visibilityChangesContainer = (isCurrentlyPrivate && targetIsPublic) || (isCurrentlyPublic && !targetIsPublic);
    
    if (visibilityChangesContainer) {
      const blobName = this.getBlobName(key);
      const newKey = targetIsPublic ? `public/${blobName}` : `.private/${blobName}`;
      throw new StorageError(
        `Azure Blob Storage requires key change for visibility transitions. ` +
        `Use copy('${key}', '${newKey}') then delete('${key}') to change visibility.`,
        StorageErrorCode.PERMISSION_DENIED,
        key,
        this.name
      );
    }
    
    const policy = await this.getAclPolicy(key) || {
      visibility,
      allowedUsers: [],
      allowedRoles: [],
    };
    policy.visibility = visibility;
    this.aclPolicies.set(key, policy);
  }

  getPublicUrl(key: string): string | null {
    if (key.startsWith(".private/")) {
      return null;
    }

    if (!this.publicContainer) {
      return null;
    }

    const blobName = this.getBlobName(key);
    return this.publicContainer.getBlobClient(blobName).url;
  }

  async getAclPolicy(key: string): Promise<ObjectAclPolicy | null> {
    return this.aclPolicies.get(key) || null;
  }

  async setAclPolicy(key: string, policy: ObjectAclPolicy): Promise<void> {
    this.aclPolicies.set(key, policy);
  }

  async canAccess(key: string, userId: string | undefined, permission: ObjectPermission): Promise<boolean> {
    const policy = await this.getAclPolicy(key);
    
    if (!policy) {
      return !key.startsWith(".private/") && permission === ObjectPermission.READ;
    }

    if (policy.visibility === ObjectVisibility.PUBLIC && permission === ObjectPermission.READ) {
      return true;
    }

    if (!userId) {
      return false;
    }

    if (policy.allowedUsers?.includes(userId)) {
      return true;
    }

    return false;
  }

  normalizeEntityPath(rawPath: string): string {
    return rawPath
      .toLowerCase()
      .replace(/[^a-z0-9\-_\/\.]/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "");
  }

  async searchPublicObject(filePath: string): Promise<{ key: string; metadata: StorageMetadata } | null> {
    const normalizedPath = this.normalizeEntityPath(filePath);
    const publicKey = `public/${normalizedPath}`;

    if (await this.exists(publicKey)) {
      const metadata = await this.getMetadata(publicKey);
      return { key: publicKey, metadata };
    }

    return null;
  }
}
