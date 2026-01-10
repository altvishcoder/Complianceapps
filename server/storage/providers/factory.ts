import {
  IStorageProvider,
  StorageProviderType,
  AnyStorageConfig,
  StorageError,
  StorageErrorCode,
} from "./types";

let globalProvider: IStorageProvider | null = null;
const providerRegistry = new Map<StorageProviderType, (config: AnyStorageConfig) => Promise<IStorageProvider>>();

export function registerStorageProvider(
  type: StorageProviderType,
  factory: (config: AnyStorageConfig) => Promise<IStorageProvider>
): void {
  providerRegistry.set(type, factory);
}

export async function createStorageProvider(
  config: AnyStorageConfig
): Promise<IStorageProvider> {
  const factory = providerRegistry.get(config.type);
  
  if (!factory) {
    throw new StorageError(
      `Storage provider type '${config.type}' is not registered. ` +
      `Available providers: ${Array.from(providerRegistry.keys()).join(", ")}`,
      StorageErrorCode.CONFIGURATION_ERROR,
      undefined,
      config.type
    );
  }
  
  const provider = await factory(config);
  await provider.initialize();
  
  const isHealthy = await provider.healthCheck();
  if (!isHealthy) {
    throw new StorageError(
      `Storage provider '${provider.name}' failed health check`,
      StorageErrorCode.PROVIDER_UNAVAILABLE,
      undefined,
      provider.name
    );
  }
  
  return provider;
}

export function getStorageConfigFromEnv(): AnyStorageConfig {
  const providerType = (process.env.STORAGE_PROVIDER || "replit").toLowerCase();
  
  switch (providerType) {
    case "replit":
      return {
        type: StorageProviderType.REPLIT,
        publicBucket: process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",")[0]?.trim(),
        privateBucket: process.env.PRIVATE_OBJECT_DIR,
      };
      
    case "s3":
      return {
        type: StorageProviderType.S3,
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        publicBucket: process.env.S3_PUBLIC_BUCKET,
        privateBucket: process.env.S3_PRIVATE_BUCKET,
      };
      
    case "azure":
    case "azure_blob":
      return {
        type: StorageProviderType.AZURE_BLOB,
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
        accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
        publicBucket: process.env.AZURE_PUBLIC_CONTAINER,
        privateBucket: process.env.AZURE_PRIVATE_CONTAINER,
      };
      
    case "gcs":
      return {
        type: StorageProviderType.GCS,
        projectId: process.env.GCP_PROJECT_ID || "",
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        publicBucket: process.env.GCS_PUBLIC_BUCKET,
        privateBucket: process.env.GCS_PRIVATE_BUCKET,
      };
      
    case "local":
      return {
        type: StorageProviderType.LOCAL,
        basePath: process.env.LOCAL_STORAGE_PATH || "./data/storage",
        publicUrlBase: process.env.LOCAL_STORAGE_PUBLIC_URL,
        publicBucket: "public",
        privateBucket: ".private",
      };
      
    default:
      throw new StorageError(
        `Unknown storage provider type: ${providerType}. ` +
        `Supported types: replit, s3, azure, gcs, local`,
        StorageErrorCode.CONFIGURATION_ERROR
      );
  }
}

export async function initializeGlobalStorage(
  config?: AnyStorageConfig
): Promise<IStorageProvider> {
  const effectiveConfig = config || getStorageConfigFromEnv();
  globalProvider = await createStorageProvider(effectiveConfig);
  console.log(`[Storage] Initialized ${globalProvider.name} provider`);
  return globalProvider;
}

export function getStorage(): IStorageProvider {
  if (!globalProvider) {
    throw new StorageError(
      "Storage provider not initialized. Call initializeGlobalStorage() first.",
      StorageErrorCode.CONFIGURATION_ERROR
    );
  }
  return globalProvider;
}

export function hasStorage(): boolean {
  return globalProvider !== null;
}
