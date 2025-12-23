import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, AlertOctagon, TrendingUp, ArrowUpRight } from "lucide-react";
import { ComplianceOverviewChart } from "@/components/dashboard/ComplianceChart";

export default function CompliancePage() {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Overview" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Big 6 Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.5%</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">+0.2%</span> from last month
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">At Risk Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">42</div>
                <p className="text-xs text-muted-foreground mt-1">Expiring within 30 days</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-rose-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Non-Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">Requiring immediate action</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Compliance by Stream</CardTitle>
                <CardDescription>Current compliance rates per statutory area</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "Gas Safety", value: 99.2, status: "High" },
                  { name: "Electrical (EICR)", value: 96.5, status: "Good" },
                  { name: "Fire Safety (FRA)", value: 100.0, status: "High" },
                  { name: "Asbestos", value: 98.8, status: "High" },
                  { name: "Legionella", value: 94.2, status: "Warning" },
                  { name: "Lift (LOLER)", value: 100.0, status: "High" },
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className={item.value < 95 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                        {item.value}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${item.value < 95 ? "bg-amber-500" : "bg-emerald-500"}`} 
                        style={{ width: `${item.value}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <ComplianceOverviewChart />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Gaps</CardTitle>
              <CardDescription>Properties requiring attention to achieve 100% compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-4">Property</th>
                      <th className="p-4">Issue</th>
                      <th className="p-4">Stream</th>
                      <th className="p-4">Days Overdue</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { prop: "12 Green Lane", issue: "No valid CP12", stream: "Gas", days: 5 },
                      { prop: "Flat 2b, The Towers", issue: "EICR Unsatisfactory", stream: "Electrical", days: 12 },
                      { prop: "56 Maple Drive", issue: "Legionella RA Expired", stream: "Water", days: 2 },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="p-4 font-medium">{row.prop}</td>
                        <td className="p-4 text-rose-600 font-medium">{row.issue}</td>
                        <td className="p-4">
                          <Badge variant="outline">{row.stream}</Badge>
                        </td>
                        <td className="p-4 text-rose-600">{row.days} days</td>
                        <td className="p-4 text-right">
                          <Button size="sm" variant="outline" className="gap-1">
                            Resolve <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
