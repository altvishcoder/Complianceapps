import { Switch, Route } from "wouter";
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
import MFAPage from "@/pages/mfa";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/ingestion" component={Ingestion} />
      <Route path="/properties" component={Properties} />
      <Route path="/reports" component={Reports} />
      <Route path="/login" component={LoginPage} />
      <Route path="/mfa" component={MFAPage} />
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
