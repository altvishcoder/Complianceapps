import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sidebar } from '@/components/layout/Sidebar';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Download, Play, RefreshCw, Target, Zap, Brain, Eye, Settings2,
  Lightbulb, Sparkles, ArrowRight, Wrench, BookOpen, Shield,
  X, ExternalLink, Clock
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface InsightsData {
  accuracy: {
    overall: number;
    trend: number;
    byDocType: Array<{ type: string; accuracy: number; count: number }>;
    byWeek: Array<{ week: string; accuracy: number }>;
  };
  errors: {
    topTags: Array<{ tag: string; count: number; trend: number }>;
    recentExamples: Array<{ id: string; field: string; tag: string; docType: string }>;
  };
  improvements: {
    queue: Array<{
      id: string;
      issue: string;
      occurrences: number;
      suggestedFix: string;
      priority: string;
    }>;
    recentWins: Array<{ date: string; improvement: string; delta: number }>;
  };
  benchmarks: {
    latest: { score: number; date: string; passed: boolean };
    trend: Array<{ run: number; score: number }>;
  };
  extractionStats: {
    total: number;
    pending: number;
    approved: number;
    awaitingReview: number;
    failed: number;
  };
}

interface AISuggestion {
  id: string;
  suggestionKey: string;
  category: 'prompt' | 'preprocessing' | 'validation' | 'training' | 'quality';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  actionable: boolean;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'AUTO_RESOLVED';
  progress: {
    current: number;
    target: number;
    percent: number;
  };
  action: {
    label: string;
    route: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface AISuggestionsData {
  suggestions: AISuggestion[];
  context: {
    totalExtractions: number;
    averageConfidence: number;
    rejectionRate: number;
    reviewCoverage: number;
    errorPatternsCount: number;
  };
  generatedAt: string;
}

interface TierStatsData {
  summary: {
    totalExtractions: number;
    totalTierAttempts: number;
    avgTiersPerExtraction: number;
    totalCost: number;
    avgCostPerExtraction: number;
    totalProcessingTimeMs: number;
    avgProcessingTimeMs: number;
  };
  tierDistribution: Array<{
    tier: string;
    label: string;
    count: number;
    percentage: number;
    successCount: number;
    successRate: number;
  }>;
  finalTierDistribution: Array<{
    tier: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  escalationReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  costByTier: Array<{
    tier: string;
    label: string;
    totalCost: number;
    avgCost: number;
  }>;
  processingTimeByTier: Array<{
    tier: string;
    label: string;
    totalTimeMs: number;
    avgTimeMs: number;
  }>;
  recentExtractions: Array<{
    certificateId: string;
    tiersAttempted: number;
    finalTier: string;
    finalStatus: string;
    totalCost: number;
    totalTimeMs: number;
    attemptedAt: string;
  }>;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon: Icon, 
  iconColor = "text-blue-600" 
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: any;
  iconColor?: string;
}) {
  return (
    <Card data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className={`flex items-center mt-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs last week
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full bg-gray-100 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#8b5cf6', '#ec4899'];

const categoryIcons: Record<string, any> = {
  prompt: Sparkles,
  preprocessing: Wrench,
  validation: Shield,
  training: BookOpen,
  quality: CheckCircle
};

const categoryColors: Record<string, string> = {
  prompt: 'bg-purple-100 text-purple-700',
  preprocessing: 'bg-blue-100 text-blue-700',
  validation: 'bg-emerald-100 text-emerald-700',
  training: 'bg-amber-100 text-amber-700',
  quality: 'bg-gray-100 text-gray-700'
};

const impactColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200'
};

export default function ModelInsightsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState('30d');
  
  const { data, isLoading, refetch } = useQuery<InsightsData>({
    queryKey: ['model-insights', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/model-insights?range=${dateRange}`);
      if (!res.ok) throw new Error('Failed to fetch insights');
      return res.json();
    },
  });
  
