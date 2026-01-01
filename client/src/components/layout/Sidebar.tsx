import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  UploadCloud, 
  FileText, 
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
  ChevronDown,
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
  HelpCircle,
  ClipboardList,
  BookOpen,
  MessageSquare,
  Calendar,
  Radar,
  Gauge,
  FolderTree,
  Briefcase,
  MonitorCheck,
  Cog,
  Library,
  TreePine,
  BarChart3,
  HeartPulse,
  Target,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { actionsApi, certificatesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  requiresFactorySettings?: boolean;
  requiresAITools?: boolean;
}

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
  requiresRole?: 'admin' | 'adminOrManager' | 'factorySettings';
}

const SIDEBAR_SCROLL_KEY = 'sidebar_scroll_position';
const SIDEBAR_SECTIONS_KEY = 'sidebar_sections_state';

export function Sidebar() {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  
  const userRole = user?.role || null;
  const isLashanSuperUser = userRole === "LASHAN_SUPER_USER" || userRole === "lashan_super_user";
  const isSuperAdmin = userRole === "super_admin" || userRole === "SUPER_ADMIN";
  const isSystemAdmin = userRole === "system_admin" || userRole === "SYSTEM_ADMIN";
  const isComplianceManager = userRole === "compliance_manager" || userRole === "COMPLIANCE_MANAGER";
  const isAdmin = isLashanSuperUser || isSuperAdmin || isSystemAdmin;
  const canAccessAITools = isAdmin || isComplianceManager;
  const canAccessAdminPanel = isAdmin || isComplianceManager;
  const canAccessFactorySettings = isLashanSuperUser || isSuperAdmin;

  const commandCentre: NavSection = {
    title: "Command Centre",
    icon: Gauge,
    defaultOpen: true,
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Analytics", href: "/compliance", icon: BarChart3 },
      { name: "Ingestion", href: "/ingestion", icon: UploadCloud },
      { name: "Reporting", href: "/reports", icon: FileText },
      { name: "Board Reporting", href: "/reports/board", icon: Briefcase },
      { name: "Regulatory Evidence", href: "/reports/regulatory", icon: Shield },
    ]
  };

  const assetManagement: NavSection = {
    title: "Asset Management",
    icon: FolderTree,
    defaultOpen: false,
    items: [
      { name: "Property Hierarchy", href: "/admin/hierarchy", icon: TreePine, requiresAITools: true },
      { name: "Properties", href: "/properties", icon: Building2 },
      { name: "Components", href: "/components", icon: Package },
    ]
  };

  const operations: NavSection = {
    title: "Operations",
    icon: Briefcase,
    defaultOpen: true,
    items: [
      { name: "Certificates", href: "/certificates", icon: Files },
      { name: "Risk Radar", href: "/risk-radar", icon: Radar },
      { name: "Remedial Actions", href: "/actions", icon: Wrench },
      { name: "Calendar", href: "/calendar", icon: Calendar },
      { name: "Risk Maps", href: "/maps", icon: Map },
      { name: "Asset Health", href: "/admin/asset-health", icon: HeartPulse, requiresFactorySettings: true },
      { name: "Remedial Kanban", href: "/admin/remedial-kanban", icon: ClipboardCheck, requiresFactorySettings: true },
      { name: "Human Review", href: "/human-review", icon: Eye, requiresAITools: true },
    ]
  };

  const contractorManagement: NavSection = {
    title: "Contractor Management",
    icon: Users,
    defaultOpen: false,
    items: [
      { name: "Performance", href: "/contractors/dashboard", icon: BarChart3 },
      { name: "SLA Tracking", href: "/contractors/sla", icon: Target },
      { name: "Contractors", href: "/contractors", icon: Users },
      { name: "Reports", href: "/contractors/reports", icon: FileText },
    ]
  };

  const monitoring: NavSection = {
    title: "Monitoring",
    icon: MonitorCheck,
    defaultOpen: false,
    requiresRole: 'adminOrManager',
    items: [
      { name: "System Health", href: "/admin/system-health", icon: Activity, requiresFactorySettings: true },
      { name: "Ingestion Control", href: "/admin/ingestion-control", icon: Sparkles, requiresFactorySettings: true },
      { name: "Chatbot Analytics", href: "/admin/chatbot-analytics", icon: MessageSquare, requiresFactorySettings: true },
      { name: "Audit Log", href: "/admin/audit-log", icon: ClipboardList, requiresAdmin: true },
      { name: "Test Suite", href: "/admin/tests", icon: FlaskConical, requiresAdmin: true },
      { name: "Model Insights", href: "/model-insights", icon: Brain, requiresAITools: true },
    ]
  };

  const administration: NavSection = {
    title: "Administration",
    icon: Cog,
    defaultOpen: false,
    requiresRole: 'admin',
    items: [
      { name: "User Management", href: "/admin/users", icon: UserCog },
      { name: "Configuration", href: "/admin/configuration", icon: Settings2 },
      { name: "Factory Settings", href: "/admin/factory-settings", icon: Shield, requiresFactorySettings: true },
      { name: "Knowledge Training", href: "/admin/knowledge-training", icon: BookOpen, requiresFactorySettings: true },
      { name: "Integrations", href: "/admin/integrations", icon: Webhook },
      { name: "API Integration", href: "/admin/api-integration", icon: Key },
      { name: "API Documentation", href: "/admin/api-docs", icon: BookOpen },
    ]
  };

  const resources: NavSection = {
    title: "Resources",
    icon: Library,
    defaultOpen: false,
    items: [
      { name: "Data Import", href: "/admin/imports", icon: Database },
      { name: "Video Library", href: "/video-library", icon: Film },
      { name: "Help Guide", href: "/help", icon: HelpCircle },
    ]
  };
  
  const getInitialSectionState = () => {
    const saved = sessionStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {
      "Command Centre": true,
      "Asset Management": false,
      "Compliance Operations": true,
      "Monitoring": false,
      "Administration": false,
      "Resources": false,
    };
  };
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getInitialSectionState);
  
  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(openSections));
  }, [openSections]);
  
  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };
  
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (savedScrollPos && navScrollRef.current) {
      navScrollRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }
  }, []);
  
  const handleNavClick = useCallback(() => {
    if (navScrollRef.current) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(navScrollRef.current.scrollTop));
    }
  }, []);
  
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

  const shouldShowSection = (section: NavSection): boolean => {
    if (!section.requiresRole) return true;
    if (section.requiresRole === 'admin') return isAdmin;
    if (section.requiresRole === 'adminOrManager') return canAccessAdminPanel;
    if (section.requiresRole === 'factorySettings') return canAccessFactorySettings;
    return true;
  };

  const filterItemsByRole = (items: NavItem[]): NavItem[] => {
    return items.filter(item => {
      if (item.requiresFactorySettings && !canAccessFactorySettings) return false;
      if (item.requiresAdmin && !isAdmin) return false;
      if (item.requiresAITools && !canAccessAITools) return false;
      return true;
    });
  };

  const renderSection = (section: NavSection) => {
    if (!shouldShowSection(section)) return null;
    
    const items = filterItemsByRole(section.items);
    if (items.length === 0) return null;
    
    const isOpen = openSections[section.title] ?? section.defaultOpen ?? false;
    const hasActiveItem = items.some(item => location === item.href);
    
    return (
      <div key={section.title} className="mb-2">
        <button
          onClick={() => toggleSection(section.title)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all",
            hasActiveItem ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
          )}
          aria-expanded={isOpen}
          data-testid={`section-toggle-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center gap-2">
            <section.icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{section.title}</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        
        {isOpen && (
          <nav className="mt-1 space-y-0.5 pl-2" aria-label={section.title}>
            {items.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href} aria-current={isActive ? "page" : undefined} onClick={handleNavClick}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-lg shadow-green-500/20"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                    data-testid={`nav-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={cn(
                          "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
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
        )}
      </div>
    );
  };

  return (
    <>
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
        
        <div ref={navScrollRef} className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
          {renderSection(commandCentre)}
          {renderSection(assetManagement)}
          {renderSection(operations)}
          {renderSection(contractorManagement)}
          {renderSection(monitoring)}
          {renderSection(administration)}
          {renderSection(resources)}
          
          <div className="mt-4 pt-4 border-t border-white/5">
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
              {(user?.name || "User").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "Guest User"}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || "Not logged in"}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            aria-label="Sign out of your account"
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
