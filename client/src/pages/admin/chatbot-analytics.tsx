import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { MessageSquare, Zap, DollarSign, Brain, Database, BookOpen, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ChatbotAnalytics {
  totalQueries: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  responseSourceBreakdown: Record<string, number>;
  dailyStats: Array<{ date: string; queries: number; llmQueries: number }>;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

const SOURCE_LABELS: Record<string, string> = {
  static: 'Static Responses',
  faq: 'FAQ Cache',
  database: 'Database Queries',
  rag: 'RAG Search',
  llm: 'LLM (Claude)',
};

const SOURCE_ICONS: Record<string, any> = {
  static: Zap,
  faq: BookOpen,
  database: Database,
  rag: Brain,
  llm: HelpCircle,
};

export default function ChatbotAnalyticsPage() {
  const [days, setDays] = useState("7");
  const queryClient = useQueryClient();
  
  const { data: analytics, isLoading, isFetching } = useQuery<ChatbotAnalytics>({
    queryKey: ['/api/assistant/analytics', days],
    queryFn: async () => {
      const res = await fetch(`/api/assistant/analytics?days=${days}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pieData = analytics?.responseSourceBreakdown 
    ? Object.entries(analytics.responseSourceBreakdown)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => ({
          name: SOURCE_LABELS[key] || key,
          value,
        }))
    : [];

  const totalNonLLM = analytics ? 
    (analytics.responseSourceBreakdown.static || 0) + 
    (analytics.responseSourceBreakdown.faq || 0) + 
    (analytics.responseSourceBreakdown.database || 0) + 
    (analytics.responseSourceBreakdown.rag || 0) : 0;
  
  const llmQueries = analytics?.responseSourceBreakdown.llm || 0;
  const llmPercentage = analytics?.totalQueries ? 
    ((llmQueries / analytics.totalQueries) * 100).toFixed(1) : '0';
  const costSavedPercentage = analytics?.totalQueries ?
    ((totalNonLLM / analytics.totalQueries) * 100).toFixed(1) : '0';

  return (
    <div className="flex h-screen bg-muted/30" data-testid="chatbot-analytics-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="AI Assistant Analytics" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">AI Assistant Analytics</h1>
              <p className="text-muted-foreground">
                Monitor chatbot usage and cost optimization performance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/assistant/analytics'] })}
                disabled={isFetching}
                data-testid="button-refresh-analytics"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-36" data-testid="select-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-queries">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalQueries.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Chatbot conversations processed
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-tokens-saved">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tokens Saved</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analytics?.tokensSaved.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {costSavedPercentage}% queries handled without LLM
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-cost-saved">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Est. Cost Saved</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${analytics?.estimatedCostSaved.toFixed(4) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              By using cached/static responses
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-llm-usage">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">LLM Usage</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{llmQueries}</div>
            <p className="text-xs text-muted-foreground">
              {llmPercentage}% of queries needed LLM
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">Response Sources</TabsTrigger>
          <TabsTrigger value="daily">Daily Trends</TabsTrigger>
          <TabsTrigger value="layers">5-Layer Architecture</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Source Distribution</CardTitle>
                <CardDescription>
                  How queries are being handled across the 5-layer architecture
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available yet. Start using the chatbot to see analytics.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Source Breakdown</CardTitle>
                <CardDescription>
                  Number of queries handled by each layer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics?.responseSourceBreakdown || {}).map(([key, value], index) => {
                    const Icon = SOURCE_ICONS[key] || HelpCircle;
                    const total = analytics?.totalQueries || 1;
                    const percentage = ((value / total) * 100).toFixed(1);
                    
                    return (
                      <div key={key} className="flex items-center gap-4">
                        <div 
                          className="p-2 rounded-lg" 
                          style={{ backgroundColor: `${COLORS[index % COLORS.length]}20` }}
                        >
                          <Icon 
                            className="h-5 w-5" 
                            style={{ color: COLORS[index % COLORS.length] }}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{SOURCE_LABELS[key] || key}</span>
                            <span className="text-sm text-muted-foreground">{value} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Daily Query Volume</CardTitle>
              <CardDescription>
                Total queries vs LLM queries over time
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {analytics?.dailyStats && analytics.dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    />
                    <Legend />
                    <Bar dataKey="queries" name="Total Queries" fill="#3b82f6" />
                    <Bar dataKey="llmQueries" name="LLM Queries" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No daily data available yet. Check back after using the chatbot.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers">
          <Card>
            <CardHeader>
              <CardTitle>5-Layer Cost Optimization Architecture</CardTitle>
              <CardDescription>
                How the chatbot minimizes LLM usage through intelligent routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {[
                    { layer: 0, name: 'Intent Classification', desc: 'Keyword-based routing', icon: Zap, cost: 'Free', color: '#22c55e' },
                    { layer: 1, name: 'FAQ Cache', desc: 'TF-IDF semantic matching', icon: BookOpen, cost: 'Free', color: '#3b82f6' },
                    { layer: 2, name: 'Database Queries', desc: 'Property/certificate lookups', icon: Database, cost: 'Free', color: '#f59e0b' },
                    { layer: 3, name: 'LLM Handler', desc: 'Claude 3.5 Haiku', icon: Brain, cost: '~$0.001/query', color: '#8b5cf6' },
                    { layer: 4, name: 'Enhancement', desc: 'Context-aware suggestions', icon: HelpCircle, cost: 'Free', color: '#06b6d4' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div 
                        key={item.layer} 
                        className="border rounded-lg p-4 text-center"
                        style={{ borderColor: item.color }}
                      >
                        <div 
                          className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: item.color }} />
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">Layer {item.layer}</div>
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
                        <div 
                          className="text-xs font-medium mt-2 px-2 py-1 rounded"
                          style={{ backgroundColor: `${item.color}20`, color: item.color }}
                        >
                          {item.cost}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">How It Works</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li><strong>Layer 0 - Intent Classification:</strong> Fast keyword matching routes greetings and off-topic queries to static responses (0 tokens)</li>
                    <li><strong>Layer 1 - FAQ Cache:</strong> TF-IDF semantic matching against 45+ compliance FAQs with question variations (0 tokens)</li>
                    <li><strong>Layer 2 - Database Queries:</strong> Natural language property/certificate lookups directly against PostgreSQL (0 tokens)</li>
                    <li><strong>Layer 2.5 - RAG Search:</strong> Semantic search against knowledge base documents for trained content (0 tokens)</li>
                    <li><strong>Layer 3 - LLM Handler:</strong> Only complex queries reach Claude 3.5 Haiku with 256 max tokens</li>
                    <li><strong>Layer 4 - Enhancement:</strong> Context-aware follow-up suggestions based on detected topics (0 tokens)</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </main>
      </div>
    </div>
  );
}