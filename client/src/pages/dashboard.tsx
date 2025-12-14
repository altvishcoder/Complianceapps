import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ComplianceOverviewChart, HazardDistributionChart } from "@/components/dashboard/ComplianceChart";
import { AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard 
              title="Overall Compliance" 
              value="98.2%" 
              description="Across all asset groups"
              icon={CheckCircle2}
              trend="up"
              trendValue="0.4%"
              status="success"
            />
            <StatsCard 
              title="Active Hazards" 
              value="24" 
              description="Requiring immediate action"
              icon={AlertTriangle}
              trend="down"
              trendValue="2"
              status="danger"
            />
            <StatsCard 
              title="Awaab's Law Breaches" 
              value="0" 
              description="Timescale violations"
              icon={Clock}
              status="success"
            />
            <StatsCard 
              title="Pending Certificates" 
              value="156" 
              description="In ingestion queue"
              icon={FileText}
              trend="up"
              trendValue="45"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-7">
            <ComplianceOverviewChart />
            <HazardDistributionChart />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 font-display">Recent Activity</h3>
              <div className="space-y-4">
                {[
                  { title: "Gas Safety Certificate Processed", desc: "124 High Street • CP12 • Pass", time: "10 mins ago", type: "success" },
                  { title: "Damp & Mould Detected", desc: "Flat 4, Oak House • Severity High", time: "25 mins ago", type: "danger" },
                  { title: "EICR Due Soon", desc: "15 properties expiring in 30 days", time: "1 hour ago", type: "warning" },
                  { title: "Bulk Upload Completed", desc: "British Gas Feed • 450 files", time: "2 hours ago", type: "info" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <div className={`mt-1 h-2 w-2 rounded-full mr-3 ${
                      item.type === 'success' ? 'bg-emerald-500' : 
                      item.type === 'danger' ? 'bg-rose-500' : 
                      item.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 font-display">Awaab's Law Watchlist</h3>
              <div className="space-y-3">
                 {[
                   { address: "12 Green Lane", issue: "Severe Mould in Bathroom", deadline: "4 hours left", status: "Critical" },
                   { address: "Flat 2b, The Towers", issue: "Water Penetration", deadline: "2 days left", status: "Investigation" },
                   { address: "56 Maple Drive", issue: "Broken Extractor Fan", deadline: "4 days left", status: "Remediation" },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
                     <div>
                       <p className="text-sm font-medium">{item.address}</p>
                       <p className="text-xs text-muted-foreground">{item.issue}</p>
                     </div>
                     <div className="text-right">
                       <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                         item.status === 'Critical' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 
                         item.status === 'Investigation' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                         'bg-blue-50 text-blue-700 ring-blue-600/20'
                       }`}>
                         {item.deadline}
                       </span>
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
