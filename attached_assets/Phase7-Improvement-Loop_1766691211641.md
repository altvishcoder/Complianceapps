# ComplianceAI™ Model Ownership — Phase 7
## Improvement Loop & Weekly Iteration

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Ongoing (establish in Week 7, then weekly) |
| **Objective** | Continuous improvement through data-driven iteration |
| **Prerequisites** | Phase 1-6 complete |
| **Outcome** | Measurable improvement every week |

```
THE WEEKLY IMPROVEMENT LOOP:

    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │   Monday: Analyse ──► Tuesday-Thursday: Improve      │
    │       │                        │                     │
    │       ▼                        ▼                     │
    │   Pull top 3              Fix prompts/               │
    │   failure modes           validators/rules           │
    │                                │                     │
    │                                ▼                     │
    │   Friday: Validate ◄── Run benchmark                 │
    │       │                                              │
    │       ▼                                              │
    │   Ship if score          Score improved?             │
    │   improves               No regressions?             │
    │                                                      │
    └──────────────────────────────────────────────────────┘

    "Every correction makes the system smarter"
```

---

## Step 1: Create Model Insights Dashboard

### Prompt 7.1: Insights Dashboard

```
Create a dashboard showing model performance and improvement opportunities.

1. Create src/app/(dashboard)/model-insights/page.tsx:

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Download, Play, RefreshCw, Target, Zap
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

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
}

export default function ModelInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  
  useEffect(() => {
    fetchInsights();
  }, [dateRange]);
  
  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/model-insights?range=${dateRange}`);
      const result = await res.json();
      setData(result);
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportTrainingData = async () => {
    const res = await fetch('/api/model-insights/export-training-data', {
      method: 'POST',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-data-${new Date().toISOString().split('T')[0]}.jsonl`;
    a.click();
  };
  
  const handleRunBenchmark = async () => {
    if (!confirm('Run benchmark suite? This may take several minutes.')) return;
    
    try {
      const res = await fetch('/api/model-insights/run-benchmark', { method: 'POST' });
      const result = await res.json();
      alert(`Benchmark complete! Score: ${result.score.toFixed(1)}`);
      fetchInsights();
    } catch (error) {
      alert('Benchmark failed');
    }
  };
  
  if (loading || !data) {
    return <div className="p-8">Loading insights...</div>;
  }
  
  const COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#8b5cf6'];
  
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Model Insights</h1>
          <p className="text-gray-500">Track extraction quality and identify improvements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportTrainingData}>
            <Download className="w-4 h-4 mr-2" />
            Export Training Data
          </Button>
          <Button onClick={handleRunBenchmark}>
            <Play className="w-4 h-4 mr-2" />
            Run Benchmark
          </Button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Overall Accuracy"
          value={`${(data.accuracy.overall * 100).toFixed(1)}%`}
          trend={data.accuracy.trend}
          icon={Target}
        />
        <MetricCard
          title="Latest Benchmark"
          value={data.benchmarks.latest.score.toFixed(0)}
          subtitle={data.benchmarks.latest.passed ? 'Passed' : 'Failed'}
          icon={data.benchmarks.latest.passed ? CheckCircle : AlertTriangle}
          iconColor={data.benchmarks.latest.passed ? 'text-green-600' : 'text-red-600'}
        />
        <MetricCard
          title="Top Error"
          value={data.errors.topTags[0]?.tag.replace('_', ' ') || 'None'}
          subtitle={`${data.errors.topTags[0]?.count || 0} occurrences`}
          icon={AlertTriangle}
          iconColor="text-yellow-600"
        />
        <MetricCard
          title="Improvement Queue"
          value={data.improvements.queue.length.toString()}
          subtitle="items to address"
          icon={Zap}
        />
      </div>
      
      <Tabs defaultValue="accuracy">
        <TabsList>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
          <TabsTrigger value="improvements">Improvements</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
        </TabsList>
        
        {/* Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Accuracy Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Accuracy Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.accuracy.byWeek}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* By Document Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Accuracy by Document Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.accuracy.byDocType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="type" width={100} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="accuracy" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Top Error Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top Error Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.errors.topTags.slice(0, 8).map((tag, index) => (
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
              </CardContent>
            </Card>
            
            {/* Recent Error Examples */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Error Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.errors.recentExamples.slice(0, 6).map((example) => (
                    <div 
                      key={example.id}
                      className="p-2 bg-gray-50 rounded text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{example.docType}</Badge>
                        <Badge variant="secondary">{example.tag.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div className="text-gray-600 text-xs">
                        Field: {example.field}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Improvements Tab */}
        <TabsContent value="improvements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Improvement Queue</CardTitle>
              <p className="text-xs text-gray-500">
                Address these issues in priority order for maximum impact
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.improvements.queue.map((item, index) => (
                  <div 
                    key={item.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg font-bold text-gray-400">
                            #{index + 1}
                          </span>
                          <span className="font-medium">{item.issue}</span>
                          <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'}>
                            {item.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {item.occurrences} occurrences in the last 30 days
                        </p>
                        <div className="bg-blue-50 p-2 rounded text-sm text-blue-800">
                          <strong>Suggested fix:</strong> {item.suggestedFix}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Recent Wins */}
          {data.improvements.recentWins.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Improvements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.improvements.recentWins.map((win, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <div>
                        <span className="text-sm">{win.improvement}</span>
                        <span className="text-xs text-gray-500 ml-2">{win.date}</span>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        +{win.delta.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Benchmark Score Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.benchmarks.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="run" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  trend, 
  subtitle, 
  icon: Icon,
  iconColor = 'text-blue-600'
}: {
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
  icon: any;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend !== undefined && (
              <div className={`flex items-center text-sm mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <Icon className={`w-8 h-8 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Step 2: Create Insights API

### Prompt 7.2: Insights API Endpoints

```
Create API endpoints for model insights and training data export.

1. Create src/app/api/model-insights/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '30d';
    
    const daysAgo = parseInt(range.replace('d', ''));
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Get human reviews for accuracy calculation
    const reviews = await prisma.humanReview.findMany({
      where: {
        organisationId: session.user.organisationId,
        reviewedAt: { gte: startDate },
      },
      include: {
        extractionRun: {
          select: { documentType: true },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });
    
    // Calculate accuracy
    const totalReviews = reviews.length;
    const correctReviews = reviews.filter(r => r.wasCorrect).length;
    const overallAccuracy = totalReviews > 0 ? correctReviews / totalReviews : 0;
    
    // Previous period for trend
    const previousStart = new Date(startDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const previousReviews = await prisma.humanReview.count({
      where: {
        organisationId: session.user.organisationId,
        reviewedAt: { gte: previousStart, lt: startDate },
        wasCorrect: true,
      },
    });
    const previousTotal = await prisma.humanReview.count({
      where: {
        organisationId: session.user.organisationId,
        reviewedAt: { gte: previousStart, lt: startDate },
      },
    });
    const previousAccuracy = previousTotal > 0 ? previousReviews / previousTotal : 0;
    const trend = ((overallAccuracy - previousAccuracy) / (previousAccuracy || 1)) * 100;
    
    // Accuracy by document type
    const byDocType: Record<string, { correct: number; total: number }> = {};
    reviews.forEach(r => {
      const docType = r.extractionRun.documentType;
      if (!byDocType[docType]) byDocType[docType] = { correct: 0, total: 0 };
      byDocType[docType].total++;
      if (r.wasCorrect) byDocType[docType].correct++;
    });
    
    const accuracyByDocType = Object.entries(byDocType).map(([type, stats]) => ({
      type: type.replace('_', ' '),
      accuracy: (stats.correct / stats.total) * 100,
      count: stats.total,
    }));
    
    // Accuracy by week
    const weeklyData: Record<string, { correct: number; total: number }> = {};
    reviews.forEach(r => {
      const week = getWeekKey(r.reviewedAt);
      if (!weeklyData[week]) weeklyData[week] = { correct: 0, total: 0 };
      weeklyData[week].total++;
      if (r.wasCorrect) weeklyData[week].correct++;
    });
    
    const accuracyByWeek = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, stats]) => ({
        week,
        accuracy: (stats.correct / stats.total) * 100,
      }));
    
    // Error tags
    const tagCounts: Record<string, number> = {};
    reviews.forEach(r => {
      r.errorTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count, trend: 0 })); // TODO: Calculate trend
    
    // Recent error examples
    const recentErrors = reviews
      .filter(r => !r.wasCorrect && r.errorTags.length > 0)
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        field: (r.fieldChanges as any[])?.[0]?.field || 'unknown',
        tag: r.errorTags[0],
        docType: r.extractionRun.documentType.replace('_', ' '),
      }));
    
    // Improvement queue
    const improvementQueue = generateImprovementQueue(topTags, reviews);
    
    // Benchmark data
    const latestBenchmark = await prisma.evalRun.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { overallScore: true, createdAt: true, passedGating: true },
    });
    
    const benchmarkRuns = await prisma.evalRun.findMany({
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { overallScore: true },
    });
    
    return NextResponse.json({
      accuracy: {
        overall: overallAccuracy,
        trend,
        byDocType: accuracyByDocType,
        byWeek: accuracyByWeek,
      },
      errors: {
        topTags,
        recentExamples: recentErrors,
      },
      improvements: {
        queue: improvementQueue,
        recentWins: [], // TODO: Track improvements
      },
      benchmarks: {
        latest: {
          score: latestBenchmark?.overallScore || 0,
          date: latestBenchmark?.createdAt?.toISOString() || '',
          passed: latestBenchmark?.passedGating || false,
        },
        trend: benchmarkRuns.map((r, i) => ({ run: i + 1, score: r.overallScore })),
      },
    });
    
  } catch (error) {
    console.error('Insights error:', error);
    return NextResponse.json({ error: 'Failed to get insights' }, { status: 500 });
  }
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Start of week
  return d.toISOString().split('T')[0];
}

