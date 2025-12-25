import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  UploadCloud, 
  FileText, 
  Settings, 
  ShieldCheck,
  AlertTriangle,
  LogOut,
  Files,
  ClipboardCheck,
  Wrench,
  Users,
  Brain,
  Eye,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { actionsApi, certificatesApi } from "@/lib/api";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Certificates", href: "/certificates", icon: Files },
  { name: "Ingestion Hub", href: "/ingestion", icon: UploadCloud },
  { name: "Compliance Overview", href: "/compliance", icon: ClipboardCheck },
  { name: "Remedial Actions", href: "/actions", icon: Wrench },
  { name: "Contractors", href: "/contractors", icon: Users },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/admin/setup", icon: Settings },
];

const aiNavigation = [
  { name: "Model Insights", href: "/model-insights", icon: Brain },
  { name: "Human Review", href: "/human-review", icon: Eye },
  { name: "Domain Rules", href: "/domain-rules", icon: Settings2 },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  
  const { data: actions = [], isError: actionsError } = useQuery({
    queryKey: ["actions"],
    queryFn: () => actionsApi.list(),
    staleTime: 30000,
    retry: false,
  });
  
  const { data: certificates = [], isError: certsError } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => certificatesApi.list(),
    staleTime: 30000,
    retry: false,
  });
  
  const emergencyHazards = actionsError ? 0 : actions.filter(a => a.severity === 'IMMEDIATE' && a.status === 'OPEN').length;
  const overdueGasCerts = certsError ? 0 : certificates.filter(c => {
    if (c.certificateType !== 'GAS_SAFETY') return false;
    if (!c.expiryDate) return false;
    return new Date(c.expiryDate) < new Date();
  }).length;

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border/50">
        <ShieldCheck className="h-8 w-8 text-sidebar-primary mr-2" />
        <span className="text-xl font-display font-bold tracking-tight">ComplianceAI</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                    )}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-6 px-3">
          <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
            AI Model
          </h3>
          <nav className="mt-2 space-y-1">
            {aiNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                        isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                      )}
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="mt-8 px-3">
          <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
            Alerts
          </h3>
          <div className="mt-2 space-y-1">
            {emergencyHazards > 0 && (
              <Link href="/actions">
                <div className="flex items-center px-3 py-2 text-sm text-rose-400 font-medium bg-rose-950/20 rounded-md border border-rose-900/20 cursor-pointer hover:bg-rose-950/30 transition-colors">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span>{emergencyHazards} Emergency Hazard{emergencyHazards !== 1 ? 's' : ''}</span>
                </div>
              </Link>
            )}
            {overdueGasCerts > 0 && (
              <Link href="/certificates">
                <div className="flex items-center px-3 py-2 text-sm text-amber-400 font-medium bg-amber-950/20 rounded-md border border-amber-900/20 cursor-pointer hover:bg-amber-950/30 transition-colors">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span>{overdueGasCerts} Overdue CP12{overdueGasCerts !== 1 ? 's' : ''}</span>
                </div>
              </Link>
            )}
            {emergencyHazards === 0 && overdueGasCerts === 0 && (
              <div className="flex items-center px-3 py-2 text-sm text-green-400 font-medium bg-green-950/20 rounded-md border border-green-900/20">
                <ShieldCheck className="h-4 w-4 mr-2" />
                <span>No critical alerts</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border/50">
        <button 
          onClick={() => setLocation("/login")}
          className="flex w-full items-center px-2 py-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
