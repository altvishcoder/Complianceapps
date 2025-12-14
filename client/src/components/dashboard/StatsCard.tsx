import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
  const statusColors = {
    default: "text-muted-foreground",
    success: "text-emerald-600 bg-emerald-50 border-emerald-100",
    warning: "text-amber-600 bg-amber-50 border-amber-100",
    danger: "text-rose-600 bg-rose-50 border-rose-100",
  };

  const iconColors = {
    default: "text-muted-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
  };

  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md", status !== 'default' && `border-${statusColors[status].split(' ')[2]}`)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", iconColors[status])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {trend && (
            <span className={cn(
              "font-medium mr-1",
              trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-muted-foreground"
            )}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
            </span>
          )}
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
