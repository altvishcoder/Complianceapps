import { ComplianceStream, RiskFilters as RiskFiltersType } from '@/lib/risk/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, ChevronDown } from 'lucide-react';

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

  const handleStreamToggle = (stream: ComplianceStream) => {
    if (filters.streams === 'all') {
      onChange({ ...filters, streams: [stream] });
    } else {
      const current = filters.streams as ComplianceStream[];
      if (current.includes(stream)) {
        const newStreams = current.filter(s => s !== stream);
        onChange({ ...filters, streams: newStreams.length === 0 ? 'all' : newStreams });
      } else {
        onChange({ ...filters, streams: [...current, stream] });
      }
    }
  };

  const handleAllStreams = () => {
    onChange({ ...filters, streams: 'all' });
  };

  const handleAtRiskToggle = (checked: boolean) => {
    onChange({ ...filters, showOnlyAtRisk: checked });
  };

  const selectedStreamCount = filters.streams === 'all' 
    ? STREAMS.length 
    : (filters.streams as ComplianceStream[]).length;

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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[160px] justify-between" data-testid="button-stream-filter">
            {selectedStreamCount === STREAMS.length ? 'All Streams' : `${selectedStreamCount} Streams`}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-3">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="all-streams" 
                checked={filters.streams === 'all'}
                onCheckedChange={handleAllStreams}
              />
              <Label htmlFor="all-streams" className="text-sm font-medium">All Streams</Label>
            </div>
            <div className="border-t pt-2 space-y-2">
              {STREAMS.map(stream => (
                <div key={stream.value} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`stream-${stream.value}`}
                    checked={filters.streams === 'all' || (filters.streams as ComplianceStream[]).includes(stream.value)}
                    onCheckedChange={() => handleStreamToggle(stream.value)}
                  />
                  <Label htmlFor={`stream-${stream.value}`} className="text-sm">{stream.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

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
