import type { Readable } from "stream";
import type { Response } from "express";
import {
  IStorageProvider,
  StorageProviderType,
  S3StorageConfig,
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
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  PutObjectAclCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export class S3StorageProvider implements IStorageProvider {
  readonly name = "AWS S3";
  readonly type = StorageProviderType.S3;
  readonly supportsInPlaceVisibilityChange = true;
  
  private client: S3Client | null = null;
  private config: S3StorageConfig;
  private publicBucket: string;
  private privateBucket: string;
  private aclPolicies: Map<string, ObjectAclPolicy> = new Map();

  constructor(config: S3StorageConfig) {
    this.config = config;
    this.publicBucket = config.publicBucket || "public";
    this.privateBucket = config.privateBucket || "private";
  }

  async initialize(): Promise<void> {
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: this.config.region,
    };

    if (this.config.accessKeyId && this.config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      };
    }

    if (this.config.endpoint) {
      clientConfig.endpoint = this.config.endpoint;
      clientConfig.forcePathStyle = this.config.forcePathStyle ?? true;
    }

    this.client = new S3Client(clientConfig);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.publicBucket,
          MaxKeys: 1,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  private getBucket(key: string): string {
    return key.startsWith(".private/") ? this.privateBucket : this.publicBucket;
  }

  private getObjectKey(key: string): string {
    if (key.startsWith(".private/")) {
      return key.substring(9);
    }
    if (key.startsWith("public/")) {
      return key.substring(7);
    }
    return key;
  }

  async upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string> {
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    try {
      let body: Buffer;
      if (Buffer.isBuffer(data)) {
        body = data;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of data) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }

      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentType: options?.contentType,
          Metadata: options?.metadata,
          ACL: options?.isPublic ? "public-read" : "private",
        })
      );

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
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      if (!response.Body) {
        throw new StorageError("Empty response body", StorageErrorCode.DOWNLOAD_FAILED, key, this.name);
      }

      return {
        data: response.Body as Readable,
        metadata: {
          contentType: response.ContentType,
          size: response.ContentLength,
          lastModified: response.LastModified,
          etag: response.ETag,
          customMetadata: response.Metadata,
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
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
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
    if (!this.client) return false;

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      return {
        contentType: response.ContentType,
        size: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        customMetadata: response.Metadata,
      };
    } catch {
      throw new StorageError("Object not found", StorageErrorCode.NOT_FOUND, key, this.name);
    }
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    let command;
    switch (options.method) {
      case "GET":
        command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
        break;
      case "PUT":
        command = new PutObjectCommand({ 
          Bucket: bucket, 
          Key: objectKey,
          ContentType: options.contentType,
        });
        break;
      case "DELETE":
        command = new DeleteObjectCommand({ Bucket: bucket, Key: objectKey });
        break;
      case "HEAD":
        command = new HeadObjectCommand({ Bucket: bucket, Key: objectKey });
        break;
    }

    return getSignedUrl(this.client, command, { expiresIn: options.ttlSec });
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
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, undefined, this.name);
    }

    const prefix = options?.prefix || "";
    const isPublic = prefix.startsWith("public/");
    const isPrivate = prefix.startsWith(".private/") || !isPublic;
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;
    const objectPrefix = this.getObjectKey(prefix);
    const keyPrefix = isPrivate ? ".private/" : "public/";

    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: objectPrefix || undefined,
          MaxKeys: options?.maxResults,
          ContinuationToken: options?.cursor,
        })
      );

      const objects = (response.Contents || []).map((obj) => ({
        key: `${keyPrefix}${obj.Key || ""}`,
        metadata: {
          size: obj.Size,
          lastModified: obj.LastModified,
          etag: obj.ETag,
        },
      }));

      return {
        objects,
        nextCursor: response.NextContinuationToken,
      };
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
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, sourceKey, this.name);
    }

    const sourceBucket = this.getBucket(sourceKey);
    const destBucket = this.getBucket(destinationKey);
    const sourceObjKey = this.getObjectKey(sourceKey);
    const destObjKey = this.getObjectKey(destinationKey);
    const isDestPublic = !destinationKey.startsWith(".private/");

    try {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: destBucket,
          Key: destObjKey,
          CopySource: `${sourceBucket}/${sourceObjKey}`,
          ACL: isDestPublic ? "public-read" : "private",
        })
      );

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
    if (!this.client) {
      throw new StorageError("S3 client not initialized", StorageErrorCode.CONFIGURATION_ERROR, key, this.name);
    }

    const bucket = this.getBucket(key);
    const objectKey = this.getObjectKey(key);

    try {
      await this.client.send(
        new PutObjectAclCommand({
          Bucket: bucket,
          Key: objectKey,
          ACL: visibility === ObjectVisibility.PUBLIC ? "public-read" : "private",
        })
      );
    } catch (error) {
      throw new StorageError(
        `Failed to set visibility: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.PERMISSION_DENIED,
        key,
        this.name
      );
    }
  }

  getPublicUrl(key: string): string | null {
    if (key.startsWith(".private/")) {
      return null;
    }

    if (this.config.endpoint) {
      return `${this.config.endpoint}/${this.publicBucket}/${this.getObjectKey(key)}`;
    }

    return `https://${this.publicBucket}.s3.${this.config.region}.amazonaws.com/${this.getObjectKey(key)}`;
  }

  async getAclPolicy(key: string): Promise<ObjectAclPolicy | null> {
    return this.aclPolicies.get(key) || null;
  }

  async setAclPolicy(key: string, policy: ObjectAclPolicy): Promise<void> {
    this.aclPolicies.set(key, policy);
    await this.setVisibility(key, policy.visibility);
  }

  async canAccess(key: string, userId: string | undefined, permission: ObjectPermission): Promise<boolean> {
    const policy = await this.getAclPolicy(key);
    
    if (!policy) {
      return key.startsWith("public/") && permission === ObjectPermission.READ;
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
