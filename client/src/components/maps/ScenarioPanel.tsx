import { Scenario, ScenarioType } from '@/lib/risk/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Building2, Clock } from 'lucide-react';

interface ScenarioPanelProps {
  scenarios: Scenario[];
  onChange: (scenarios: Scenario[]) => void;
}

const SCENARIO_CONFIG: Record<ScenarioType, {
  title: string;
  description: string;
  icon: React.ReactNode;
  hasSlider?: boolean;
  sliderLabel?: string;
  sliderMin?: number;
  sliderMax?: number;
  sliderDefault?: number;
}> = {
  advisory_as_failure: {
    title: 'Advisory as Failure',
    description: 'Treat C3, FI, NCS, and Advisory findings as major defects',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  certificate_slip: {
    title: 'Certificate Slip',
    description: 'Simulate certificates due soon becoming overdue',
    icon: <Clock className="h-4 w-4" />,
    hasSlider: true,
    sliderLabel: 'Slip percentage',
    sliderMin: 10,
    sliderMax: 50,
    sliderDefault: 20,
  },
  dual_failure: {
    title: 'Dual System Failure',
    description: 'Highlight properties with 2+ non-compliant streams',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  capacity_reduction: {
    title: 'Capacity Reduction',
    description: 'Simulate reduced contractor capacity',
    icon: <AlertTriangle className="h-4 w-4" />,
    hasSlider: true,
    sliderLabel: 'Capacity reduction',
    sliderMin: 10,
    sliderMax: 50,
    sliderDefault: 25,
  },
  hrb_only: {
    title: 'HRB Focus',
    description: 'Filter to 18m+ / 7+ storey buildings only',
    icon: <Building2 className="h-4 w-4" />,
  },
};

export function ScenarioPanel({ scenarios, onChange }: ScenarioPanelProps) {
  const handleToggle = (type: ScenarioType, enabled: boolean) => {
    const updated = scenarios.map(s => 
      s.type === type ? { ...s, enabled } : s
    );
    onChange(updated);
  };

  const handleSliderChange = (type: ScenarioType, paramKey: 'slipPercentage' | 'capacityReduction', value: number) => {
    const updated = scenarios.map(s => 
      s.type === type ? { ...s, params: { ...s.params, [paramKey]: value } } : s
    );
    onChange(updated);
  };

  const enabledCount = scenarios.filter(s => s.enabled).length;

  return (
    <Card className="h-full" data-testid="scenario-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Scenario Analysis
          </CardTitle>
          {enabledCount > 0 && (
            <Badge variant="secondary">{enabledCount} active</Badge>
          )}
        </div>
        <CardDescription>
          Test "what-if" scenarios to understand potential risks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scenarios.map(scenario => {
          const config = SCENARIO_CONFIG[scenario.type];
          if (!config) return null;
          
          const paramKey = scenario.type === 'certificate_slip' ? 'slipPercentage' : 'capacityReduction';
          const currentValue = scenario.params[paramKey] || config.sliderDefault || 20;
          
          return (
            <div 
              key={scenario.type} 
              className={`p-4 rounded-lg border transition-colors ${scenario.enabled ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-muted/30'}`}
              data-testid={`scenario-${scenario.type}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${scenario.enabled ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {config.icon}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{config.title}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                  </div>
                </div>
                <Switch
                  checked={scenario.enabled}
                  onCheckedChange={(checked) => handleToggle(scenario.type, checked)}
                  data-testid={`switch-${scenario.type}`}
                />
              </div>
              
              {config.hasSlider && scenario.enabled && (
                <div className="mt-4 pl-7">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{config.sliderLabel}</span>
                    <span className="text-xs font-medium">{currentValue}%</span>
                  </div>
                  <Slider
                    value={[currentValue]}
                    min={config.sliderMin}
                    max={config.sliderMax}
                    step={5}
                    onValueChange={([value]) => handleSliderChange(scenario.type, paramKey, value)}
                    data-testid={`slider-${scenario.type}`}
                  />
                </div>
              )}
              
              {scenario.enabled && scenario.impact && (
                <div className="mt-3 pl-7">
                  <Badge variant="destructive" className="text-xs">
                    +{scenario.impact.additionalPropertiesAtRisk} properties at risk
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ScenarioPanel;
