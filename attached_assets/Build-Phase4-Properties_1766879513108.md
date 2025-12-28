# ComplianceAI™ Build Guide — Phase 4
## Properties Management

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Day 4-5 |
| **Objective** | Property CRUD, list, detail pages |
| **Prerequisites** | Phase 3 complete |
| **Outcome** | Full property management functionality |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│                 PROPERTIES MODULE                       │
│                                                         │
│   List View:                                            │
│   ┌──────────────────────────────────────────────────┐ │
│   │ Filters: Search | Type | Status | Compliance    │ │
│   ├──────────────────────────────────────────────────┤ │
│   │ UPRN | Address | Type | Beds | Status | Actions │ │
│   │ ───────────────────────────────────────────────  │ │
│   │ ...                                              │ │
│   │ ───────────────────────────────────────────────  │ │
│   │ Pagination                                       │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
│   Detail View:                                          │
│   ┌──────────────────────────────────────────────────┐ │
│   │ Property Info Card                               │ │
│   ├──────────────────────────────────────────────────┤ │
│   │ Tabs: Overview | Compliance | Certs | Actions   │ │
│   └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Properties List Page

### Prompt 4.1: Properties List

```
Create the properties list page with filtering and pagination.

Create src/app/(dashboard)/properties/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/features/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, ChevronLeft, ChevronRight, Eye, Edit } from 'lucide-react';

interface Property {
  id: string;
  uprn: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  propertyType: string;
  bedrooms?: number;
  status: string;
  complianceStatus?: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [status, setStatus] = useState('all');
  
  const fetchProperties = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (search) params.set('search', search);
      if (propertyType !== 'all') params.set('propertyType', propertyType);
      if (status !== 'all') params.set('status', status);
      
      const res = await fetch(`/api/properties?${params}`);
      const data = await res.json();
      
      setProperties(data.properties || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchProperties(1);
  }, [search, propertyType, status]);
  
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      VOID: 'bg-gray-100 text-gray-800',
      SOLD: 'bg-blue-100 text-blue-800',
      DEMOLISHED: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };
  
  const getComplianceBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">No data</Badge>;
    
    const styles: Record<string, string> = {
      COMPLIANT: 'bg-emerald-100 text-emerald-800',
      DUE_SOON: 'bg-amber-100 text-amber-800',
      OVERDUE: 'bg-red-100 text-red-800',
      NON_COMPLIANT: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Properties" />
      
      <div className="flex-1 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-500">
              Manage your property portfolio
            </p>
          </div>
          <Link href="/properties/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Property
            </Button>
          </Link>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by address, UPRN, postcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Property Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="HOUSE">House</SelectItem>
              <SelectItem value="FLAT">Flat</SelectItem>
              <SelectItem value="BUNGALOW">Bungalow</SelectItem>
              <SelectItem value="MAISONETTE">Maisonette</SelectItem>
              <SelectItem value="BEDSIT">Bedsit</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="DEMOLISHED">Demolished</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Table */}
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UPRN</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Beds</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-10 bg-gray-100 animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : properties.length > 0 ? (
                properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-mono text-sm">
                      {property.uprn}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{property.addressLine1}</p>
                        <p className="text-sm text-gray-500">
                          {property.city}, {property.postcode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{property.propertyType}</TableCell>
                    <TableCell>{property.bedrooms || '-'}</TableCell>
                    <TableCell>{getStatusBadge(property.status)}</TableCell>
                    <TableCell>{getComplianceBadge(property.complianceStatus)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/properties/${property.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/properties/${property.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No properties found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} properties
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchProperties(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchProperties(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 2: Create Properties API

### Prompt 4.2: Properties List API

```
Create the properties API routes.

