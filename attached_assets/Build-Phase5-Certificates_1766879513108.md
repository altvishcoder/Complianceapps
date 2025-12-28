# ComplianceAI™ Build Guide — Phase 5
## Certificate Upload & AI Processing

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Day 5-7 |
| **Objective** | Upload UI, storage, AI extraction pipeline |
| **Prerequisites** | Phase 4 complete |
| **Outcome** | End-to-end certificate processing |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│              CERTIFICATE PROCESSING FLOW                │
│                                                         │
│   Step 1: UPLOAD                                        │
│   ┌─────────────────────────────────────────────────┐  │
│   │  Drag & Drop Zone                               │  │
│   │  Property Selection                             │  │
│   │  Compliance Stream Selection                    │  │
│   └─────────────────────────────────────────────────┘  │
│                      │                                  │
│                      ▼                                  │
│   Step 2: PROCESSING                                    │
│   ┌─────────────────────────────────────────────────┐  │
│   │  Uploading... → Analysing... → Extracting...   │  │
│   └─────────────────────────────────────────────────┘  │
│                      │                                  │
│                      ▼                                  │
│   Step 3: REVIEW                                        │
│   ┌──────────────────┬──────────────────────────────┐  │
│   │  PDF Viewer      │  Extracted Data Form         │  │
│   │                  │  - Certificate Number        │  │
│   │                  │  - Inspection Date           │  │
│   │                  │  - Expiry Date               │  │
│   │                  │  - Outcome                   │  │
│   │                  │  [Approve] [Reject]          │  │
│   └──────────────────┴──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Storage Utility

### Prompt 5.1: S3/R2 Storage

```
Create the file storage utility for Cloudflare R2.

Create src/lib/storage.ts:

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
});

const BUCKET = process.env.S3_BUCKET || 'compliance-documents';

export async function uploadFile(
  file: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: path,
    Body: file,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  return path;
}

export async function getFile(path: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: path,
  });
  
  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];
  
  // @ts-ignore - ReadableStream
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

export async function getFileUrl(path: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: path,
  });
  
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(path: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: path,
  });
  
  await s3Client.send(command);
}

export function generateStoragePath(
  organisationId: string,
  propertyId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${organisationId}/${propertyId}/${timestamp}-${sanitizedFilename}`;
}

Install the AWS SDK:
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## Step 2: Create Upload UI

### Prompt 5.2: Upload Dropzone Component

```
Create the drag-and-drop upload component.

Create src/components/features/certificates/UploadDropzone.tsx:

'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClear: () => void;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export function UploadDropzone({ onFileSelect, selectedFile, onClear }: UploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);
      
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('File is too large. Maximum size is 20MB.');
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload a PDF, PNG, or JPG.');
        } else {
          setError('Invalid file.');
        }
        return;
      }
      
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
  });
  
  if (selectedFile) {
    return (
      <div className="border-2 border-dashed border-green-300 bg-green-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <File className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop the file here' : 'Drag & drop your certificate'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse • PDF, PNG, JPG up to 20MB
            </p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

Install react-dropzone:
npm install react-dropzone
```

### Prompt 5.3: Upload Page

