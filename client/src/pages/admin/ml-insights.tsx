import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Brain, 
  TrendingUp,
  Activity,
  Target,
  Zap,
  RefreshCcw,
  Settings,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Lightbulb,
  Calculator,
  MessageSquare
} from "lucide-react";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

interface MLModelMetrics {
  model: {
    id: string;
    modelType: string;
    version: string;
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1Score: number | null;
    lastTrainedAt: string | null;
    status: string;
    learningRate: number;
    epochs: number;
    batchSize: number;
    featureWeights: Record<string, number> | null;
    totalPredictions: number;
    correctPredictions: number;
  } | null;
  feedbackStats: {
    total: number;
    correct: number;
    incorrect: number;
    partiallyCorrect: number;
  };
  predictionStats: {
    total: number;
    avgConfidence: number;
    lastPredictionAt: string | null;
  };
  trainingReady: boolean;
  feedbackSamplesNeeded: number;
}

interface TrainingRun {
  id: string;
  modelId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  epochsCompleted: number;
  totalEpochs: number;
  finalLoss: number | null;
  finalAccuracy: number | null;
  trainingMetrics: {
    epochHistory?: Array<{ epoch: number; loss: number; accuracy: number }>;
  } | null;
}

interface MLPrediction {
  id: string;
  propertyId: string;
  riskScore: number;
  riskCategory: string;
  breachProbability: number;
  predictedBreachDate: string | null;
  confidenceLevel: number;
  sourceLabel: string;
  createdAt: string;
}

const FEATURE_LABELS: Record<string, string> = {
  expiryRiskScore: "Certificate Expiry Risk",
  defectRiskScore: "Defect Risk Score",
  assetProfileRiskScore: "Asset Profile Risk",
  coverageGapRiskScore: "Coverage Gap Risk",
  externalFactorRiskScore: "External Factors",
  daysSinceLastCert: "Days Since Last Certificate",
  openActionsCount: "Open Actions Count",
  historicalBreachCount: "Historical Breaches",
  propertyAge: "Property Age",
  isHRB: "High-Rise Building",
  hasVulnerableOccupants: "Vulnerable Occupants",
};

