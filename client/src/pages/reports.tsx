import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { FileText, BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Reports" />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-muted-foreground">
          <div className="h-24 w-24 bg-muted rounded-full flex items-center justify-center mb-6">
             <BarChart3 className="h-10 w-10 opacity-50" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Reports Module</h2>
          <p className="max-w-md text-center">
            Advanced reporting and BI dashboards will be available in the next sprint. 
            Currently tracking Awaab's Law KPIs and Big 6 Compliance metrics.
          </p>
        </main>
      </div>
    </div>
  );
}
