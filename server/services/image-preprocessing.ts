import sharp from 'sharp';
import { logger } from '../logger';

const preprocessLogger = logger.child({ component: 'image-preprocessing' });

export interface PreprocessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  sharpen?: boolean;
  normalize?: boolean;
  grayscale?: boolean;
  deskew?: boolean;
  outputFormat?: 'jpeg' | 'png' | 'webp';
}

export interface PreprocessingResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  originalSize: number;
  processedSize: number;
  processingTimeMs: number;
  operations: string[];
}

const DEFAULT_OPTIONS: PreprocessingOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 85,
  sharpen: true,
  normalize: true,
  grayscale: false,
  deskew: false,
  outputFormat: 'jpeg',
};

export async function preprocessImage(
  inputBuffer: Buffer,
  options: PreprocessingOptions = {}
): Promise<PreprocessingResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const operations: string[] = [];
  
  try {
    const originalSize = inputBuffer.length;
    let pipeline = sharp(inputBuffer);
    
    const metadata = await pipeline.metadata();
    preprocessLogger.debug({
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      format: metadata.format,
    }, 'Starting image preprocessing');

    if (opts.normalize) {
      pipeline = pipeline.normalize();
      operations.push('normalize');
    }

    if (opts.sharpen) {
      pipeline = pipeline.sharpen({
        sigma: 1.0,
        m1: 0.5,
        m2: 0.5,
      });
      operations.push('sharpen');
    }

    if (opts.grayscale) {
      pipeline = pipeline.grayscale();
      operations.push('grayscale');
    }

    const needsResize = metadata.width && metadata.height && 
      (metadata.width > (opts.maxWidth || 2048) || metadata.height > (opts.maxHeight || 2048));
    
    if (needsResize) {
      pipeline = pipeline.resize({
        width: opts.maxWidth,
        height: opts.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
      operations.push(`resize(max: ${opts.maxWidth}x${opts.maxHeight})`);
    }

    switch (opts.outputFormat) {
      case 'png':
        pipeline = pipeline.png({ quality: opts.quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality: opts.quality });
        break;
      case 'jpeg':
      default:
        pipeline = pipeline.jpeg({ quality: opts.quality, mozjpeg: true });
        break;
    }
    operations.push(`format(${opts.outputFormat})`);

    const outputBuffer = await pipeline.toBuffer({ resolveWithObject: true });
    const processingTimeMs = Date.now() - startTime;

    preprocessLogger.info({
      originalSize,
      processedSize: outputBuffer.info.size,
      compressionRatio: (originalSize / outputBuffer.info.size).toFixed(2),
      operations,
      processingTimeMs,
    }, 'Image preprocessing completed');

    return {
      buffer: outputBuffer.data,
      width: outputBuffer.info.width,
      height: outputBuffer.info.height,
      format: outputBuffer.info.format,
      originalSize,
      processedSize: outputBuffer.info.size,
      processingTimeMs,
      operations,
    };
  } catch (error) {
    preprocessLogger.error({ error }, 'Image preprocessing failed');
    throw error;
  }
}

export async function preprocessForClaudeVision(
  inputBuffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; base64: string; mimeType: string }> {
  const isImage = mimeType.startsWith('image/');
  
  if (!isImage) {
    return {
      buffer: inputBuffer,
      base64: inputBuffer.toString('base64'),
      mimeType,
    };
  }

  const outputFormat = mimeType === 'image/png' ? 'png' : 'jpeg';
  
  const result = await preprocessImage(inputBuffer, {
    maxWidth: 1568,
    maxHeight: 1568,
    quality: 90,
    sharpen: true,
    normalize: true,
    grayscale: false,
    outputFormat,
  });

  const outputMimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';

  return {
    buffer: result.buffer,
    base64: result.buffer.toString('base64'),
    mimeType: outputMimeType,
  };
}

export async function getImageMetadata(inputBuffer: Buffer): Promise<{
  width: number | undefined;
  height: number | undefined;
  format: string | undefined;
  size: number;
  hasAlpha: boolean;
  orientation: number | undefined;
}> {
  const metadata = await sharp(inputBuffer).metadata();
  
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: inputBuffer.length,
    hasAlpha: metadata.hasAlpha || false,
    orientation: metadata.orientation,
  };
}
