import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Loader2, RefreshCw, Plus, Landmark, Users, Eye
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer, Views, type View, type Event as RBCEvent, type SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, differenceInDays, addDays } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { cn, formatDate, apiRequest } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStream, setFilterStream] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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

  const dateFormat = factorySettings?.regional?.dateFormat || 'DD-MM-YYYY';

  const formatUKDate = useCallback((date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const { data: certificates, isLoading: certificatesLoading } = useQuery<any[]>({
    queryKey: ["calendarCertificates"],
    queryFn: async () => {
      const res = await fetch("/api/certificates", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch certificates");
      return res.json();
    },
  });

  const { data: calendarEvents, isLoading: eventsLoading, refetch } = useQuery<any[]>({
    queryKey: ["calendarEvents"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/events", { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: properties } = useQuery<any[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });

  const { data: complianceStreams } = useQuery<any[]>({
    queryKey: ["complianceStreams"],
    queryFn: async () => {
      const res = await fetch("/api/compliance-streams", { credentials: 'include' });
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

  const handleNavigateToProperty = () => {
    if (selectedEvent?.propertyId) {
      navigate(`/properties/${selectedEvent.propertyId}`);
    }
  };

  const handleNavigateToCertificate = () => {
    if (selectedEvent?.certificateId) {
      navigate(`/certificates/${selectedEvent.certificateId}`);
    }
  };

  const isLoading = certificatesLoading || eventsLoading;

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-compliance-calendar">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Calendar" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Compliance Calendar</h1>
              <p className="text-muted-foreground">Track certificate expirations, legislative deadlines, and compliance events</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-calendar">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-event">
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-bold" data-testid="stat-total-events">{stats.total}</p>
                  </div>
                  <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600">Expiring Soon</p>
                    <p className="text-2xl font-bold text-amber-700" data-testid="stat-expiring-soon">{stats.expiringSoon}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Expired</p>
                    <p className="text-2xl font-bold text-red-700" data-testid="stat-expired">{stats.expired}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600">Compliant</p>
                    <p className="text-2xl font-bold text-emerald-700" data-testid="stat-compliant">{stats.compliant}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600">Legislative</p>
                    <p className="text-2xl font-bold text-purple-700" data-testid="stat-legislative">{stats.legislative}</p>
                  </div>
                  <Landmark className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Calendar</CardTitle>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40" data-testid="select-filter-type">
                      <SelectValue placeholder="Filter by type" />
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
                    <SelectTrigger className="w-40" data-testid="select-filter-stream">
                      <SelectValue placeholder="Filter by stream" />
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
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="h-[600px]" data-testid="calendar-container">
                  <Calendar<CalendarEvent>
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
                    views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
                    formats={{
                      dateFormat: 'd',
                      dayFormat: (date: Date) => format(date, 'EEE dd/MM', { locale: enGB }),
                      monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: enGB }),
                      dayHeaderFormat: (date: Date) => format(date, 'EEEE dd MMMM yyyy', { locale: enGB }),
                      agendaDateFormat: (date: Date) => format(date, 'EEE dd/MM/yyyy', { locale: enGB }),
                    }}
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
                      <span>{formatUKDate(selectedEvent.start)}</span>
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
