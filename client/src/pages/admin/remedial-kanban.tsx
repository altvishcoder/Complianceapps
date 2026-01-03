import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Clock, CheckCircle, XCircle, Calendar, ChevronRight, RefreshCw, Filter, AlertTriangle, Building, FileText, ListTodo } from "lucide-react";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_COLUMNS = [
  { id: 'OPEN', label: 'Open', icon: AlertCircle, color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', headerBg: 'bg-red-100 dark:bg-red-900/30' },
  { id: 'IN_PROGRESS', label: 'In Progress', icon: Clock, color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', headerBg: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'SCHEDULED', label: 'Scheduled', icon: Calendar, color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', headerBg: 'bg-amber-100 dark:bg-amber-900/30' },
  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle, color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', headerBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'CANCELLED', label: 'Cancelled', icon: XCircle, color: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700', headerBg: 'bg-gray-100 dark:bg-gray-800' },
];

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  IMMEDIATE: { bg: 'bg-red-600', text: 'text-white', border: 'border-l-red-600' },
  URGENT: { bg: 'bg-orange-500', text: 'text-white', border: 'border-l-orange-500' },
  PRIORITY: { bg: 'bg-amber-500', text: 'text-white', border: 'border-l-amber-500' },
  ROUTINE: { bg: 'bg-blue-500', text: 'text-white', border: 'border-l-blue-500' },
  ADVISORY: { bg: 'bg-gray-400', text: 'text-white', border: 'border-l-gray-400' },
};

interface RemedialAction {
  id: string;
  certificateId: string;
  propertyId: string;
  code: string | null;
  category: string | null;
  description: string;
  location: string | null;
  severity: string;
  status: string;
  dueDate: string | null;
  costEstimate: string | null;
  createdAt: string;
  property?: {
    id: string;
    address: string;
    uprn?: string;
  };
  certificate?: {
    id: string;
    certificateType: string;
    fileName?: string;
  };
}

interface KanbanCardProps {
  action: RemedialAction;
  onMove: (actionId: string, newStatus: string) => void;
  isMoving: boolean;
}