function generateImprovementQueue(
  topTags: Array<{ tag: string; count: number }>,
  reviews: any[]
): Array<{
  id: string;
  issue: string;
  occurrences: number;
  suggestedFix: string;
  priority: string;
}> {
  const suggestions: Record<string, string> = {
    'wrong_date_format': 'Update date parsing in normalisation rules',
    'missed_table_row': 'Improve table extraction prompts',
    'hallucinated_value': 'Add stricter evidence requirements',
    'wrong_field_mapping': 'Add field-specific validation rules',
    'missed_defect': 'Enhance defect detection prompts',
    'name_address_confusion': 'Add address pattern detection to name validator',
    'poor_ocr_quality': 'Implement OCR preprocessing step',
    'multi_page_missed': 'Ensure multi-page documents are fully processed',
    'handwriting_error': 'Consider handwriting-specific extraction mode',
    'wrong_appliance_result': 'Add appliance result validation',
    'missed_observation': 'Improve observation extraction prompts',
    'wrong_outcome': 'Add outcome validation against evidence',
  };
  
  return topTags.slice(0, 5).map((tag, index) => ({
    id: `imp_${index}`,
    issue: tag.tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    occurrences: tag.count,
    suggestedFix: suggestions[tag.tag] || 'Review extraction prompts for this pattern',
    priority: index < 2 ? 'high' : 'medium',
  }));
}