  const { data: suggestionsData, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<AISuggestionsData>({
    queryKey: ['ai-suggestions'],
    queryFn: async () => {
      const res = await fetch('/api/model-insights/ai-suggestions');
      if (!res.ok) throw new Error('Failed to fetch AI suggestions');
      return res.json();
    },
  });
  
  const { data: tierStats, isLoading: tierStatsLoading } = useQuery<TierStatsData>({
    queryKey: ['tier-stats'],
    queryFn: async () => {
      const res = await fetch('/api/model-insights/tier-stats');
      if (!res.ok) throw new Error('Failed to fetch tier statistics');
      return res.json();
    },
  });
  
  const runBenchmarkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/model-insights/run-benchmark', { method: 'POST' });
      if (!res.ok) throw new Error('Benchmark failed');
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: 'Benchmark Complete', description: `Score: ${result.score?.toFixed(1) || 'N/A'}` });
      refetch();
    },
    onError: () => {
      toast({ title: 'Benchmark Failed', variant: 'destructive' });
    },
  });
  
  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/model-insights/export-training-data', { method: 'POST' });
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training-data-${new Date().toISOString().split('T')[0]}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export Complete', description: 'Training data downloaded' });
    },
  });
  
  const dismissSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/model-insights/ai-suggestions/${id}/dismiss`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User dismissed' })
      });
      if (!res.ok) throw new Error('Dismiss failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      toast({ title: 'Suggestion dismissed' });
    },
  });
  
  const startSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/model-insights/ai-suggestions/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Start failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      toast({ title: 'Suggestion marked as in progress' });
    },
  });
  
  const resolveSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/model-insights/ai-suggestions/${id}/resolve`, { method: 'POST' });
      if (!res.ok) throw new Error('Resolve failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      toast({ title: 'Suggestion resolved' });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-4 pt-16 md:pt-4 md:p-6 lg:p-6 xl:p-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }
  
  const insights = data || {
    accuracy: { overall: 0, trend: 0, byDocType: [], byWeek: [] },
    errors: { topTags: [], recentExamples: [] },
    improvements: { queue: [], recentWins: [] },
    benchmarks: { latest: { score: 0, date: '', passed: false }, trend: [] },
    extractionStats: { total: 0, pending: 0, approved: 0, awaitingReview: 0, failed: 0 },
  };
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 pt-16 md:pt-8 md:p-6 lg:p-6 xl:p-8 space-y-4 md:space-y-5 lg:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
                <Brain className="w-6 h-6 lg:w-7 lg:h-7" />
                Model Insights
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">Track extraction quality and identify improvements</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="lg:size-default"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
                data-testid="button-export-training"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export Training Data</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Button 
                size="sm"
                className="lg:size-default"
                onClick={() => runBenchmarkMutation.mutate()}
                disabled={runBenchmarkMutation.isPending}
                data-testid="button-run-benchmark"
              >
                <Play className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Run Benchmark</span>
                <span className="sm:hidden">Benchmark</span>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 lg:gap-4">
            <MetricCard
              title="Overall Accuracy"
              value={`${insights.accuracy.overall.toFixed(1)}%`}
              trend={insights.accuracy.trend}
              icon={Target}
            />
            <MetricCard
              title="Latest Benchmark"
              value={insights.benchmarks.latest.score.toFixed(0)}
              subtitle={insights.benchmarks.latest.passed ? 'Passed' : 'Awaiting run'}
              icon={insights.benchmarks.latest.passed ? CheckCircle : AlertTriangle}
              iconColor={insights.benchmarks.latest.passed ? 'text-green-600' : 'text-yellow-600'}
            />
            <MetricCard
              title="Top Error"
              value={insights.errors.topTags[0]?.tag.replace(/_/g, ' ') || 'None'}
              subtitle={`${insights.errors.topTags[0]?.count || 0} occurrences`}
              icon={AlertTriangle}
              iconColor="text-yellow-600"
            />
            <MetricCard
              title="Awaiting Review"
              value={insights.extractionStats.awaitingReview.toString()}
              subtitle="extractions need review"
              icon={Eye}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-5 xl:grid-cols-5 gap-4">
            <Card className="col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Extraction Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <Badge variant="outline">{insights.extractionStats.total}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <Badge variant="secondary">{insights.extractionStats.pending}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Awaiting Review</span>
                  <Badge className="bg-amber-100 text-amber-800">{insights.extractionStats.awaitingReview}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Approved</span>
                  <Badge className="bg-green-100 text-green-800">{insights.extractionStats.approved}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Failed</span>
                  <Badge variant="destructive">{insights.extractionStats.failed}</Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-1 md:col-span-1 lg:col-span-4 xl:col-span-4">
              <Tabs defaultValue="accuracy">
                <CardHeader className="pb-0 overflow-x-auto">
                  <TabsList className="w-full flex-wrap h-auto gap-1 lg:flex-nowrap">
                    <TabsTrigger value="ai-suggestions" className="gap-1 text-xs lg:text-sm">
                      <Lightbulb className="w-3 h-3 lg:w-4 lg:h-4" />
                      <span className="hidden sm:inline">AI Suggestions</span>
                      <span className="sm:hidden">AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="accuracy" className="text-xs lg:text-sm">Accuracy</TabsTrigger>
                    <TabsTrigger value="errors" className="text-xs lg:text-sm">
                      <span className="hidden sm:inline">Error Analysis</span>
                      <span className="sm:hidden">Errors</span>
                    </TabsTrigger>
                    <TabsTrigger value="improvements" className="text-xs lg:text-sm">
                      <span className="hidden sm:inline">Improvements</span>
                      <span className="sm:hidden">Improve</span>
                    </TabsTrigger>
                    <TabsTrigger value="benchmarks" className="text-xs lg:text-sm">
                      <span className="hidden sm:inline">Benchmarks</span>
                      <span className="sm:hidden">Bench</span>
                    </TabsTrigger>
                    <TabsTrigger value="tiers" className="text-xs lg:text-sm">
                      <span className="hidden sm:inline">Tier Analytics</span>
                      <span className="sm:hidden">Tiers</span>
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="pt-4">
                  <TabsContent value="ai-suggestions" className="mt-0">
                    <div className="space-y-4">
                      {suggestionsLoading ? (
                        <div className="flex items-center justify-center h-48">
                          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 mb-4">
                            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                              <CardContent className="pt-4 pb-3">
                                <div className="text-sm text-emerald-700">Confidence</div>
                                <div className="text-2xl font-bold text-emerald-800">{suggestionsData.context.averageConfidence}%</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                              <CardContent className="pt-4 pb-3">
                                <div className="text-sm text-amber-700">Rejection Rate</div>
                                <div className="text-2xl font-bold text-amber-800">{suggestionsData.context.rejectionRate}%</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                              <CardContent className="pt-4 pb-3">
                                <div className="text-sm text-blue-700">Extractions</div>
                                <div className="text-2xl font-bold text-blue-800">{suggestionsData.context.totalExtractions}</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                              <CardContent className="pt-4 pb-3">
                                <div className="text-sm text-purple-700">Error Patterns</div>
                                <div className="text-2xl font-bold text-purple-800">{suggestionsData.context.errorPatternsCount}</div>
                              </CardContent>
                            </Card>
                          </div>
                          
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-600" />
                              AI-Powered Recommendations
                            </h3>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => refetchSuggestions()}
                              data-testid="button-refresh-suggestions"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-3">
                            {suggestionsData.suggestions.map((suggestion) => {
                              const CategoryIcon = categoryIcons[suggestion.category] || Lightbulb;
                              const isInProgress = suggestion.status === 'IN_PROGRESS';
                              const hasProgress = suggestion.progress && suggestion.progress.target > 0 && suggestion.progress.current < suggestion.progress.target;
                              
                              return (
                                <Card 
                                  key={suggestion.id} 
                                  className={`hover:shadow-md transition-shadow ${isInProgress ? 'border-emerald-300 bg-emerald-50/30' : ''}`} 
                                  data-testid={`suggestion-${suggestion.id}`}
                                >
                                  <CardContent className="pt-4 pb-4">
                                    <div className="flex items-start gap-4">
                                      <div className={`p-2 rounded-lg ${categoryColors[suggestion.category]}`}>
                                        <CategoryIcon className="w-5 h-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <h4 className="font-medium">{suggestion.title}</h4>
                                          {isInProgress && (
                                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                              <Clock className="w-3 h-3 mr-1" />
                                              In Progress
                                            </Badge>
                                          )}
                                          <Badge variant="outline" className={`text-xs ${impactColors[suggestion.impact]}`}>
                                            {suggestion.impact} impact
                                          </Badge>
                                          <Badge variant="secondary" className="text-xs">
                                            {suggestion.effort} effort
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                                        
                                        {hasProgress && (
                                          <div className="mt-3">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                              <span>
                                                {suggestion.suggestionKey === 'increase-reviews' 
                                                  ? `${suggestion.progress.current} of ${suggestion.progress.target} reviews completed`
                                                  : suggestion.suggestionKey === 'improve-confidence'
                                                  ? `Current: ${suggestion.progress.current}% → Target: ${suggestion.progress.target}%`
                                                  : suggestion.suggestionKey === 'reduce-rejections'
                                                  ? `Acceptance rate: ${suggestion.progress.current}% → Target: ${suggestion.progress.target}%`
                                                  : `${suggestion.progress.current} of ${suggestion.progress.target} completed`
                                                }
                                              </span>
                                              <span className="text-emerald-600 font-medium">{suggestion.progress.percent}%</span>
                                            </div>
                                            <Progress 
                                              value={suggestion.progress.percent} 
                                              className="h-2"
                                            />
                                          </div>
                                        )}
                                        
                                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                                          {suggestion.action && (
                                            <Button 
                                              size="sm" 
                                              className="bg-emerald-600 hover:bg-emerald-700"
                                              onClick={() => {
                                                startSuggestionMutation.mutate(suggestion.id);
                                                if (suggestion.action?.route) {
                                                  setLocation(suggestion.action.route);
                                                }
                                              }}
                                              data-testid={`button-action-${suggestion.id}`}
                                            >
                                              <ExternalLink className="w-3 h-3 mr-1" />
                                              {suggestion.action.label}
                                            </Button>
                                          )}
                                          {isInProgress && (
                                            <Button 
                                              size="sm" 
                                              variant="outline"
                                              onClick={() => resolveSuggestionMutation.mutate(suggestion.id)}
                                              data-testid={`button-resolve-${suggestion.id}`}
                                            >
                                              <CheckCircle className="w-3 h-3 mr-1" />
                                              Mark Complete
                                            </Button>
                                          )}
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => dismissSuggestionMutation.mutate(suggestion.id)}
                                            data-testid={`button-dismiss-${suggestion.id}`}
                                          >
                                            <X className="w-3 h-3 mr-1" />
                                            Dismiss
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                          
                          <p className="text-xs text-muted-foreground text-center mt-4">
                            Suggestions generated at {new Date(suggestionsData.generatedAt).toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                          <Lightbulb className="w-12 h-12 mb-3 opacity-50" />
                          <p>No suggestions available yet</p>
                          <p className="text-sm">Process more certificates to get AI-powered recommendations</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="accuracy" className="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Accuracy Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {insights.accuracy.byWeek.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                              <LineChart data={insights.accuracy.byWeek}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" fontSize={12} />
                                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
                                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                                <Line type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                              No trend data available yet
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Accuracy by Document Type</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {insights.accuracy.byDocType.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={insights.accuracy.byDocType} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
                                <YAxis type="category" dataKey="type" width={100} fontSize={12} />
                                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                                <Bar dataKey="accuracy" fill="#2563eb" />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                              No document type data available
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="errors" className="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Top Error Categories</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {insights.errors.topTags.length > 0 ? (
                            <div className="space-y-3">
                              {insights.errors.topTags.slice(0, 8).map((tag, index) => (
                                <div key={tag.tag} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="text-sm">{tag.tag.replace(/_/g, ' ')}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{tag.count}</span>
                                    {tag.trend !== 0 && (
                                      <Badge variant={tag.trend < 0 ? 'default' : 'destructive'} className="text-xs">
                                        {tag.trend > 0 ? '+' : ''}{tag.trend}%
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                              No error data available
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Recent Error Examples</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {insights.errors.recentExamples.length > 0 ? (
                            <div className="space-y-2">
                              {insights.errors.recentExamples.slice(0, 6).map((example) => (
                                <div key={example.id} className="p-2 bg-gray-50 rounded text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline">{example.docType}</Badge>
                                    <Badge variant="secondary">{example.tag.replace(/_/g, ' ')}</Badge>
                                  </div>
                                  <div className="text-gray-600 text-xs">Field: {example.field}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                              No recent errors
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="improvements" className="mt-0">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Improvement Queue</CardTitle>
                        <CardDescription>Address these issues in priority order for maximum impact</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {insights.improvements.queue.length > 0 ? (
                          <div className="space-y-4">
                            {insights.improvements.queue.map((item, index) => (
                              <div key={item.id} className="p-4 border rounded-lg">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                                      <span className="font-medium">{item.issue}</span>
                                      <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'}>
                                        {item.priority}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{item.suggestedFix}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{item.occurrences} occurrences</p>
                                  </div>
                                  <Button variant="outline" size="sm">Address</Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                            <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
                            <p>No improvements queued - system is performing well!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="benchmarks" className="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Benchmark Score Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {insights.benchmarks.trend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                              <LineChart data={insights.benchmarks.trend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="run" fontSize={12} />
                                <YAxis domain={[0, 100]} fontSize={12} />
                                <Tooltip />
                                <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                              No benchmark runs yet
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Latest Benchmark</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-col items-center justify-center h-[220px]">
                            <div className={`text-6xl font-bold ${insights.benchmarks.latest.passed ? 'text-green-600' : 'text-yellow-600'}`}>
                              {insights.benchmarks.latest.score.toFixed(0)}
                            </div>
                            <Badge className={`mt-2 ${insights.benchmarks.latest.passed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {insights.benchmarks.latest.passed ? 'PASSED' : 'PENDING'}
                            </Badge>
                            {insights.benchmarks.latest.date && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Last run: {new Date(insights.benchmarks.latest.date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tiers" className="mt-0">
                    {tierStatsLoading ? (
                      <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : tierStats ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                            <CardContent className="pt-4 pb-3">
                              <div className="text-sm text-blue-700">Extraction Runs</div>
                              <div className="text-2xl font-bold text-blue-800">{tierStats.summary.totalExtractionRuns}</div>
                              <div className="text-xs text-blue-600">{tierStats.summary.totalCertificates} certificates</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                            <CardContent className="pt-4 pb-3">
                              <div className="text-sm text-emerald-700">Avg Tiers/Run</div>
                              <div className="text-2xl font-bold text-emerald-800">{tierStats.summary.avgTiersPerRun?.toFixed(1) || '0'}</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                            <CardContent className="pt-4 pb-3">
                              <div className="text-sm text-amber-700">Avg Cost/Run</div>
                              <div className="text-2xl font-bold text-amber-800">${tierStats.summary.avgCostPerRun?.toFixed(4) || '0.0000'}</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                            <CardContent className="pt-4 pb-3">
                              <div className="text-sm text-purple-700">Avg Time</div>
                              <div className="text-2xl font-bold text-purple-800">{(tierStats.summary.avgProcessingTimeMs / 1000).toFixed(1)}s</div>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Where Extractions End (Final Tier)</CardTitle>
                              <CardDescription className="text-xs">Lower tiers = better (cheaper, faster)</CardDescription>
                            </CardHeader>
                            <CardContent>
                              {tierStats.finalTierDistribution.some(t => t.count > 0) ? (
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={tierStats.finalTierDistribution.filter(t => t.count > 0)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" fontSize={11} />
                                    <YAxis type="category" dataKey="label" width={140} fontSize={10} tickFormatter={(v) => v.replace(/Tier \d+\.?\d* \(|\)/g, '')} />
                                    <Tooltip formatter={(v) => [`${v} extractions`, 'Count']} />
                                    <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                                  No extraction data yet
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Tier Success Rates</CardTitle>
                              <CardDescription className="text-xs">Percentage of attempts that succeed at each tier</CardDescription>
                            </CardHeader>
                            <CardContent>
                              {tierStats.tierDistribution.some(t => t.count > 0) ? (
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={tierStats.tierDistribution.filter(t => t.count > 0)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="tier" fontSize={10} tickFormatter={(v) => v.replace('tier-', 'T')} />
                                    <YAxis domain={[0, 100]} fontSize={11} />
                                    <Tooltip formatter={(v) => [`${v}%`, 'Success Rate']} />
                                    <Bar dataKey="successRate" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                                  No tier data yet
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Cost by Tier</CardTitle>
                              <CardDescription className="text-xs">Total cost incurred at each tier</CardDescription>
                            </CardHeader>
                            <CardContent>
                              {tierStats.costByTier.some(t => t.totalCost > 0) ? (
                                <ResponsiveContainer width="100%" height={180}>
                                  <BarChart data={tierStats.costByTier.filter(t => t.totalCost > 0)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="tier" fontSize={10} tickFormatter={(v) => v.replace('tier-', 'T')} />
                                    <YAxis fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                                    <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, 'Total Cost']} />
                                    <Bar dataKey="totalCost" fill="#eab308" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                                  No cost data yet
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Processing Time by Tier</CardTitle>
                              <CardDescription className="text-xs">Average processing time at each tier</CardDescription>
                            </CardHeader>
                            <CardContent>
                              {tierStats.processingTimeByTier.some(t => t.avgTimeMs > 0) ? (
                                <ResponsiveContainer width="100%" height={180}>
                                  <BarChart data={tierStats.processingTimeByTier.filter(t => t.avgTimeMs > 0)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="tier" fontSize={10} tickFormatter={(v) => v.replace('tier-', 'T')} />
                                    <YAxis fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(1)}s`} />
                                    <Tooltip formatter={(v: number) => [`${(v/1000).toFixed(2)}s`, 'Avg Time']} />
                                    <Bar dataKey="avgTimeMs" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                                  No timing data yet
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                        
                        {tierStats.escalationReasons.length > 0 && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Top Escalation Reasons</CardTitle>
                              <CardDescription className="text-xs">Why extractions move to higher tiers</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {tierStats.escalationReasons.map((reason, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">{reason.reason}</span>
                                    <div className="flex items-center gap-2">
                                      <Progress value={reason.percentage} className="w-20 h-2" />
                                      <span className="text-xs font-medium w-12 text-right">{reason.count}x</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {tierStats.recentExtractions.length > 0 && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Recent Extractions</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {tierStats.recentExtractions.map((extraction, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-xs">{extraction.certificateId.slice(0, 8)}...</span>
                                      <span className="text-xs text-muted-foreground">
                                        {extraction.tiersAttempted} tier{extraction.tiersAttempted !== 1 ? 's' : ''} tried
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={extraction.finalStatus === 'success' ? 'default' : 'secondary'} className="text-xs">
                                        {extraction.finalTier.replace('tier-', 'T')}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">${extraction.totalCost.toFixed(4)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-muted-foreground">
                        No tier data available
                      </div>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