function KanbanCard({ action, onMove, isMoving }: KanbanCardProps) {
  const severityStyle = SEVERITY_COLORS[action.severity] || SEVERITY_COLORS.ROUTINE;
  const currentStatusIndex = STATUS_COLUMNS.findIndex(c => c.id === action.status);
  
  const nextStatus = currentStatusIndex < STATUS_COLUMNS.length - 2 
    ? STATUS_COLUMNS[currentStatusIndex + 1] 
    : null;

  return (
    <TooltipProvider>
      <Card 
        className={`mb-3 border-l-4 ${severityStyle.border} hover:shadow-md transition-shadow cursor-pointer`}
        data-testid={`card-action-${action.id}`}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge className={`${severityStyle.bg} ${severityStyle.text} text-xs`}>
              {action.severity}
            </Badge>
            {action.code && (
              <span className="text-xs text-muted-foreground font-mono">{action.code}</span>
            )}
          </div>
          
          <p className="text-sm font-medium line-clamp-2 mb-2">{action.description}</p>
          
          {action.location && (
            <p className="text-xs text-muted-foreground mb-2">
              <Building className="inline h-3 w-3 mr-1" />
              {action.location}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            {action.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {format(new Date(action.dueDate), 'dd MMM yyyy')}
              </span>
            )}
            {action.costEstimate && (
              <span className="font-medium text-emerald-600">{action.costEstimate}</span>
            )}
          </div>
          
          {action.category && (
            <Badge variant="outline" className="text-xs mb-2">{action.category}</Badge>
          )}
          
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{action.certificate?.certificateType || 'N/A'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Certificate: {action.certificate?.certificateType}</p>
              </TooltipContent>
            </Tooltip>
            
            {nextStatus && action.status !== 'COMPLETED' && action.status !== 'CANCELLED' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(action.id, nextStatus.id);
                }}
                disabled={isMoving}
                data-testid={`button-move-${action.id}`}
              >
                {nextStatus.label}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

interface KanbanColumnProps {
  column: typeof STATUS_COLUMNS[0];
  actions: RemedialAction[];
  onMove: (actionId: string, newStatus: string) => void;
  isMoving: boolean;
}

function KanbanColumn({ column, actions, onMove, isMoving }: KanbanColumnProps) {
  const Icon = column.icon;
  
  return (
    <div 
      className={`flex-1 min-w-[280px] max-w-[320px] rounded-lg border ${column.color}`}
      data-testid={`column-${column.id}`}
    >
      <div className={`p-3 rounded-t-lg ${column.headerBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-medium">{column.label}</span>
          </div>
          <Badge variant="secondary" className="rounded-full">{actions.length}</Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="p-3">
          {actions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No actions
            </div>
          ) : (
            actions.map(action => (
              <KanbanCard 
                key={action.id} 
                action={action} 
                onMove={onMove}
                isMoving={isMoving}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function RemedialKanban() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: actions = [], isLoading, refetch } = useQuery<RemedialAction[]>({
    queryKey: ['/api/actions'],
    queryFn: async () => {
      const res = await fetch('/api/actions');
      if (!res.ok) throw new Error('Failed to fetch remedial actions');
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data || []);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ actionId, newStatus }: { actionId: string; newStatus: string }) => {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update action status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      toast({ title: "Action Updated", description: "Status has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleMove = (actionId: string, newStatus: string) => {
    moveMutation.mutate({ actionId, newStatus });
  };

  const filteredActions = actions.filter(action => {
    if (severityFilter !== 'all' && action.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && action.category !== categoryFilter) return false;
    return true;
  });

  const categories = Array.from(new Set(actions.map(a => a.category).filter(Boolean)));

  const groupedByStatus = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredActions.filter(a => a.status === col.id);
    return acc;
  }, {} as Record<string, RemedialAction[]>);

  const stats = {
    total: actions.length,
    open: actions.filter(a => a.status === 'OPEN').length,
    immediate: actions.filter(a => a.severity === 'IMMEDIATE').length,
    overdue: actions.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length,
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-muted/30">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Remedial Actions" />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Remedial Actions" />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6" role="main" aria-label="Remedial actions kanban board" data-testid="remedial-kanban-page">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Remedial Actions Kanban</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Track and manage remedial actions across your properties
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <HeroStatsGrid stats={[
            {
              title: "Total Actions",
              value: stats.total,
              icon: ListTodo,
              riskLevel: "low",
              testId: "stat-total-actions"
            },
            {
              title: "Open",
              value: stats.open,
              icon: AlertCircle,
              riskLevel: stats.open > 20 ? "critical" : stats.open > 10 ? "high" : stats.open > 0 ? "medium" : "good",
              testId: "stat-open-actions"
            },
            {
              title: "Immediate Priority",
              value: stats.immediate,
              icon: AlertTriangle,
              riskLevel: stats.immediate > 0 ? "critical" : "good",
              testId: "stat-immediate-actions"
            },
            {
              title: "Overdue",
              value: stats.overdue,
              icon: Clock,
              riskLevel: stats.overdue > 5 ? "critical" : stats.overdue > 0 ? "high" : "good",
              testId: "stat-overdue-actions"
            }
          ]} />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium hidden sm:inline">Filters:</span>
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32 sm:w-40" data-testid="select-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="PRIORITY">Priority</SelectItem>
                  <SelectItem value="ROUTINE">Routine</SelectItem>
                  <SelectItem value="ADVISORY">Advisory</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32 sm:w-40" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {Object.entries(SEVERITY_COLORS).map(([sev, style]) => (
                <div key={sev} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${style.bg}`} />
                  <span className="text-xs text-muted-foreground">{sev}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                actions={groupedByStatus[column.id] || []}
                onMove={handleMove}
                isMoving={moveMutation.isPending}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
