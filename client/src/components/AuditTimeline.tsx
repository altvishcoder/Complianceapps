import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, FileText, User, Settings, AlertTriangle, Eye, Upload, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  actorName: string;
  actorType: string;
  message: string;
  changes: Record<string, { from: any; to: any }> | null;
  createdAt: string;
}

interface AuditTimelineProps {
  entityType: string;
  entityId: string;
  maxHeight?: string;
}

const eventIcons: Record<string, React.ReactNode> = {
  CERTIFICATE_UPLOADED: <Upload className="h-4 w-4" />,
  CERTIFICATE_PROCESSED: <RefreshCw className="h-4 w-4" />,
  CERTIFICATE_APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  CERTIFICATE_REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  CERTIFICATE_STATUS_CHANGED: <RefreshCw className="h-4 w-4 text-blue-500" />,
  EXTRACTION_COMPLETED: <FileText className="h-4 w-4 text-purple-500" />,
  REMEDIAL_ACTION_CREATED: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  REMEDIAL_ACTION_UPDATED: <Settings className="h-4 w-4 text-blue-500" />,
  REMEDIAL_ACTION_COMPLETED: <CheckCircle className="h-4 w-4 text-green-500" />,
  USER_LOGIN: <User className="h-4 w-4 text-blue-500" />,
  USER_LOGOUT: <User className="h-4 w-4 text-gray-500" />,
  default: <Clock className="h-4 w-4" />,
};

const eventColors: Record<string, string> = {
  CERTIFICATE_APPROVED: "bg-green-100 border-green-300",
  CERTIFICATE_REJECTED: "bg-red-100 border-red-300",
  CERTIFICATE_UPLOADED: "bg-blue-100 border-blue-300",
  REMEDIAL_ACTION_CREATED: "bg-yellow-100 border-yellow-300",
  REMEDIAL_ACTION_COMPLETED: "bg-green-100 border-green-300",
  default: "bg-gray-100 border-gray-300",
};

export function AuditTimeline({ entityType, entityId, maxHeight = "400px" }: AuditTimelineProps) {
  const { data: events, isLoading, error } = useQuery<AuditEvent[]>({
    queryKey: ["/api/audit-events", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-events/${entityType}/${entityId}`);
      if (!res.ok) throw new Error("Failed to fetch audit history");
      return res.json();
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Failed to load audit history
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No audit history available
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="relative space-y-4">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-4 pl-10">
            <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${eventColors[event.eventType] || eventColors.default}`}>
              {eventIcons[event.eventType] || eventIcons.default}
            </div>
            
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 truncate" data-testid={`audit-event-message-${index}`}>
                  {event.message}
                </p>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {event.actorType === 'USER' ? 'User' : event.actorType === 'SYSTEM' ? 'System' : 'API'}
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground mt-1">
                by {event.actorName} • {format(new Date(event.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
              
              {event.changes && Object.keys(event.changes).length > 0 && (
                <div className="mt-2 text-xs bg-gray-50 rounded p-2">
                  <p className="font-medium text-gray-600 mb-1">Changes:</p>
                  <ul className="space-y-0.5">
                    {Object.entries(event.changes).slice(0, 3).map(([field, change]) => (
                      <li key={field} className="text-gray-500">
                        <span className="font-medium">{field}:</span>{" "}
                        <span className="line-through text-red-400">{String(change.from || 'empty')}</span>
                        {" → "}
                        <span className="text-green-600">{String(change.to || 'empty')}</span>
                      </li>
                    ))}
                    {Object.keys(event.changes).length > 3 && (
                      <li className="text-gray-400">+{Object.keys(event.changes).length - 3} more changes</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function CertificateAuditTimeline({ certificateId }: { certificateId: string }) {
  return <AuditTimeline entityType="CERTIFICATE" entityId={certificateId} />;
}
