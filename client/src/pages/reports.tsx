import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Download, Calendar, ArrowRight, FileX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const { toast } = useToast();

  const handleGenerateReport = (reportName: string) => {
    toast({
      title: "Report Generation",
      description: `${reportName} report will be generated when you have compliance data.`,
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Compliance Reports" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-500">
              <CardHeader>
                <div className="mb-2 h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <CardTitle>Tenant Satisfaction Measures (TSM)</CardTitle>
                <CardDescription>Quarterly submission for Regulator of Social Housing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4">
                  Generate when you have compliance data
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleGenerateReport("TSM PDF")}
                  >
                    <Download className="mr-2 h-4 w-4" /> PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleGenerateReport("TSM CSV")}
                  >
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="mb-2 h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
                <CardTitle>Big 6 Compliance Summary</CardTitle>
                <CardDescription>Executive overview of all major compliance streams</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4">
                  Updated when certificates are processed
                </div>
                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={() => handleGenerateReport("Big 6 Summary")}
                >
                  View Interactive Report <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
              <CardHeader>
                <div className="mb-2 h-10 w-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6" />
                </div>
                <CardTitle>Forecast & Expiry Schedule</CardTitle>
                <CardDescription>Forward look at upcoming renewals for budget planning</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4">
                  Scope: Next 12 Months
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleGenerateReport("Expiry Forecast")}
                >
                   Generate Forecast
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <FileX className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Reports Generated Yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  Reports will appear here once you start processing compliance certificates.
                  Use the cards above to generate your first report.
                </p>
              </div>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
}
