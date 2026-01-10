export * from "./types";
export * from "./factory";

import { registerStorageProvider } from "./factory";
import { StorageProviderType, AnyStorageConfig, S3StorageConfig, AzureBlobStorageConfig, LocalStorageConfig } from "./types";

export function registerAllStorageProviders(): void {
  registerStorageProvider(StorageProviderType.REPLIT, async () => {
    const { ReplitStorageProvider } = await import("./replit");
    return new ReplitStorageProvider();
  });

  registerStorageProvider(StorageProviderType.LOCAL, async (config: AnyStorageConfig) => {
    const { LocalStorageProvider } = await import("./local");
    const localConfig = config as LocalStorageConfig;
    return new LocalStorageProvider(localConfig.basePath, localConfig.publicUrlBase);
  });

  registerStorageProvider(StorageProviderType.S3, async (config: AnyStorageConfig) => {
    const { S3StorageProvider } = await import("./s3");
    return new S3StorageProvider(config as S3StorageConfig);
  });

  registerStorageProvider(StorageProviderType.AZURE_BLOB, async (config: AnyStorageConfig) => {
    const { AzureBlobStorageProvider } = await import("./azure-blob");
    return new AzureBlobStorageProvider(config as AzureBlobStorageConfig);
  });
}

registerAllStorageProviders();
