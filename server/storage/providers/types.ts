import type { Readable } from "stream";
import type { Response } from "express";

export interface StorageMetadata {
  contentType?: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
  customMetadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  metadata: StorageMetadata;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

export interface DownloadOptions {
  cacheTtlSec?: number;
}

export interface SignedUrlOptions {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
  contentType?: string;
}

export interface ListOptions {
  prefix?: string;
  maxResults?: number;
  cursor?: string;
}

export interface ListResult {
  objects: StorageObject[];
  nextCursor?: string;
}

export enum ObjectVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
  DELETE = "delete",
}

export interface ObjectAclPolicy {
  visibility: ObjectVisibility;
  allowedUsers?: string[];
  allowedRoles?: string[];
}

export interface IStorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;
  readonly supportsInPlaceVisibilityChange: boolean;
  
  initialize(): Promise<void>;
  
  healthCheck(): Promise<boolean>;
  
  upload(key: string, data: Buffer | Readable, options?: UploadOptions): Promise<string>;
  
  download(key: string): Promise<{ data: Readable; metadata: StorageMetadata }>;
  
  streamToResponse(key: string, res: Response, options?: DownloadOptions): Promise<void>;
  
  delete(key: string): Promise<void>;
  
  exists(key: string): Promise<boolean>;
  
  getMetadata(key: string): Promise<StorageMetadata>;
  
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  
  getUploadUrl(prefix?: string, ttlSec?: number): Promise<{ uploadUrl: string; objectKey: string }>;
  
  list(options?: ListOptions): Promise<ListResult>;
  
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  
  setVisibility(key: string, visibility: ObjectVisibility): Promise<void>;
  
  getPublicUrl(key: string): string | null;
  
  getAclPolicy(key: string): Promise<ObjectAclPolicy | null>;
  
  setAclPolicy(key: string, policy: ObjectAclPolicy): Promise<void>;
  
  canAccess(key: string, userId: string | undefined, permission: ObjectPermission): Promise<boolean>;
  
  normalizeEntityPath(rawPath: string): string;
  
  searchPublicObject(filePath: string): Promise<{ key: string; metadata: StorageMetadata } | null>;
}

export enum StorageProviderType {
  REPLIT = "replit",
  S3 = "s3",
  AZURE_BLOB = "azure_blob",
  GCS = "gcs",
  LOCAL = "local",
}

export interface StorageProviderConfig {
  type: StorageProviderType;
  publicBucket?: string;
  privateBucket?: string;
}

export interface ReplitStorageConfig extends StorageProviderConfig {
  type: StorageProviderType.REPLIT;
}

export interface S3StorageConfig extends StorageProviderConfig {
  type: StorageProviderType.S3;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface AzureBlobStorageConfig extends StorageProviderConfig {
  type: StorageProviderType.AZURE_BLOB;
  accountName: string;
  accountKey?: string;
  connectionString?: string;
}

export interface GCSStorageConfig extends StorageProviderConfig {
  type: StorageProviderType.GCS;
  projectId: string;
  keyFilename?: string;
  credentials?: object;
}

export interface LocalStorageConfig extends StorageProviderConfig {
  type: StorageProviderType.LOCAL;
  basePath: string;
  publicUrlBase?: string;
}

export type AnyStorageConfig = 
  | ReplitStorageConfig 
  | S3StorageConfig 
  | AzureBlobStorageConfig 
  | GCSStorageConfig 
  | LocalStorageConfig;

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly key?: string,
    public readonly provider?: string
  ) {
    super(message);
    this.name = "StorageError";
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export enum StorageErrorCode {
  NOT_FOUND = "NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INVALID_KEY = "INVALID_KEY",
  UPLOAD_FAILED = "UPLOAD_FAILED",
  DOWNLOAD_FAILED = "DOWNLOAD_FAILED",
  DELETE_FAILED = "DELETE_FAILED",
  CONNECTION_ERROR = "CONNECTION_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
}
