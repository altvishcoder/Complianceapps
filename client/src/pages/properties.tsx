import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Download, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle, Home } from "lucide-react";

export default function Properties() {
  const properties = [
    { id: "UPRN-1001", address: "124 High Street", type: "House", status: "Compliant", gas: "Pass", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "N/A" },
    { id: "UPRN-1002", address: "Flat 4, Oak House", type: "Flat", status: "Non-Compliant", gas: "Pass", elec: "Fail", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "Pass" },
    { id: "UPRN-1003", address: "12 Green Lane", type: "House", status: "Attention", gas: "Due Soon", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "N/A" },
    { id: "UPRN-1004", address: "The Towers (Block A)", type: "Block", status: "Compliant", gas: "Pass", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "Pass" },
    { id: "UPRN-1005", address: "56 Maple Drive", type: "Bungalow", status: "Compliant", gas: "Pass", elec: "Pass", fire: "Pass", asbestos: "Pass", water: "Pass", lift: "N/A" },
    { id: "UPRN-1006", address: "Flat 2b, The Towers", type: "Flat", status: "Investigation", gas: "Pass", elec: "Pass", fire: "Fail", asbestos: "Pass", water: "Pass", lift: "Pass" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pass": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "Fail": return <XCircle className="h-4 w-4 text-rose-500" />;
      case "Due Soon": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <span className="text-muted-foreground text-xs">-</span>;
    }
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Property Assets" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Input placeholder="Search address or UPRN..." className="pl-9" />
                  <Filter className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" className="gap-2">
                   <Download className="h-4 w-4" /> Export
                </Button>
                <Button className="gap-2">
                   <Home className="h-4 w-4" /> Add Property
                </Button>
             </div>
          </div>

          <Card>
            <CardContent className="p-0">
               <div className="rounded-md border-t border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-4 pl-6">UPRN / Address</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Overall Status</th>
                      <th className="p-4 text-center">Gas</th>
                      <th className="p-4 text-center">Elec</th>
                      <th className="p-4 text-center">Fire</th>
                      <th className="p-4 text-center">Asbestos</th>
                      <th className="p-4 text-center">Water</th>
                      <th className="p-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {properties.map((prop, i) => (
                      <tr key={i} className="group hover:bg-muted/20 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{prop.address}</span>
                            <span className="text-xs text-muted-foreground font-mono">{prop.id}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{prop.type}</td>
                        <td className="p-4">
                           <Badge variant="outline" className={
                             prop.status === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                             prop.status === 'Non-Compliant' || prop.status === 'Investigation' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                             'bg-amber-50 text-amber-700 border-amber-200'
                           }>
                             {prop.status}
                           </Badge>
                        </td>
                        <td className="p-4 text-center">{getStatusIcon(prop.gas)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.elec)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.fire)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.asbestos)}</td>
                        <td className="p-4 text-center">{getStatusIcon(prop.water)}</td>
                        <td className="p-4 text-right pr-6">
                           <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                             <MoreHorizontal className="h-4 w-4" />
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
