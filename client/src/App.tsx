import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useExtractionEvents } from "@/hooks/useExtractionEvents";
import NotFound from "@/pages/not-found";
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
import ModelInsightsPage from "@/pages/model-insights";
import HumanReviewPage from "@/pages/human-review";
import ComponentsPage from "@/pages/components";

import LandingPage from "@/pages/landing";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/mfa" component={MFAPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/ingestion" component={Ingestion} />
      <Route path="/properties" component={Properties} />
      <Route path="/properties/:id" component={PropertyDetail} />
      <Route path="/certificates" component={CertificatesPage} />
      <Route path="/certificates/upload" component={CertificateUpload} />
      <Route path="/certificates/:id" component={CertificateDetailPage} />
      <Route path="/compliance" component={CompliancePage} />
      <Route path="/actions" component={ActionsPage} />
      <Route path="/contractors" component={ContractorsPage} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin/setup" component={AdminSetup} />
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/configuration" component={AdminConfiguration} />
      <Route path="/admin/imports" component={AdminImportsPage} />
      <Route path="/admin/tests" component={AdminTestSuite} />
      <Route path="/model-insights" component={ModelInsightsPage} />
      <Route path="/human-review" component={HumanReviewPage} />
      <Route path="/domain-rules">{() => <Redirect to="/admin/configuration" />}</Route>
      <Route path="/components" component={ComponentsPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  useExtractionEvents();
  return (
    <>
      <Toaster />
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
