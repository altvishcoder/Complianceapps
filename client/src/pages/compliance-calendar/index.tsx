import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar as CalendarIcon, 
  AlertTriangle, Clock, CheckCircle, FileText, Building2,
  Loader2, RefreshCw, Plus, Landmark, Users, Eye, Radar,
  ToggleLeft, ToggleRight
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer, Views, type View, type Event as RBCEvent, type SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, differenceInDays, addDays } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { cn } from "@/lib/utils";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CardSkeleton } from "@/components/ui/skeleton";

function parseCalendarParams(search: string) {
  const params = new URLSearchParams(search);
  const dateStr = params.get('date');
  let parsedDate = new Date();
  if (dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    parsedDate = new Date(year, month - 1, day);
  }
  return {
    date: parsedDate,
    view: (params.get('view') as View) || Views.MONTH,
    filterType: params.get('filterType') || 'all',
    filterStream: params.get('filterStream') || 'all',
  };
}

function buildCalendarParams(date: Date, view: View, filterType: string, filterStream: string) {
  const params = new URLSearchParams();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  params.set('date', `${year}-${month}-${day}`);
  params.set('view', view);
  if (filterType !== 'all') params.set('filterType', filterType);
  if (filterStream !== 'all') params.set('filterStream', filterStream);
  return params.toString();
}

const locales = { 'en-GB': enGB };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'expiry' | 'renewal' | 'due' | 'completed' | 'legislative' | 'company_wide' | 'stream_task' | 'certificate_expiry' | 'remedial_due' | 'inspection';
  eventType?: string;
  certificateType?: string;
  propertyAddress?: string;
  propertyId?: string;
  certificateId?: string;
  remedialActionId?: string;
  complianceStreamId?: string;
  description?: string;
  legislationRef?: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrencePattern?: string;
  resource?: any;
}

const eventTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  expiry: { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
  renewal: { bg: '#fef3c7', border: '#fcd34d', text: '#b45309' },
  due: { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
  completed: { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
  legislative: { bg: '#f3e8ff', border: '#c4b5fd', text: '#7c3aed' },
  company_wide: { bg: '#e0f2fe', border: '#7dd3fc', text: '#0369a1' },
  stream_task: { bg: '#fce7f3', border: '#f9a8d4', text: '#be185d' },
  certificate_expiry: { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
  remedial_due: { bg: '#fef3c7', border: '#fcd34d', text: '#b45309' },
  inspection: { bg: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
};

const eventTypeLabels: Record<string, string> = {
  expiry: 'Expired',
  renewal: 'Expiring Soon',
  due: 'Upcoming',
  completed: 'Compliant',
  legislative: 'Legislative Deadline',
  company_wide: 'Company Event',
  stream_task: 'Stream Task',
  certificate_expiry: 'Certificate Expiry',
  remedial_due: 'Remedial Due',
  inspection: 'Inspection',
};

const eventTypeIcons: Record<string, typeof CalendarIcon> = {
  legislative: Landmark,
  company_wide: Users,
  certificate_expiry: FileText,
  remedial_due: Clock,
  inspection: Eye,
};

export default function ComplianceCalendar() {
  useEffect(() => {
    document.title = "Compliance Calendar - ComplianceAI";
  }, []);

  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize state from URL params
  const initialParams = useMemo(() => parseCalendarParams(searchString), []);
  const [currentDate, setCurrentDate] = useState(initialParams.date);
  const [currentView, setCurrentView] = useState<View>(initialParams.view);
  const [filterType, setFilterType] = useState<string>(initialParams.filterType);
  const [filterStream, setFilterStream] = useState<string>(initialParams.filterStream);
  
  // Update URL when state changes (without full navigation)
  useEffect(() => {
    const newParams = buildCalendarParams(currentDate, currentView, filterType, filterStream);
    const newUrl = `/calendar?${newParams}`;
    window.history.replaceState(null, '', newUrl);
  }, [currentDate, currentView, filterType, filterStream]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventType: 'company_wide' as string,
    startDate: '',
    endDate: '',
    isAllDay: true,
    isRecurring: false,
    recurrencePattern: 'none' as string,
    legislationRef: '',
    complianceStreamId: '',
  });

  const { data: factorySettings } = useQuery<any>({
    queryKey: ["factorySettings"],
    queryFn: async () => {
      const res = await fetch("/api/factory-settings", { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const dateFormatSetting = factorySettings?.regional?.dateFormat || 'DD-MM-YYYY';
  
  const formatConfiguredDate = useCallback((date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    switch (dateFormatSetting) {
      case 'MM-DD-YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD-MM-YYYY':
      default:
        return `${day}/${month}/${year}`;
    }
  }, [dateFormatSetting]);
  
  const getDateFnsFormat = useCallback(() => {
    switch (dateFormatSetting) {
      case 'MM-DD-YYYY':
        return 'MM/dd/yyyy';
      case 'YYYY-MM-DD':
        return 'yyyy-MM-dd';
      case 'DD-MM-YYYY':
      default:
        return 'dd/MM/yyyy';
    }
  }, [dateFormatSetting]);
  
  const getShortDateFormat = useCallback(() => {
    switch (dateFormatSetting) {
      case 'MM-DD-YYYY':
        return 'MM/dd';
      case 'YYYY-MM-DD':
        return 'MM-dd';
      case 'DD-MM-YYYY':
      default:
        return 'dd/MM';
    }
  }, [dateFormatSetting]);
  
  const calendarFormats = useMemo(() => ({
    dateFormat: 'd',
    dayFormat: (date: Date) => `${format(date, 'EEE', { locale: enGB })} ${format(date, getShortDateFormat(), { locale: enGB })}`,
    monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: enGB }),
    dayHeaderFormat: (date: Date) => `${format(date, 'EEEE', { locale: enGB })} ${format(date, getDateFnsFormat(), { locale: enGB })}`,
    agendaDateFormat: (date: Date) => `${format(date, 'EEE', { locale: enGB })} ${format(date, getDateFnsFormat(), { locale: enGB })}`,
  }), [getDateFnsFormat, getShortDateFormat]);

  const { data: certificatesResponse, isLoading: certificatesLoading } = useQuery<{ data: any[], total: number }>({
    queryKey: ["calendarCertificates"],
    queryFn: async () => {
      const res = await fetch("/api/certificates?limit=200", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch certificates");
      return res.json();
    },
  });
  const certificates = certificatesResponse?.data || [];

  const { data: calendarEvents, isLoading: eventsLoading, refetch } = useQuery<any[]>({
    queryKey: ["calendarEvents"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/events", { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: propertiesResponse } = useQuery<{ data: any[], total: number }>({
    queryKey: ["calendarProperties"],
    queryFn: async () => {
      const res = await fetch("/api/properties?limit=200", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });
  const properties = propertiesResponse?.data || [];

  const { data: complianceStreams } = useQuery<any[]>({
    queryKey: ["complianceStreams"],
    queryFn: async () => {
      const res = await fetch("/api/config/compliance-streams", { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(eventData),
      });
      if (!res.ok) throw new Error("Failed to create event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      setIsCreateDialogOpen(false);
      setNewEvent({
        title: '',
        description: '',
        eventType: 'company_wide',
        startDate: '',
        endDate: '',
        isAllDay: true,
        isRecurring: false,
        recurrencePattern: 'none',
        legislationRef: '',
        complianceStreamId: '',
      });
      toast({ title: "Event created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  const propertyMap = useMemo(() => {
    return (properties || []).reduce((acc, p) => {
      acc[p.id] = p.addressLine1 || p.uprn || 'Unknown';
      return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  const events: CalendarEvent[] = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    if (certificates) {
      certificates
        .filter(cert => cert.expiryDate)
        .forEach(cert => {
          const expiryDate = new Date(cert.expiryDate);
          const now = new Date();
          const daysUntilExpiry = differenceInDays(expiryDate, now);

          let type: CalendarEvent['type'] = 'certificate_expiry';
          if (daysUntilExpiry < 0) {
            type = 'expiry';
          } else if (daysUntilExpiry <= 30) {
            type = 'renewal';
          } else if (cert.status === 'APPROVED' && daysUntilExpiry > 30) {
            type = 'completed';
          } else {
            type = 'due';
          }

          allEvents.push({
            id: `cert-${cert.id}`,
            title: cert.certificateType?.replace(/_/g, ' ') || 'Certificate Expiry',
            start: expiryDate,
            end: expiryDate,
            type,
            eventType: type,
            certificateType: cert.certificateType || 'Unknown',
            propertyAddress: propertyMap[cert.propertyId],
            propertyId: cert.propertyId,
            certificateId: cert.id,
            isAllDay: true,
          });
        });
    }

    if (calendarEvents) {
      calendarEvents.forEach(event => {
        allEvents.push({
          id: event.id,
          title: event.title,
          start: new Date(event.startDate),
          end: event.endDate ? new Date(event.endDate) : new Date(event.startDate),
          type: event.eventType as CalendarEvent['type'],
          eventType: event.eventType,
          description: event.description,
          legislationRef: event.legislationRef,
          complianceStreamId: event.complianceStreamId,
          propertyId: event.propertyId,
          certificateId: event.certificateId,
          remedialActionId: event.remedialActionId,
          isAllDay: event.isAllDay,
          isRecurring: event.isRecurring,
          recurrencePattern: event.recurrencePattern,
        });
      });
    }

    return allEvents.filter(event => {
      if (filterType !== 'all' && event.type !== filterType && event.eventType !== filterType) {
        return false;
      }
      if (filterStream !== 'all' && event.complianceStreamId !== filterStream) {
        return false;
      }
      return true;
    });
  }, [certificates, calendarEvents, propertyMap, filterType, filterStream]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: events.length,
      expiringSoon: events.filter(e => {
        const daysUntil = differenceInDays(e.start, now);
        return daysUntil >= 0 && daysUntil <= 30;
      }).length,
      expired: events.filter(e => e.start < now && (e.type === 'expiry' || e.type === 'certificate_expiry')).length,
      compliant: events.filter(e => e.type === 'completed').length,
      legislative: events.filter(e => e.type === 'legislative').length,
    };
  }, [events]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = eventTypeColors[event.type] || eventTypeColors.due;
    return {
      style: {
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
        borderRadius: '4px',
        fontSize: '12px',
        padding: '2px 4px',
      },
    };
  }, []);

  const eventDensityMap = useMemo(() => {
    const densityMap = new Map<string, { total: number; expired: number; expiringSoon: number }>();
    const now = new Date();
    
    events.forEach(event => {
      const dateKey = format(event.start, 'yyyy-MM-dd');
      const existing = densityMap.get(dateKey) || { total: 0, expired: 0, expiringSoon: 0 };
      const daysUntil = differenceInDays(event.start, now);
      
      existing.total += 1;
      if (daysUntil < 0) {
        existing.expired += 1;
      } else if (daysUntil <= 30) {
        existing.expiringSoon += 1;
      }
      
      densityMap.set(dateKey, existing);
    });
    
    return densityMap;
  }, [events]);

  const maxDensity = useMemo(() => {
    let max = 0;
    eventDensityMap.forEach(({ total }) => {
      if (total > max) max = total;
    });
    return max || 1;
  }, [eventDensityMap]);

  const dayPropGetter = useCallback((date: Date) => {
    if (!showHeatmap) return {};
    
    const dateKey = format(date, 'yyyy-MM-dd');
    const density = eventDensityMap.get(dateKey);
    
    if (!density || density.total === 0) return {};
    
    const intensity = Math.min(density.total / maxDensity, 1);
    
    let bgColor: string;
    if (density.expired > 0) {
      const alpha = 0.15 + intensity * 0.35;
      bgColor = `rgba(239, 68, 68, ${alpha})`;
    } else if (density.expiringSoon > 0) {
      const alpha = 0.15 + intensity * 0.35;
      bgColor = `rgba(245, 158, 11, ${alpha})`;
    } else {
      const alpha = 0.1 + intensity * 0.25;
      bgColor = `rgba(34, 197, 94, ${alpha})`;
    }
    
    return {
      style: {
        backgroundColor: bgColor,
      },
    };
  }, [showHeatmap, eventDensityMap, maxDensity]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  }, []);

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setNewEventDate(slotInfo.start);
    setNewEvent(prev => ({
      ...prev,
      startDate: format(slotInfo.start, 'yyyy-MM-dd'),
      endDate: format(slotInfo.end, 'yyyy-MM-dd'),
    }));
    setIsCreateDialogOpen(true);
  }, []);

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleViewChange = useCallback((view: View) => {
    setCurrentView(view);
  }, []);

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.startDate) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    
    createEventMutation.mutate({
      title: newEvent.title,
      description: newEvent.description || null,
      eventType: newEvent.eventType,
      startDate: newEvent.startDate,
      endDate: newEvent.endDate || null,
      isAllDay: newEvent.isAllDay,
      isRecurring: newEvent.isRecurring,
      recurrencePattern: newEvent.isRecurring ? newEvent.recurrencePattern : null,
      legislationRef: newEvent.legislationRef || null,
      complianceStreamId: newEvent.complianceStreamId || null,
    });
  };

  const getCalendarReturnUrl = useCallback(() => {
    const params = buildCalendarParams(currentDate, currentView, filterType, filterStream);
    return `/calendar?${params}`;
  }, [currentDate, currentView, filterType, filterStream]);

  const handleNavigateToProperty = () => {
    if (selectedEvent?.propertyId) {
      const returnUrl = encodeURIComponent(getCalendarReturnUrl());
      navigate(`/properties/${selectedEvent.propertyId}?from=${returnUrl}`);
    }
  };

  const handleNavigateToCertificate = () => {
    if (selectedEvent?.certificateId) {
      const returnUrl = encodeURIComponent(getCalendarReturnUrl());
      navigate(`/certificates/${selectedEvent.certificateId}?from=${returnUrl}`);
    }
  };

  const isLoading = certificatesLoading || eventsLoading;

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-compliance-calendar">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Calendar" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-0">
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-bold">Compliance Calendar</h1>
              <p className="text-sm text-muted-foreground">Track certificate expirations, legislative deadlines, and compliance events</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={showHeatmap ? "default" : "outline"} 
                onClick={() => setShowHeatmap(!showHeatmap)} 
                data-testid="button-toggle-heatmap"
                size="sm"
                className={showHeatmap ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" : ""}
              >
                {showHeatmap ? <ToggleRight className="h-4 w-4 sm:mr-2" /> : <ToggleLeft className="h-4 w-4 sm:mr-2" />}
                <span className="hidden sm:inline">Heatmap</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/risk-radar')} data-testid="button-view-radar">
                <Radar className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Risk Radar</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-calendar">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-event">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>

          <HeroStatsGrid stats={[
            {
              title: "Total Events",
              value: stats.total,
              icon: CalendarIcon,
              riskLevel: "low",
              subtitle: "All calendar events",
              testId: "stat-total-events"
            },
            {
              title: "Expiring Soon",
              value: stats.expiringSoon,
              icon: Clock,
              riskLevel: stats.expiringSoon > 0 ? "high" : "good",
              subtitle: "Within 30 days",
              testId: "stat-expiring-soon"
            },
            {
              title: "Expired",
              value: stats.expired,
              icon: AlertTriangle,
              riskLevel: stats.expired > 0 ? "critical" : "good",
              subtitle: "Requires action",
              testId: "stat-expired"
            },
            {
              title: "Compliant",
              value: stats.compliant,
              icon: CheckCircle,
              riskLevel: "good",
              subtitle: "Up to date",
              testId: "stat-compliant"
            },
            {
              title: "Legislative",
              value: stats.legislative,
              icon: Landmark,
              riskLevel: "medium",
              subtitle: "Regulatory deadlines",
              testId: "stat-legislative"
            }
          ]} />

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Calendar</CardTitle>
                  <div className="flex gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-28 sm:w-40 h-9" data-testid="select-filter-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="legislative">Legislative</SelectItem>
                        <SelectItem value="company_wide">Company Events</SelectItem>
                        <SelectItem value="certificate_expiry">Certificate Expiry</SelectItem>
                        <SelectItem value="remedial_due">Remedial Due</SelectItem>
                        <SelectItem value="inspection">Inspections</SelectItem>
                        <SelectItem value="expiry">Expired</SelectItem>
                        <SelectItem value="renewal">Expiring Soon</SelectItem>
                        <SelectItem value="completed">Compliant</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStream} onValueChange={setFilterStream}>
                      <SelectTrigger className="w-28 sm:w-40 h-9" data-testid="select-filter-stream">
                        <SelectValue placeholder="Stream" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Streams</SelectItem>
                        {complianceStreams?.map(stream => (
                          <SelectItem key={stream.id} value={stream.id}>
                            {stream.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {showHeatmap && (
                  <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground border-t pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-4 overflow-x-auto" data-testid="heatmap-legend">
                    <span className="font-medium shrink-0">Heatmap:</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-400/50" />
                      <span>Expired</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-amber-400/50" />
                      <span>Expiring</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-400/35" />
                      <span>Compliant</span>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && !events.length ? (
                <CardSkeleton hasHeader={false} contentHeight={600} />
              ) : (
                <div className="h-[600px]" data-testid="calendar-container">
                  <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    date={currentDate}
                    view={currentView}
                    onNavigate={handleNavigate}
                    onView={handleViewChange}
                    onSelectEvent={handleSelectEvent}
                    onSelectSlot={handleSelectSlot}
                    selectable
                    eventPropGetter={eventStyleGetter}
                    dayPropGetter={dayPropGetter}
                    views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
                    formats={calendarFormats}
                    messages={{
                      today: 'Today',
                      previous: 'Back',
                      next: 'Next',
                      month: 'Month',
                      week: 'Week',
                      agenda: 'Agenda',
                      noEventsInRange: 'No events in this range.',
                    }}
                    popup
                    culture="en-GB"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{selectedEvent?.title}</DialogTitle>
              </DialogHeader>
              {selectedEvent && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge 
                      style={{ 
                        backgroundColor: eventTypeColors[selectedEvent.type]?.bg,
                        color: eventTypeColors[selectedEvent.type]?.text,
                      }}
                    >
                      {eventTypeLabels[selectedEvent.type] || selectedEvent.type}
                    </Badge>
                    {selectedEvent.isRecurring && (
                      <Badge variant="outline">Recurring: {selectedEvent.recurrencePattern}</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{formatConfiguredDate(selectedEvent.start)}</span>
                    </div>
                    
                    {selectedEvent.certificateType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Certificate Type:</span>
                        <span>{selectedEvent.certificateType}</span>
                      </div>
                    )}
                    
                    {selectedEvent.propertyAddress && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Property:</span>
                        <span>{selectedEvent.propertyAddress}</span>
                      </div>
                    )}
                    
                    {selectedEvent.legislationRef && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Legislation:</span>
                        <span>{selectedEvent.legislationRef}</span>
                      </div>
                    )}
                    
                    {selectedEvent.description && (
                      <div>
                        <span className="text-muted-foreground">Description:</span>
                        <p className="mt-1">{selectedEvent.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <DialogFooter className="gap-2">
                    {selectedEvent.propertyId && (
                      <Button variant="outline" onClick={handleNavigateToProperty} data-testid="button-view-property">
                        <Building2 className="h-4 w-4 mr-2" />
                        View Property
                      </Button>
                    )}
                    {selectedEvent.certificateId && (
                      <Button onClick={handleNavigateToCertificate} data-testid="button-view-certificate">
                        <FileText className="h-4 w-4 mr-2" />
                        View Certificate
                      </Button>
                    )}
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Calendar Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="event-title">Title *</Label>
                  <Input
                    id="event-title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Event title"
                    data-testid="input-event-title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="event-type">Event Type</Label>
                  <Select 
                    value={newEvent.eventType} 
                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, eventType: value }))}
                  >
                    <SelectTrigger data-testid="select-event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="legislative">Legislative Deadline</SelectItem>
                      <SelectItem value="company_wide">Company Event</SelectItem>
                      <SelectItem value="stream_task">Stream Task</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-start">Start Date *</Label>
                    <Input
                      id="event-start"
                      type="date"
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, startDate: e.target.value }))}
                      data-testid="input-event-start"
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-end">End Date</Label>
                    <Input
                      id="event-end"
                      type="date"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, endDate: e.target.value }))}
                      data-testid="input-event-end"
                    />
                  </div>
                </div>
                
                {newEvent.eventType === 'legislative' && (
                  <div>
                    <Label htmlFor="legislation-ref">Legislation Reference</Label>
                    <Input
                      id="legislation-ref"
                      value={newEvent.legislationRef}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, legislationRef: e.target.value }))}
                      placeholder="e.g., Gas Safety (Installation and Use) Regulations 1998"
                      data-testid="input-legislation-ref"
                    />
                  </div>
                )}
                
                <div>
                  <Label htmlFor="compliance-stream">Compliance Stream</Label>
                  <Select 
                    value={newEvent.complianceStreamId} 
                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, complianceStreamId: value }))}
                  >
                    <SelectTrigger data-testid="select-compliance-stream">
                      <SelectValue placeholder="Select stream (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {complianceStreams?.map(stream => (
                        <SelectItem key={stream.id} value={stream.id}>
                          {stream.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEvent.isRecurring}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, isRecurring: e.target.checked }))}
                      className="rounded border-gray-300"
                      data-testid="checkbox-recurring"
                    />
                    <span className="text-sm">Recurring Event</span>
                  </label>
                </div>
                
                {newEvent.isRecurring && (
                  <div>
                    <Label htmlFor="recurrence">Recurrence Pattern</Label>
                    <Select 
                      value={newEvent.recurrencePattern} 
                      onValueChange={(value) => setNewEvent(prev => ({ ...prev, recurrencePattern: value }))}
                    >
                      <SelectTrigger data-testid="select-recurrence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Event description"
                    data-testid="input-event-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateEvent} 
                  disabled={createEventMutation.isPending}
                  data-testid="button-create-event"
                >
                  {createEventMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
