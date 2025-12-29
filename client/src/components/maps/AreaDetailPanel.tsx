import { RiskScore, StreamScore } from '@/lib/risk/types';
import { getRiskColor } from './PropertyMarkers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'wouter';

interface AreaDetailPanelProps {
  areaId: string;
  areaName: string;
  areaLevel: 'property' | 'estate' | 'ward';
  riskScore: RiskScore;
  onClose: () => void;
  onExport?: () => void;
}

function StreamRow({ stream }: { stream: StreamScore }) {
  const percentage = Math.round(stream.compliance * 100);
  const color = getRiskColor(percentage);
  
  const statusIcon = percentage >= 95 ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : percentage >= 80 ? (
    <AlertTriangle className="h-4 w-4 text-amber-500" />
  ) : (
    <AlertCircle className="h-4 w-4 text-red-500" />
  );

  const streamLabels: Record<string, string> = {
    gas: 'Gas Safety',
    electrical: 'Electrical (EICR)',
    fire: 'Fire Risk',
    asbestos: 'Asbestos',
    lift: 'Lift (LOLER)',
    water: 'Legionella',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        {statusIcon}
        <span className="text-sm">{streamLabels[stream.stream] || stream.stream}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-20">
          <Progress value={percentage} className="h-2" />
        </div>
        <span className="text-sm font-medium w-12 text-right" style={{ color }}>
          {percentage}%
        </span>
        {stream.overdueCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {stream.overdueCount} overdue
          </Badge>
        )}
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'improving' | 'stable' | 'deteriorating' }) {
  if (trend === 'improving') {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <TrendingUp className="h-4 w-4" />
        <span className="text-xs">Improving</span>
      </div>
    );
  }
  if (trend === 'deteriorating') {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <TrendingDown className="h-4 w-4" />
        <span className="text-xs">Declining</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Minus className="h-4 w-4" />
      <span className="text-xs">Stable</span>
    </div>
  );
}

export function AreaDetailPanel({
  areaId,
  areaName,
  areaLevel,
  riskScore,
  onClose,
  onExport,
}: AreaDetailPanelProps) {
  const scoreColor = getRiskColor(riskScore.compositeScore);
  const levelLabels = { property: 'Property', estate: 'Estate', ward: 'Ward' };

  return (
    <Card className="h-full flex flex-col" data-testid="area-detail-panel">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="mb-2 text-xs">
              {levelLabels[areaLevel]}
            </Badge>
            <CardTitle className="text-lg">{areaName}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            <div className="text-center py-4 bg-muted/50 rounded-lg">
              <div className="text-4xl font-bold" style={{ color: scoreColor }}>
                {riskScore.compositeScore}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Risk Score</div>
              <div className="mt-2">
                <TrendIndicator trend={riskScore.trend} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xl font-semibold">{riskScore.propertyCount}</div>
                <div className="text-xs text-muted-foreground">Properties</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-xl font-semibold">{riskScore.unitCount}</div>
                <div className="text-xs text-muted-foreground">Units</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Compliance by Stream</h4>
              <div className="space-y-1">
                {riskScore.streams.map(stream => (
                  <StreamRow key={stream.stream} stream={stream} />
                ))}
              </div>
            </div>

            {(riskScore.defects.critical > 0 || riskScore.defects.major > 0) && (
              <div>
                <h4 className="text-sm font-medium mb-3">Open Defects</h4>
                <div className="flex gap-2">
                  {riskScore.defects.critical > 0 && (
                    <Badge variant="destructive">
                      {riskScore.defects.critical} Critical
                    </Badge>
                  )}
                  {riskScore.defects.major > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      {riskScore.defects.major} Major
                    </Badge>
                  )}
                  {riskScore.defects.minor > 0 && (
                    <Badge variant="outline">
                      {riskScore.defects.minor} Minor
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-4 border-t">
              <Link href={`/properties?${areaLevel}Id=${areaId}`}>
                <Button variant="outline" className="w-full" data-testid="button-view-properties">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Properties
                </Button>
              </Link>
              {onExport && (
                <Button variant="outline" className="w-full" onClick={onExport} data-testid="button-export">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default AreaDetailPanel;
