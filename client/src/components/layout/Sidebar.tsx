import { useState, useEffect, useRef, useCallback } from "react";
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
  UserCog,
  Brain,
  Eye,
  Settings2,
  ChevronRight,
  Sparkles,
  Package,
  Database,
  FlaskConical,
  Shield,
  Webhook,
  Film,
  Menu,
  X,
  Key,
  Activity,
  Map,
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { actionsApi, certificatesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Components", href: "/components", icon: Package },
  { name: "Certificates", href: "/certificates", icon: Files },
  { name: "Ingestion Hub", href: "/ingestion", icon: UploadCloud },
  { name: "Compliance", href: "/compliance", icon: ClipboardCheck },
  { name: "Actions", href: "/actions", icon: Wrench },
  { name: "Contractors", href: "/contractors", icon: Users },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Risk Maps", href: "/maps", icon: Map },
  { name: "Data Import", href: "/admin/imports", icon: Database },
  { name: "Video Library", href: "/video-library", icon: Film },
  { name: "Help Guide", href: "/help", icon: HelpCircle },
];

const aiNavigation = [
  { name: "Model Insights", href: "/model-insights", icon: Brain },
  { name: "Human Review", href: "/human-review", icon: Eye },
];

// Admin-only items in Admin Panel
const adminOnlyNavigation = [
  { name: "Asset Hierarchy", href: "/admin/hierarchy", icon: Building2 },
  { name: "User Management", href: "/admin/users", icon: UserCog },
  { name: "Settings", href: "/admin/setup", icon: Settings },
  { name: "Integrations", href: "/admin/integrations", icon: Webhook },
  { name: "API Integration", href: "/admin/api-integration", icon: Key },
  { name: "Test Suite", href: "/admin/tests", icon: FlaskConical },
];

// Lashan Super User only items
const lashanSuperUserNav = [
  { name: "Factory Settings", href: "/admin/factory-settings", icon: Shield },
  { name: "System Health", href: "/admin/system-health", icon: Activity },
];

// Configuration visible to both admin and compliance manager
const configurationNav = [
  { name: "Configuration", href: "/admin/configuration", icon: Settings2 },
];

const SIDEBAR_SCROLL_KEY = 'sidebar_scroll_position';

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  
  const userRole = typeof window !== 'undefined' ? localStorage.getItem("user_role") : null;
  const isLashanSuperUser = userRole === "LASHAN_SUPER_USER" || userRole === "lashan_super_user";
  const isSuperAdmin = userRole === "super_admin" || userRole === "SUPER_ADMIN";
  const isSystemAdmin = userRole === "system_admin" || userRole === "SYSTEM_ADMIN";
  const isComplianceManager = userRole === "compliance_manager" || userRole === "COMPLIANCE_MANAGER";
  const isAdmin = isLashanSuperUser || isSuperAdmin || isSystemAdmin;
  const canAccessAITools = isAdmin || isComplianceManager;
  const canAccessAdminPanel = isAdmin || isComplianceManager;
  const canAccessFactorySettings = isLashanSuperUser || isSuperAdmin;
  
  // Restore scroll position on mount
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (savedScrollPos && navScrollRef.current) {
      navScrollRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }
  }, []);
  
  // Save scroll position before navigation
  const handleNavClick = useCallback(() => {
    if (navScrollRef.current) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(navScrollRef.current.scrollTop));
    }
  }, []);
  
  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);
  
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
  const overdueCerts = certsError ? 0 : certificates.filter(c => {
    if (!c.expiryDate) return false;
    return new Date(c.expiryDate) < new Date();
  }).length;

  return (
    <>
      {/* Mobile menu button - fixed position */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-slate-900 text-white hover:bg-slate-800 shadow-lg"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        data-testid="button-mobile-menu"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <aside 
        className={cn(
          "fixed md:relative z-40 flex h-screen w-72 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-r border-white/5 transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        aria-label="Main navigation"
      >
      <div className="flex h-20 items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl blur-lg opacity-60"></div>
            <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <span className="text-xl font-display font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">ComplianceAI</span>
            <p className="text-xs text-slate-500 font-medium">Enterprise Platform</p>
          </div>
        </div>
      </div>
      
      <div ref={navScrollRef} className="flex-1 overflow-y-auto py-6 px-4 scrollbar-thin">
        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Main Menu</span>
        </div>
        <nav className="space-y-1" aria-label="Main menu">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} aria-current={isActive ? "page" : undefined} onClick={handleNavClick}>
                <div
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-lg shadow-green-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-200",
                        isActive ? "text-white" : "text-slate-500 group-hover:text-emerald-400"
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-white/70" aria-hidden="true" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
        
        {canAccessAITools && (
          <div className="mt-8">
            <div className="mb-2 px-3 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">AI Tools</span>
            </div>
            <nav className="space-y-1">
              {aiNavigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href} onClick={handleNavClick}>
                    <div
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-lg shadow-green-500/20"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={cn(
                            "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
                            isActive ? "text-white" : "text-slate-500 group-hover:text-emerald-400"
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
        )}
        
        {canAccessAdminPanel && (
          <div className="mt-8">
            <div className="mb-2 px-3 flex items-center gap-2">
              <Shield className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Admin Panel</span>
            </div>
            <nav className="space-y-1">
              {/* Admin-only items: Settings and Test Suite */}
              {isAdmin && adminOnlyNavigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href} onClick={handleNavClick}>
                    <div
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-lg shadow-green-500/20"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={cn(
                            "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
                            isActive ? "text-white" : "text-slate-500 group-hover:text-emerald-400"
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
              {/* Configuration visible to both admin and compliance manager */}
              {configurationNav.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href} onClick={handleNavClick}>
                    <div
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-lg shadow-green-500/20"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={cn(
                            "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
                            isActive ? "text-white" : "text-slate-500 group-hover:text-emerald-400"
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
              {/* Factory Settings - Lashan Super User only */}
              {canAccessFactorySettings && lashanSuperUserNav.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href} onClick={handleNavClick}>
                    <div
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white shadow-lg shadow-orange-500/20"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={cn(
                            "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
                            isActive ? "text-white" : "text-amber-500 group-hover:text-amber-400"
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
        )}
        
        <div className="mt-8">
          <div className="mb-2 px-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Status</span>
          </div>
          <div className="space-y-2 px-1">
            {emergencyHazards > 0 && (
              <Link href="/actions" onClick={handleNavClick}>
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
            {overdueCerts > 0 && (
              <Link href="/certificates?filter=overdue" onClick={handleNavClick}>
                <div className="flex items-center gap-3 px-3 py-3 text-sm rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 cursor-pointer hover:from-amber-500/20 hover:to-amber-500/10 transition-all group">
                  <div className="p-1.5 rounded-lg bg-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-amber-300 font-medium">{overdueCerts} Overdue</p>
                    <p className="text-[11px] text-amber-400/60">Certificates past expiry</p>
                  </div>
                </div>
              </Link>
            )}
            {emergencyHazards === 0 && overdueCerts === 0 && (
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
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-sm font-bold">
            {(localStorage.getItem("user_name") || "User").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{localStorage.getItem("user_name") || "Guest User"}</p>
            <p className="text-xs text-slate-500 truncate">{localStorage.getItem("user_email") || "Not logged in"}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            localStorage.removeItem("user_id");
            localStorage.removeItem("user_name");
            localStorage.removeItem("user_email");
            localStorage.removeItem("user_role");
            localStorage.removeItem("user_username");
            setLocation("/login");
          }}
          className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          aria-label="Sign out of your account"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
    </>
  );
}
