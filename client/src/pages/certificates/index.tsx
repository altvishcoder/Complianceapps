import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Link } from "wouter";

export default function CertificatesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const certificates = [
    { id: "CERT-001", type: "Gas Safety (CP12)", property: "124 High Street", status: "Valid", expiry: "2026-12-14", outcome: "PASS" },
    { id: "CERT-002", type: "EICR", property: "Flat 4, Oak House", status: "Valid", expiry: "2028-05-20", outcome: "SATISFACTORY" },
    { id: "CERT-003", type: "Fire Risk Assessment", property: "The Towers (Block A)", status: "Expiring Soon", expiry: "2025-01-15", outcome: "ACTION REQUIRED" },
    { id: "CERT-004", type: "Legionella", property: "The Towers (Block A)", status: "Overdue", expiry: "2024-11-01", outcome: "FAIL" },
    { id: "CERT-005", type: "Gas Safety (CP12)", property: "56 Maple Drive", status: "Valid", expiry: "2026-02-10", outcome: "PASS" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Valid": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Expiring Soon": return "bg-amber-50 text-amber-700 border-amber-200";
      case "Overdue": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Certificates" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 w-full max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by address, type or reference..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <Link href="/ingestion">
              <Button className="bg-primary hover:bg-primary/90">
                Upload New
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Certificates</CardTitle>
              <CardDescription>Manage and view compliance documents across all properties.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-4">Certificate Type</th>
                      <th className="p-4">Property</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Expiry Date</th>
                      <th className="p-4">Outcome</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-muted/20">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium">{cert.type}</div>
                              <div className="text-xs text-muted-foreground">{cert.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium">{cert.property}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(cert.status)}`}>
                            {cert.status}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{cert.expiry}</td>
                        <td className="p-4">
                          <Badge variant="outline">{cert.outcome}</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
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
