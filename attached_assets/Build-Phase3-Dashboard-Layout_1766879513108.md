# ComplianceAI™ Build Guide — Phase 3
## Dashboard Layout & Navigation

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Day 3-4 |
| **Objective** | Main app shell, sidebar, header, dashboard home |
| **Prerequisites** | Phase 2 complete (auth working) |
| **Outcome** | Professional dashboard with navigation |

```
WHAT WE'RE BUILDING:

┌─────────────────────────────────────────────────────────┐
│  HEADER (search, notifications, user menu)              │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   SIDEBAR    │           MAIN CONTENT                   │
│              │                                          │
│  - Dashboard │    Stats Cards                           │
│  - Properties│    ┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│  - Certs     │    │    │ │    │ │    │ │    │          │
│  - Compliance│    └────┘ └────┘ └────┘ └────┘          │
│  - Actions   │                                          │
│  - Reports   │    Charts & Tables                       │
│  - Settings  │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  User info / Logout                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Sidebar Component

### Prompt 3.1: Sidebar Navigation

```
Create the main sidebar navigation component.

Create src/components/features/Sidebar.tsx:

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Building2,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', href: '/properties', icon: Building2 },
  { name: 'Certificates', href: '/certificates', icon: FileCheck },
  { name: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { name: 'Actions', href: '/actions', icon: AlertTriangle },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  
  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };
  
  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-gray-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg">ComplianceAI</span>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>
      
      {/* User section */}
      <div className="border-t border-gray-800 p-4">
        {!collapsed && session?.user && (
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-gray-400 truncate">{session.user.organisationName}</p>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
          
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-gray-400 hover:text-white hover:bg-gray-800 flex-1"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
```

---

## Step 2: Create Header Component

### Prompt 3.2: Dashboard Header

```
Create the header component with search and user menu.

Create src/components/features/Header.tsx:

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell, Search, User, Settings, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  
  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';
  
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      {/* Title / Search */}
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        )}
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search properties, certificates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-64 bg-gray-50 border-gray-200"
          />
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
        
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-600 text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline">
                {session?.user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{session?.user?.name}</p>
                <p className="text-xs text-gray-500">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

---

## Step 3: Create Dashboard Layout

### Prompt 3.3: Dashboard Layout

```
Create the main dashboard layout that wraps all dashboard pages.

Create src/app/(dashboard)/layout.tsx:

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/features/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

---

## Step 4: Create Dashboard Home Page

### Prompt 3.4: Dashboard Stats Cards

```
Create the main dashboard page with statistics.

Create src/app/(dashboard)/dashboard/page.tsx:

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Header } from '@/components/features/Header';
import { DashboardStats } from '@/components/features/dashboard/DashboardStats';
import { ComplianceChart } from '@/components/features/dashboard/ComplianceChart';
import { UpcomingExpiries } from '@/components/features/dashboard/UpcomingExpiries';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  return (
    <div className="flex flex-col h-full">
      <Header />
      
      <div className="flex-1 p-6 space-y-6">
        {/* Welcome message */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500">
            Here's your compliance overview for {session?.user?.organisationName}
          </p>
        </div>
        
        {/* Stats cards */}
        <DashboardStats />
        
        {/* Charts and tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComplianceChart />
          <UpcomingExpiries />
        </div>
      </div>
    </div>
  );
}
```

### Prompt 3.5: Stats Cards Component

```
Create the dashboard statistics cards.

Create src/components/features/dashboard/DashboardStats.tsx:

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, CheckCircle, FileCheck, AlertTriangle } from 'lucide-react';

interface Stats {
  totalProperties: number;
  complianceRate: number;
  certificatesThisMonth: number;
  overdueActions: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  const cards = [
    {
      title: 'Total Properties',
      value: stats?.totalProperties || 0,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Compliance Rate',
      value: `${stats?.complianceRate?.toFixed(1) || 0}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Certificates This Month',
      value: stats?.certificatesThisMonth || 0,
      icon: FileCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Overdue Actions',
      value: stats?.overdueActions || 0,
      icon: AlertTriangle,
      color: stats?.overdueActions ? 'text-red-600' : 'text-gray-600',
      bgColor: stats?.overdueActions ? 'bg-red-50' : 'bg-gray-50',
    },
  ];
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-20 bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Prompt 3.6: Compliance Chart Component

```
Create the compliance pie chart.

Create src/components/features/dashboard/ComplianceChart.tsx:

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StreamData {
  stream: string;
  compliant: number;
  total: number;
}

const COLORS = {
  GAS: '#10b981',
  ELECTRICAL: '#3b82f6',
  FIRE: '#f59e0b',
  ASBESTOS: '#8b5cf6',
  LEGIONELLA: '#ec4899',
  LIFT: '#06b6d4',
  EPC: '#84cc16',
  SMOKE_ALARM: '#f97316',
};

export function ComplianceChart() {
  const [data, setData] = useState<StreamData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((result) => {
        setData(result.complianceByStream || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance by Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const chartData = data.map((d) => ({
    name: d.stream.replace('_', ' '),
    value: d.compliant,
    total: d.total,
    percentage: d.total > 0 ? ((d.compliant / d.total) * 100).toFixed(0) : 0,
  }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance by Stream</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percentage }) => `${percentage}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name.toUpperCase().replace(' ', '_') as keyof typeof COLORS] || '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => [
                  `${props.payload.value}/${props.payload.total} properties`,
                  props.payload.name,
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No compliance data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Prompt 3.7: Upcoming Expiries Component

```
Create the upcoming expiries table.

Create src/components/features/dashboard/UpcomingExpiries.tsx:

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface ExpiryItem {
  id: string;
  propertyAddress: string;
  propertyId: string;
  stream: string;
  nextDueDate: string;
  daysUntilDue: number;
}

export function UpcomingExpiries() {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/dashboard/upcoming')
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  const getStatusBadge = (days: number) => {
    if (days < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (days <= 7) {
      return <Badge className="bg-red-100 text-red-800">Due in {days}d</Badge>;
    }
    if (days <= 30) {
      return <Badge className="bg-amber-100 text-amber-800">Due in {days}d</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Due in {days}d</Badge>;
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Expiries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Expiries</CardTitle>
        <Link
          href="/compliance"
          className="text-sm text-blue-600 hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/properties/${item.propertyId}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block"
                  >
                    {item.propertyAddress}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.stream.replace('_', ' ')}
                  </p>
                </div>
                <div className="ml-4">
                  {getStatusBadge(item.daysUntilDue)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No upcoming expiries
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Step 5: Create Dashboard API Routes

### Prompt 3.8: Dashboard Stats API

```
Create the API routes for dashboard data.

Create src/app/api/dashboard/stats/route.ts:

import { NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    // Total properties
    const totalProperties = await prisma.property.count({
      where: { organisationId: orgId, status: 'ACTIVE' },
    });
    
    // Compliance rate (compliant / total with records)
    const complianceRecords = await prisma.complianceRecord.groupBy({
      by: ['status'],
      where: { organisationId: orgId },
      _count: true,
    });
    
    const totalRecords = complianceRecords.reduce((sum, r) => sum + r._count, 0);
    const compliantRecords = complianceRecords.find((r) => r.status === 'COMPLIANT')?._count || 0;
    const complianceRate = totalRecords > 0 ? (compliantRecords / totalRecords) * 100 : 100;
    
    // Certificates this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const certificatesThisMonth = await prisma.certificate.count({
      where: {
        organisationId: orgId,
        uploadedAt: { gte: startOfMonth },
        processingStatus: 'COMPLETED',
      },
    });
    
    // Overdue actions
    const overdueActions = await prisma.remedialAction.count({
      where: {
        organisationId: orgId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
    });
    
    // Compliance by stream
    const streams = await prisma.complianceStream.findMany({
      where: { isActive: true },
    });
    
    const complianceByStream = await Promise.all(
      streams.map(async (stream) => {
        const total = await prisma.complianceRecord.count({
          where: {
            organisationId: orgId,
            complianceStreamId: stream.id,
          },
        });
        const compliant = await prisma.complianceRecord.count({
          where: {
            organisationId: orgId,
            complianceStreamId: stream.id,
            status: 'COMPLIANT',
          },
        });
        return {
          stream: stream.code,
          compliant,
          total,
        };
      })
    );
    
    return NextResponse.json({
      totalProperties,
      complianceRate,
      certificatesThisMonth,
      overdueActions,
      complianceByStream: complianceByStream.filter((s) => s.total > 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Prompt 3.9: Upcoming Expiries API

```
Create the API route for upcoming expiries.

Create src/app/api/dashboard/upcoming/route.ts:

import { NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { addDays, differenceInDays } from 'date-fns';

export async function GET() {
  try {
    const session = await requireAuth();
    const orgId = session.user.organisationId;
    
    const thirtyDaysFromNow = addDays(new Date(), 30);
    
    const records = await prisma.complianceRecord.findMany({
      where: {
        organisationId: orgId,
        nextDueDate: {
          lte: thirtyDaysFromNow,
        },
        status: { in: ['COMPLIANT', 'DUE_SOON', 'OVERDUE'] },
      },
      include: {
        property: {
          select: {
            id: true,
            addressLine1: true,
            postcode: true,
          },
        },
        complianceStream: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        nextDueDate: 'asc',
      },
      take: 20,
    });
    
    const items = records.map((record) => ({
      id: record.id,
      propertyId: record.property.id,
      propertyAddress: `${record.property.addressLine1}, ${record.property.postcode}`,
      stream: record.complianceStream.name,
      nextDueDate: record.nextDueDate.toISOString(),
      daysUntilDue: differenceInDays(record.nextDueDate, new Date()),
    }));
    
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Verification Checklist

After completing Phase 3, verify:

```
□ Sidebar displays correctly
  - Logo visible
  - All navigation items present
  - Active state shows for current page
  - Collapse/expand works
  - Sign out works

□ Header works
  - Search bar visible
  - User menu opens
  - Sign out from menu works

□ Dashboard layout renders
  - Sidebar on left
  - Content area fills rest
  - Responsive on mobile

□ Dashboard page works
  - Welcome message shows user name
  - Stats cards display (may show 0s)
  - Compliance chart renders
  - Upcoming expiries table renders

□ API routes respond
  - GET /api/dashboard/stats returns JSON
  - GET /api/dashboard/upcoming returns JSON
```

---

## What's Next

Phase 4 will add:
- Properties list page
- Property detail page
- Property CRUD operations

---

## Files Created in Phase 3

```
src/components/features/
  Sidebar.tsx
  Header.tsx

src/components/features/dashboard/
  DashboardStats.tsx
  ComplianceChart.tsx
  UpcomingExpiries.tsx

src/app/(dashboard)/
  layout.tsx
  dashboard/page.tsx

src/app/api/dashboard/
  stats/route.ts
  upcoming/route.ts
```
