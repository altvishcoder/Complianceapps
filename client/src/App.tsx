import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Ingestion from "@/pages/ingestion";
import Properties from "@/pages/properties";
import Reports from "@/pages/reports";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import MFAPage from "@/pages/mfa";
import AdminSetup from "@/pages/admin/setup";
import AdminUsersPage from "@/pages/admin/users";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/mfa" component={MFAPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/ingestion" component={Ingestion} />
      <Route path="/properties" component={Properties} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin/setup" component={AdminSetup} />
      <Route path="/admin/users" component={AdminUsersPage} />
      
      {/* Default Redirect to Login */}
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
