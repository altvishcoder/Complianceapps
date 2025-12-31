import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  AlertTriangle, Clock, CheckCircle, FileText, Building2,
  Loader2, RefreshCw
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, addDays, differenceInDays } from "date-fns";
import { cn, formatDate } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'expiry' | 'renewal' | 'due' | 'completed';
  certificateType: string;
  propertyAddress?: string;
  status: string;
}

const eventTypeColors = {
  expiry: 'bg-red-100 border-red-300 text-red-700',
  renewal: 'bg-amber-100 border-amber-300 text-amber-700',
  due: 'bg-blue-100 border-blue-300 text-blue-700',
  completed: 'bg-emerald-100 border-emerald-300 text-emerald-700',
};

const eventTypeBadges = {
  expiry: 'destructive',
  renewal: 'secondary',
  due: 'default',
  completed: 'outline',
} as const;

export default function ComplianceCalendar() {
  useEffect(() => {
    document.title = "Compliance Calendar - ComplianceAI";
  }, []);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [filterType, setFilterType] = useState<string>('all');

  const { data: certificates, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["calendarCertificates"],
    queryFn: async () => {
      const res = await fetch("/api/certificates", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch certificates");
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

  const propertyMap = useMemo(() => {
    return (properties || []).reduce((acc, p) => {
      acc[p.id] = p.addressLine1 || p.uprn || 'Unknown';
      return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  const events: CalendarEvent[] = useMemo(() => {
    if (!certificates) return [];

    return certificates
      .filter(cert => cert.expiryDate)
      .map(cert => {
        const expiryDate = new Date(cert.expiryDate);
        const now = new Date();
        const daysUntilExpiry = differenceInDays(expiryDate, now);

        let type: CalendarEvent['type'] = 'expiry';
        if (daysUntilExpiry < 0) {
          type = 'expiry';
        } else if (daysUntilExpiry <= 30) {
          type = 'renewal';
        } else {
          type = 'due';
        }

        if (cert.status === 'APPROVED' && daysUntilExpiry > 30) {
          type = 'completed';
        }

        return {
          id: cert.id,
          title: cert.certificateType?.replace(/_/g, ' ') || 'Unknown Certificate',
          date: expiryDate,
          type,
          certificateType: cert.certificateType || 'Unknown',
          propertyAddress: propertyMap[cert.propertyId],
          status: cert.status,
        };
      })
      .filter(event => filterType === 'all' || event.type === filterType);
  }, [certificates, propertyMap, filterType]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = monthStart.getDay();
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...monthDays,
  ];

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const upcomingEvents = events
    .filter(event => event.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);

  const expiringSoon = events.filter(event => {
    const daysUntil = differenceInDays(event.date, new Date());
    return daysUntil >= 0 && daysUntil <= 30;
  }).length;

  const expiredCount = events.filter(event => event.date < new Date()).length;

  return (
    <div className="flex h-screen overflow-hidden" data-testid="page-compliance-calendar">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Calendar" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Compliance Calendar</h1>
              <p className="text-muted-foreground">Track certificate expirations, renewals, and compliance deadlines</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-calendar">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40" data-testid="select-filter-type">
                  <SelectValue placeholder="Filter events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="expiry">Expired</SelectItem>
                  <SelectItem value="renewal">Expiring Soon</SelectItem>
                  <SelectItem value="due">Upcoming</SelectItem>
                  <SelectItem value="completed">Compliant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-bold">{events.length}</p>
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
                    <p className="text-2xl font-bold text-amber-700">{expiringSoon}</p>
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
                    <p className="text-2xl font-bold text-red-700">{expiredCount}</p>
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
                    <p className="text-2xl font-bold text-emerald-700">
                      {events.filter(e => e.type === 'completed').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      data-testid="button-prev-month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date())}
                      data-testid="button-today"
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      data-testid="button-next-month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground">
                        {day}
                      </div>
                    ))}
                    {paddedDays.map((day, i) => {
                      if (!day) {
                        return <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />;
                      }

                      const dayEvents = getEventsForDate(day);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const today = isToday(day);

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "bg-background p-2 min-h-[80px] text-left transition-colors hover:bg-muted/50",
                            isSelected && "ring-2 ring-primary",
                            today && "bg-primary/5"
                          )}
                          data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                        >
                          <span className={cn(
                            "text-sm font-medium",
                            today && "text-primary",
                            !isSameMonth(day, currentMonth) && "text-muted-foreground"
                          )}>
                            {format(day, 'd')}
                          </span>
                          <div className="mt-1 space-y-1">
                            {dayEvents.slice(0, 2).map(event => (
                              <div
                                key={event.id}
                                className={cn(
                                  "text-xs px-1 py-0.5 rounded truncate border",
                                  eventTypeColors[event.type]
                                )}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground px-1">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {selectedDate && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {formatDate(selectedDate)}
                    </CardTitle>
                    <CardDescription>
                      {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {selectedDateEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No events on this date
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedDateEvents.map(event => (
                            <div key={event.id} className="p-2 rounded-lg bg-muted/50 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{event.title}</span>
                                <Badge variant={eventTypeBadges[event.type]}>
                                  {event.type}
                                </Badge>
                              </div>
                              {event.propertyAddress && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Building2 className="h-3 w-3" />
                                  {event.propertyAddress}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {upcomingEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No upcoming events
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {upcomingEvents.map(event => {
                          const daysUntil = differenceInDays(event.date, new Date());
                          return (
                            <div key={event.id} className="p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">{event.title}</span>
                                </div>
                                <Badge variant={eventTypeBadges[event.type]}>
                                  {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(event.date)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expired certificates</span>
                      <Badge variant="destructive">{expiredCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expiring in 30 days</span>
                      <Badge variant="secondary">{expiringSoon}</Badge>
                    </div>
                    <Button className="w-full" variant="outline" size="sm">
                      View All Renewals
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