2. Create src/app/api/model-insights/export-training-data/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    
    const body = await request.json().catch(() => ({}));
    const daysAgo = body.daysAgo || 90;
    const minChanges = body.minChanges || 1;
    
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Get human reviews with corrections
    const reviews = await prisma.humanReview.findMany({
      where: {
        organisationId: session.user.organisationId,
        reviewedAt: { gte: startDate },
        changeCount: { gte: minChanges },
      },
      include: {
        extractionRun: {
          include: {
            certificate: {
              select: { storagePath: true, documentType: true },
            },
          },
        },
      },
    });
    
    // Format as training data
    const trainingData = reviews.map(review => ({
      id: review.id,
      document_type: review.extractionRun.documentType,
      document_ref: review.extractionRun.certificate.storagePath,
      model_output: review.extractionRun.rawOutput,
      gold_output: review.approvedOutput,
      field_corrections: review.fieldChanges,
      error_tags: review.errorTags,
      difficulty: inferDifficulty(review),
      created_at: review.reviewedAt.toISOString(),
    }));
    
    // Return as JSONL
    const jsonl = trainingData.map(d => JSON.stringify(d)).join('\n');
    
    return new NextResponse(jsonl, {
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': `attachment; filename="training-data-${new Date().toISOString().split('T')[0]}.jsonl"`,
      },
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

function inferDifficulty(review: any): string {
  const tags = review.errorTags || [];
  if (tags.includes('poor_ocr_quality') || tags.includes('handwriting_error')) {
    return 'hard';
  }
  if (review.changeCount > 5) return 'hard';
  if (review.changeCount > 2) return 'medium';
  return 'easy';
}

3. Create src/app/api/model-insights/run-benchmark/route.ts:

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { runBenchmark } from '@/lib/benchmarks/runner';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    
    // Find the main benchmark set
    const benchmarkSet = await prisma.benchmarkSet.findFirst({
      where: { isLocked: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!benchmarkSet) {
      return NextResponse.json(
        { error: 'No locked benchmark set found' },
        { status: 404 }
      );
    }
    
    const result = await runBenchmark({
      benchmarkSetId: benchmarkSet.id,
    });
    
    return NextResponse.json({
      score: result.overallScore,
      passed: result.passedGating,
      comparison: result.comparison,
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Benchmark failed' }, { status: 500 });
  }
}
```

---

## Step 3: Create Weekly Iteration Workflow

### Prompt 7.3: Weekly Process Documentation

```
Create documentation and tooling for the weekly improvement process.

1. Create src/lib/improvement/weekly-process.ts:

import { prisma } from '@/lib/db';
import { runBenchmark } from '../benchmarks/runner';

// ==========================================
// WEEKLY IMPROVEMENT WORKFLOW
// ==========================================

export interface WeeklyAnalysis {
  week: string;
  
  // Error analysis
  topErrorTags: Array<{
    tag: string;
    count: number;
    trend: number;
    exampleIds: string[];
  }>;
  
  // Improvement candidates
  improvementCandidates: Array<{
    issue: string;
    impact: 'high' | 'medium' | 'low';
    suggestedAction: string;
    affectedDocTypes: string[];
  }>;
  
  // Metrics
  metrics: {
    reviewCount: number;
    accuracyRate: number;
    avgChangesPerReview: number;
  };
}

export async function generateWeeklyAnalysis(
  organisationId: string,
  weekStart: Date
): Promise<WeeklyAnalysis> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Get reviews for the week
  const reviews = await prisma.humanReview.findMany({
    where: {
      organisationId,
      reviewedAt: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
    include: {
      extractionRun: {
        select: { documentType: true },
      },
    },
  });
  
  // Aggregate error tags
  const tagData: Record<string, { count: number; examples: string[] }> = {};
  reviews.forEach(r => {
    r.errorTags.forEach(tag => {
      if (!tagData[tag]) tagData[tag] = { count: 0, examples: [] };
      tagData[tag].count++;
      if (tagData[tag].examples.length < 5) {
        tagData[tag].examples.push(r.id);
      }
    });
  });
  
  const topErrorTags = Object.entries(tagData)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      trend: 0, // TODO: Compare to previous week
      exampleIds: data.examples,
    }));
  
  // Generate improvement candidates
  const improvementCandidates = topErrorTags.map(tag => ({
    issue: tag.tag.replace(/_/g, ' '),
    impact: tag.count > 10 ? 'high' : tag.count > 5 ? 'medium' : 'low' as const,
    suggestedAction: getSuggestedAction(tag.tag),
    affectedDocTypes: getAffectedDocTypes(reviews, tag.tag),
  }));
  
  // Calculate metrics
  const reviewCount = reviews.length;
  const correctCount = reviews.filter(r => r.wasCorrect).length;
  const totalChanges = reviews.reduce((sum, r) => sum + r.changeCount, 0);
  
  return {
    week: weekStart.toISOString().split('T')[0],
    topErrorTags,
    improvementCandidates,
    metrics: {
      reviewCount,
      accuracyRate: reviewCount > 0 ? correctCount / reviewCount : 0,
      avgChangesPerReview: reviewCount > 0 ? totalChanges / reviewCount : 0,
    },
  };
}

