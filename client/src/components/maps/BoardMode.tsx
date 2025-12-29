import { RiskScore } from '@/lib/risk/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface BoardModeProps {
  organisationName: string;
  overallScore: number;
  targetScore: number;
  openHighSeverity: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  trendPercentage: number;
}

export function BoardMode({
  organisationName,
  overallScore,
  targetScore,
  openHighSeverity,
  trend,
  trendPercentage,
}: BoardModeProps) {
  const isCompliant = overallScore >= targetScore;
  const complianceGap = targetScore - overallScore;

  const TrafficLight = () => {
    if (overallScore >= 90) {
      return (
        <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
          <CheckCircle2 className="h-12 w-12 text-white" />
        </div>
      );
    }
    if (overallScore >= 70) {
      return (
        <div className="w-24 h-24 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
          <AlertTriangle className="h-12 w-12 text-white" />
        </div>
      );
    }
    return (
      <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg animate-pulse">
        <AlertCircle className="h-12 w-12 text-white" />
      </div>
    );
  };

  const TrendIndicator = () => {
    if (trend === 'improving') {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <TrendingUp className="h-8 w-8" />
          <span className="text-2xl font-bold">Up {trendPercentage}%</span>
          <span className="text-lg text-muted-foreground">this quarter</span>
        </div>
      );
    }
    if (trend === 'deteriorating') {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <TrendingDown className="h-8 w-8" />
          <span className="text-2xl font-bold">Down {trendPercentage}%</span>
          <span className="text-lg text-muted-foreground">this quarter</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Minus className="h-8 w-8" />
        <span className="text-2xl font-bold">Stable</span>
        <span className="text-lg">this quarter</span>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8" data-testid="board-mode">
      <div className="text-center">
        <h2 className="text-3xl font-bold">{organisationName}</h2>
        <p className="text-xl text-muted-foreground mt-2">Compliance Overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="text-center p-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Are we compliant?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <TrafficLight />
            </div>
            <div className="text-3xl font-bold">
              {overallScore}% compliant
            </div>
            <div className="text-lg text-muted-foreground">
              (target: {targetScore}%)
            </div>
            {!isCompliant && (
              <Badge variant="destructive" className="text-lg py-2 px-4">
                Gap: {complianceGap.toFixed(1)}%
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="text-center p-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">What's at risk?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-6xl font-bold text-red-600">
              {openHighSeverity}
            </div>
            <div className="text-xl text-muted-foreground">
              high-severity findings open
            </div>
            {openHighSeverity > 0 && (
              <Badge variant="destructive" className="text-lg py-2 px-4">
                Action Required
              </Badge>
            )}
            {openHighSeverity === 0 && (
              <Badge className="text-lg py-2 px-4 bg-green-100 text-green-800">
                No Critical Issues
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="text-center p-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Are we improving?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <TrendIndicator />
            </div>
            <div className="text-lg text-muted-foreground mt-4">
              {trend === 'improving' && 'Positive trajectory maintained'}
              {trend === 'deteriorating' && 'Review remediation efforts'}
              {trend === 'stable' && 'Consistent performance'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BoardMode;
