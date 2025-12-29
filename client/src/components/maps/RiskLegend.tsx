import { cn } from '@/lib/utils';

interface RiskLegendProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function RiskLegend({ className, orientation = 'horizontal' }: RiskLegendProps) {
  const isHorizontal = orientation === 'horizontal';
  
  return (
    <div 
      className={cn(
        'bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border p-3',
        isHorizontal ? 'flex items-center gap-6' : 'space-y-3',
        className
      )}
      data-testid="risk-legend"
    >
      <span className="text-xs font-medium text-muted-foreground">Risk Level:</span>
      
      <div className={cn('flex gap-4', !isHorizontal && 'flex-col')}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm" />
          <span className="text-xs">High Risk (0-60%)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
          <span className="text-xs">Medium Risk (60-85%)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm" />
          <span className="text-xs">Low Risk (85%+)</span>
        </div>
      </div>
    </div>
  );
}

export default RiskLegend;
