import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useExtractionEvents } from "@/hooks/useExtractionEvents";
import { useEffect, useState, ComponentType } from "react";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}
import Dashboard from "@/pages/dashboard";
import Ingestion from "@/pages/ingestion";
import Properties from "@/pages/properties";
import PropertyDetail from "@/pages/properties/detail";
import Reports from "@/pages/reports";
import CertificatesPage from "@/pages/certificates";
import CertificateUpload from "@/pages/certificates/upload";
import CertificateDetailPage from "@/pages/certificates/detail";
import CompliancePage from "@/pages/compliance";
import ActionsPage from "@/pages/actions";
import ContractorsPage from "@/pages/contractors";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import MFAPage from "@/pages/mfa";
import AdminSetup from "@/pages/admin/setup";
import AdminUsersPage from "@/pages/admin/users";
import AdminConfiguration from "@/pages/admin/configuration";
import AdminImportsPage from "@/pages/admin/imports";
import AdminTestSuite from "@/pages/admin/tests";
import AdminIntegrationsPage from "@/pages/admin/integrations";
import AdminHierarchy from "@/pages/admin/hierarchy";
import AdminFactorySettings from "@/pages/admin/factory-settings";
import AdminApiIntegration from "@/pages/admin/api-integration";
import AdminSystemHealth from "@/pages/admin/system-health";
import AdminAuditLog from "@/pages/admin/AuditLogPage";
import AdminApiDocs from "@/pages/admin/api-docs";
import AdminChatbotAnalytics from "@/pages/admin/chatbot-analytics";
import ModelInsightsPage from "@/pages/model-insights";
import HumanReviewPage from "@/pages/human-review";
import ComponentsPage from "@/pages/components";
import VideoLibrary from "@/pages/video-library";
import MapsIndex from "@/pages/maps";
import RiskHeatmap from "@/pages/maps/risk-heatmap";
import ScenariosPage from "@/pages/maps/scenarios";
import EvidencePage from "@/pages/maps/evidence";

import LandingPage from "@/pages/landing";
import HelpPage from "@/pages/help";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { AIAssistant } from "@/components/AIAssistant";
import { OnboardingWizard } from "@/components/OnboardingWizard";

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
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/admin/setup">{() => <ProtectedRoute component={AdminSetup} />}</Route>
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsersPage} />}</Route>
      <Route path="/admin/configuration">{() => <ProtectedRoute component={AdminConfiguration} />}</Route>
      <Route path="/admin/imports">{() => <ProtectedRoute component={AdminImportsPage} />}</Route>
      <Route path="/admin/tests">{() => <ProtectedRoute component={AdminTestSuite} />}</Route>
      <Route path="/admin/integrations">{() => <ProtectedRoute component={AdminIntegrationsPage} />}</Route>
      <Route path="/admin/hierarchy">{() => <ProtectedRoute component={AdminHierarchy} />}</Route>
      <Route path="/admin/factory-settings">{() => <ProtectedRoute component={AdminFactorySettings} />}</Route>
      <Route path="/admin/api-integration">{() => <ProtectedRoute component={AdminApiIntegration} />}</Route>
      <Route path="/admin/system-health">{() => <ProtectedRoute component={AdminSystemHealth} />}</Route>
      <Route path="/admin/audit-log">{() => <ProtectedRoute component={AdminAuditLog} />}</Route>
      <Route path="/admin/api-docs">{() => <ProtectedRoute component={AdminApiDocs} />}</Route>
      <Route path="/admin/chatbot-analytics">{() => <ProtectedRoute component={AdminChatbotAnalytics} />}</Route>
      <Route path="/model-insights">{() => <ProtectedRoute component={ModelInsightsPage} />}</Route>
      <Route path="/human-review">{() => <ProtectedRoute component={HumanReviewPage} />}</Route>
      <Route path="/domain-rules">{() => <Redirect to="/admin/configuration" />}</Route>
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
  const isProtectedRoute = !["/", "/login", "/register", "/mfa"].includes(location);
  
  return (
    <>
      <Toaster />
      <KeyboardShortcutsDialog />
      <Router />
      <AIAssistant />
      {isAuthenticated && isProtectedRoute && <OnboardingWizard />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
