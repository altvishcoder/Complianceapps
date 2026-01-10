import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { Readable } from "stream";
import type { Response } from "express";
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
  LocalStorageConfig,
} from "./types";
import { registerStorageProvider } from "./factory";

export class LocalStorageProvider implements IStorageProvider {
  readonly name = "Local Filesystem Storage";
  readonly type = StorageProviderType.LOCAL;
  
  private basePath: string = "./data/storage";
  private publicUrlBase: string | null = null;
  private publicBucket: string = "public";
  private privateBucket: string = ".private";

  constructor(config?: Partial<LocalStorageConfig>) {
    if (config?.basePath) this.basePath = config.basePath;
    if (config?.publicUrlBase) this.publicUrlBase = config.publicUrlBase;
    if (config?.publicBucket) this.publicBucket = config.publicBucket;
    if (config?.privateBucket) this.privateBucket = config.privateBucket;
  }

  async initialize(): Promise<void> {
    this.basePath = process.env.LOCAL_STORAGE_PATH || this.basePath;
    this.publicUrlBase = process.env.LOCAL_STORAGE_PUBLIC_URL || null;
    
    const publicDir = path.join(this.basePath, this.publicBucket);
    const privateDir = path.join(this.basePath, this.privateBucket, "uploads");
    
    await fs.mkdir(publicDir, { recursive: true });
    await fs.mkdir(privateDir, { recursive: true });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.basePath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  private resolvePath(key: string): string {
    const safePath = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.basePath, this.privateBucket, safePath);
  }

