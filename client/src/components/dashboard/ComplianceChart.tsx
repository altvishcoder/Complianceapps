import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComplianceData {
  name: string;
  compliant: number;
  nonCompliant: number;
  pending?: number;
  total?: number;
}

interface ComplianceOverviewChartProps {
  data?: ComplianceData[];
}

export function ComplianceOverviewChart({ data }: ComplianceOverviewChartProps) {
  const chartData = data || [];
  // Filter to only show categories that have certificates
  const filteredData = chartData.filter(d => (d.total ?? 0) > 0);
  const hasData = filteredData.length > 0;
  const unassessedCount = chartData.length - filteredData.length;

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Compliance by Stream</span>
          {unassessedCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {unassessedCount} category{unassessedCount !== 1 ? 'ies' : 'y'} not assessed
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        {hasData ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `${value}%`} 
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend />
              <Bar dataKey="compliant" name="Compliant %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="pending" name="Pending Review %" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="nonCompliant" name="Non-Compliant %" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No compliance data available. Upload certificates to see this chart.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface HazardData {
  name: string;
  value: number;
}

interface HazardDistributionChartProps {
  data?: HazardData[];
}

const HAZARD_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b'];

export function HazardDistributionChart({ data }: HazardDistributionChartProps) {
  const chartData = data || [];
  const hasData = chartData.some(d => d.value > 0);

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Active Hazard Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={HAZARD_COLORS[index % HAZARD_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            No active hazards found.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
