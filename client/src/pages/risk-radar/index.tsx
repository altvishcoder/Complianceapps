import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw, 
  Shield, 
  Clock, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Flame,
  Zap,
  FileWarning,
  ChevronRight,
  Calendar
} from "lucide-react";
import { Link } from "wouter";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type RiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface PortfolioSummary {
  totalProperties: number;
  distribution: { tier: RiskTier; count: number; percentage: number }[];
  averageScore: number;
  criticalAlerts: number;
  trendsUp: number;
  trendsDown: number;
}

interface PropertyRisk {
  id: string;
  propertyId: string;
  overallScore: number;
  riskTier: RiskTier;
  expiryRiskScore: number;
  defectRiskScore: number;
  assetProfileRiskScore: number;
  coverageGapRiskScore: number;
  externalFactorRiskScore: number;
  factorBreakdown: {
    expiringCertificates: number;
    overdueCertificates: number;
    openDefects: number;
    criticalDefects: number;
    missingStreams: string[];
    assetAge: number | null;
    isHRB: boolean;
    hasVulnerableOccupants: boolean;
    epcRating: string | null;
  };
  triggeringFactors: string[];
  recommendedActions: string[];
  scoreChange: number | null;
  trendDirection: string | null;
  calculatedAt: string;
  propertyAddressLine1: string;
  propertyCity: string;
  propertyPostcode: string;
  propertyUprn: string;
}

interface RiskAlert {
  id: string;
  propertyId: string;
  alertType: string;
  riskTier: RiskTier;
  status: string;
  title: string;
  description: string;
  triggeringFactors: string[];
  riskScore: number;
  dueDate: string;
  slaHours: number;
  escalationLevel: number;
  createdAt: string;
  propertyAddressLine1: string;
  propertyCity: string;
  propertyPostcode: string;
}

const TIER_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#eab308',
  LOW: '#22c55e'
};

const TIER_BG = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-green-100 text-green-800 border-green-300'
};

function TierBadge({ tier }: { tier: RiskTier }) {
  return (
    <Badge className={`${TIER_BG[tier]} border font-semibold`} data-testid={`badge-tier-${tier.toLowerCase()}`}>
      {tier}
    </Badge>
  );
}

