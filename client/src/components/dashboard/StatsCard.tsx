import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  status?: "default" | "success" | "warning" | "danger";
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  trendValue,
  status = "default" 
}: StatsCardProps) {
  const gradients = {
    default: "from-slate-500 to-slate-600",
    success: "from-emerald-500 to-teal-600",
    warning: "from-amber-500 to-orange-600",
    danger: "from-rose-500 to-red-600",
  };

  const bgColors = {
    default: "bg-slate-50 dark:bg-slate-900/50",
    success: "bg-emerald-50 dark:bg-emerald-950/30",
    warning: "bg-amber-50 dark:bg-amber-950/30",
    danger: "bg-rose-50 dark:bg-rose-950/30",
  };

  const borderColors = {
    default: "border-slate-200/50 dark:border-slate-800",
    success: "border-emerald-200/50 dark:border-emerald-900/50",
    warning: "border-amber-200/50 dark:border-amber-900/50",
    danger: "border-rose-200/50 dark:border-rose-900/50",
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border",
      bgColors[status],
      borderColors[status]
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8">
        <div className={cn(
          "w-full h-full rounded-full bg-gradient-to-br opacity-10",
          gradients[status]
        )} />
      </div>
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-2.5 rounded-xl bg-gradient-to-br shadow-lg",
            gradients[status]
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend === "up" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" : 
              trend === "down" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400" : 
              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}>
              {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trendValue}
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold font-display tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        </div>
      </div>
    </div>
  );
}
