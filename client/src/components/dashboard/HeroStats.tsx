import { cn } from "@/lib/utils";
import { LucideIcon, AlertTriangle, Clock, FileWarning, Wrench, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RiskLevel = "critical" | "high" | "medium" | "low" | "good";

interface HeroStatProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  riskLevel: RiskLevel;
  href?: string;
  onClick?: () => void;
  slaInfo?: string;
  "data-testid"?: string;
}

const riskStyles: Record<RiskLevel, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-l-4 border-l-red-500 border-red-200 dark:border-red-900",
    text: "text-red-600 dark:text-red-400",
    icon: "bg-red-500",
  },
  high: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-l-4 border-l-orange-500 border-orange-200 dark:border-orange-900",
    text: "text-orange-600 dark:text-orange-400",
    icon: "bg-orange-500",
  },
  medium: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-900",
    text: "text-amber-600 dark:text-amber-400",
    icon: "bg-amber-500",
  },
  low: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-l-4 border-l-blue-500 border-blue-200 dark:border-blue-900",
    text: "text-blue-600 dark:text-blue-400",
    icon: "bg-blue-500",
  },
  good: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-900",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: "bg-emerald-500",
  },
};

function HeroStat({ title, value, subtitle, icon: Icon, riskLevel, href, onClick, slaInfo, "data-testid": testId }: HeroStatProps) {
  const styles = riskStyles[riskLevel];
  const isClickable = href || onClick;
  
  const valueStr = String(value);
  const valueFontSize = valueStr.length > 6 
    ? "text-lg sm:text-xl" 
    : valueStr.length > 3 
      ? "text-xl sm:text-2xl" 
      : "text-2xl sm:text-3xl";
  
  const content = (
    <div className={cn(
      "rounded-lg p-3 sm:p-4 border transition-all h-full min-h-[100px] sm:min-h-[120px] overflow-hidden",
      styles.bg,
      styles.border,
      isClickable && "hover:shadow-md cursor-pointer"
    )}>
      <div className="flex items-start justify-between h-full gap-1">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
            <div className={cn("p-1 sm:p-1.5 rounded-md flex-shrink-0", styles.icon)}>
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span 
                  className="font-medium text-muted-foreground min-w-0 line-clamp-2 leading-tight"
                  style={{ fontSize: 'clamp(0.65rem, 2vw, 0.875rem)' }}
                >
                  {title}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">{title}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 min-w-0">
            <span className={cn(valueFontSize, "font-bold block", styles.text)}>{value}</span>
            {subtitle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p 
                    className="text-muted-foreground mt-0.5 line-clamp-1"
                    style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}
                  >
                    {subtitle}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs">{subtitle}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {slaInfo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p 
                  className="text-muted-foreground mt-1 line-clamp-1"
                  style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}
                >
                  {slaInfo}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">{slaInfo}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {isClickable && <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block" data-testid={testId}>{content}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className="block w-full text-left" data-testid={testId}>{content}</button>;
  }
  return <div data-testid={testId}>{content}</div>;
}

interface HeroStatsGridProps {
  stats: Array<{
    title: string;
    value: number | string;
    subtitle?: string;
    icon: LucideIcon;
    riskLevel: RiskLevel;
    href?: string;
    onClick?: () => void;
    slaInfo?: string;
    testId?: string;
  }>;
  isLoading?: boolean;
}

function HeroStatSkeleton() {
  return (
    <div className="rounded-lg p-4 border border-muted bg-muted/30 h-full min-h-[120px] animate-pulse">
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-32 mt-1" />
        </div>
        <Skeleton className="h-5 w-5 flex-shrink-0" />
      </div>
    </div>
  );
}

interface HeroStatsGridSkeletonProps {
  count?: number;
}

export function HeroStatsGridSkeleton({ count = 4 }: HeroStatsGridSkeletonProps) {
  const gridCols = count <= 4 
    ? "grid-cols-2 md:grid-cols-4" 
    : count === 5 
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" 
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
  
  return (
    <div className={`grid ${gridCols} gap-3`}>
      {Array.from({ length: count }).map((_, index) => (
        <HeroStatSkeleton key={index} />
      ))}
    </div>
  );
}

export function HeroStatsGrid({ stats, isLoading }: HeroStatsGridProps) {
  const gridCols = stats.length <= 4 
    ? "grid-cols-2 md:grid-cols-4" 
    : stats.length === 5 
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" 
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
  
  if (isLoading) {
    return (
      <div className={`grid ${gridCols} gap-3`}>
        {stats.map((_, index) => (
          <HeroStatSkeleton key={index} />
        ))}
      </div>
    );
  }
  
  return (
    <TooltipProvider delayDuration={300}>
      <div className={`grid ${gridCols} gap-3 animate-in fade-in duration-300`}>
        {stats.map((stat, index) => (
          <HeroStat
            key={index}
            title={stat.title}
            value={stat.value}
            subtitle={stat.subtitle}
            icon={stat.icon}
            riskLevel={stat.riskLevel}
            href={stat.href}
            onClick={stat.onClick}
            slaInfo={stat.slaInfo}
            data-testid={stat.testId}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}

export { HeroStat };
export type { RiskLevel, HeroStatProps };
