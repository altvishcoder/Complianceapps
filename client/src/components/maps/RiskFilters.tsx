import { ComplianceStream, RiskFilters as RiskFiltersType } from '@/lib/risk/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getActionIcon } from '@/config/icons';

const Filter = getActionIcon('filter');

interface RiskFiltersProps {
  filters: RiskFiltersType;
  onChange: (filters: RiskFiltersType) => void;
}

const STREAMS: { value: ComplianceStream | 'all'; label: string }[] = [
  { value: 'all', label: 'All Streams' },
  { value: 'gas', label: 'Gas Safety' },
  { value: 'electrical', label: 'Electrical (EICR)' },
  { value: 'fire', label: 'Fire Safety' },
  { value: 'asbestos', label: 'Asbestos' },
  { value: 'lift', label: 'Lift (LOLER)' },
  { value: 'water', label: 'Water (Legionella)' },
];

const LEVELS = [
  { value: 'property', label: 'Property' },
  { value: 'estate', label: 'Estate' },
  { value: 'ward', label: 'Ward' },
];

const PERIODS = [
  { value: 'current', label: 'Current' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
];

export function RiskFilters({ filters, onChange }: RiskFiltersProps) {
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, level: e.target.value as 'property' | 'estate' | 'ward' });
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, period: e.target.value as 'current' | '3m' | '6m' | '12m' });
  };

  const handleStreamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
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

  const selectClassName = "h-10 px-3 py-2 text-sm rounded-xl border border-input bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 appearance-none bg-no-repeat bg-[length:16px] bg-[right_12px_center] cursor-pointer";
  const selectStyle = { backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, paddingRight: '36px' };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-background border-b" data-testid="risk-filters">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      <select 
        value={filters.level} 
        onChange={handleLevelChange}
        className={selectClassName}
        style={selectStyle}
        data-testid="select-aggregation-level"
      >
        {LEVELS.map(level => (
          <option key={level.value} value={level.value}>{level.label}</option>
        ))}
      </select>

      <select 
        value={currentStreamValue} 
        onChange={handleStreamChange}
        className={selectClassName}
        style={selectStyle}
        data-testid="select-stream-filter"
      >
        {STREAMS.map(stream => (
          <option key={stream.value} value={stream.value}>{stream.label}</option>
        ))}
      </select>

      <select 
        value={filters.period} 
        onChange={handlePeriodChange}
        className={selectClassName}
        style={selectStyle}
        data-testid="select-period"
      >
        {PERIODS.map(period => (
          <option key={period.value} value={period.value}>{period.label}</option>
        ))}
      </select>

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