function getSuggestedAction(tag: string): string {
  const actions: Record<string, string> = {
    wrong_date_format: 'Update date parsing rules in normalisation.ts',
    missed_table_row: 'Review table extraction prompt for Gas/EICR extractors',
    hallucinated_value: 'Add evidence requirement validation',
    wrong_field_mapping: 'Add field-specific pattern detection',
    missed_defect: 'Enhance observation/remedial extraction prompts',
    name_address_confusion: 'Add address regex to name validator',
    poor_ocr_quality: 'Consider OCR preprocessing or lower tier threshold',
    multi_page_missed: 'Verify multi-page handling in extractors',
    handwriting_error: 'Flag for manual review or handwriting mode',
    wrong_appliance_result: 'Add result validation for gas appliances',
    missed_observation: 'Review observation extraction prompts',
    wrong_outcome: 'Add outcome cross-validation with evidence',
  };
  
  return actions[tag] || 'Review extraction prompts for this pattern';
}

function getAffectedDocTypes(reviews: any[], tag: string): string[] {
  const types = new Set<string>();
  reviews.forEach(r => {
    if (r.errorTags.includes(tag)) {
      types.add(r.extractionRun.documentType);
    }
  });
  return Array.from(types);
}

// ==========================================
// IMPROVEMENT TRACKING
// ==========================================

