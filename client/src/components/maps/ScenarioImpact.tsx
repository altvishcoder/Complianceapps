import { ScenarioResult } from '@/lib/risk/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getRiskColor } from './PropertyMarkers';
import { TrendingDown, TrendingUp, AlertTriangle, MapPin } from 'lucide-react';

interface ScenarioImpactProps {
  result: ScenarioResult | null;
  isLoading?: boolean;
}

export function ScenarioImpact({ result, isLoading }: ScenarioImpactProps) {
  if (isLoading) {
    return (
      <Card className="h-full" data-testid="scenario-impact-loading">
        <CardHeader>
          <CardTitle className="text-lg">Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">Calculating impact...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="h-full" data-testid="scenario-impact-empty">
        <CardHeader>
          <CardTitle className="text-lg">Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Enable scenarios to see impact analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreChange = result.impact.scoreChange;
  const isNegative = scoreChange < 0;

  return (
    <Card className="h-full flex flex-col" data-testid="scenario-impact">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Impact Analysis
          {isNegative && <Badge variant="destructive">Risk Increased</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Baseline</div>
                <div className="text-2xl font-bold" style={{ color: getRiskColor(result.baseline.score) }}>
                  {result.baseline.score}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {result.baseline.propertiesAtRisk} at risk
                </div>
              </div>
              
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Scenario</div>
                <div className="text-2xl font-bold" style={{ color: getRiskColor(result.scenario.score) }}>
                  {result.scenario.score}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {result.scenario.propertiesAtRisk} at risk
                </div>
              </div>
              
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Change</div>
                <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                  {isNegative ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                  {Math.abs(scoreChange)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  +{result.impact.additionalAtRisk} properties
                </div>
              </div>
            </div>

            {result.impact.newHotspots.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  New Risk Hotspots
                </h4>
                <div className="space-y-2">
                  {result.impact.newHotspots.slice(0, 5).map(hotspot => (
                    <div 
                      key={hotspot.id} 
                      className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800"
                    >
                      <span className="text-sm">{hotspot.name}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: getRiskColor(hotspot.baselineScore) }}>
                          {hotspot.baselineScore}%
                        </span>
                        <span>→</span>
                        <span style={{ color: getRiskColor(hotspot.scenarioScore) }}>
                          {hotspot.scenarioScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Scenario Mode Active
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    These results are hypothetical projections based on selected scenarios. 
                    Actual outcomes may vary.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ScenarioImpact;
