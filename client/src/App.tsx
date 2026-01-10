import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { useExtractionEvents } from "@/hooks/useExtractionEvents";
import { useEffect, useState, ComponentType, Suspense, lazy } from "react";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";

const PageLoader = () => (
  <div className="flex h-screen bg-background">
    <aside className="hidden md:flex w-72 flex-col bg-card border-r border-border">
      <div className="h-20 px-6 flex items-center border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-28 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2">
        <div className="h-9 w-full bg-muted rounded-lg animate-pulse" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-8 w-full bg-muted rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    </aside>
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 px-4 flex items-center justify-between border-b border-border bg-card">
        <div className="h-7 w-40 bg-muted rounded animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-6 rounded-xl border border-border bg-card">
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
        </div>
      </main>
    </div>
  </div>
);

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirecting) {
      setRedirecting(true);
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation, redirecting]);

  if (isLoading || redirecting) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}
import Dashboard from "@/pages/dashboard";
import LoginPage from "@/pages/auth/login";
import LandingPage from "@/pages/landing";

const Ingestion = lazy(() => import("@/pages/ingestion"));
const Properties = lazy(() => import("@/pages/properties"));
const PropertyDetail = lazy(() => import("@/pages/properties/detail"));
const Reports = lazy(() => import("@/pages/reports"));
const CertificatesPage = lazy(() => import("@/pages/certificates"));
const CertificateUpload = lazy(() => import("@/pages/certificates/upload"));
const CertificateDetailPage = lazy(() => import("@/pages/certificates/detail"));
const CompliancePage = lazy(() => import("@/pages/compliance"));
const ActionsPage = lazy(() => import("@/pages/actions"));
const ContractorsPage = lazy(() => import("@/pages/contractors"));
const ContractorDashboardPage = lazy(() => import("@/pages/contractors/dashboard"));
const ContractorSLAPage = lazy(() => import("@/pages/contractors/sla"));
const ContractorReportsPage = lazy(() => import("@/pages/contractors/reports"));
const StaffDirectoryPage = lazy(() => import("@/pages/staff"));
const StaffDashboardPage = lazy(() => import("@/pages/staff/dashboard"));
const StaffSLAPage = lazy(() => import("@/pages/staff/sla"));
const StaffReportsPage = lazy(() => import("@/pages/staff/reports"));
const RegisterPage = lazy(() => import("@/pages/auth/register"));
const MFAPage = lazy(() => import("@/pages/mfa"));
const AdminSetup = lazy(() => import("@/pages/admin/setup"));
const AdminUsersPage = lazy(() => import("@/pages/admin/users"));
const AdminConfiguration = lazy(() => import("@/pages/admin/configuration"));
const AdminImportsPage = lazy(() => import("@/pages/admin/imports"));
const AdminTestSuite = lazy(() => import("@/pages/admin/tests"));
const AdminIntegrationsPage = lazy(() => import("@/pages/admin/integrations"));
const AdminHierarchy = lazy(() => import("@/pages/admin/hierarchy"));
const AdminFactorySettings = lazy(() => import("@/pages/admin/factory-settings"));
const AdminApiIntegration = lazy(() => import("@/pages/admin/api-integration"));
const AdminSystemHealth = lazy(() => import("@/pages/admin/system-health"));
const AdminDbOptimization = lazy(() => import("@/pages/admin/db-optimization"));
const AdminObservabilityDashboard = lazy(() => import("@/pages/admin/observability-dashboard"));
const AdminIngestionControl = lazy(() => import("@/pages/admin/ingestion-control"));
const AdminRemedialKanban = lazy(() => import("@/pages/admin/remedial-kanban"));
const AdminAssetHealth = lazy(() => import("@/pages/admin/asset-health"));
const AdminAuditLog = lazy(() => import("@/pages/admin/AuditLogPage"));
const AdminApiDocs = lazy(() => import("@/pages/admin/api-docs"));
const AdminChatbotAnalytics = lazy(() => import("@/pages/admin/chatbot-analytics"));
const AdminKnowledgeTraining = lazy(() => import("@/pages/admin/knowledge-training"));
const AdminNavigationManagement = lazy(() => import("@/pages/admin/navigation-management"));
const AdminMLInsights = lazy(() => import("@/pages/admin/ml-insights"));
const AdminCacheControl = lazy(() => import("@/pages/admin/cache-control"));
const AdminJobsManagement = lazy(() => import("@/pages/admin/jobs-management"));
const AdminPerformance = lazy(() => import("@/pages/admin/performance"));
const AdminLoginPage = lazy(() => import("@/pages/admin/login"));
const ModelInsightsPage = lazy(() => import("@/pages/model-insights"));
const HumanReviewPage = lazy(() => import("@/pages/human-review"));
const ComponentsPage = lazy(() => import("@/pages/components"));
const VideoLibrary = lazy(() => import("@/pages/video-library"));
const MapsIndex = lazy(() => import("@/pages/maps"));
const RiskHeatmap = lazy(() => import("@/pages/maps/risk-heatmap"));
const ScenariosPage = lazy(() => import("@/pages/maps/scenarios"));
const EvidencePage = lazy(() => import("@/pages/maps/evidence"));
const ComplianceCalendar = lazy(() => import("@/pages/compliance-calendar"));
const RiskRadarPage = lazy(() => import("@/pages/risk-radar"));
const AssetHealthTreemapPage = lazy(() => import("@/pages/analytics/asset-health-treemap"));
const BoardReportingPage = lazy(() => import("@/pages/reports/board"));
const RegulatoryEvidencePage = lazy(() => import("@/pages/reports/regulatory"));
const ReportBuilderPage = lazy(() => import("@/pages/reports/builder"));
const ReportCanvasPage = lazy(() => import("@/pages/reports/canvas"));
const HelpPage = lazy(() => import("@/pages/help"));
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { AIAssistant } from "@/components/AIAssistant";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { GuidedTour, TourTriggerButton } from "@/components/GuidedTour";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/mfa" component={MFAPage} />
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/ingestion">{() => <ProtectedRoute component={Ingestion} />}</Route>
      <Route path="/properties">{() => <ProtectedRoute component={Properties} />}</Route>
      <Route path="/properties/:id">{() => <ProtectedRoute component={PropertyDetail} />}</Route>
      <Route path="/certificates">{() => <ProtectedRoute component={CertificatesPage} />}</Route>
      <Route path="/certificates/upload">{() => <ProtectedRoute component={CertificateUpload} />}</Route>
      <Route path="/certificates/:id">{() => <ProtectedRoute component={CertificateDetailPage} />}</Route>
      <Route path="/compliance">{() => <ProtectedRoute component={CompliancePage} />}</Route>
      <Route path="/actions">{() => <ProtectedRoute component={ActionsPage} />}</Route>
      <Route path="/contractors">{() => <ProtectedRoute component={ContractorsPage} />}</Route>
      <Route path="/contractors/dashboard">{() => <ProtectedRoute component={ContractorDashboardPage} />}</Route>
      <Route path="/contractors/sla">{() => <ProtectedRoute component={ContractorSLAPage} />}</Route>
      <Route path="/contractors/reports">{() => <ProtectedRoute component={ContractorReportsPage} />}</Route>
      <Route path="/staff">{() => <ProtectedRoute component={StaffDirectoryPage} />}</Route>
      <Route path="/staff/dashboard">{() => <ProtectedRoute component={StaffDashboardPage} />}</Route>
      <Route path="/staff/sla">{() => <ProtectedRoute component={StaffSLAPage} />}</Route>
      <Route path="/staff/reports">{() => <ProtectedRoute component={StaffReportsPage} />}</Route>
      <Route path="/risk-radar">{() => <ProtectedRoute component={RiskRadarPage} />}</Route>
      <Route path="/analytics/asset-health">{() => <ProtectedRoute component={AssetHealthTreemapPage} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/reports/board">{() => <ProtectedRoute component={BoardReportingPage} />}</Route>
      <Route path="/reports/regulatory">{() => <ProtectedRoute component={RegulatoryEvidencePage} />}</Route>
      <Route path="/reports/builder">{() => <ProtectedRoute component={ReportBuilderPage} />}</Route>
      <Route path="/reports/canvas">{() => <ProtectedRoute component={ReportCanvasPage} />}</Route>
      <Route path="/calendar">{() => <ProtectedRoute component={ComplianceCalendar} />}</Route>
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/setup">{() => <AdminProtectedRoute component={AdminSetup} />}</Route>
      <Route path="/admin/users">{() => <AdminProtectedRoute component={AdminUsersPage} />}</Route>
      <Route path="/admin/configuration">{() => <AdminProtectedRoute component={AdminConfiguration} />}</Route>
      <Route path="/admin/imports">{() => <AdminProtectedRoute component={AdminImportsPage} />}</Route>
      <Route path="/admin/tests">{() => <AdminProtectedRoute component={AdminTestSuite} />}</Route>
      <Route path="/admin/integrations">{() => <AdminProtectedRoute component={AdminIntegrationsPage} />}</Route>
      <Route path="/admin/hierarchy">{() => <AdminProtectedRoute component={AdminHierarchy} />}</Route>
      <Route path="/admin/factory-settings">{() => <AdminProtectedRoute component={AdminFactorySettings} />}</Route>
      <Route path="/admin/api-integration">{() => <AdminProtectedRoute component={AdminApiIntegration} />}</Route>
      <Route path="/admin/system-health">{() => <AdminProtectedRoute component={AdminSystemHealth} />}</Route>
      <Route path="/admin/db-optimization">{() => <AdminProtectedRoute component={AdminDbOptimization} />}</Route>
      <Route path="/admin/observability">{() => <AdminProtectedRoute component={AdminObservabilityDashboard} />}</Route>
      <Route path="/admin/ingestion-control">{() => <AdminProtectedRoute component={AdminIngestionControl} />}</Route>
      <Route path="/admin/remedial-kanban">{() => <AdminProtectedRoute component={AdminRemedialKanban} />}</Route>
      <Route path="/admin/asset-health">{() => <AdminProtectedRoute component={AdminAssetHealth} />}</Route>
      <Route path="/admin/audit-log">{() => <AdminProtectedRoute component={AdminAuditLog} />}</Route>
      <Route path="/admin/api-docs">{() => <AdminProtectedRoute component={AdminApiDocs} />}</Route>
      <Route path="/admin/chatbot-analytics">{() => <AdminProtectedRoute component={AdminChatbotAnalytics} />}</Route>
      <Route path="/admin/knowledge-training">{() => <AdminProtectedRoute component={AdminKnowledgeTraining} />}</Route>
      <Route path="/admin/navigation">{() => <AdminProtectedRoute component={AdminNavigationManagement} />}</Route>
      <Route path="/admin/ml-insights">{() => <AdminProtectedRoute component={AdminMLInsights} />}</Route>
      <Route path="/admin/cache-control">{() => <AdminProtectedRoute component={AdminCacheControl} />}</Route>
      <Route path="/admin/jobs">{() => <AdminProtectedRoute component={AdminJobsManagement} />}</Route>
      <Route path="/admin/performance">{() => <AdminProtectedRoute component={AdminPerformance} />}</Route>
      <Route path="/model-insights">{() => <ProtectedRoute component={ModelInsightsPage} />}</Route>
      <Route path="/human-review">{() => <ProtectedRoute component={HumanReviewPage} />}</Route>
      <Route path="/domain-rules">{() => <Redirect to="/admin/configuration" />}</Route>
      <Route path="/reporting">{() => <Redirect to="/reports" />}</Route>
      <Route path="/components">{() => <ProtectedRoute component={ComponentsPage} />}</Route>
      <Route path="/video-library">{() => <ProtectedRoute component={VideoLibrary} />}</Route>
      <Route path="/maps">{() => <ProtectedRoute component={MapsIndex} />}</Route>
      <Route path="/maps/risk-heatmap">{() => <ProtectedRoute component={RiskHeatmap} />}</Route>
      <Route path="/maps/scenarios">{() => <ProtectedRoute component={ScenariosPage} />}</Route>
      <Route path="/maps/evidence">{() => <ProtectedRoute component={EvidencePage} />}</Route>
      <Route path="/help">{() => <ProtectedRoute component={HelpPage} />}</Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  useExtractionEvents();
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const isProtectedRoute = !["/", "/login", "/register", "/mfa", "/admin/login"].includes(location);
  
  return (
    <>
      <Toaster />
      <KeyboardShortcutsDialog />
      <Suspense fallback={<PageLoader />}>
        <Router />
      </Suspense>
      <AIAssistant />
      {isAuthenticated && isProtectedRoute && (
        <>
          <OnboardingWizard />
          <GuidedTour />
          <TourTriggerButton />
        </>
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