export interface ImprovementRecord {
  id: string;
  date: string;
  issue: string;
  action: string;
  beforeScore: number;
  afterScore: number;
  delta: number;
}

export async function recordImprovement(
  issue: string,
  action: string,
  beforeScore: number,
  afterScore: number
): Promise<void> {
  // Store in a simple log or database table
  console.log(`IMPROVEMENT: ${issue}`);
  console.log(`  Action: ${action}`);
  console.log(`  Before: ${beforeScore.toFixed(1)}, After: ${afterScore.toFixed(1)}`);
  console.log(`  Delta: ${(afterScore - beforeScore).toFixed(1)}`);
  
  // TODO: Store in database for tracking
}

// ==========================================
// BENCHMARK GATING
// ==========================================

export async function validateBeforeRelease(
  benchmarkSetId: string
): Promise<{
  canRelease: boolean;
  reason: string;
  score: number;
  comparison?: any;
}> {
  const result = await runBenchmark({ benchmarkSetId });
  
  return {
    canRelease: result.passedGating,
    reason: result.gatingReason || 'Unknown',
    score: result.overallScore,
    comparison: result.comparison,
  };
}

2. Create a weekly process checklist at docs/WEEKLY_IMPROVEMENT_PROCESS.md:

# Weekly Model Improvement Process

## Monday: Analyse

### 1. Review Model Insights Dashboard
- Go to `/model-insights`
- Check overall accuracy trend
- Note top 3 error tags

### 2. Pull Error Examples
- Click on top error tags to see examples
- Download 10-20 examples for each top error
- Identify patterns

### 3. Prioritise Issues
- Rank by: impact (count) × fixability
- Choose 1-3 issues to address this week

## Tuesday-Thursday: Improve

### 4. For Each Issue:

**If it's a prompt issue:**
- Update the relevant extractor in `src/lib/extraction/extractors/`
- Add more specific instructions
- Add examples if helpful

**If it's a validation issue:**
- Update validators in `src/lib/extraction/validators/`
- Add new field-level checks
- Consider repair prompts

**If it's a normalisation issue:**
- Update rules in `src/lib/compliance-rules/normalisation.ts`
- Add new mappings or patterns

**If it's a schema issue:**
- Update types in `src/lib/extraction-schemas/`
- Update Zod validators

### 5. Add Test Cases
- Add problematic certificates to benchmark set
- Create expected output for each
- Lock benchmark set when ready

## Friday: Validate & Ship

### 6. Run Benchmark
- Go to `/model-insights`
- Click "Run Benchmark"
- Wait for results

### 7. Check Gating
- Score improved or stable? ✓
- No regressions? ✓
- If failed, investigate and fix

### 8. Deploy
- If gating passed, deploy changes
- Record improvement in changelog
- Update team on improvements

### 9. Document
- Note what worked
- Note what didn't
- Plan for next week

## Metrics to Track

| Metric | Target |
|--------|--------|
| Weekly accuracy | > 90% |
| Benchmark score | > 80 |
| Error tag reduction | 20% per week on focus areas |
| Reviews needing changes | < 20% |

## Tools

- `/model-insights` - Dashboard
- `/benchmarks` - Benchmark management
- Export training data for fine-tuning prep
- Git for prompt versioning

3. Create src/app/(dashboard)/model-insights/weekly/page.tsx:

'use client';

// Weekly analysis view
// Shows this week's analysis and comparison to last week
// Provides action items and progress tracking

// Implementation follows similar pattern to main insights page
// with focus on week-over-week comparison and action tracking
```

---

## Step 4: Create Prompt Version Control

### Prompt 7.4: Prompt Versioning

```
Create a system for tracking prompt versions.

