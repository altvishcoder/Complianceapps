import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Download, Clock, User, FileText, Settings, CheckCircle, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";

interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  actorId: string | null;
  actorName: string;
  actorType: string;
  message: string;
  propertyId: string | null;
  certificateId: string | null;
  beforeState: any | null;
  afterState: any | null;
  changes: Record<string, { from: any; to: any }> | null;
  metadata: any | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

const eventTypeLabels: Record<string, string> = {
  CERTIFICATE_UPLOADED: "Certificate Uploaded",
  CERTIFICATE_PROCESSED: "Certificate Processed",
  CERTIFICATE_APPROVED: "Certificate Approved",
  CERTIFICATE_REJECTED: "Certificate Rejected",
  CERTIFICATE_STATUS_CHANGED: "Status Changed",
  CERTIFICATE_DELETED: "Certificate Deleted",
  EXTRACTION_COMPLETED: "Extraction Completed",
  REMEDIAL_ACTION_CREATED: "Action Created",
  REMEDIAL_ACTION_UPDATED: "Action Updated",
  REMEDIAL_ACTION_COMPLETED: "Action Completed",
  PROPERTY_CREATED: "Property Created",
  PROPERTY_UPDATED: "Property Updated",
  PROPERTY_DELETED: "Property Deleted",
  COMPONENT_CREATED: "Component Created",
  COMPONENT_UPDATED: "Component Updated",
  USER_LOGIN: "User Login",
  USER_LOGOUT: "User Logout",
  USER_CREATED: "User Created",
  USER_UPDATED: "User Updated",
  USER_ROLE_CHANGED: "Role Changed",
  SETTINGS_CHANGED: "Settings Changed",
  API_KEY_CREATED: "API Key Created",
  API_KEY_REVOKED: "API Key Revoked",
  BULK_IMPORT_COMPLETED: "Bulk Import",
};

const eventIcons: Record<string, React.ReactNode> = {
  CERTIFICATE_UPLOADED: <FileText className="h-4 w-4 text-blue-500" />,
  CERTIFICATE_APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  CERTIFICATE_REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  REMEDIAL_ACTION_CREATED: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  USER_LOGIN: <User className="h-4 w-4 text-blue-500" />,
  SETTINGS_CHANGED: <Settings className="h-4 w-4 text-purple-500" />,
  default: <Clock className="h-4 w-4 text-gray-500" />,
};

export default function AuditLogPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<AuditResponse>({
    queryKey: ["/api/audit-events", entityTypeFilter, eventTypeFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityTypeFilter && entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
      if (eventTypeFilter && eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
      params.set("limit", "100");
      
      const res = await fetch(`/api/audit-events?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  const filteredEvents = data?.events?.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.message.toLowerCase().includes(query) ||
      event.actorName.toLowerCase().includes(query) ||
      event.entityName?.toLowerCase().includes(query) ||
      event.eventType.toLowerCase().includes(query)
    );
  }) || [];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Please log in to view audit logs</p>
        </div>
      </div>
    );
  }

  const exportToCSV = () => {
    if (!filteredEvents.length) return;
    
    const headers = ["Timestamp", "Event Type", "Entity", "Actor", "Message", "IP Address"];
    const rows = filteredEvents.map(e => [
      format(new Date(e.createdAt), "yyyy-MM-dd HH:mm:ss"),
      eventTypeLabels[e.eventType] || e.eventType,
      `${e.entityType}: ${e.entityName || e.entityId}`,
      e.actorName,
      e.message,
      e.ipAddress || "",
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Audit Log" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Audit Log</h1>
              <p className="text-muted-foreground">Track all changes and activities across the platform</p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={!filteredEvents.length} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-entity-type">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="CERTIFICATE">Certificates</SelectItem>
                  <SelectItem value="REMEDIAL_ACTION">Actions</SelectItem>
                  <SelectItem value="PROPERTY">Properties</SelectItem>
                  <SelectItem value="USER">Users</SelectItem>
                  <SelectItem value="SETTINGS">Settings</SelectItem>
                </SelectContent>
              </Select>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-event-type">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="CERTIFICATE_APPROVED">Approved</SelectItem>
                  <SelectItem value="CERTIFICATE_REJECTED">Rejected</SelectItem>
                  <SelectItem value="CERTIFICATE_UPLOADED">Uploaded</SelectItem>
                  <SelectItem value="REMEDIAL_ACTION_CREATED">Action Created</SelectItem>
                  <SelectItem value="USER_LOGIN">User Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load audit logs. Please try again.
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No audit events found matching your filters.
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[150px]">Event</TableHead>
                    <TableHead className="w-[120px]">Entity</TableHead>
                    <TableHead className="w-[120px]">Actor</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <Collapsible key={event.id} open={expandedRows.has(event.id)} onOpenChange={() => toggleRow(event.id)}>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(event.id)} data-testid={`audit-row-${event.id}`}>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              {expandedRows.has(event.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(event.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {eventIcons[event.eventType] || eventIcons.default}
                            <span className="text-sm">{eventTypeLabels[event.eventType] || event.eventType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {event.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.actorName}
                          {event.actorType === 'SYSTEM' && (
                            <Badge variant="secondary" className="ml-1 text-xs">System</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {event.message}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium mb-1">Details</p>
                                <dl className="space-y-1 text-muted-foreground">
                                  <div className="flex gap-2">
                                    <dt className="font-medium">Entity ID:</dt>
                                    <dd className="font-mono text-xs">{event.entityId}</dd>
                                  </div>
                                  {event.entityName && (
                                    <div className="flex gap-2">
                                      <dt className="font-medium">Entity Name:</dt>
                                      <dd>{event.entityName}</dd>
                                    </div>
                                  )}
                                  {event.ipAddress && (
                                    <div className="flex gap-2">
                                      <dt className="font-medium">IP Address:</dt>
                                      <dd className="font-mono text-xs">{event.ipAddress}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>
                              {event.changes && Object.keys(event.changes).length > 0 && (
                                <div>
                                  <p className="font-medium mb-1">Changes</p>
                                  <ul className="space-y-1 text-xs text-muted-foreground">
                                    {Object.entries(event.changes).map(([field, change]) => (
                                      <li key={field}>
                                        <span className="font-medium">{field}:</span>{" "}
                                        <span className="line-through text-red-400">{String(change.from || 'empty')}</span>
                                        {" → "}
                                        <span className="text-green-600">{String(change.to || 'empty')}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
        </main>
      </div>
    </div>
  );
}
