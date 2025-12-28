# ComplianceAI™ Build Guide — Phase 6
## Compliance Dashboard & Remedial Actions

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Day 7-8 |
| **Objective** | Compliance overview, stream views, actions management |
| **Prerequisites** | Phase 5 complete |
| **Outcome** | Full compliance visibility and action tracking |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│              COMPLIANCE OVERVIEW                        │
│  ┌────────────────────────────────────────────────────┐│
│  │  Overall: 87% │ Compliant: 156 │ Due: 12 │ Over: 4 ││
│  └────────────────────────────────────────────────────┘│
│                                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ GAS  │ │ EICR │ │ FIRE │ │ LIFT │ │ EPC  │         │
│  │ 95%  │ │ 88%  │ │ 75%  │ │ 100% │ │ 92%  │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              REMEDIAL ACTIONS                           │
│  Tabs: Open | In Progress | Completed                  │
│  ┌────────────────────────────────────────────────────┐│
│  │ 🔴 EMERGENCY - Boiler isolation required           ││
│  │    12 Example St • Due: Tomorrow                   ││
│  ├────────────────────────────────────────────────────┤│
│  │ 🟡 URGENT - EICR remedial work                     ││
│  │    34 Example St • Due: 7 days                     ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Compliance Overview Page

### Prompt 6.1: Compliance Dashboard

```
Create the compliance overview page.

Create src/app/(dashboard)/compliance/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/features/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Flame,
  Zap,
  ShieldAlert,
  Droplets,
  Wind,
  ArrowUp,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface ComplianceOverview {
  overallRate: number;
  totalProperties: number;
  compliantCount: number;
  dueSoonCount: number;
  overdueCount: number;
  byStream: Array<{
    code: string;
    name: string;
    compliant: number;
    dueSoon: number;
    overdue: number;
    total: number;
    rate: number;
  }>;
}

const STREAM_ICONS: Record<string, any> = {
  GAS: Flame,
  ELECTRICAL: Zap,
  FIRE: ShieldAlert,
  LEGIONELLA: Droplets,
  ASBESTOS: Wind,
  LIFT: ArrowUp,
  EPC: Building2,
  SMOKE_ALARM: AlertTriangle,
};

const STREAM_COLORS: Record<string, string> = {
  GAS: 'text-orange-600 bg-orange-100',
  ELECTRICAL: 'text-blue-600 bg-blue-100',
  FIRE: 'text-red-600 bg-red-100',
  LEGIONELLA: 'text-cyan-600 bg-cyan-100',
  ASBESTOS: 'text-gray-600 bg-gray-100',
  LIFT: 'text-purple-600 bg-purple-100',
  EPC: 'text-green-600 bg-green-100',
  SMOKE_ALARM: 'text-amber-600 bg-amber-100',
};

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/compliance/overview')
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Compliance" />
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Compliance" />
      
      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <p className="text-blue-100 text-sm">Overall Compliance</p>
              <p className="text-4xl font-bold mt-2">
                {data?.overallRate.toFixed(0) || 0}%
              </p>
              <Progress
                value={data?.overallRate || 0}
                className="mt-4 bg-blue-400"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Compliant</p>
                  <p className="text-2xl font-bold">{data?.compliantCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Due Soon</p>
                  <p className="text-2xl font-bold">{data?.dueSoonCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">
                    {data?.overdueCount || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Stream Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Compliance by Stream</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.byStream.map((stream) => {
              const Icon = STREAM_ICONS[stream.code] || Building2;
              const colors = STREAM_COLORS[stream.code] || 'text-gray-600 bg-gray-100';
              
              return (
                <Link href={`/compliance/${stream.code.toLowerCase()}`} key={stream.code}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-lg ${colors}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <Badge
                          className={
                            stream.rate >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : stream.rate >= 70
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {stream.rate.toFixed(0)}%
                        </Badge>
                      </div>
                      
                      <h3 className="font-medium">{stream.name}</h3>
                      
                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-500">
                          <span>Compliant</span>
                          <span className="text-emerald-600">{stream.compliant}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Due Soon</span>
                          <span className="text-amber-600">{stream.dueSoon}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Overdue</span>
                          <span className="text-red-600">{stream.overdue}</span>
                        </div>
                      </div>
                      
                      <Progress value={stream.rate} className="mt-4" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Prompt 6.2: Compliance Overview API

```
Create the compliance overview API.

Create src/app/api/compliance/overview/route.ts:

import { NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    // Get all streams
    const streams = await prisma.complianceStream.findMany({
      where: { isActive: true },
    });
    
    // Get counts by stream
    const byStream = await Promise.all(
      streams.map(async (stream) => {
        const records = await prisma.complianceRecord.groupBy({
          by: ['status'],
          where: {
            organisationId: orgId,
            complianceStreamId: stream.id,
          },
          _count: true,
        });
        
        const compliant = records.find((r) => r.status === 'COMPLIANT')?._count || 0;
        const dueSoon = records.find((r) => r.status === 'DUE_SOON')?._count || 0;
        const overdue = records.find((r) => r.status === 'OVERDUE')?._count || 0;
        const nonCompliant = records.find((r) => r.status === 'NON_COMPLIANT')?._count || 0;
        const total = records.reduce((sum, r) => sum + r._count, 0);
        
        return {
          code: stream.code,
          name: stream.name,
          compliant,
          dueSoon,
          overdue: overdue + nonCompliant,
          total,
          rate: total > 0 ? (compliant / total) * 100 : 100,
        };
      })
    );
    
    // Calculate overall stats
    const totalProperties = await prisma.property.count({
      where: { organisationId: orgId, status: 'ACTIVE' },
    });
    
    const allRecords = await prisma.complianceRecord.groupBy({
      by: ['status'],
      where: { organisationId: orgId },
      _count: true,
    });
    
    const compliantCount = allRecords.find((r) => r.status === 'COMPLIANT')?._count || 0;
    const dueSoonCount = allRecords.find((r) => r.status === 'DUE_SOON')?._count || 0;
    const overdueCount =
      (allRecords.find((r) => r.status === 'OVERDUE')?._count || 0) +
      (allRecords.find((r) => r.status === 'NON_COMPLIANT')?._count || 0);
    const totalRecords = allRecords.reduce((sum, r) => sum + r._count, 0);
    
    const overallRate = totalRecords > 0 ? (compliantCount / totalRecords) * 100 : 100;
    
    return NextResponse.json({
      overallRate,
      totalProperties,
      compliantCount,
      dueSoonCount,
      overdueCount,
      byStream: byStream.filter((s) => s.total > 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Step 2: Create Remedial Actions Page

### Prompt 6.3: Actions List Page

```
Create the remedial actions management page.

Create src/app/(dashboard)/actions/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/features/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface RemedialAction {
  id: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string | null;
  propertyId: string;
  propertyAddress: string;
  streamName: string;
  createdAt: string;
}

export default function ActionsPage() {
  const [actions, setActions] = useState<RemedialAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  const fetchActions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeTab === 'all' ? '' : activeTab.toUpperCase(),
      });
      if (priorityFilter !== 'all') {
        params.set('priority', priorityFilter);
      }
      if (search) {
        params.set('search', search);
      }
      
      const res = await fetch(`/api/actions?${params}`);
      const data = await res.json();
      setActions(data.actions || []);
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchActions();
  }, [activeTab, priorityFilter, search]);
  
  const handleComplete = async (id: string) => {
    try {
      await fetch(`/api/actions/${id}/complete`, { method: 'POST' });
      fetchActions();
    } catch (error) {
      console.error('Failed to complete action:', error);
    }
  };
  
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'URGENT':
        return <Clock className="w-5 h-5 text-amber-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
    }
  };
  
  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      EMERGENCY: 'bg-red-100 text-red-800 border-red-200',
      URGENT: 'bg-amber-100 text-amber-800 border-amber-200',
      ROUTINE: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return (
      <Badge className={styles[priority] || styles.ROUTINE} variant="outline">
        {priority}
      </Badge>
    );
  };
  
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-gray-100 text-gray-500',
    };
    return <Badge className={styles[status]}>{status.replace('_', ' ')}</Badge>;
  };
  
  const getDueStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return <span className="text-red-600 font-medium">Overdue by {Math.abs(daysUntil)} days</span>;
    }
    if (daysUntil === 0) {
      return <span className="text-red-600 font-medium">Due today</span>;
    }
    if (daysUntil <= 7) {
      return <span className="text-amber-600">Due in {daysUntil} days</span>;
    }
    return <span className="text-gray-500">Due {format(due, 'dd MMM yyyy')}</span>;
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Remedial Actions" />
      
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Remedial Actions</h1>
            <p className="text-gray-500">
              Track and manage required remedial work
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Action
          </Button>
        </div>
        
        {/* Tabs and Filters */}
        <div className="mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="ROUTINE">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Tabs>
        </div>
        
        {/* Actions List */}
        <div className="space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="animate-pulse h-16 bg-gray-100 rounded" />
                </CardContent>
              </Card>
            ))
          ) : actions.length > 0 ? (
            actions.map((action) => (
              <Card key={action.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {getPriorityIcon(action.priority)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {action.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <Link
                              href={`/properties/${action.propertyId}`}
                              className="flex items-center gap-1 hover:text-blue-600"
                            >
                              <MapPin className="w-4 h-4" />
                              {action.propertyAddress}
                            </Link>
                            <span>{action.streamName}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(action.priority)}
                          {getStatusBadge(action.status)}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {getDueStatus(action.dueDate)}
                        </div>
                        
                        {action.status !== 'COMPLETED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleComplete(action.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No actions found
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Prompt 6.4: Actions API

```
Create the remedial actions API routes.

Create src/app/api/actions/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// GET - List actions
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    
    const where: any = { organisationId: orgId };
    
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }
    
    const actions = await prisma.remedialAction.findMany({
      where,
      include: {
        property: {
          select: { id: true, addressLine1: true, postcode: true },
        },
        complianceRecord: {
          include: {
            complianceStream: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { dueDate: 'asc' },
      ],
    });
    
    const formatted = actions.map((a) => ({
      id: a.id,
      description: a.description,
      priority: a.priority,
      status: a.status,
      dueDate: a.dueDate?.toISOString() || null,
      propertyId: a.property.id,
      propertyAddress: `${a.property.addressLine1}, ${a.property.postcode}`,
      streamName: a.complianceRecord?.complianceStream.name || 'General',
      createdAt: a.createdAt.toISOString(),
    }));
    
    return NextResponse.json({ actions: formatted });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create action
const CreateActionSchema = z.object({
  propertyId: z.string(),
  description: z.string().min(1),
  priority: z.enum(['EMERGENCY', 'URGENT', 'ROUTINE']),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const body = await request.json();
    const data = CreateActionSchema.parse(body);
    
    const action = await prisma.remedialAction.create({
      data: {
        organisationId: orgId,
        propertyId: data.propertyId,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedTo: data.assignedTo,
        source: 'MANUAL',
      },
    });
    
    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

Create src/app/api/actions/[id]/complete/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const action = await prisma.remedialAction.findFirst({
      where: { id: params.id, organisationId: orgId },
    });
    
    if (!action) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    await prisma.remedialAction.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
      },
    });
    
    await prisma.auditLog.create({
      data: {
        organisationId: orgId,
        userId: session.user.id,
        action: 'COMPLETE',
        entityType: 'RemedialAction',
        entityId: params.id,
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Step 3: Create Reports Page

### Prompt 6.5: Reports Page

```
Create the reports page with export functionality.

Create src/app/(dashboard)/reports/page.tsx:

'use client';

import { useState } from 'react';
import { Header } from '@/components/features/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Building2,
  Calendar,
  Users,
  ClipboardList,
  Download,
  Loader2,
} from 'lucide-react';

const REPORTS = [
  {
    id: 'compliance-summary',
    title: 'Compliance Summary',
    description: 'Overall compliance status across all streams',
    icon: FileText,
  },
  {
    id: 'property-compliance',
    title: 'Property Compliance',
    description: 'Detailed compliance status per property',
    icon: Building2,
  },
  {
    id: 'expiry-report',
    title: 'Expiry Report',
    description: 'Certificates expiring within date range',
    icon: Calendar,
  },
  {
    id: 'contractor-performance',
    title: 'Contractor Performance',
    description: 'Certificate submissions by contractor',
    icon: Users,
  },
  {
    id: 'remedial-actions',
    title: 'Remedial Actions',
    description: 'Outstanding and completed actions',
    icon: ClipboardList,
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState('csv');
  const [loading, setLoading] = useState(false);
  
  const handleGenerate = async () => {
    if (!selectedReport) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        report: selectedReport,
        format,
      });
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      
      const res = await fetch(`/api/reports/generate?${params}`);
      
      if (!res.ok) throw new Error('Failed to generate report');
      
      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      setSelectedReport(null);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <Header title="Reports" />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-500">
              Generate and download compliance reports
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map((report) => (
              <Card
                key={report.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedReport(report.id)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <report.icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {report.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      
      {/* Generate Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Generate {REPORTS.find((r) => r.id === selectedReport)?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### Prompt 6.6: Reports API

```
Create the reports generation API.

Create src/app/api/reports/generate/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const searchParams = request.nextUrl.searchParams;
    const report = searchParams.get('report');
    const format = searchParams.get('format') || 'csv';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    let data: any[] = [];
    let filename = 'report';
    
    switch (report) {
      case 'compliance-summary':
        data = await getComplianceSummary(orgId);
        filename = 'compliance-summary';
        break;
        
      case 'property-compliance':
        data = await getPropertyCompliance(orgId);
        filename = 'property-compliance';
        break;
        
      case 'expiry-report':
        data = await getExpiryReport(orgId, from, to);
        filename = 'expiry-report';
        break;
        
      case 'remedial-actions':
        data = await getRemedialActions(orgId);
        filename = 'remedial-actions';
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
    
    // Convert to CSV
    if (data.length === 0) {
      return new NextResponse('No data', { status: 204 });
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const val = row[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val ?? '';
        }).join(',')
      ),
    ].join('\n');
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getComplianceSummary(orgId: string) {
  const streams = await prisma.complianceStream.findMany({
    where: { isActive: true },
  });
  
  const results = [];
  
  for (const stream of streams) {
    const records = await prisma.complianceRecord.groupBy({
      by: ['status'],
      where: { organisationId: orgId, complianceStreamId: stream.id },
      _count: true,
    });
    
    const compliant = records.find((r) => r.status === 'COMPLIANT')?._count || 0;
    const dueSoon = records.find((r) => r.status === 'DUE_SOON')?._count || 0;
    const overdue = records.find((r) => r.status === 'OVERDUE')?._count || 0;
    const total = records.reduce((sum, r) => sum + r._count, 0);
    
    results.push({
      Stream: stream.name,
      Compliant: compliant,
      'Due Soon': dueSoon,
      Overdue: overdue,
      Total: total,
      'Compliance Rate': total > 0 ? `${((compliant / total) * 100).toFixed(1)}%` : 'N/A',
    });
  }
  
  return results;
}

async function getPropertyCompliance(orgId: string) {
  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, status: 'ACTIVE' },
    include: {
      complianceRecords: {
        include: { complianceStream: true },
      },
    },
  });
  
  return properties.map((p) => ({
    UPRN: p.uprn,
    Address: p.addressLine1,
    Postcode: p.postcode,
    Type: p.propertyType,
    'Compliance Records': p.complianceRecords.length,
    Status: p.complianceRecords.some((r) => r.status === 'OVERDUE')
      ? 'Overdue'
      : p.complianceRecords.some((r) => r.status === 'DUE_SOON')
      ? 'Due Soon'
      : 'Compliant',
  }));
}

async function getExpiryReport(orgId: string, from: string | null, to: string | null) {
  const where: any = { organisationId: orgId };
  
  if (from || to) {
    where.nextDueDate = {};
    if (from) where.nextDueDate.gte = new Date(from);
    if (to) where.nextDueDate.lte = new Date(to);
  }
  
  const records = await prisma.complianceRecord.findMany({
    where,
    include: {
      property: true,
      complianceStream: true,
    },
    orderBy: { nextDueDate: 'asc' },
  });
  
  return records.map((r) => ({
    Property: r.property.addressLine1,
    Postcode: r.property.postcode,
    Stream: r.complianceStream.name,
    'Last Inspection': r.inspectionDate.toISOString().split('T')[0],
    'Next Due': r.nextDueDate.toISOString().split('T')[0],
    Status: r.status,
  }));
}

async function getRemedialActions(orgId: string) {
  const actions = await prisma.remedialAction.findMany({
    where: { organisationId: orgId },
    include: { property: true },
    orderBy: { createdAt: 'desc' },
  });
  
  return actions.map((a) => ({
    Property: a.property.addressLine1,
    Description: a.description,
    Priority: a.priority,
    Status: a.status,
    'Due Date': a.dueDate?.toISOString().split('T')[0] || 'Not set',
    Created: a.createdAt.toISOString().split('T')[0],
  }));
}
```

---

## Verification Checklist

After completing Phase 6, verify:

```
□ Compliance overview works
  - Shows overall rate
  - Shows stats cards
  - Shows stream cards with percentages

□ Stream cards link to detail
  - Click on stream card navigates

□ Actions page works
  - Tabs filter correctly
  - Priority filter works
  - Mark complete works

□ Reports page works
  - Dialog opens for each report
  - CSV downloads

□ APIs respond correctly
  - GET /api/compliance/overview
  - GET /api/actions
  - POST /api/actions/[id]/complete
  - GET /api/reports/generate
```

---

## What's Next

Phase 7 will add:
- Settings pages
- User management
- Final polish and testing

---

## Files Created in Phase 6

```
src/app/(dashboard)/compliance/
  page.tsx
  [stream]/page.tsx

src/app/(dashboard)/actions/
  page.tsx

src/app/(dashboard)/reports/
  page.tsx

src/app/api/compliance/
  overview/route.ts

src/app/api/actions/
  route.ts
  [id]/complete/route.ts

src/app/api/reports/
  generate/route.ts
```