```
Create the complete certificate upload page.

Create src/app/(dashboard)/certificates/upload/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/features/Header';
import { UploadDropzone } from '@/components/features/certificates/UploadDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface Property {
  id: string;
  addressLine1: string;
  postcode: string;
}

interface ComplianceStream {
  id: string;
  code: string;
  name: string;
}

type Step = 'upload' | 'processing' | 'review';

export default function CertificateUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPropertyId = searchParams.get('propertyId');
  
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [propertyId, setPropertyId] = useState(preselectedPropertyId || '');
  const [streamId, setStreamId] = useState('');
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [streams, setStreams] = useState<ComplianceStream[]>([]);
  
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  
  // Load properties and streams
  useEffect(() => {
    fetch('/api/properties?pageSize=100')
      .then((res) => res.json())
      .then((data) => setProperties(data.properties || []));
    
    fetch('/api/compliance-streams')
      .then((res) => res.json())
      .then((data) => setStreams(data.streams || []));
  }, []);
  
  const handleUpload = async () => {
    if (!file || !propertyId || !streamId) return;
    
    setError('');
    setUploading(true);
    setStep('processing');
    setProgress(10);
    setStatusMessage('Uploading document...');
    
    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('propertyId', propertyId);
      formData.append('complianceStreamId', streamId);
      
      const uploadRes = await fetch('/api/certificates/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }
      
      const { certificateId } = await uploadRes.json();
      setCertificateId(certificateId);
      
      setProgress(30);
      setStatusMessage('Analysing document with AI...');
      
      // Step 2: Process with AI
      setProcessing(true);
      const processRes = await fetch(`/api/certificates/${certificateId}/process`, {
        method: 'POST',
      });
      
      setProgress(70);
      setStatusMessage('Extracting compliance data...');
      
      if (!processRes.ok) {
        throw new Error('Processing failed');
      }
      
      const { extraction } = await processRes.json();
      setExtractedData(extraction);
      
      setProgress(100);
      setStatusMessage('Complete!');
      
      // Move to review step after brief delay
      setTimeout(() => {
        setStep('review');
      }, 500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('upload');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };
  
  const handleApprove = async () => {
    if (!certificateId) return;
    
    try {
      const res = await fetch(`/api/certificates/${certificateId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedData }),
      });
      
      if (!res.ok) {
        throw new Error('Approval failed');
      }
      
      router.push(`/properties/${propertyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Upload Certificate" />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6">
            <Link href="/certificates" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Certificates
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900">Upload</span>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {['upload', 'processing', 'review'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s ? 'bg-blue-600 text-white' :
                  ['upload', 'processing', 'review'].indexOf(step) > i ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {['upload', 'processing', 'review'].indexOf(step) > i ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && <div className="w-16 h-1 bg-gray-200 mx-2" />}
              </div>
            ))}
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
          
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Certificate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <UploadDropzone
                  onFileSelect={setFile}
                  selectedFile={file}
                  onClear={() => setFile(null)}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property *</Label>
                    <Select value={propertyId} onValueChange={setPropertyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.addressLine1}, {p.postcode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Compliance Stream *</Label>
                    <Select value={streamId} onValueChange={setStreamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {streams.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={handleUpload}
                    disabled={!file || !propertyId || !streamId || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Process with AI
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step 2: Processing */}
          {step === 'processing' && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">{statusMessage}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      This may take up to 30 seconds
                    </p>
                  </div>
                  <Progress value={progress} className="w-64 mx-auto" />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step 3: Review */}
          {step === 'review' && extractedData && (
            <div className="grid grid-cols-2 gap-6">
              {/* PDF Preview - placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle>Document</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">PDF Preview</p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Extracted Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Extracted Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-500">Certificate Number</Label>
                      <p className="font-medium">{extractedData.certificateNumber || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Outcome</Label>
                      <p className="font-medium">{extractedData.outcome || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Inspection Date</Label>
                      <p className="font-medium">{extractedData.inspectionDate || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Next Due</Label>
                      <p className="font-medium">{extractedData.nextDueDate || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Engineer</Label>
                      <p className="font-medium">{extractedData.engineerName || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">Contractor</Label>
                      <p className="font-medium">{extractedData.contractor || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setStep('upload')}>
                      Re-upload
                    </Button>
                    <Button onClick={handleApprove}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 3: Create Certificate APIs

### Prompt 5.4: Upload API

```
Create the certificate upload API.

Create src/app/api/certificates/upload/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { uploadFile, generateStoragePath } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const propertyId = formData.get('propertyId') as string;
    const complianceStreamId = formData.get('complianceStreamId') as string;
    
    if (!file || !propertyId || !complianceStreamId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Verify property belongs to org
    const property = await prisma.property.findFirst({
      where: { id: propertyId, organisationId: orgId },
    });
    
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Generate storage path and upload
    const storagePath = generateStoragePath(orgId, propertyId, file.name);
    await uploadFile(buffer, storagePath, file.type);
    
    // Create certificate record
    const certificate = await prisma.certificate.create({
      data: {
        organisationId: orgId,
        propertyId,
        complianceStreamId,
        originalFilename: file.name,
        storagePath,
        fileSize: file.size,
        mimeType: file.type,
        uploadedById: session.user.id,
        processingStatus: 'PENDING',
      },
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        organisationId: orgId,
        userId: session.user.id,
        action: 'UPLOAD',
        entityType: 'Certificate',
        entityId: certificate.id,
        newData: { filename: file.name, propertyId, complianceStreamId } as any,
      },
    });
    
    return NextResponse.json({ certificateId: certificate.id });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Prompt 5.5: Process API

```
Create the certificate processing API that calls AI.

Create src/app/api/certificates/[id]/process/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { getFile } from '@/lib/storage';
import { extractFromDocument } from '@/lib/ai/extractor';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    // Get certificate
    const certificate = await prisma.certificate.findFirst({
      where: { id: params.id, organisationId: orgId },
      include: { complianceStream: true },
    });
    
    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }
    
    // Update status
    await prisma.certificate.update({
      where: { id: params.id },
      data: { processingStatus: 'PROCESSING' },
    });
    
    try {
      // Get file from storage
      const fileBuffer = await getFile(certificate.storagePath);
      
      // Extract using AI
      const result = await extractFromDocument(
        fileBuffer,
        certificate.mimeType,
        certificate.complianceStream.code
      );
      
      // Store extraction
      const extraction = await prisma.extraction.create({
        data: {
          certificateId: params.id,
          rawResponse: result.rawResponse as any,
          extractedData: result.data as any,
          confidence: result.confidence,
          status: result.confidence >= 0.9 ? 'AUTO_APPROVED' : 'PENDING_REVIEW',
        },
      });
      
      // Update certificate status
      await prisma.certificate.update({
        where: { id: params.id },
        data: {
          processingStatus: result.confidence >= 0.9 ? 'COMPLETED' : 'REVIEW_REQUIRED',
          processingTier: result.tier,
          processingCost: result.cost,
        },
      });
      
      // Log processing usage
      await prisma.processingUsage.create({
        data: {
          organisationId: orgId,
          certificateId: params.id,
          tier: result.tier,
          method: result.method,
          cost: result.cost,
          processingTimeMs: result.processingTime,
          success: true,
        },
      });
      
      return NextResponse.json({
        extraction: result.data,
        confidence: result.confidence,
        tier: result.tier,
      });
      
    } catch (processingError) {
      // Update status on failure
      await prisma.certificate.update({
        where: { id: params.id },
        data: { processingStatus: 'FAILED' },
      });
      
      throw processingError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Prompt 5.6: Approve API

```
Create the certificate approval API.

Create src/app/api/certificates/[id]/approve/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { addMonths } from 'date-fns';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const body = await request.json();
    const { extractedData } = body;
    
    // Get certificate with stream
    const certificate = await prisma.certificate.findFirst({
      where: { id: params.id, organisationId: orgId },
      include: { complianceStream: true },
    });
    
    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }
    
    // Parse dates
    const inspectionDate = extractedData.inspectionDate
      ? new Date(extractedData.inspectionDate)
      : new Date();
    
    const nextDueDate = extractedData.nextDueDate
      ? new Date(extractedData.nextDueDate)
      : addMonths(inspectionDate, certificate.complianceStream.defaultFrequencyMonths);
    
    // Determine compliance status
    const now = new Date();
    let status: 'COMPLIANT' | 'DUE_SOON' | 'OVERDUE' = 'COMPLIANT';
    const daysUntilDue = Math.floor((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) {
      status = 'OVERDUE';
    } else if (daysUntilDue <= 30) {
      status = 'DUE_SOON';
    }
    
    // Determine outcome
    const outcome = extractedData.outcome?.toUpperCase() === 'PASS' 
      ? 'PASS' 
      : extractedData.outcome?.toUpperCase() === 'FAIL'
      ? 'FAIL'
      : 'PASS';
    
    // Create compliance record
    const complianceRecord = await prisma.complianceRecord.create({
      data: {
        organisationId: orgId,
        propertyId: certificate.propertyId,
        assetId: certificate.assetId,
        complianceStreamId: certificate.complianceStreamId,
        certificateId: certificate.id,
        status,
        inspectionDate,
        nextDueDate,
        outcome,
        contractor: extractedData.contractor,
        engineerName: extractedData.engineerName,
        certificateNumber: extractedData.certificateNumber,
        defects: extractedData.defects || [],
      },
    });
    
    // Create remedial actions for any defects
    if (extractedData.defects && extractedData.defects.length > 0) {
      for (const defect of extractedData.defects) {
        await prisma.remedialAction.create({
          data: {
            complianceRecordId: complianceRecord.id,
            organisationId: orgId,
            propertyId: certificate.propertyId,
            description: defect.description,
            priority: defect.priority || 'ROUTINE',
            source: 'EXTRACTION',
            dueDate: defect.dueDate ? new Date(defect.dueDate) : addMonths(new Date(), 1),
          },
        });
      }
    }
    
    // Update extraction status
    await prisma.extraction.updateMany({
      where: { certificateId: params.id },
      data: {
        status: 'APPROVED',
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
    
    // Update certificate status
    await prisma.certificate.update({
      where: { id: params.id },
      data: { processingStatus: 'COMPLETED' },
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        organisationId: orgId,
        userId: session.user.id,
        action: 'APPROVE',
        entityType: 'Certificate',
        entityId: params.id,
        newData: { complianceRecordId: complianceRecord.id } as any,
      },
    });
    
    return NextResponse.json({
      success: true,
      complianceRecordId: complianceRecord.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Prompt 5.7: Compliance Streams API

```
Create the compliance streams API.

Create src/app/api/compliance-streams/route.ts:

import { NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await requireAuth();
    
    const streams = await prisma.complianceStream.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    
    return NextResponse.json({ streams });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Step 4: Create AI Extractor

### Prompt 5.8: Claude AI Extractor

```
Create the AI extraction service using Claude.

Create src/lib/ai/extractor.ts:

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractionResult {
  data: any;
  rawResponse: any;
  confidence: number;
  tier: number;
  method: string;
  cost: number;
  processingTime: number;
}

const EXTRACTION_PROMPTS: Record<string, string> = {
  GAS: `Extract the following information from this Gas Safety Certificate (CP12):
- Certificate number
- Inspection date (format: YYYY-MM-DD)
- Next due date (format: YYYY-MM-DD)
- Overall outcome (PASS or FAIL)
- Engineer name
- Engineer Gas Safe ID
- Contractor/company name
- Property address
- List of appliances tested with their outcomes
- Any defects or observations

Return as JSON.`,

  ELECTRICAL: `Extract the following from this Electrical Installation Condition Report (EICR):
- Report reference number
- Date of inspection (format: YYYY-MM-DD)
- Next inspection due (format: YYYY-MM-DD)
- Overall assessment (SATISFACTORY or UNSATISFACTORY)
- Inspector name
- Inspector registration number
- Contractor name
- Property address
- List of observations with codes (C1, C2, C3, FI)
- Any urgent remedial work required

Return as JSON.`,

  FIRE: `Extract the following from this Fire Risk Assessment:
- Assessment reference
- Assessment date (format: YYYY-MM-DD)
- Next review date (format: YYYY-MM-DD)
- Risk rating (Low, Medium, High)
- Assessor name
- Assessor qualifications
- Company name
- Property address
- List of fire risks identified
- Recommended actions with priorities

Return as JSON.`,
};

export async function extractFromDocument(
  buffer: Buffer,
  mimeType: string,
  streamCode: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  const prompt = EXTRACTION_PROMPTS[streamCode] || EXTRACTION_PROMPTS.GAS;
  
  // Convert buffer to base64 for vision
  const base64 = buffer.toString('base64');
  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType === 'application/pdf' ? 'image/png' : mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });
    
    // Parse response
    const textContent = response.content.find(c => c.type === 'text');
    const rawText = textContent?.type === 'text' ? textContent.text : '';
    
    // Extract JSON from response
    let data: any = {};
    let confidence = 0.5;
    
    try {
      // Try to parse JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
        confidence = 0.85; // Base confidence for successful parse
      }
    } catch {
      // If JSON parse fails, try to extract key fields
      data = {
        certificateNumber: extractField(rawText, 'certificate number'),
        inspectionDate: extractField(rawText, 'inspection date'),
        outcome: rawText.toLowerCase().includes('pass') ? 'PASS' : 'FAIL',
      };
      confidence = 0.6;
    }
    
    // Normalize the data
    const normalized = {
      certificateNumber: data.certificateNumber || data.certificate_number || data.reportReference,
      inspectionDate: normalizeDate(data.inspectionDate || data.inspection_date || data.date),
      nextDueDate: normalizeDate(data.nextDueDate || data.next_due_date || data.nextInspection),
      outcome: normalizeOutcome(data.outcome || data.result || data.assessment),
      engineerName: data.engineerName || data.engineer_name || data.inspectorName,
      contractor: data.contractor || data.company || data.companyName,
      defects: data.defects || data.observations || [],
    };
    
    return {
      data: normalized,
      rawResponse: { text: rawText },
      confidence,
      tier: 4, // Vision tier
      method: 'claude-vision',
      cost: 0.03, // Approximate cost
      processingTime: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error('Extraction error:', error);
    throw error;
  }
}

function extractField(text: string, fieldName: string): string | null {
  const regex = new RegExp(`${fieldName}[:\\s]+([^\\n,]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {}
  
  return dateStr;
}

function normalizeOutcome(outcome: string | null): string {
  if (!outcome) return 'PASS';
  const lower = outcome.toLowerCase();
  if (lower.includes('fail') || lower.includes('unsatisfactory')) {
    return 'FAIL';
  }
  return 'PASS';
}
```

---

## Verification Checklist

After completing Phase 5, verify:

```
□ Storage works
  - Configure S3/R2 credentials in .env
  - Test file upload doesn't error

□ Upload page works
  - Drag-drop accepts files
  - Property dropdown populates
  - Stream dropdown populates

□ Processing works
  - File uploads to storage
  - AI extraction runs
  - Progress indicator shows

□ Review step works
  - Extracted data displays
  - Approve button saves record

□ Compliance record created
  - Check database after approval
  - ComplianceRecord exists
  - Status calculated correctly
```

---

## What's Next

Phase 6 will add:
- Compliance overview dashboard
- Stream-specific views
- Expiry management

---

## Files Created in Phase 5

```
src/lib/
  storage.ts

src/lib/ai/
  extractor.ts

src/components/features/certificates/
  UploadDropzone.tsx

src/app/(dashboard)/certificates/
  upload/page.tsx

src/app/api/certificates/
  upload/route.ts
  [id]/process/route.ts
  [id]/approve/route.ts

src/app/api/compliance-streams/
  route.ts
```
