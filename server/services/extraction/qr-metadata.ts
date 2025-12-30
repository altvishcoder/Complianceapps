import type { QRCodeData, ImageMetadata } from './types';

type JsQRFunction = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

export interface QRMetadataResult {
  qrCodes: QRCodeData[];
  metadata: ImageMetadata | null;
  hasVerificationData: boolean;
  extractedData: Record<string, string>;
}

const QR_PROVIDER_PATTERNS: { provider: QRCodeData['provider']; pattern: RegExp }[] = [
  { provider: 'gas-safe', pattern: /gassaferegister\.co\.uk\/check\/(\w+)/i },
  { provider: 'gas-tag', pattern: /gastag\.co\.uk\/verify\/(.+)/i },
  { provider: 'niceic', pattern: /niceic\.com\/verify\/(\w+)/i },
  { provider: 'corgi', pattern: /corgi.*\.co\.uk.*verify/i },
];

export function parseQRContent(rawData: string): QRCodeData {
  for (const { provider, pattern } of QR_PROVIDER_PATTERNS) {
    const match = rawData.match(pattern);
    if (match) {
      return {
        provider,
        url: rawData.startsWith('http') ? rawData : null,
        verificationCode: match[1] || null,
        rawData,
      };
    }
  }

  return {
    provider: 'other',
    url: rawData.startsWith('http') ? rawData : null,
    verificationCode: null,
    rawData,
  };
}

async function scanImageBufferForQR(buffer: Buffer): Promise<QRCodeData[]> {
  const qrCodes: QRCodeData[] = [];
  
  try {
    const jsQRModule = await import('jsqr').catch(() => null);
    const jsQR: JsQRFunction | null = jsQRModule ? (jsQRModule.default || jsQRModule) : null;
    const sharpModule = await import('sharp').catch(() => null);
    
    if (!jsQR || !sharpModule) {
      return qrCodes;
    }
    
    const sharp = sharpModule.default;
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      return qrCodes;
    }
    
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const clampedArray = new Uint8ClampedArray(data);
    const code = jsQR(clampedArray, info.width, info.height);
    
    if (code) {
      qrCodes.push(parseQRContent(code.data));
    }
  } catch (error) {
    console.warn('Image QR scan failed:', error);
  }
  
  return qrCodes;
}

export async function extractQRCodes(buffer: Buffer, mimeType?: string): Promise<QRCodeData[]> {
  const qrCodes: QRCodeData[] = [];

  try {
    if (mimeType?.startsWith('image/') || isImageBuffer(buffer)) {
      const imageQRs = await scanImageBufferForQR(buffer);
      qrCodes.push(...imageQRs);
      return qrCodes;
    }

    if (mimeType === 'application/pdf' || isPdfBuffer(buffer)) {
      const sharpModule = await import('sharp').catch(() => null);
      const jsQRModule = await import('jsqr').catch(() => null);
      
      if (!sharpModule || !jsQRModule) {
        return qrCodes;
      }
      
      const jsQR: JsQRFunction = jsQRModule.default || jsQRModule;
      const sharp = sharpModule.default;

      try {
        const pdfImages = await sharp(buffer, { pages: -1 })
          .png()
          .toBuffer({ resolveWithObject: true });
        
        const { data, info } = await sharp(pdfImages.data)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        const clampedArray = new Uint8ClampedArray(data);
        const code = jsQR(clampedArray, info.width, info.height);
        
        if (code) {
          qrCodes.push(parseQRContent(code.data));
        }
      } catch (pdfError) {
        console.debug('PDF QR extraction not available:', pdfError);
      }
    }
  } catch (error) {
    console.warn('QR code extraction failed:', error);
  }

  return qrCodes;
}

function isImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return true;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  if (buffer.slice(0, 4).toString() === 'GIF8') return true;
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return true;
  return false;
}

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.slice(0, 5).toString() === '%PDF-';
}

export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata | null> {
  try {
    const ExifReaderModule = await import('exifreader').catch(() => null);
    const ExifReader: { load: (data: Buffer) => Record<string, { description?: string }> } | null = 
      ExifReaderModule ? (ExifReaderModule.default || ExifReaderModule) : null;

    if (!ExifReader) {
      return null;
    }

    const tags = ExifReader.load(buffer);

    return {
      dateTaken: tags['DateTimeOriginal']?.description
        ? new Date(tags['DateTimeOriginal'].description)
        : null,
      gpsCoordinates: tags['GPSLatitude'] && tags['GPSLongitude']
        ? {
            lat: parseFloat(String(tags['GPSLatitude'].description)),
            lng: parseFloat(String(tags['GPSLongitude'].description)),
          }
        : null,
      device: [tags['Make']?.description, tags['Model']?.description]
        .filter(Boolean)
        .join(' ') || null,
      software: tags['Software']?.description || null,
    };
  } catch (error) {
    console.warn('Metadata extraction failed:', error);
    return null;
  }
}

export async function extractQRAndMetadata(buffer: Buffer, mimeType?: string): Promise<QRMetadataResult> {
  const [qrCodes, metadata] = await Promise.all([
    extractQRCodes(buffer, mimeType),
    extractImageMetadata(buffer),
  ]);

  const extractedData: Record<string, string> = {};
  let hasVerificationData = false;

  for (const qr of qrCodes) {
    if (qr.provider === 'gas-safe' && qr.verificationCode) {
      extractedData.gasSafeId = qr.verificationCode;
      hasVerificationData = true;
    }
    if (qr.provider === 'gas-tag' && qr.verificationCode) {
      extractedData.gasTagRef = qr.verificationCode;
      hasVerificationData = true;
    }
    if (qr.provider === 'niceic' && qr.verificationCode) {
      extractedData.niceicRef = qr.verificationCode;
      hasVerificationData = true;
    }
    if (qr.url) {
      extractedData.verificationUrl = qr.url;
      hasVerificationData = true;
    }
  }

  if (metadata) {
    if (metadata.dateTaken) {
      extractedData.photoDate = metadata.dateTaken.toISOString().split('T')[0];
    }
    if (metadata.gpsCoordinates) {
      extractedData.latitude = String(metadata.gpsCoordinates.lat);
      extractedData.longitude = String(metadata.gpsCoordinates.lng);
    }
    if (metadata.software) {
      extractedData.generatingSoftware = metadata.software;
      if (metadata.software.toLowerCase().includes('gas')) {
        hasVerificationData = true;
      }
    }
  }

  return {
    qrCodes,
    metadata,
    hasVerificationData,
    extractedData,
  };
}
