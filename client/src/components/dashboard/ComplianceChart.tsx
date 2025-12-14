import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const complianceData = [
  { name: "Gas", compliant: 98, nonCompliant: 2 },
  { name: "Elec", compliant: 92, nonCompliant: 8 },
  { name: "Fire", compliant: 95, nonCompliant: 5 },
  { name: "Water", compliant: 99, nonCompliant: 1 },
  { name: "Lift", compliant: 100, nonCompliant: 0 },
  { name: "Asbestos", compliant: 97, nonCompliant: 3 },
];

const COLORS = ['#3b82f6', '#e11d48', '#f59e0b', '#10b981'];

export function ComplianceOverviewChart() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Compliance Overview (Big 6)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={complianceData}>
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
            <Bar dataKey="compliant" name="Compliant %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
            <Bar dataKey="nonCompliant" name="Non-Compliant %" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const hazardData = [
  { name: "Damp & Mould", value: 35 },
  { name: "Fire Safety", value: 25 },
  { name: "Electrical", value: 20 },
  { name: "Structural", value: 10 },
  { name: "Other", value: 10 },
];

const HAZARD_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b'];

export function HazardDistributionChart() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Active Hazard Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={hazardData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {hazardData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={HAZARD_COLORS[index % HAZARD_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
