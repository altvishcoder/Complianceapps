import { Storage, File } from "@google-cloud/storage";
import type { Readable } from "stream";
import type { Response } from "express";
import { randomUUID } from "crypto";
import {
  IStorageProvider,
  StorageProviderType,
  StorageMetadata,
  StorageObject,
  UploadOptions,
  DownloadOptions,
  SignedUrlOptions,
  ListOptions,
  ListResult,
  ObjectVisibility,
  ObjectPermission,
  ObjectAclPolicy,
  StorageError,
  StorageErrorCode,
} from "./types";
import { registerStorageProvider } from "./factory";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function createReplitStorageClient(): Storage {
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

export class ReplitStorageProvider implements IStorageProvider {
  readonly name = "Replit Object Storage";
  readonly type = StorageProviderType.REPLIT;
  
  private client: Storage | null = null;
  private publicSearchPaths: string[] = [];
  private privateObjectDir: string = "";

  async initialize(): Promise<void> {
    this.client = createReplitStorageClient();
    
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    this.publicSearchPaths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    
    this.privateObjectDir = process.env.PRIVATE_OBJECT_DIR || "";
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      if (this.publicSearchPaths.length > 0 || this.privateObjectDir) {
        return true;
      }
      return false;
    }
  }

  private getClient(): Storage {
    if (!this.client) {
      throw new StorageError(
        "Replit storage client not initialized",
        StorageErrorCode.CONFIGURATION_ERROR,
        undefined,
        this.name
      );
    }
    return this.client;
  }

  private parseObjectPath(path: string): { bucketName: string; objectName: string } {
    let normalizedPath = path;
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }
    const pathParts = normalizedPath.split("/");
    if (pathParts.length < 3) {
      throw new StorageError(
        "Invalid path: must contain at least a bucket name",
        StorageErrorCode.INVALID_KEY,
        path,
        this.name
      );
    }

    return {
      bucketName: pathParts[1],
      objectName: pathParts.slice(2).join("/"),
    };
  }

  private getFile(key: string): File {
    const fullPath = this.resolveKey(key);
    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    return this.getClient().bucket(bucketName).file(objectName);
  }

  private resolveKey(key: string): string {
    if (key.startsWith("/")) {
      return key;
    }
    if (this.privateObjectDir) {
      return `${this.privateObjectDir}/${key}`;
    }
    throw new StorageError(
      "PRIVATE_OBJECT_DIR not configured",
      StorageErrorCode.CONFIGURATION_ERROR,
      key,
      this.name
    );
  }

  async upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string> {
    try {
      const file = this.getFile(key);
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: options?.contentType || "application/octet-stream",
          metadata: options?.metadata,
        },
        resumable: false,
      });

      await new Promise<void>((resolve, reject) => {
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
        
        if (Buffer.isBuffer(data)) {
          writeStream.end(data);
        } else {
          data.pipe(writeStream);
        }
      });

      return key;
    } catch (error) {
      throw new StorageError(
        `Failed to upload ${key}: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.UPLOAD_FAILED,
        key,
        this.name
      );
    }
  }

  async download(key: string): Promise<{ data: Readable; metadata: StorageMetadata }> {
    try {
      const file = this.getFile(key);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new StorageError(
          `Object not found: ${key}`,
          StorageErrorCode.NOT_FOUND,
          key,
          this.name
        );
      }

      const [metadata] = await file.getMetadata();
      const stream = file.createReadStream();

      return {
        data: stream,
        metadata: {
          contentType: metadata.contentType as string | undefined,
          size: metadata.size ? Number(metadata.size) : undefined,
          lastModified: metadata.updated ? new Date(metadata.updated as string) : undefined,
          etag: metadata.etag as string | undefined,
        },
      };
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to download ${key}: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        key,
        this.name
      );
    }
  }

  async streamToResponse(key: string, res: Response, options?: DownloadOptions): Promise<void> {
    try {
      const file = this.getFile(key);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new StorageError(
          `Object not found: ${key}`,
          StorageErrorCode.NOT_FOUND,
          key,
          this.name
        );
      }

      const [metadata] = await file.getMetadata();
      const cacheTtl = options?.cacheTtlSec ?? 3600;

      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": String(metadata.size),
        "Cache-Control": `private, max-age=${cacheTtl}`,
      });

      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("[ReplitStorage] Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        `Failed to stream ${key}: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        key,
        this.name
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const file = this.getFile(key);
      await file.delete({ ignoreNotFound: true });
    } catch (error) {
      throw new StorageError(
        `Failed to delete ${key}: ${error instanceof Error ? error.message : String(error)}`,
        StorageErrorCode.DELETE_FAILED,
        key,
        this.name
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const file = this.getFile(key);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    const file = this.getFile(key);
    const [exists] = await file.exists();
    
    if (!exists) {
      throw new StorageError(
        `Object not found: ${key}`,
        StorageErrorCode.NOT_FOUND,
        key,
        this.name
      );
    }

    const [metadata] = await file.getMetadata();
    return {
      contentType: metadata.contentType as string | undefined,
      size: metadata.size ? Number(metadata.size) : undefined,
      lastModified: metadata.updated ? new Date(metadata.updated as string) : undefined,
      etag: metadata.etag as string | undefined,
    };
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const fullPath = this.resolveKey(key);
    const { bucketName, objectName } = this.parseObjectPath(fullPath);

    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: options.method,
      expires_at: new Date(Date.now() + options.ttlSec * 1000).toISOString(),
    };

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new StorageError(
        `Failed to generate signed URL: ${response.status}`,
        StorageErrorCode.CONNECTION_ERROR,
        key,
        this.name
      );
    }

    const { signed_url } = await response.json();
    return signed_url;
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix || "";
    const fullPath = this.resolveKey(prefix);
    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    
    const bucket = this.getClient().bucket(bucketName);
    const [files] = await bucket.getFiles({
      prefix: objectName,
      maxResults: options?.maxResults,
      pageToken: options?.cursor,
    });

    const objects: StorageObject[] = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return {
          key: file.name,
          metadata: {
            contentType: metadata.contentType as string | undefined,
            size: metadata.size ? Number(metadata.size) : undefined,
            lastModified: metadata.updated ? new Date(metadata.updated as string) : undefined,
          },
        };
      })
    );

    return { objects };
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const sourceFile = this.getFile(sourceKey);
    const destFile = this.getFile(destinationKey);
    
    await sourceFile.copy(destFile);
  }

  async setVisibility(key: string, visibility: ObjectVisibility): Promise<void> {
    const file = this.getFile(key);
    const [metadata] = await file.getMetadata();
    
    await file.setMetadata({
      ...metadata,
      metadata: {
        ...(metadata.metadata || {}),
        visibility: visibility,
      },
    });
  }

  getPublicUrl(key: string): string | null {
    return null;
  }

  async getUploadUrl(prefix?: string, ttlSec: number = 900): Promise<{ uploadUrl: string; objectKey: string }> {
    const objectId = randomUUID();
    const objectKey = prefix ? `${prefix}/${objectId}` : `uploads/${objectId}`;
    const fullPath = `${this.privateObjectDir}/${objectKey}`;
    const { bucketName, objectName } = this.parseObjectPath(fullPath);

    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new StorageError(
        `Failed to generate upload URL: ${response.status}`,
        StorageErrorCode.CONNECTION_ERROR,
        objectKey,
        this.name
      );
    }

    const { signed_url } = await response.json();
    return { uploadUrl: signed_url, objectKey };
  }

  async getAclPolicy(key: string): Promise<ObjectAclPolicy | null> {
    const file = this.getFile(key);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [metadata] = await file.getMetadata();
    const aclPolicyStr = metadata?.metadata?.["custom:aclPolicy"];
    if (!aclPolicyStr) {
      return null;
    }

    try {
      const parsed = JSON.parse(aclPolicyStr as string);
      return {
        visibility: parsed.visibility === "public" ? ObjectVisibility.PUBLIC : ObjectVisibility.PRIVATE,
        allowedUsers: parsed.owner ? [parsed.owner] : undefined,
      };
    } catch {
      return null;
    }
  }

  async setAclPolicy(key: string, policy: ObjectAclPolicy): Promise<void> {
    const file = this.getFile(key);
    const [exists] = await file.exists();
    if (!exists) {
      throw new StorageError(
        `Object not found: ${key}`,
        StorageErrorCode.NOT_FOUND,
        key,
        this.name
      );
    }

    const aclPolicy = {
      owner: policy.allowedUsers?.[0] || "",
      visibility: policy.visibility === ObjectVisibility.PUBLIC ? "public" : "private",
    };

    await file.setMetadata({
      metadata: {
        "custom:aclPolicy": JSON.stringify(aclPolicy),
      },
    });
  }

  async canAccess(key: string, userId: string | undefined, permission: ObjectPermission): Promise<boolean> {
    const policy = await this.getAclPolicy(key);
    if (!policy) {
      return false;
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
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.privateObjectDir;
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async searchPublicObject(filePath: string): Promise<{ key: string; metadata: StorageMetadata } | null> {
    const client = this.getClient();
    
    for (const searchPath of this.publicSearchPaths) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = this.parseObjectPath(fullPath);
      const bucket = client.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        const [meta] = await file.getMetadata();
        return {
          key: fullPath,
          metadata: {
            contentType: meta.contentType as string | undefined,
            size: meta.size ? Number(meta.size) : undefined,
            lastModified: meta.updated ? new Date(meta.updated as string) : undefined,
          },
        };
      }
    }

    return null;
  }

  getRawFile(key: string): File {
    return this.getFile(key);
  }

  getPublicSearchPaths(): string[] {
    return this.publicSearchPaths;
  }

  getPrivateObjectDir(): string {
    return this.privateObjectDir;
  }
}

registerStorageProvider(StorageProviderType.REPLIT, async (config) => {
  return new ReplitStorageProvider();
});
