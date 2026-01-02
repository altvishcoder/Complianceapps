import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  ChevronDown,
  ChevronUp,
  Calendar,
  Brain,
  Calculator,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Filter,
  MoreHorizontal,
  MapPin,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

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

interface MLPrediction {
  id: string;
  propertyId: string;
  riskScore: number;
  riskCategory: string;
  breachProbability: number;
  predictedBreachDate: string | null;
  confidenceLevel: number;
  sourceLabel: 'Statistical' | 'ML-Enhanced' | 'ML-Only';
  createdAt: string;
}

interface MLModelMetrics {
  model: {
    accuracy: number | null;
    totalPredictions: number;
    correctPredictions: number;
  } | null;
  feedbackStats: {
    total: number;
    correct: number;
    incorrect: number;
  };
  trainingReady: boolean;
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

const TIER_BG_SOLID = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500'
};

function TierBadge({ tier, size = "default" }: { tier: RiskTier; size?: "default" | "sm" }) {
  return (
    <Badge 
      className={cn(
        TIER_BG[tier], 
        "border font-semibold",
        size === "sm" && "text-xs px-1.5 py-0"
      )} 
      data-testid={`badge-tier-${tier.toLowerCase()}`}
    >
      {tier}
    </Badge>
  );
}

function TrendIndicator({ direction, change }: { direction: string | null; change: number | null }) {
  if (!direction || change === null) return <Minus className="h-4 w-4 text-gray-400" />;
  
  if (direction === 'INCREASING') {
    return (
      <span className="flex items-center text-red-600 text-sm font-medium">
        <TrendingUp className="h-4 w-4 mr-0.5" />
        +{change}
      </span>
    );
  }
  if (direction === 'DECREASING') {
    return (
      <span className="flex items-center text-green-600 text-sm font-medium">
        <TrendingDown className="h-4 w-4 mr-0.5" />
        {change}
      </span>
    );
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function RiskScoreCircle({ score, tier, size = "md" }: { score: number; tier: RiskTier; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { container: "w-12 h-12", text: "text-sm", label: "text-[8px]", stroke: 8, radius: 18 },
    md: { container: "w-16 h-16", text: "text-lg", label: "text-[9px]", stroke: 10, radius: 24 },
    lg: { container: "w-24 h-24", text: "text-2xl", label: "text-xs", stroke: 12, radius: 36 }
  };
  const s = sizes[size];
  
  return (
    <div className={cn("relative flex-shrink-0", s.container)} data-testid="circle-risk-score">
      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth={s.stroke} />
        <circle 
          cx="50" cy="50" r="40" 
          fill="none" 
          stroke={TIER_COLORS[tier]} 
          strokeWidth={s.stroke}
          strokeDasharray={`${score * 2.51} 251`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold leading-none", s.text)} style={{ color: TIER_COLORS[tier] }}>{score}</span>
      </div>
    </div>
  );
}

function SourceBadge({ sourceLabel }: { sourceLabel: string }) {
  switch (sourceLabel) {
    case 'Statistical':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1" data-testid="badge-source-statistical">
          <Calculator className="h-3 w-3" /> Stats
        </Badge>
      );
    case 'ML-Enhanced':
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs gap-1" data-testid="badge-source-ml-enhanced">
          <Brain className="h-3 w-3" /> ML+
        </Badge>
      );
    case 'ML-Only':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs gap-1" data-testid="badge-source-ml-only">
          <Sparkles className="h-3 w-3" /> ML
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{sourceLabel}</Badge>;
  }
}

function ConfidenceBar({ confidence, sourceLabel }: { confidence?: number | null; sourceLabel: string }) {
  const safeConfidence = confidence ?? 0;
  
  const getColor = () => {
    if (sourceLabel === 'Statistical') return 'bg-blue-500';
    if (safeConfidence >= 80) return 'bg-green-500';
    if (safeConfidence >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="w-full" data-testid="confidence-bar">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">Confidence</span>
        <span className="font-medium">{safeConfidence.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all", getColor())}
          style={{ width: `${safeConfidence}%` }}
        />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="min-w-[140px] flex-shrink-0 snap-start">
      <CardHeader className="pb-2 px-3 pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-12 mt-1" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

function PropertyCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}

function MobileQuickStats({ summary, isLoading }: { summary: PortfolioSummary | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <ScrollArea className="w-full md:hidden">
        <div className="flex gap-3 pb-2 px-1">
          {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  }

  const stats = [
    { 
      label: "Properties", 
      value: summary?.totalProperties || 0, 
      icon: Building2, 
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    { 
      label: "Avg Score", 
      value: summary?.averageScore || 0, 
      icon: Activity, 
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    { 
      label: "Critical", 
      value: summary?.criticalAlerts || 0, 
      icon: AlertTriangle, 
      color: "text-red-600",
      bg: "bg-red-50"
    },
    { 
      label: "Trending Up", 
      value: summary?.trendsUp || 0, 
      icon: TrendingUp, 
      color: "text-orange-600",
      bg: "bg-orange-50"
    },
  ];

  return (
    <ScrollArea className="w-full md:hidden">
      <div className="flex gap-3 pb-2 px-1">
        {stats.map((stat, i) => (
          <Card key={i} className={cn("min-w-[130px] flex-shrink-0 snap-start border-0 shadow-sm", stat.bg)}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <stat.icon className={cn("h-4 w-4", stat.color)} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className={cn("text-2xl font-bold mt-1", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function DesktopStatCards({ summary, isLoading }: { summary: PortfolioSummary | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card data-testid="card-total-properties">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Total Properties
          </CardDescription>
          <CardTitle className="text-3xl">{summary?.totalProperties || 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Under risk monitoring</p>
        </CardContent>
      </Card>

      <Card data-testid="card-average-score">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Average Risk Score
          </CardDescription>
          <CardTitle className="text-3xl">{summary?.averageScore || 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={summary?.averageScore || 0} className="h-2" />
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50/50" data-testid="card-critical-alerts">
        <CardHeader className="pb-2">
          <CardDescription className="text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Critical Alerts
          </CardDescription>
          <CardTitle className="text-3xl text-red-700">{summary?.criticalAlerts || 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Require immediate action</p>
        </CardContent>
      </Card>

      <Card data-testid="card-trends">
        <CardHeader className="pb-2">
          <CardDescription>Risk Trends</CardDescription>
          <div className="flex gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-100">
                <TrendingUp className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <span className="text-xl font-bold text-red-600">{summary?.trendsUp || 0}</span>
                <p className="text-xs text-muted-foreground">Increasing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-green-100">
                <TrendingDown className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <span className="text-xl font-bold text-green-600">{summary?.trendsDown || 0}</span>
                <p className="text-xs text-muted-foreground">Decreasing</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

function PropertyRiskCard({ risk, isExpanded, onToggle }: { 
  risk: PropertyRisk; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  return (
    <Card 
      className={cn(
        "transition-all duration-200 cursor-pointer active:scale-[0.99]",
        risk.riskTier === 'CRITICAL' && "border-l-4 border-l-red-500",
        risk.riskTier === 'HIGH' && "border-l-4 border-l-orange-500",
        risk.riskTier === 'MEDIUM' && "border-l-4 border-l-yellow-500",
        risk.riskTier === 'LOW' && "border-l-4 border-l-green-500"
      )} 
      data-testid={`card-property-risk-${risk.propertyId}`}
      onClick={onToggle}
    >
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-3 md:gap-4">
          <RiskScoreCircle score={risk.overallScore} tier={risk.riskTier} size="sm" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <TierBadge tier={risk.riskTier} size="sm" />
              <TrendIndicator direction={risk.trendDirection} change={risk.scoreChange} />
              {risk.factorBreakdown?.isHRB && (
                <Badge variant="outline" className="text-xs px-1.5">HRB</Badge>
              )}
            </div>
            <h3 className="font-semibold text-sm md:text-base truncate">{risk.propertyAddressLine1}</h3>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{risk.propertyCity}, {risk.propertyPostcode}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {risk.factorBreakdown?.overdueCertificates > 0 && (
              <Badge variant="destructive" className="text-xs hidden sm:inline-flex">
                {risk.factorBreakdown.overdueCertificates} Overdue
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              data-testid={`button-toggle-property-${risk.propertyId}`}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: "Expiry", score: risk.expiryRiskScore, icon: Clock },
                { label: "Defects", score: risk.defectRiskScore, icon: FileWarning },
                { label: "Asset", score: risk.assetProfileRiskScore, icon: Building2 },
                { label: "Coverage", score: risk.coverageGapRiskScore, icon: Shield },
                { label: "External", score: risk.externalFactorRiskScore, icon: Zap },
              ].map((factor) => (
                <div key={factor.label} className="p-2 bg-muted/50 rounded-lg">
                  <factor.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div 
                    className="text-lg font-bold"
                    style={{ color: factor.score > 50 ? '#dc2626' : factor.score > 30 ? '#eab308' : '#22c55e' }}
                  >
                    {factor.score}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{factor.label}</div>
                </div>
              ))}
            </div>

            {risk.triggeringFactors && risk.triggeringFactors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Risk Factors</p>
                <div className="flex flex-wrap gap-1.5">
                  {risk.triggeringFactors.slice(0, 6).map((factor, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{factor}</Badge>
                  ))}
                  {risk.triggeringFactors.length > 6 && (
                    <Badge variant="secondary" className="text-xs">+{risk.triggeringFactors.length - 6}</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/properties/${risk.propertyId}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-property-${risk.propertyId}`}>
                  View Property
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertCard({ alert, onUpdateStatus }: { 
  alert: RiskAlert; 
  onUpdateStatus: (alertId: string, status: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true });

  return (
    <Card 
      className={cn(
        "border-l-4 transition-all",
        alert.riskTier === 'CRITICAL' && "border-l-red-500",
        alert.riskTier === 'HIGH' && "border-l-orange-500",
        "border-l-yellow-500"
      )} 
      data-testid={`card-alert-${alert.id}`}
    >
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-full flex-shrink-0",
            alert.riskTier === 'CRITICAL' && "bg-red-100",
            alert.riskTier === 'HIGH' && "bg-orange-100",
            "bg-yellow-100"
          )}>
            {alert.riskTier === 'CRITICAL' ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : alert.riskTier === 'HIGH' ? (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            ) : (
              <FileWarning className="h-5 w-5 text-yellow-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <TierBadge tier={alert.riskTier} size="sm" />
              <Badge variant="outline" className="text-xs">{alert.status}</Badge>
              {alert.escalationLevel > 0 && (
                <Badge variant="destructive" className="text-xs">Esc. x{alert.escalationLevel}</Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
            </div>
            <h4 className="font-semibold text-sm">{alert.title}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {alert.propertyAddressLine1}, {alert.propertyCity}
            </p>
            
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleContent className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">{alert.description}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Score: {alert.riskScore}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> SLA: {alert.slaHours}h
                  </span>
                  {alert.dueDate && (
                    <span className="flex items-center gap-1 text-red-600">
                      <Calendar className="h-3 w-3" /> Due: {format(new Date(alert.dueDate), 'MMM d')}
                    </span>
                  )}
                </div>
              </CollapsibleContent>
              
              <div className="flex items-center gap-2 mt-3">
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-7 px-2"
                    data-testid={`button-toggle-alert-${alert.id}`}
                    aria-label={isExpanded ? "Show less" : "Show details"}
                  >
                    {isExpanded ? "Show less" : "Details"}
                    {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                </CollapsibleTrigger>
                
                <div className="flex-1" />
                
                {alert.status === 'OPEN' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs"
                    onClick={() => onUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                    data-testid={`button-acknowledge-${alert.id}`}
                  >
                    Acknowledge
                  </Button>
                )}
                {(alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED') && (
                  <Button 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={() => onUpdateStatus(alert.id, 'RESOLVED')}
                    data-testid={`button-resolve-${alert.id}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                )}
              </div>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MLPredictionCard({ prediction, onFeedback }: { 
  prediction: MLPrediction; 
  onFeedback: (id: string, type: 'CORRECT' | 'INCORRECT') => void;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md" data-testid={`card-ml-prediction-${prediction.id}`}>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="text-center flex-shrink-0">
            <div 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: TIER_COLORS[prediction.riskCategory as RiskTier] || '#6b7280' }}
            >
              {prediction.riskScore}
            </div>
            <div className="text-[10px] text-muted-foreground">Risk</div>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SourceBadge sourceLabel={prediction.sourceLabel} />
              <Badge variant={
                prediction.riskCategory === 'CRITICAL' ? 'destructive' :
                prediction.riskCategory === 'HIGH' ? 'warning' : 'secondary'
              } className="text-xs">
                {prediction.riskCategory}
              </Badge>
            </div>
            <div className="w-full max-w-[200px]">
              <ConfidenceBar confidence={prediction.confidenceLevel} sourceLabel={prediction.sourceLabel} />
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-amber-600">
              {prediction.breachProbability != null ? `${(prediction.breachProbability * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">Breach Risk</div>
            {prediction.predictedBreachDate && (
              <div className="text-[10px] text-red-600 mt-0.5">
                {format(new Date(prediction.predictedBreachDate), 'MMM d')}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 text-green-600 hover:bg-green-50"
              onClick={() => onFeedback(prediction.id, 'CORRECT')}
              data-testid={`button-feedback-correct-${prediction.id}`}
              aria-label="Mark prediction as correct"
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 text-red-600 hover:bg-red-50"
              onClick={() => onFeedback(prediction.id, 'INCORRECT')}
              data-testid={`button-feedback-incorrect-${prediction.id}`}
              aria-label="Mark prediction as incorrect"
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: typeof Shield;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 md:py-16 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export default function RiskRadarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("OPEN");
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);

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

  const { data: mlPredictions, isLoading: mlLoading } = useQuery<MLPrediction[]>({
    queryKey: ['ml-predictions'],
    queryFn: async () => {
      const res = await fetch('/api/ml/predictions?limit=30', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: mlMetrics } = useQuery<MLModelMetrics>({
    queryKey: ['ml-model-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/ml/model', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    }
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ predictionId, feedbackType }: { predictionId: string; feedbackType: 'CORRECT' | 'INCORRECT' }) => {
      const res = await apiRequest('POST', `/api/ml/predictions/${predictionId}/feedback`, { feedbackType });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Feedback submitted', description: 'Thank you for helping improve our predictions!' });
      queryClient.invalidateQueries({ queryKey: ['ml-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['ml-model-metrics'] });
    },
    onError: () => {
      toast({ title: 'Feedback failed', variant: 'destructive' });
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
        description: `Processed ${data.processed} properties`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/risk/portfolio-summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/risk/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/risk/alerts'] });
    },
    onError: () => {
      toast({
        title: 'Calculation Failed',
        description: 'Unable to calculate risk scores. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const testPredictionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ml/predictions/test', {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Predictions Generated',
        description: data.message || `Generated ${data.generated || 0} test predictions`,
      });
      queryClient.invalidateQueries({ queryKey: ['ml-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['ml-model-metrics'] });
    },
    onError: () => {
      toast({
        title: 'Test Failed',
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

  return (
    <div className="flex h-screen bg-muted/30" data-testid="page-risk-radar">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Risk Radar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-xl md:text-3xl font-bold" data-testid="heading-risk-radar">
                  Predictive Compliance Radar
                </h1>
                <p className="text-sm text-muted-foreground hidden md:block">
                  ML-powered risk scoring and early warning system
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/calendar" className="hidden md:block">
                  <Button variant="outline" size="sm" data-testid="button-view-calendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    Calendar
                  </Button>
                </Link>
                <Button 
                  onClick={() => calculateAllMutation.mutate()} 
                  disabled={calculateAllMutation.isPending}
                  size="sm"
                  className="flex-1 md:flex-none"
                  data-testid="button-calculate-all"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", calculateAllMutation.isPending && "animate-spin")} />
                  <span className="hidden sm:inline">Recalculate</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>
              </div>
            </div>

            <MobileQuickStats summary={summary} isLoading={summaryLoading} />
            <DesktopStatCards summary={summary} isLoading={summaryLoading} />

            <div className="hidden md:grid md:grid-cols-3 gap-6">
              <Card className="col-span-1" data-testid="card-risk-distribution">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <Skeleton className="h-[180px] w-full" />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={70}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {pieData.map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                            <span>{d.name}: {d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="col-span-2" data-testid="card-factor-weights">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Risk Factor Weights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4 text-center">
                    {[
                      { name: 'Expiry', weight: 30, icon: Clock, color: 'text-blue-500' },
                      { name: 'Defects', weight: 25, icon: FileWarning, color: 'text-orange-500' },
                      { name: 'Asset', weight: 20, icon: Building2, color: 'text-purple-500' },
                      { name: 'Coverage', weight: 15, icon: Shield, color: 'text-green-500' },
                      { name: 'External', weight: 10, icon: Zap, color: 'text-yellow-500' },
                    ].map(factor => (
                      <div key={factor.name} className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
                        <factor.icon className={cn("h-6 w-6 mb-2", factor.color)} />
                        <span className="text-2xl font-bold">{factor.weight}%</span>
                        <span className="text-xs text-muted-foreground">{factor.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="properties" className="space-y-4">
              <div 
                className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b -mx-4 px-4 md:-mx-6 md:px-6 py-3 space-y-3" 
                data-testid="sticky-filter-bar"
              >
                <div className="flex items-center justify-between gap-3">
                  <TabsList className="flex-1 md:flex-none grid grid-cols-3 md:inline-flex" data-testid="tabs-risk-views">
                    <TabsTrigger value="properties" className="text-xs md:text-sm" data-testid="tab-properties">
                      <Building2 className="h-4 w-4 mr-1 md:mr-2" />
                      <span className="hidden md:inline">Properties</span>
                      <span className="md:hidden">Risk</span>
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="text-xs md:text-sm" data-testid="tab-alerts">
                      <AlertTriangle className="h-4 w-4 mr-1 md:mr-2" />
                      Alerts
                    </TabsTrigger>
                    <TabsTrigger value="ml-predictions" className="text-xs md:text-sm" data-testid="tab-ml-predictions">
                      <Brain className="h-4 w-4 mr-1 md:mr-2" />
                      <span className="hidden md:inline">ML Predictions</span>
                      <span className="md:hidden">ML</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="hidden md:flex gap-2">
                    <Link href="/calendar">
                      <Button variant="outline" size="sm" data-testid="button-view-calendar-quick">
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3">
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="w-[120px] md:w-[140px] h-8" data-testid="select-tier-filter">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={alertFilter} onValueChange={setAlertFilter}>
                    <SelectTrigger className="w-[120px] md:w-[140px] h-8" data-testid="select-alert-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                      <SelectItem value="ESCALATED">Escalated</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <span className="text-xs text-muted-foreground ml-auto">
                    {propertyRisks?.length || 0} items
                  </span>
                </div>
              </div>

              <TabsContent value="properties" className="space-y-4 mt-0">

                {risksLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <PropertyCardSkeleton key={i} />)}
                  </div>
                ) : propertyRisks?.length === 0 ? (
                  <EmptyState 
                    icon={Shield}
                    title="No Risk Data Available"
                    description="Calculate risk scores to see property risk assessments here."
                    action={
                      <Button onClick={() => calculateAllMutation.mutate()} disabled={calculateAllMutation.isPending}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", calculateAllMutation.isPending && "animate-spin")} />
                        Calculate Risks
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {propertyRisks?.map(risk => (
                      <PropertyRiskCard 
                        key={risk.id} 
                        risk={risk} 
                        isExpanded={expandedPropertyId === risk.id}
                        onToggle={() => setExpandedPropertyId(expandedPropertyId === risk.id ? null : risk.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="alerts" className="space-y-4 mt-0">
                {alertsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <PropertyCardSkeleton key={i} />)}
                  </div>
                ) : alerts?.length === 0 ? (
                  <EmptyState 
                    icon={CheckCircle2}
                    title={`No ${alertFilter.toLowerCase()} Alerts`}
                    description="Your portfolio is in good standing. No immediate action required."
                  />
                ) : (
                  <div className="space-y-3">
                    {alerts?.map(alert => (
                      <AlertCard 
                        key={alert.id} 
                        alert={alert}
                        onUpdateStatus={(alertId, status) => updateAlertMutation.mutate({ alertId, status })}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ml-predictions" className="space-y-4 mt-0">
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0" data-testid="card-ml-info">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold flex items-center gap-2 mb-1">
                          <Brain className="h-5 w-5 text-purple-600" />
                          Two-Tier Prediction System
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Statistical rules + ML learning for accurate risk prediction
                        </p>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div className="p-2 bg-white/80 rounded-lg">
                          <div className="text-xl font-bold text-purple-700">
                            {mlMetrics?.model?.accuracy != null ? `${(mlMetrics.model.accuracy * 100).toFixed(0)}%` : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">Accuracy</div>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg">
                          <div className="text-xl font-bold text-blue-700">
                            {mlMetrics?.model?.totalPredictions || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Predictions</div>
                        </div>
                        <div className="p-2 bg-white/80 rounded-lg">
                          <div className="text-xl font-bold text-green-700">
                            {mlMetrics?.feedbackStats?.total || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Feedback</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {mlLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <PropertyCardSkeleton key={i} />)}
                  </div>
                ) : mlPredictions && mlPredictions.length > 0 ? (
                  <div className="space-y-3">
                    {mlPredictions.map(prediction => (
                      <MLPredictionCard 
                        key={prediction.id} 
                        prediction={prediction}
                        onFeedback={(id, type) => submitFeedbackMutation.mutate({ predictionId: id, feedbackType: type })}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    icon={Brain}
                    title="No ML Predictions Yet"
                    description="Generate test predictions to see how the ML model evaluates your portfolio."
                    action={
                      <Button onClick={() => testPredictionsMutation.mutate()} disabled={testPredictionsMutation.isPending}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", testPredictionsMutation.isPending && "animate-spin")} />
                        Generate Test Predictions
                      </Button>
                    }
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
