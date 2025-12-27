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
  Settings2,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { actionsApi, certificatesApi } from "@/lib/api";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Certificates", href: "/certificates", icon: Files },
  { name: "Ingestion Hub", href: "/ingestion", icon: UploadCloud },
  { name: "Compliance", href: "/compliance", icon: ClipboardCheck },
  { name: "Actions", href: "/actions", icon: Wrench },
  { name: "Contractors", href: "/contractors", icon: Users },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/admin/setup", icon: Settings },
];

const aiNavigation = [
  { name: "Model Insights", href: "/model-insights", icon: Brain },
  { name: "Human Review", href: "/human-review", icon: Eye },
  { name: "Domain Rules", href: "/domain-rules", icon: Settings2 },
  { name: "Configuration", href: "/admin/configuration", icon: Settings },
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
    <div className="flex h-screen w-72 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-r border-white/5">
      <div className="flex h-20 items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-lg opacity-60"></div>
            <div className="relative bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <span className="text-xl font-display font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">ComplianceAI</span>
            <p className="text-xs text-slate-500 font-medium">Enterprise Platform</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-thin">
        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Main Menu</span>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-gradient-to-r from-violet-600/90 to-purple-600/90 text-white shadow-lg shadow-purple-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-200",
                        isActive ? "text-white" : "text-slate-500 group-hover:text-violet-400"
                      )}
                    />
                    {item.name}
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-white/70" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-8">
          <div className="mb-2 px-3 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">AI Tools</span>
          </div>
          <nav className="space-y-1">
            {aiNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-violet-600/90 to-purple-600/90 text-white shadow-lg shadow-purple-500/20"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={cn(
                          "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
                          isActive ? "text-white" : "text-slate-500 group-hover:text-violet-400"
                        )}
                      />
                      {item.name}
                    </div>
                    {isActive && (
                      <ChevronRight className="h-4 w-4 text-white/70" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="mt-8">
          <div className="mb-2 px-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Status</span>
          </div>
          <div className="space-y-2 px-1">
            {emergencyHazards > 0 && (
              <Link href="/actions">
                <div className="flex items-center gap-3 px-3 py-3 text-sm rounded-xl bg-gradient-to-r from-rose-500/10 to-rose-500/5 border border-rose-500/20 cursor-pointer hover:from-rose-500/20 hover:to-rose-500/10 transition-all group">
                  <div className="p-1.5 rounded-lg bg-rose-500/20">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-rose-300 font-medium">{emergencyHazards} Emergency</p>
                    <p className="text-[11px] text-rose-400/60">Requires immediate action</p>
                  </div>
                </div>
              </Link>
            )}
            {overdueGasCerts > 0 && (
              <Link href="/certificates">
                <div className="flex items-center gap-3 px-3 py-3 text-sm rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 cursor-pointer hover:from-amber-500/20 hover:to-amber-500/10 transition-all group">
                  <div className="p-1.5 rounded-lg bg-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-amber-300 font-medium">{overdueGasCerts} Overdue</p>
                    <p className="text-[11px] text-amber-400/60">CP12 certificates expired</p>
                  </div>
                </div>
              </Link>
            )}
            {emergencyHazards === 0 && overdueGasCerts === 0 && (
              <div className="flex items-center gap-3 px-3 py-3 text-sm rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 font-medium">All Clear</p>
                  <p className="text-[11px] text-emerald-400/60">No critical alerts</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-xl bg-white/5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin User</p>
            <p className="text-xs text-slate-500 truncate">admin@company.com</p>
          </div>
        </div>
        <button 
          onClick={() => setLocation("/login")}
          className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