1. Create src/lib/prompts/registry.ts:

// ==========================================
// PROMPT REGISTRY
// ==========================================

export interface PromptVersion {
  id: string;
  documentType: string;
  version: string;
  prompt: string;
  createdAt: Date;
  notes?: string;
  benchmarkScore?: number;
}

// In-memory registry (could be database-backed)
const PROMPT_VERSIONS: PromptVersion[] = [];

export function registerPrompt(
  documentType: string,
  version: string,
  prompt: string,
  notes?: string
): void {
  PROMPT_VERSIONS.push({
    id: `${documentType}_${version}`,
    documentType,
    version,
    prompt,
    createdAt: new Date(),
    notes,
  });
}

export function getLatestPrompt(documentType: string): PromptVersion | null {
  const versions = PROMPT_VERSIONS
    .filter(p => p.documentType === documentType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  return versions[0] || null;
}

export function getPromptVersion(
  documentType: string,
  version: string
): PromptVersion | null {
  return PROMPT_VERSIONS.find(
    p => p.documentType === documentType && p.version === version
  ) || null;
}

export function listPromptVersions(documentType: string): PromptVersion[] {
  return PROMPT_VERSIONS
    .filter(p => p.documentType === documentType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function recordBenchmarkScore(
  documentType: string,
  version: string,
  score: number
): void {
  const prompt = getPromptVersion(documentType, version);
  if (prompt) {
    prompt.benchmarkScore = score;
  }
}

2. Update extractors to use versioned prompts:

// In each extractor file, add version tracking:

const PROMPT_VERSION = 'v1.2';  // Increment when changing prompt

// At file load, register the prompt
import { registerPrompt } from '../../prompts/registry';

registerPrompt('GAS_SAFETY', PROMPT_VERSION, GAS_SAFETY_PROMPT, 
  'Added emphasis on appliance result extraction'
);
```

---

## Verification Checklist

After completing Phase 7, verify:

```
□ Insights dashboard works
  - Shows accuracy metrics
  - Displays top error tags
  - Shows improvement queue
  - Benchmark trend visible

□ Export training data works
  - Download produces JSONL file
  - File contains model output + gold output
  - Error tags included

□ Weekly process documented
  - WEEKLY_IMPROVEMENT_PROCESS.md exists
  - Team understands the workflow

□ Benchmark integration
  - Can trigger benchmark from dashboard
  - Results update insights

□ Prompt versioning
  - Versions tracked
  - Can query prompt history
```

---

## The Weekly Loop in Practice

```
WEEK 1 EXAMPLE:

Monday:
├── Check dashboard: 78% accuracy, top error "missed_table_row" (23 cases)
├── Pull 15 examples of missed table rows
└── Most are Gas Safety appliance tables

Tuesday-Thursday:
├── Update gas-safety.ts extractor prompt
├── Add explicit table extraction instructions
├── Add 5 problem certificates to benchmark
└── Create expected outputs

Friday:
├── Run benchmark: 81 → 84 (+3 points)
├── No regressions
├── Deploy changes
└── Document: "Improved Gas Safety table extraction"

RESULT: "missed_table_row" reduced by 40% next week
```

---

## Files Created in Phase 7

```
src/app/(dashboard)/model-insights/
  page.tsx
  weekly/page.tsx

src/app/api/model-insights/
  route.ts
  export-training-data/route.ts
  run-benchmark/route.ts

src/lib/improvement/
  weekly-process.ts

src/lib/prompts/
  registry.ts

docs/
  WEEKLY_IMPROVEMENT_PROCESS.md
```

---

## Congratulations! 🎉

You've completed all 7 phases of the Model Ownership Guide.

**What you've built:**

| Phase | Component | Purpose |
|-------|-----------|---------|
| 1 | Schema & Validation | Behaviour contract |
| 2 | Classification & Routing | Document-specific extraction |
| 3 | Repair Pipeline | Self-correcting errors |
| 4 | Human Review | Data flywheel |
| 5 | Benchmarking | Quantified quality |
| 6 | Domain Rules | Compliance logic |
| 7 | Improvement Loop | Continuous improvement |

**You now own:**
- The extraction schemas (not just using Claude)
- The correction data (training flywheel)
- The evaluation metrics (release gating)
- The compliance logic (domain expertise)

**Anthropic provides the engine; Lashan owns the system.**
