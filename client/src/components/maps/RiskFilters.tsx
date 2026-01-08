import { ComplianceStream, RiskFilters as RiskFiltersType } from '@/lib/risk/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Filter } from 'lucide-react';

interface RiskFiltersProps {
  filters: RiskFiltersType;
  onChange: (filters: RiskFiltersType) => void;
}

const STREAMS: { value: ComplianceStream; label: string }[] = [
  { value: 'gas', label: 'Gas Safety' },
  { value: 'electrical', label: 'Electrical (EICR)' },
  { value: 'fire', label: 'Fire Safety' },
  { value: 'asbestos', label: 'Asbestos' },
  { value: 'lift', label: 'Lift (LOLER)' },
  { value: 'water', label: 'Water (Legionella)' },
];

export function RiskFilters({ filters, onChange }: RiskFiltersProps) {
  const handleLevelChange = (level: string) => {
    onChange({ ...filters, level: level as 'property' | 'estate' | 'ward' });
  };

  const handlePeriodChange = (period: string) => {
    onChange({ ...filters, period: period as 'current' | '3m' | '6m' | '12m' });
  };

  const handleStreamChange = (value: string) => {
    if (value === 'all') {
      onChange({ ...filters, streams: 'all' });
    } else {
      onChange({ ...filters, streams: [value as ComplianceStream] });
    }
  };

  const handleAtRiskToggle = (checked: boolean) => {
    onChange({ ...filters, showOnlyAtRisk: checked });
  };

  const currentStreamValue = filters.streams === 'all' 
    ? 'all' 
    : (filters.streams as ComplianceStream[])[0] || 'all';

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-background border-b" data-testid="risk-filters">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      <Select value={filters.level} onValueChange={handleLevelChange}>
        <SelectTrigger className="w-[140px]" data-testid="select-aggregation-level">
          <SelectValue placeholder="Aggregation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="property">Property</SelectItem>
          <SelectItem value="estate">Estate</SelectItem>
          <SelectItem value="ward">Ward</SelectItem>
        </SelectContent>
      </Select>

      <Select value={currentStreamValue} onValueChange={handleStreamChange}>
        <SelectTrigger className="w-[160px]" data-testid="select-stream-filter">
          <SelectValue placeholder="Select Stream" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Streams</SelectItem>
          {STREAMS.map(stream => (
            <SelectItem key={stream.value} value={stream.value}>{stream.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[120px]" data-testid="select-period">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current">Current</SelectItem>
          <SelectItem value="3m">Last 3 Months</SelectItem>
          <SelectItem value="6m">Last 6 Months</SelectItem>
          <SelectItem value="12m">Last 12 Months</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 ml-auto">
        <Switch 
          id="at-risk-only"
          checked={filters.showOnlyAtRisk || false}
          onCheckedChange={handleAtRiskToggle}
          data-testid="switch-at-risk-only"
        />
        <Label htmlFor="at-risk-only" className="text-sm">Show only at-risk</Label>
      </div>
    </div>
  );
}

export default RiskFilters;
