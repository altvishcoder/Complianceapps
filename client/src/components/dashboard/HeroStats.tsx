import { cn } from "@/lib/utils";
import { LucideIcon, AlertTriangle, Clock, FileWarning, Wrench, ChevronRight } from "lucide-react";
import { Link } from "wouter";

type RiskLevel = "critical" | "high" | "medium" | "low" | "good";

interface HeroStatProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  riskLevel: RiskLevel;
  href?: string;
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

function HeroStat({ title, value, subtitle, icon: Icon, riskLevel, href, slaInfo, "data-testid": testId }: HeroStatProps) {
  const styles = riskStyles[riskLevel];
  
  const content = (
    <div className={cn(
      "rounded-lg p-4 border transition-all",
      styles.bg,
      styles.border,
      href && "hover:shadow-md cursor-pointer"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("p-1.5 rounded-md", styles.icon)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium text-muted-foreground truncate">{title}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold", styles.text)}>{value}</span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
          {slaInfo && (
            <p className="text-xs text-muted-foreground mt-1">{slaInfo}</p>
          )}
        </div>
        {href && <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block" data-testid={testId}>{content}</Link>;
  }
  return <div data-testid={testId}>{content}</div>;
}

interface HeroStatsGridProps {
  stats: Array<{
    title: string;
    value: number;
    subtitle?: string;
    icon: LucideIcon;
    riskLevel: RiskLevel;
    href?: string;
    slaInfo?: string;
    testId?: string;
  }>;
}

export function HeroStatsGrid({ stats }: HeroStatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <HeroStat
          key={index}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          riskLevel={stat.riskLevel}
          href={stat.href}
          slaInfo={stat.slaInfo}
          data-testid={stat.testId}
        />
      ))}
    </div>
  );
}

export { HeroStat };
export type { RiskLevel, HeroStatProps };