function TrendIndicator({ direction, change }: { direction: string | null; change: number | null }) {
  if (!direction || change === null) return <Minus className="h-4 w-4 text-gray-400" />;
  
  if (direction === 'INCREASING') {
    return (
      <span className="flex items-center text-red-600 text-sm">
        <TrendingUp className="h-4 w-4 mr-1" />
        +{change}
      </span>
    );
  }
  if (direction === 'DECREASING') {
    return (
      <span className="flex items-center text-green-600 text-sm">
        <TrendingDown className="h-4 w-4 mr-1" />
        {change}
      </span>
    );
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function RiskScoreGauge({ score, tier }: { score: number; tier: RiskTier }) {
  return (
    <div className="relative w-32 h-32" data-testid="gauge-risk-score">
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle 
          cx="50" cy="50" r="40" 
          fill="none" 
          stroke={TIER_COLORS[tier]} 
          strokeWidth="12"
          strokeDasharray={`${score * 2.51} 251`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: TIER_COLORS[tier] }}>{score}</span>
        <span className="text-xs text-muted-foreground">Risk Score</span>
      </div>
    </div>
  );
}

export default function RiskRadarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("OPEN");

  const { data: summary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ['/api/risk/portfolio-summary'],
  });

  const { data: propertyRisks, isLoading: risksLoading } = useQuery<PropertyRisk[]>({
    queryKey: ['/api/risk/properties', tierFilter],
    queryFn: async () => {
      const url = tierFilter === 'all' 
        ? '/api/risk/properties?limit=50' 
        : `/api/risk/properties?tier=${tierFilter}&limit=50`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<RiskAlert[]>({
    queryKey: ['/api/risk/alerts', alertFilter],
    queryFn: async () => {
      const url = `/api/risk/alerts?status=${alertFilter}&limit=20`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const calculateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/risk/calculate-all', {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Risk Calculation Complete',
        description: `Processed ${data.processed} properties: ${data.critical} critical, ${data.high} high, ${data.medium} medium, ${data.low} low`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/risk'] });
    },
    onError: () => {
      toast({
        title: 'Calculation Failed',
        description: 'Unable to calculate risk scores. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/risk/alerts/${alertId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Alert Updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/risk/alerts'] });
    },
  });

  const pieData = summary?.distribution.map(d => ({
    name: d.tier,
    value: d.count,
    percentage: d.percentage,
    color: TIER_COLORS[d.tier]
  })) || [];

  const factorData = [
    { name: 'Expiry', score: 30, weight: '30%' },
    { name: 'Defects', score: 25, weight: '25%' },
    { name: 'Asset', score: 20, weight: '20%' },
    { name: 'Coverage', score: 15, weight: '15%' },
    { name: 'External', score: 10, weight: '10%' },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-risk-radar">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-risk-radar">Predictive Compliance Radar</h1>
          <p className="text-muted-foreground">ML-powered risk scoring and early warning system for your property portfolio</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calendar">
            <Button variant="outline" data-testid="button-view-calendar">
              <Calendar className="h-4 w-4 mr-2" />
              View Calendar
            </Button>
          </Link>
          <Button 
            onClick={() => calculateAllMutation.mutate()} 
            disabled={calculateAllMutation.isPending}
            data-testid="button-calculate-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${calculateAllMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate All Risks
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-properties">
          <CardHeader className="pb-2">
            <CardDescription>Total Properties</CardDescription>
            <CardTitle className="text-3xl">{summary?.totalProperties || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Under risk monitoring
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-average-score">
          <CardHeader className="pb-2">
            <CardDescription>Average Risk Score</CardDescription>
            <CardTitle className="text-3xl">{summary?.averageScore || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={summary?.averageScore || 0} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50" data-testid="card-critical-alerts">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-700">Critical Alerts</CardDescription>
            <CardTitle className="text-3xl text-red-700">{summary?.criticalAlerts || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Require immediate action
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-trends">
          <CardHeader className="pb-2">
            <CardDescription>Trending</CardDescription>
            <div className="flex gap-4">
              <div className="flex items-center gap-1 text-red-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-lg font-bold">{summary?.trendsUp || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-lg font-bold">{summary?.trendsDown || 0}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Properties with score changes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1" data-testid="card-risk-distribution">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Portfolio breakdown by risk tier</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-[200px] flex items-center justify-center">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-sm">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
                  <span>{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-testid="card-factor-weights">
          <CardHeader>
            <CardTitle>Risk Factor Weights</CardTitle>
            <CardDescription>Contribution of each factor to overall risk score</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={factorData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(value: number) => [`${value}%`, 'Weight']} />
                <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-5 gap-2 mt-4 text-xs text-center">
              <div className="flex flex-col items-center">
                <Clock className="h-5 w-5 text-blue-500" />
                <span>Expiry</span>
                <span className="font-bold">30%</span>
              </div>
              <div className="flex flex-col items-center">
                <FileWarning className="h-5 w-5 text-orange-500" />
                <span>Defects</span>
                <span className="font-bold">25%</span>
              </div>
              <div className="flex flex-col items-center">
                <Building2 className="h-5 w-5 text-purple-500" />
                <span>Asset</span>
                <span className="font-bold">20%</span>
              </div>
              <div className="flex flex-col items-center">
                <Shield className="h-5 w-5 text-green-500" />
                <span>Coverage</span>
                <span className="font-bold">15%</span>
              </div>
              <div className="flex flex-col items-center">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span>External</span>
                <span className="font-bold">10%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="properties" className="space-y-4">
        <TabsList data-testid="tabs-risk-views">
          <TabsTrigger value="properties">Properties at Risk</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-tier-filter">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="CRITICAL">Critical Only</SelectItem>
                <SelectItem value="HIGH">High Only</SelectItem>
                <SelectItem value="MEDIUM">Medium Only</SelectItem>
                <SelectItem value="LOW">Low Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {risksLoading ? (
            <div className="h-[200px] flex items-center justify-center">Loading property risks...</div>
          ) : propertyRisks?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Risk Data Available</h3>
                <p className="text-muted-foreground">Click "Recalculate All Risks" to generate risk scores for your properties.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {propertyRisks?.map(risk => (
                <Card key={risk.id} className="hover:shadow-md transition-shadow" data-testid={`card-property-risk-${risk.propertyId}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-6">
                      <RiskScoreGauge score={risk.overallScore} tier={risk.riskTier} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TierBadge tier={risk.riskTier} />
                          <TrendIndicator direction={risk.trendDirection} change={risk.scoreChange} />
                        </div>
                        <h3 className="font-semibold truncate">{risk.propertyAddressLine1}</h3>
                        <p className="text-sm text-muted-foreground">{risk.propertyCity}, {risk.propertyPostcode}</p>
                        <p className="text-xs text-muted-foreground">UPRN: {risk.propertyUprn}</p>
                      </div>

                      <div className="hidden md:grid grid-cols-5 gap-4 text-center text-xs">
                        <div>
                          <div className="text-lg font-bold" style={{ color: risk.expiryRiskScore > 50 ? '#dc2626' : '#16a34a' }}>
                            {risk.expiryRiskScore}
                          </div>
                          <div className="text-muted-foreground">Expiry</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold" style={{ color: risk.defectRiskScore > 50 ? '#dc2626' : '#16a34a' }}>
                            {risk.defectRiskScore}
                          </div>
                          <div className="text-muted-foreground">Defects</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold" style={{ color: risk.assetProfileRiskScore > 50 ? '#dc2626' : '#16a34a' }}>
                            {risk.assetProfileRiskScore}
                          </div>
                          <div className="text-muted-foreground">Asset</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold" style={{ color: risk.coverageGapRiskScore > 50 ? '#dc2626' : '#16a34a' }}>
                            {risk.coverageGapRiskScore}
                          </div>
                          <div className="text-muted-foreground">Coverage</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold" style={{ color: risk.externalFactorRiskScore > 50 ? '#dc2626' : '#16a34a' }}>
                            {risk.externalFactorRiskScore}
                          </div>
                          <div className="text-muted-foreground">External</div>
                        </div>
                      </div>

                      <div className="text-right">
                        {risk.factorBreakdown && (
                          <div className="flex flex-wrap gap-1 justify-end mb-2">
                            {risk.factorBreakdown.overdueCertificates > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {risk.factorBreakdown.overdueCertificates} Overdue
                              </Badge>
                            )}
                            {risk.factorBreakdown.criticalDefects > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {risk.factorBreakdown.criticalDefects} Critical
                              </Badge>
                            )}
                            {risk.factorBreakdown.isHRB && (
                              <Badge variant="outline" className="text-xs">HRB</Badge>
                            )}
                          </div>
                        )}
                        <Link href={`/properties/${risk.propertyId}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-property-${risk.propertyId}`}>
                            View <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {risk.triggeringFactors && risk.triggeringFactors.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Risk Factors:</p>
                        <div className="flex flex-wrap gap-1">
                          {risk.triggeringFactors.slice(0, 4).map((factor, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{factor}</Badge>
                          ))}
                          {risk.triggeringFactors.length > 4 && (
                            <Badge variant="secondary" className="text-xs">+{risk.triggeringFactors.length - 4} more</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-alert-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertsLoading ? (
            <div className="h-[200px] flex items-center justify-center">Loading alerts...</div>
          ) : alerts?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">No {alertFilter.toLowerCase()} Alerts</h3>
                <p className="text-muted-foreground">Your portfolio is in good standing.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts?.map(alert => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.riskTier === 'CRITICAL' ? 'border-l-red-500' :
                  alert.riskTier === 'HIGH' ? 'border-l-orange-500' :
                  'border-l-yellow-500'
                }`} data-testid={`card-alert-${alert.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {alert.riskTier === 'CRITICAL' ? (
                          <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                        ) : alert.riskTier === 'HIGH' ? (
                          <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0" />
                        ) : (
                          <FileWarning className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <TierBadge tier={alert.riskTier} />
                            <Badge variant="outline">{alert.status}</Badge>
                            {alert.escalationLevel > 0 && (
                              <Badge variant="destructive">Escalated x{alert.escalationLevel}</Badge>
                            )}
                          </div>
                          <h4 className="font-semibold">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground">{alert.propertyAddressLine1}, {alert.propertyCity}</p>
                          <p className="text-sm mt-1">{alert.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Score: {alert.riskScore}</span>
                            <span>SLA: {alert.slaHours}h</span>
                            {alert.dueDate && (
                              <span>Due: {format(new Date(alert.dueDate), 'MMM d, yyyy HH:mm')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {alert.status === 'OPEN' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateAlertMutation.mutate({ alertId: alert.id, status: 'ACKNOWLEDGED' })}
                              data-testid={`button-acknowledge-${alert.id}`}
                            >
                              Acknowledge
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateAlertMutation.mutate({ alertId: alert.id, status: 'ESCALATED' })}
                              data-testid={`button-escalate-${alert.id}`}
                            >
                              Escalate
                            </Button>
                          </>
                        )}
                        {(alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED') && (
                          <Button 
                            size="sm"
                            onClick={() => updateAlertMutation.mutate({ alertId: alert.id, status: 'RESOLVED' })}
                            data-testid={`button-resolve-${alert.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                        <Link href={`/properties/${alert.propertyId}`}>
                          <Button variant="ghost" size="sm">
                            View Property
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