  private resolvePublicPath(key: string): string {
    const safePath = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.basePath, this.publicBucket, safePath);
  }

  async upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string> {
    try {
      const isPublic = options?.isPublic ?? false;
      const filePath = isPublic ? this.resolvePublicPath(key) : this.resolvePath(key);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      if (Buffer.isBuffer(data)) {
        await fs.writeFile(filePath, data);
      } else {
        await new Promise<void>((resolve, reject) => {
          const writeStream = fsSync.createWriteStream(filePath);
          data.pipe(writeStream);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
      }

      const metadataPath = `${filePath}.meta.json`;
      await fs.writeFile(metadataPath, JSON.stringify({
        contentType: options?.contentType || "application/octet-stream",
        metadata: options?.metadata,
        uploadedAt: new Date().toISOString(),
        visibility: isPublic ? ObjectVisibility.PUBLIC : ObjectVisibility.PRIVATE,
      }));

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
      const filePath = this.resolvePath(key);
      
      try {
        await fs.access(filePath);
      } catch {
        throw new StorageError(
          `Object not found: ${key}`,
          StorageErrorCode.NOT_FOUND,
          key,
          this.name
        );
      }

      const stats = await fs.stat(filePath);
      const metadata = await this.loadMetadata(filePath);
      
      const stream = fsSync.createReadStream(filePath);

      return {
        data: stream,
        metadata: {
          contentType: metadata.contentType || "application/octet-stream",
          size: stats.size,
          lastModified: stats.mtime,
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
      const filePath = this.resolvePath(key);
      
      try {
        await fs.access(filePath);
      } catch {
        throw new StorageError(
          `Object not found: ${key}`,
          StorageErrorCode.NOT_FOUND,
          key,
          this.name
        );
      }

      const stats = await fs.stat(filePath);
      const metadata = await this.loadMetadata(filePath);
      const cacheTtl = options?.cacheTtlSec ?? 3600;

      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": String(stats.size),
        "Cache-Control": `private, max-age=${cacheTtl}`,
      });

      const stream = fsSync.createReadStream(filePath);
      stream.on("error", (err) => {
        console.error("[LocalStorage] Stream error:", err);
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
      const filePath = this.resolvePath(key);
      const metadataPath = `${filePath}.meta.json`;
      
      await fs.unlink(filePath).catch(() => {});
      await fs.unlink(metadataPath).catch(() => {});
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
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    const filePath = this.resolvePath(key);
    
    try {
      await fs.access(filePath);
    } catch {
      throw new StorageError(
        `Object not found: ${key}`,
        StorageErrorCode.NOT_FOUND,
        key,
        this.name
      );
    }

    const stats = await fs.stat(filePath);
    const metadata = await this.loadMetadata(filePath);
    
    return {
      contentType: metadata.contentType || "application/octet-stream",
      size: stats.size,
      lastModified: stats.mtime,
    };
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${key}?expires=${Date.now() + options.ttlSec * 1000}`;
    }
    throw new StorageError(
      "Signed URLs not supported without PUBLIC_URL_BASE configuration",
      StorageErrorCode.CONFIGURATION_ERROR,
      key,
      this.name
    );
  }

  async list(options?: ListOptions): Promise<ListResult> {
    const prefix = options?.prefix || "";
    const basePath = this.resolvePath(prefix);
    
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const objects: StorageObject[] = [];
      
      for (const entry of entries) {
        if (entry.isFile() && !entry.name.endsWith(".meta.json")) {
          const key = path.join(prefix, entry.name);
          const filePath = path.join(basePath, entry.name);
          const stats = await fs.stat(filePath);
          const metadata = await this.loadMetadata(filePath);
          
          objects.push({
            key,
            metadata: {
              contentType: metadata.contentType,
              size: stats.size,
              lastModified: stats.mtime,
            },
          });
        }
      }
      
      return { objects };
    } catch {
      return { objects: [] };
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    const sourcePath = this.resolvePath(sourceKey);
    const destPath = this.resolvePath(destinationKey);
    
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourcePath, destPath);
    
    const sourceMetaPath = `${sourcePath}.meta.json`;
    const destMetaPath = `${destPath}.meta.json`;
    try {
      await fs.copyFile(sourceMetaPath, destMetaPath);
    } catch {
    }
  }

  async setVisibility(key: string, visibility: ObjectVisibility): Promise<void> {
    const filePath = this.resolvePath(key);
    const metadata = await this.loadMetadata(filePath);
    metadata.visibility = visibility;
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata));
  }

  getPublicUrl(key: string): string | null {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${this.publicBucket}/${key}`;
    }
    return null;
  }

  async getUploadUrl(prefix?: string, ttlSec: number = 900): Promise<{ uploadUrl: string; objectKey: string }> {
    const { randomUUID } = await import("crypto");
    const objectId = randomUUID();
    const objectKey = prefix ? `${prefix}/${objectId}` : `uploads/${objectId}`;
    
    if (this.publicUrlBase) {
      return {
        uploadUrl: `${this.publicUrlBase}/upload/${objectKey}`,
        objectKey,
      };
    }
    
    throw new StorageError(
      "Upload URLs not supported without PUBLIC_URL_BASE configuration for local storage",
      StorageErrorCode.CONFIGURATION_ERROR,
      objectKey,
      this.name
    );
  }

  async getAclPolicy(key: string): Promise<ObjectAclPolicy | null> {
    const filePath = this.resolvePath(key);
    const metadata = await this.loadMetadata(filePath);
    
    if (!metadata.visibility) {
      return null;
    }

    return {
      visibility: metadata.visibility,
    };
  }

  async setAclPolicy(key: string, policy: ObjectAclPolicy): Promise<void> {
    const filePath = this.resolvePath(key);
    const metadata = await this.loadMetadata(filePath);
    metadata.visibility = policy.visibility;
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata));
  }

  async canAccess(key: string, userId: string | undefined, permission: ObjectPermission): Promise<boolean> {
    const policy = await this.getAclPolicy(key);
    if (!policy) {
      return false;
    }

    if (policy.visibility === ObjectVisibility.PUBLIC && permission === ObjectPermission.READ) {
      return true;
    }

    return userId !== undefined;
  }

  normalizeEntityPath(rawPath: string): string {
    if (!rawPath.startsWith(this.basePath)) {
      return rawPath;
    }
    const entityId = rawPath.slice(this.basePath.length + this.privateBucket.length + 2);
    return `/objects/${entityId}`;
  }

  async searchPublicObject(filePath: string): Promise<{ key: string; metadata: StorageMetadata } | null> {
    const publicPath = this.resolvePublicPath(filePath);
    
    try {
      await fs.access(publicPath);
      const stats = await fs.stat(publicPath);
      const metadata = await this.loadMetadata(publicPath);
      
      return {
        key: filePath,
        metadata: {
          contentType: metadata.contentType || "application/octet-stream",
          size: stats.size,
          lastModified: stats.mtime,
        },
      };
    } catch {
      return null;
    }
  }

  private async loadMetadata(filePath: string): Promise<{ contentType?: string; metadata?: Record<string, string>; visibility?: ObjectVisibility }> {
    const metadataPath = `${filePath}.meta.json`;
    try {
      const content = await fs.readFile(metadataPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}

registerStorageProvider(StorageProviderType.LOCAL, async (config) => {
  return new LocalStorageProvider(config as LocalStorageConfig);
});