Create src/app/api/properties/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// GET - List properties
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const propertyType = searchParams.get('propertyType');
    const status = searchParams.get('status');
    
    // Build where clause
    const where: any = {
      organisationId: orgId,
    };
    
    if (search) {
      where.OR = [
        { addressLine1: { contains: search, mode: 'insensitive' } },
        { postcode: { contains: search, mode: 'insensitive' } },
        { uprn: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (propertyType && propertyType !== 'all') {
      where.propertyType = propertyType;
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Get total count
    const total = await prisma.property.count({ where });
    
    // Get properties with compliance status
    const properties = await prisma.property.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        complianceRecords: {
          select: { status: true },
          orderBy: { nextDueDate: 'asc' },
          take: 1,
        },
      },
    });
    
    // Calculate overall compliance status per property
    const propertiesWithCompliance = properties.map((p) => {
      let complianceStatus: string | undefined;
      
      if (p.complianceRecords.length > 0) {
        // Get worst status
        const statuses = p.complianceRecords.map((r) => r.status);
        if (statuses.includes('OVERDUE') || statuses.includes('NON_COMPLIANT')) {
          complianceStatus = 'OVERDUE';
        } else if (statuses.includes('DUE_SOON')) {
          complianceStatus = 'DUE_SOON';
        } else {
          complianceStatus = 'COMPLIANT';
        }
      }
      
      return {
        id: p.id,
        uprn: p.uprn,
        addressLine1: p.addressLine1,
        addressLine2: p.addressLine2,
        city: p.city,
        postcode: p.postcode,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms,
        status: p.status,
        complianceStatus,
      };
    });
    
    return NextResponse.json({
      properties: propertiesWithCompliance,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create property
const CreatePropertySchema = z.object({
  uprn: z.string().min(1, 'UPRN is required'),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  postcode: z.string().min(1, 'Postcode is required'),
  propertyType: z.enum(['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'OTHER']),
  bedrooms: z.number().int().min(0).optional(),
  block: z.string().optional(),
  scheme: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const body = await request.json();
    const data = CreatePropertySchema.parse(body);
    
    // Check for duplicate UPRN
    const existing = await prisma.property.findUnique({
      where: {
        organisationId_uprn: {
          organisationId: orgId,
          uprn: data.uprn,
        },
      },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'A property with this UPRN already exists' },
        { status: 400 }
      );
    }
    
    const property = await prisma.property.create({
      data: {
        ...data,
        organisationId: orgId,
      },
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        organisationId: orgId,
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Property',
        entityId: property.id,
        newData: property as any,
      },
    });
    
    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Prompt 4.3: Property Detail API

```
Create the property detail API route.

Create src/app/api/properties/[id]/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// GET - Get property details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const property = await prisma.property.findFirst({
      where: {
        id: params.id,
        organisationId: orgId,
      },
      include: {
        complianceRecords: {
          include: {
            complianceStream: true,
            certificate: {
              select: {
                id: true,
                originalFilename: true,
                uploadedAt: true,
              },
            },
          },
          orderBy: { nextDueDate: 'asc' },
        },
        certificates: {
          select: {
            id: true,
            originalFilename: true,
            processingStatus: true,
            uploadedAt: true,
            complianceStream: {
              select: { name: true, code: true },
            },
          },
          orderBy: { uploadedAt: 'desc' },
          take: 10,
        },
        remedialActions: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        },
        assets: true,
      },
    });
    
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ property });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update property
const UpdatePropertySchema = z.object({
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().optional(),
  city: z.string().min(1).optional(),
  postcode: z.string().min(1).optional(),
  propertyType: z.enum(['HOUSE', 'FLAT', 'BUNGALOW', 'MAISONETTE', 'BEDSIT', 'OTHER']).optional(),
  bedrooms: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'VOID', 'SOLD', 'DEMOLISHED']).optional(),
  block: z.string().optional(),
  scheme: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const body = await request.json();
    const data = UpdatePropertySchema.parse(body);
    
    // Check property exists and belongs to org
    const existing = await prisma.property.findFirst({
      where: { id: params.id, organisationId: orgId },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    const property = await prisma.property.update({
      where: { id: params.id },
      data,
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        organisationId: orgId,
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Property',
        entityId: property.id,
        previousData: existing as any,
        newData: property as any,
      },
    });
    
    return NextResponse.json({ property });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete property
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const property = await prisma.property.findFirst({
      where: { id: params.id, organisationId: orgId },
    });
    
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Soft delete by setting status
    await prisma.property.update({
      where: { id: params.id },
      data: { status: 'DEMOLISHED' },
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        organisationId: orgId,
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Property',
        entityId: property.id,
        previousData: property as any,
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Step 3: Create Property Detail Page

### Prompt 4.4: Property Detail Page

```
Create the property detail page with tabs.

Create src/app/(dashboard)/properties/[id]/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/features/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Edit,
  MapPin,
  Home,
  Bed,
  FileCheck,
  AlertTriangle,
  Upload,
} from 'lucide-react';

interface Property {
  id: string;
  uprn: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  propertyType: string;
  bedrooms?: number;
  status: string;
  complianceRecords: any[];
  certificates: any[];
  remedialActions: any[];
}

export default function PropertyDetailPage() {
  const params = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/properties/${params.id}`)
      .then((res) => res.json())
      .then((data) => setProperty(data.property))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);
  
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Property Details" />
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="h-40 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }
  
  if (!property) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Property Not Found" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-gray-500">Property not found</p>
        </div>
      </div>
    );
  }
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLIANT: 'bg-emerald-100 text-emerald-800',
      DUE_SOON: 'bg-amber-100 text-amber-800',
      OVERDUE: 'bg-red-100 text-red-800',
      NON_COMPLIANT: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header />
      
      <div className="flex-1 p-6 overflow-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <Link href="/properties" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Properties
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900">{property.addressLine1}</span>
        </div>
        
        {/* Property info card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-6">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Home className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {property.addressLine1}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span>{property.city}, {property.postcode}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <Badge variant="outline">{property.propertyType}</Badge>
                    {property.bedrooms && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Bed className="w-4 h-4" />
                        {property.bedrooms} bed
                      </span>
                    )}
                    <Badge className={property.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {property.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/certificates/upload?propertyId=${property.id}`}>
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Certificate
                  </Button>
                </Link>
                <Link href={`/properties/${property.id}/edit`}>
                  <Button variant="outline">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Tabs */}
        <Tabs defaultValue="compliance">
          <TabsList>
            <TabsTrigger value="compliance">
              Compliance ({property.complianceRecords.length})
            </TabsTrigger>
            <TabsTrigger value="certificates">
              Certificates ({property.certificates.length})
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions ({property.remedialActions.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="compliance" className="mt-4">
            <div className="grid gap-4">
              {property.complianceRecords.length > 0 ? (
                property.complianceRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">
                            {record.complianceStream.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Next due: {new Date(record.nextDueDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={getStatusColor(record.status)}>
                          {record.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No compliance records yet. Upload a certificate to get started.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="certificates" className="mt-4">
            <div className="space-y-3">
              {property.certificates.length > 0 ? (
                property.certificates.map((cert) => (
                  <Card key={cert.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileCheck className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{cert.originalFilename}</p>
                            <p className="text-sm text-gray-500">
                              {cert.complianceStream.name} • {new Date(cert.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{cert.processingStatus}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No certificates uploaded yet
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="actions" className="mt-4">
            <div className="space-y-3">
              {property.remedialActions.length > 0 ? (
                property.remedialActions.map((action) => (
                  <Card key={action.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                          action.priority === 'EMERGENCY' ? 'text-red-500' :
                          action.priority === 'URGENT' ? 'text-amber-500' :
                          'text-blue-500'
                        }`} />
                        <div className="flex-1">
                          <p className="font-medium">{action.description}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Due: {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : 'Not set'}
                          </p>
                        </div>
                        <Badge variant="outline">{action.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No outstanding actions
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

---

## Step 4: Create Add/Edit Property Form

### Prompt 4.5: Property Form

```
Create the add/edit property form.

Create src/app/(dashboard)/properties/new/page.tsx:

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/features/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    uprn: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    propertyType: 'FLAT',
    bedrooms: '',
  });
  
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create property');
      }
      
      router.push(`/properties/${data.property.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Add Property" />
      
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6">
            <Link href="/properties" className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Properties
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900">Add Property</span>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uprn">UPRN *</Label>
                    <Input
                      id="uprn"
                      placeholder="100000000001"
                      value={formData.uprn}
                      onChange={(e) => handleChange('uprn', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="propertyType">Property Type *</Label>
                    <Select
                      value={formData.propertyType}
                      onValueChange={(v) => handleChange('propertyType', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOUSE">House</SelectItem>
                        <SelectItem value="FLAT">Flat</SelectItem>
                        <SelectItem value="BUNGALOW">Bungalow</SelectItem>
                        <SelectItem value="MAISONETTE">Maisonette</SelectItem>
                        <SelectItem value="BEDSIT">Bedsit</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Input
                    id="addressLine1"
                    placeholder="123 Example Street"
                    value={formData.addressLine1}
                    onChange={(e) => handleChange('addressLine1', e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    placeholder="Flat 4B (optional)"
                    value={formData.addressLine2}
                    onChange={(e) => handleChange('addressLine2', e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="London"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode *</Label>
                    <Input
                      id="postcode"
                      placeholder="SW1A 1AA"
                      value={formData.postcode}
                      onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      min="0"
                      placeholder="2"
                      value={formData.bedrooms}
                      onChange={(e) => handleChange('bedrooms', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <Link href="/properties">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Property'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

---

## Verification Checklist

After completing Phase 4, verify:

```
□ Properties list works
  - Shows demo properties from seed
  - Search filters work
  - Type/status filters work
  - Pagination works

□ Property detail works
  - Shows property info
  - Tabs switch correctly
  - Compliance/certificates/actions display

□ Add property works
  - Form validates
  - Creates new property
  - Redirects to detail page

□ API routes respond
  - GET /api/properties returns list
  - POST /api/properties creates property
  - GET /api/properties/[id] returns detail
  - PUT /api/properties/[id] updates
```

---

## What's Next

Phase 5 will add:
- Certificate upload interface
- AI processing pipeline
- Extraction review UI

---

## Files Created in Phase 4

```
src/app/(dashboard)/properties/
  page.tsx
  new/page.tsx
  [id]/page.tsx
  [id]/edit/page.tsx

src/app/api/properties/
  route.ts
  [id]/route.ts
```
