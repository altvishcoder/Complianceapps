import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import * as LucideIcons from "lucide-react";
import { 
  ShieldCheck,
  AlertTriangle,
  LogOut,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  HelpCircle,
  Sun,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { sidebarApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SECTION_DESCRIPTIONS: Record<string, string> = {
  'operate': 'Day-to-Day Operations',
  'assure': 'Compliance & Proof',
  'understand': 'Insights & Trends',
  'assets': 'Property & Component Management',
  'people-suppliers': 'Contractors & Staff',
  'manage-system': 'Admin/IT Configuration',
  'resources': 'Help & Training Materials',
};

interface NavigationItem {
  id: string;
  sectionId: string;
  slug: string;
  name: string;
  href: string;
  iconKey: string;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  requiresAdmin?: boolean;
  requiresFactorySettings?: boolean;
  requiresAITools?: boolean;
}

interface NavigationSection {
  id: string;
  slug: string;
  title: string;
  iconKey: string;
  displayOrder: number;
  defaultOpen: boolean;
  isActive: boolean;
  isSystem: boolean;
  requiresRole?: string;
  items: NavigationItem[];
}

const SIDEBAR_SCROLL_KEY = 'sidebar_scroll_position';
const SIDEBAR_SECTIONS_KEY = 'sidebar_sections_state';

const getIconComponent = (iconKey: string): React.ComponentType<{ className?: string }> => {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  return icons[iconKey] || HelpCircle;
};

export function Sidebar() {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const userRole = user?.role || null;
  const isLashanSuperUser = userRole === "LASHAN_SUPER_USER" || userRole === "lashan_super_user";
  const isSuperAdmin = userRole === "super_admin" || userRole === "SUPER_ADMIN";
  const isSystemAdmin = userRole === "system_admin" || userRole === "SYSTEM_ADMIN";
  const isComplianceManager = userRole === "compliance_manager" || userRole === "COMPLIANCE_MANAGER";
  const isAdmin = isLashanSuperUser || isSuperAdmin || isSystemAdmin;
  const canAccessAITools = isAdmin || isComplianceManager;
  const canAccessAdminPanel = isAdmin || isComplianceManager;
  const canAccessFactorySettings = isLashanSuperUser || isSuperAdmin;

  const { data: navigationSections = [], isLoading: navLoading, isError: navError } = useQuery<NavigationSection[]>({
    queryKey: ["navigation"],
    queryFn: async () => {
      const response = await fetch("/api/navigation");
      if (!response.ok) throw new Error("Failed to fetch navigation");
      return response.json();
    },
    staleTime: 60000,
    retry: 2,
  });
  
  const getInitialSectionState = () => {
    const saved = sessionStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  };
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getInitialSectionState);
  
  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(openSections));
  }, [openSections]);
  
  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
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
  
  const { data: sidebarCounts, isError: countsError } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: () => sidebarApi.getCounts(),
    staleTime: 30000,
    retry: false,
  });
  
  const emergencyHazards = countsError ? 0 : (sidebarCounts?.emergencyHazards || 0);
  const overdueCerts = countsError ? 0 : (sidebarCounts?.overdueCertificates || 0);

  const shouldShowSection = (section: NavigationSection): boolean => {
    if (!section.isActive) return false;
    if (!section.requiresRole) return true;
    if (section.requiresRole === 'admin') return isAdmin;
    if (section.requiresRole === 'adminOrManager') return canAccessAdminPanel;
    if (section.requiresRole === 'factorySettings') return canAccessFactorySettings;
    return true;
  };

  const filterItemsByRole = (items: NavigationItem[]): NavigationItem[] => {
    return items.filter(item => {
      if (!item.isActive) return false;
      if (item.requiresFactorySettings && !canAccessFactorySettings) return false;
      if (item.requiresAdmin && !isAdmin) return false;
      if (item.requiresAITools && !canAccessAITools) return false;
      return true;
    });
  };

  const renderSection = (section: NavigationSection) => {
    if (!shouldShowSection(section)) return null;
    
    const items = filterItemsByRole(section.items)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (items.length === 0) return null;
    
    const isOpen = openSections[section.id] ?? section.defaultOpen ?? false;
    const hasActiveItem = items.some(item => location === item.href);
    
    const SectionIcon = getIconComponent(section.iconKey);
    
    return (
      <div key={section.id} className="mb-2">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all",
                  hasActiveItem ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                aria-expanded={isOpen}
                data-testid={`section-toggle-${section.slug}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <SectionIcon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{section.title}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            {SECTION_DESCRIPTIONS[section.slug] && (
              <TooltipContent side="right" className="text-xs">
                {SECTION_DESCRIPTIONS[section.slug]}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        
        {isOpen && (
          <nav className="mt-1 space-y-0.5 pl-2" aria-label={section.title}>
            {items.map((item) => {
              const isActive = location === item.href;
              const ItemIcon = getIconComponent(item.iconKey);
              return (
                <Link key={item.id} href={item.href} aria-current={isActive ? "page" : undefined} onClick={handleNavClick}>
                  <div
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-emerald-600/90 to-green-600/90 text-white shadow-lg shadow-green-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                    )}
                    data-testid={`nav-item-${item.slug}`}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <ItemIcon
                        className={cn(
                          "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200",
                          isActive ? "text-white" : "text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.name}</span>
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
        className="fixed top-4 left-4 z-50 md:hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-lg border border-slate-200 dark:border-transparent"
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
          "fixed md:relative z-40 flex h-screen w-72 flex-col bg-white dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white border-r border-slate-200 dark:border-white/5 transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-20 items-center px-6 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl blur-lg opacity-60"></div>
              <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-xl font-display font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">ComplianceAI</span>
              <p className="text-xs text-slate-500 font-medium">Enterprise Platform</p>
            </div>
          </div>
        </div>
        
        <div ref={navScrollRef} className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
          {navLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          ) : navError ? (
            <div className="px-3 py-4 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Navigation unavailable</p>
              <Link href="/dashboard">
                <div className="mt-2 px-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 cursor-pointer">
                  Go to Dashboard
                </div>
              </Link>
            </div>
          ) : (
            [...navigationSections]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(section => renderSection(section))
          )}
          
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
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

        <div className="p-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-xl bg-slate-100 dark:bg-white/5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-sm font-bold text-white">
              {(user?.name || "User").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name || "Guest User"}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || "Not logged in"}</p>
            </div>
          </div>
          {mounted && (
            <div className="flex items-center gap-2 mb-3">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                data-testid="button-theme-toggle"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-4 w-4" aria-hidden="true" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" aria-hidden="true" />
                    Dark Mode
                  </>
                )}
              </button>
            </div>
          )}
          <button 
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
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