export default function MLInsightsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  
  const [learningRate, setLearningRate] = useState("0.01");
  const [epochs, setEpochs] = useState("50");
  const [batchSize, setBatchSize] = useState("32");

  const { data: modelMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<MLModelMetrics>({
    queryKey: ["ml-model-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/ml/model", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch ML model metrics");
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: trainingRuns, isLoading: runsLoading } = useQuery<TrainingRun[]>({
    queryKey: ["ml-training-runs"],
    queryFn: async () => {
      const res = await fetch("/api/ml/training-runs", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch training runs");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: recentPredictions } = useQuery<MLPrediction[]>({
    queryKey: ["ml-predictions"],
    queryFn: async () => {
      const res = await fetch("/api/ml/predictions?limit=20", { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch predictions");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const trainMutation = useMutation({
    mutationFn: async (params: { learningRate: number; epochs: number; batchSize: number }) => {
      const res = await fetch("/api/ml/model/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to train model");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Training started", description: "Model training has been initiated" });
      queryClient.invalidateQueries({ queryKey: ["ml-model-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["ml-training-runs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Training failed", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (params: { learningRate?: number; epochs?: number; batchSize?: number }) => {
      const res = await fetch("/api/ml/model/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings updated", description: "ML model settings have been saved" });
      refetchMetrics();
    },
  });

  const handleStartTraining = () => {
    trainMutation.mutate({
      learningRate: parseFloat(learningRate),
      epochs: parseInt(epochs),
      batchSize: parseInt(batchSize),
    });
  };

  const getSourceBadge = (sourceLabel: string) => {
    switch (sourceLabel) {
      case 'Statistical':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Calculator className="h-3 w-3 mr-1" /> Statistical</Badge>;
      case 'ML-Enhanced':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><Brain className="h-3 w-3 mr-1" /> ML-Enhanced</Badge>;
      case 'ML-Only':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Zap className="h-3 w-3 mr-1" /> ML-Only</Badge>;
      default:
        return <Badge variant="outline">{sourceLabel}</Badge>;
    }
  };

  const epochHistory = trainingRuns?.[0]?.trainingMetrics?.epochHistory || [];

  const featureWeightData = modelMetrics?.model?.featureWeights 
    ? Object.entries(modelMetrics.model.featureWeights).map(([key, value]) => ({
        feature: FEATURE_LABELS[key] || key,
        weight: value * 100,
        fullMark: 100,
      }))
    : [];

  const predictionDistribution = recentPredictions?.reduce((acc, p) => {
    acc[p.sourceLabel] = (acc[p.sourceLabel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const predictionChartData = Object.entries(predictionDistribution).map(([name, count]) => ({ name, count }));

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Header title="Model Insights" />
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">
                <Activity className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="training" data-testid="tab-training">
                <Brain className="h-4 w-4 mr-2" />
                Training
              </TabsTrigger>
              <TabsTrigger value="predictions" data-testid="tab-predictions">
                <Target className="h-4 w-4 mr-2" />
                Predictions
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <HeroStatsGrid
                stats={[
                  {
                    title: "Model Accuracy",
                    value: modelMetrics?.model?.accuracy != null 
                      ? `${(modelMetrics.model.accuracy * 100).toFixed(1)}%`
                      : '--',
                    subtitle: `${modelMetrics?.model?.correctPredictions || 0} verified`,
                    icon: Target,
                    riskLevel: "good",
                    testId: "stat-accuracy"
                  },
                  {
                    title: "Total Predictions",
                    value: modelMetrics?.predictionStats?.total ?? 0,
                    subtitle: `${(modelMetrics?.predictionStats?.avgConfidence ?? 0).toFixed(1)}% avg confidence`,
                    icon: Activity,
                    riskLevel: "low",
                    testId: "stat-predictions"
                  },
                  {
                    title: "Human Feedback",
                    value: modelMetrics?.feedbackStats?.total ?? 0,
                    subtitle: `${modelMetrics?.feedbackStats?.correct ?? 0} correct, ${modelMetrics?.feedbackStats?.incorrect ?? 0} incorrect`,
                    icon: MessageSquare,
                    riskLevel: (modelMetrics?.feedbackStats?.total ?? 0) >= 10 ? "good" : "medium",
                    testId: "stat-feedback"
                  },
                  {
                    title: "Model Status",
                    value: modelMetrics?.model?.status === 'active' ? 'Active' : 
                           modelMetrics?.model?.status === 'training' ? 'Training' : 'Pending',
                    subtitle: `v${modelMetrics?.model?.version || '1.0.0'}`,
                    icon: modelMetrics?.model?.status === 'active' ? CheckCircle : 
                          modelMetrics?.model?.status === 'training' ? Activity : Clock,
                    riskLevel: modelMetrics?.model?.status === 'active' ? "good" : 
                               modelMetrics?.model?.status === 'training' ? "low" : "medium",
                    testId: "stat-status"
                  }
                ]}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-confidence-tiers">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Two-Tier Confidence System
                    </CardTitle>
                    <CardDescription>
                      Understanding statistical vs ML predictions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-blue-800 dark:text-blue-300">Statistical Score (85-95%)</span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        Based on proven compliance rules, certificate expiry patterns, and historical data. 
                        High accuracy, always reliable.
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="font-medium text-purple-800 dark:text-purple-300">ML Prediction (30-95%)</span>
                      </div>
                      <p className="text-sm text-purple-700 dark:text-purple-400">
                        Learning from patterns and human feedback. Confidence improves over time as 
                        more feedback is provided.
                      </p>
                    </div>
                    <Separator />
                    <div className="text-sm text-muted-foreground">
                      <strong>Tip:</strong> The ML model requires at least 10 feedback samples to begin 
                      learning. Currently have {modelMetrics?.feedbackStats?.total ?? 0} samples.
                      {!modelMetrics?.trainingReady && (
                        <span className="text-amber-600">
                          {" "}Need {modelMetrics?.feedbackSamplesNeeded || 10} more for training.
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-prediction-sources">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Prediction Sources
                    </CardTitle>
                    <CardDescription>
                      Distribution of prediction types
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {predictionChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={predictionChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                        No predictions yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {featureWeightData.length > 0 && (
                <Card data-testid="card-feature-weights">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Feature Importance
                    </CardTitle>
                    <CardDescription>
                      How each factor contributes to risk predictions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={featureWeightData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="feature" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Weight"
                          dataKey="weight"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.6}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="training" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" data-testid="card-training-history">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Training History
                    </CardTitle>
                    <CardDescription>
                      Loss and accuracy over training epochs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {epochHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={epochHistory}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="epoch" label={{ value: 'Epoch', position: 'bottom' }} />
                          <YAxis yAxisId="left" label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} />
                          <YAxis yAxisId="right" orientation="right" label={{ value: 'Accuracy', angle: 90, position: 'insideRight' }} domain={[0, 1]} />
                          <Tooltip />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="loss" stroke="#ef4444" name="Loss" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#22c55e" name="Accuracy" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <Brain className="h-12 w-12 mb-4 opacity-50" />
                        <p>No training history available</p>
                        <p className="text-sm">Start training to see epoch metrics</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-start-training">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Start Training
                    </CardTitle>
                    <CardDescription>
                      Configure and initiate model training
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="learningRate">Learning Rate</Label>
                      <Input 
                        id="learningRate"
                        type="number" 
                        step="0.001"
                        value={learningRate}
                        onChange={(e) => setLearningRate(e.target.value)}
                        data-testid="input-learning-rate"
                      />
                    </div>
                    <div>
                      <Label htmlFor="epochs">Epochs</Label>
                      <Input 
                        id="epochs"
                        type="number" 
                        value={epochs}
                        onChange={(e) => setEpochs(e.target.value)}
                        data-testid="input-epochs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="batchSize">Batch Size</Label>
                      <Input 
                        id="batchSize"
                        type="number" 
                        value={batchSize}
                        onChange={(e) => setBatchSize(e.target.value)}
                        data-testid="input-batch-size"
                      />
                    </div>
                    <Separator />
                    <div className="text-sm text-muted-foreground">
                      {modelMetrics?.trainingReady ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Ready to train with {modelMetrics.feedbackStats.total} feedback samples
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertCircle className="h-4 w-4" />
                          Need {modelMetrics?.feedbackSamplesNeeded || 10} more feedback samples
                        </div>
                      )}
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleStartTraining}
                      disabled={trainMutation.isPending || !modelMetrics?.trainingReady}
                      data-testid="button-start-training"
                    >
                      {trainMutation.isPending ? (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Start Training
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-training-runs">
                <CardHeader>
                  <CardTitle>Recent Training Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {runsLoading ? (
                      <p className="text-muted-foreground">Loading...</p>
                    ) : trainingRuns && trainingRuns.length > 0 ? (
                      <div className="space-y-3">
                        {trainingRuns.map((run) => (
                          <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {run.status === 'completed' ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : run.status === 'running' ? (
                                <RefreshCcw className="h-5 w-5 text-blue-500 animate-spin" />
                              ) : run.status === 'failed' ? (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              ) : (
                                <Clock className="h-5 w-5 text-amber-500" />
                              )}
                              <div>
                                <p className="font-medium">
                                  Training Run - {format(new Date(run.startedAt), "MMM d, yyyy HH:mm")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {run.epochsCompleted}/{run.totalEpochs} epochs
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {run.finalAccuracy != null && (
                                <p className="font-medium text-green-600">
                                  {(run.finalAccuracy * 100).toFixed(1)}% accuracy
                                </p>
                              )}
                              {run.finalLoss != null && (
                                <p className="text-sm text-muted-foreground">
                                  Loss: {run.finalLoss.toFixed(4)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No training runs yet</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="predictions" className="space-y-6">
              <Card data-testid="card-recent-predictions">
                <CardHeader>
                  <CardTitle>Recent Predictions</CardTitle>
                  <CardDescription>
                    Latest risk predictions with confidence levels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {recentPredictions && recentPredictions.length > 0 ? (
                      <div className="space-y-3">
                        {recentPredictions.map((prediction) => (
                          <div key={prediction.id} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {getSourceBadge(prediction.sourceLabel)}
                                  <Badge variant={
                                    prediction.riskCategory === 'CRITICAL' ? 'destructive' :
                                    prediction.riskCategory === 'HIGH' ? 'warning' :
                                    prediction.riskCategory === 'MEDIUM' ? 'default' : 'secondary'
                                  }>
                                    {prediction.riskCategory}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Property: {prediction.propertyId.slice(0, 8)}...
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">
                                  {prediction.riskScore}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Risk Score
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Confidence:</span>
                                <div className="font-medium">{prediction.confidenceLevel.toFixed(1)}%</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Breach Prob:</span>
                                <div className="font-medium">{(prediction.breachProbability * 100).toFixed(1)}%</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Predicted Breach:</span>
                                <div className="font-medium">
                                  {prediction.predictedBreachDate 
                                    ? format(new Date(prediction.predictedBreachDate), "MMM d, yyyy")
                                    : '--'}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {format(new Date(prediction.createdAt), "MMM d, yyyy HH:mm")}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <Target className="h-12 w-12 mb-4 opacity-50" />
                        <p>No predictions yet</p>
                        <p className="text-sm">Predictions are generated when viewing property risk</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card data-testid="card-model-settings">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Model Configuration
                  </CardTitle>
                  <CardDescription>
                    Adjust ML model hyperparameters and feature weights
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="settings-lr">Default Learning Rate</Label>
                      <Input 
                        id="settings-lr"
                        type="number" 
                        step="0.001"
                        defaultValue={modelMetrics?.model?.learningRate || 0.01}
                        onBlur={(e) => updateSettingsMutation.mutate({ learningRate: parseFloat(e.target.value) })}
                        data-testid="input-settings-learning-rate"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Controls how quickly the model learns (0.001-0.1)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="settings-epochs">Default Epochs</Label>
                      <Input 
                        id="settings-epochs"
                        type="number"
                        defaultValue={modelMetrics?.model?.epochs || 50}
                        onBlur={(e) => updateSettingsMutation.mutate({ epochs: parseInt(e.target.value) })}
                        data-testid="input-settings-epochs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of training iterations (10-200)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="settings-batch">Default Batch Size</Label>
                      <Input 
                        id="settings-batch"
                        type="number"
                        defaultValue={modelMetrics?.model?.batchSize || 32}
                        onBlur={(e) => updateSettingsMutation.mutate({ batchSize: parseInt(e.target.value) })}
                        data-testid="input-settings-batch-size"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Samples per training step (8-128)
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-3">Current Model Metrics</h3>
                    {modelMetrics?.model ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Precision</p>
                          <p className="text-xl font-bold">
                            {modelMetrics.model.precision != null 
                              ? `${(modelMetrics.model.precision * 100).toFixed(1)}%`
                              : '--'}
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Recall</p>
                          <p className="text-xl font-bold">
                            {modelMetrics.model.recall != null 
                              ? `${(modelMetrics.model.recall * 100).toFixed(1)}%`
                              : '--'}
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">F1 Score</p>
                          <p className="text-xl font-bold">
                            {modelMetrics.model.f1Score != null 
                              ? `${(modelMetrics.model.f1Score * 100).toFixed(1)}%`
                              : '--'}
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Last Trained</p>
                          <p className="text-xl font-bold">
                            {modelMetrics.model.lastTrainedAt 
                              ? format(new Date(modelMetrics.model.lastTrainedAt), "MMM d")
                              : 'Never'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No model data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
