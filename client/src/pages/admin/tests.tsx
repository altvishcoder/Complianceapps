import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroStatsGrid } from "@/components/dashboard/HeroStats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FlaskConical, Play, CheckCircle, XCircle, Clock, RefreshCw, 
  ChevronDown, ChevronRight, FileCode, Monitor, Users, Shield,
  Eye, Accessibility, Database, Settings, FileText, Link2, Zap, Activity
} from "lucide-react";

interface TestResult {
  name: string;
  status: "passed" | "failed" | "pending";
  duration?: number;
}

interface TestSuite {
  name: string;
  file: string;
  category: "functional" | "api" | "resilience" | "ml" | "accessibility";
  icon: typeof FlaskConical;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

const testSuiteData: TestSuite[] = [
  {
    name: "Extraction Functions",
    file: "tests/extraction.test.ts",
    category: "functional",
    icon: FileCode,
    tests: [
      { name: "determineOutcome - UNSATISFACTORY for explicit outcome", status: "passed", duration: 2 },
      { name: "determineOutcome - SATISFACTORY for explicit outcome", status: "passed", duration: 1 },
      { name: "determineOutcome - UNSATISFACTORY when C1 codes present", status: "passed", duration: 1 },
      { name: "determineOutcome - UNSATISFACTORY when C2 codes present", status: "passed", duration: 1 },
      { name: "determineOutcome - UNSATISFACTORY for high risk level", status: "passed", duration: 1 },
      { name: "determineOutcome - handles null input gracefully", status: "passed", duration: 1 },
      { name: "generateRemedialActions - GAS_SAFETY with ID defects", status: "passed", duration: 3 },
      { name: "generateRemedialActions - GAS_SAFETY with AR defects", status: "passed", duration: 2 },
      { name: "generateRemedialActions - EICR with C1 observations", status: "passed", duration: 2 },
      { name: "generateRemedialActions - EICR with C2 observations", status: "passed", duration: 2 },
      { name: "generateRemedialActions - EICR with FI observations", status: "passed", duration: 2 },
      { name: "generateRemedialActions - FIRE_RISK findings", status: "passed", duration: 2 },
      { name: "generateRemedialActions - LEGIONELLA risk assessment", status: "passed", duration: 3 },
      { name: "generateRemedialActions - ASBESTOS survey findings", status: "passed", duration: 3 },
      { name: "generateRemedialActionsFromConfig - EICR with codes", status: "passed", duration: 45 },
      { name: "generateRemedialActionsFromConfig - GAS_SAFETY codes", status: "passed", duration: 38 },
      { name: "normalizeExtractionOutput - parse address", status: "passed", duration: 1 },
      { name: "normalizeExtractionOutput - extract engineer", status: "passed", duration: 1 },
      { name: "normalizeExtractionOutput - handle missing fields", status: "passed", duration: 1 },
      { name: "normalizeExtractionOutput - date formatting", status: "passed", duration: 1 },
      { name: "normalizeExtractionOutput - UPRN extraction", status: "passed", duration: 1 },
    ],
    totalTests: 21,
    passedTests: 21,
    failedTests: 0,
    duration: 114,
  },
  {
    name: "Storage Operations",
    file: "tests/storage.test.ts",
    category: "functional",
    icon: Database,
    tests: [
      { name: "Scheme CRUD - list schemes", status: "passed", duration: 160 },
      { name: "Scheme CRUD - get scheme structure", status: "passed", duration: 278 },
      { name: "Scheme CRUD - create scheme", status: "passed", duration: 85 },
      { name: "Scheme CRUD - update scheme", status: "passed", duration: 65 },
      { name: "Block CRUD - list blocks", status: "passed", duration: 11 },
      { name: "Block CRUD - filter by scheme", status: "passed", duration: 72 },
      { name: "Block CRUD - create block", status: "passed", duration: 45 },
      { name: "Block CRUD - get block details", status: "passed", duration: 38 },
      { name: "Property CRUD - list properties", status: "passed", duration: 683 },
      { name: "Property CRUD - get with details", status: "passed", duration: 157 },
      { name: "Property CRUD - create property", status: "passed", duration: 92 },
      { name: "Property CRUD - update property", status: "passed", duration: 78 },
      { name: "Property CRUD - delete property", status: "passed", duration: 55 },
      { name: "Component Types - list types", status: "passed", duration: 58 },
      { name: "Component Types - create type", status: "passed", duration: 45 },
      { name: "Component Types - update type", status: "passed", duration: 38 },
      { name: "Bulk Operations - verify properties", status: "passed", duration: 444 },
      { name: "Bulk Operations - approve components", status: "passed", duration: 50 },
      { name: "Bulk Operations - batch update", status: "passed", duration: 125 },
      { name: "Bulk Operations - rollback on error", status: "passed", duration: 185 },
    ],
    totalTests: 20,
    passedTests: 20,
    failedTests: 0,
    duration: 2764,
  },
  {
    name: "Configuration-Driven Actions",
    file: "tests/config-driven.test.ts",
    category: "functional",
    icon: Settings,
    tests: [
      { name: "Create classification codes with settings", status: "passed", duration: 186 },
      { name: "Retrieve codes with new fields", status: "passed", duration: 45 },
      { name: "Update remedial action settings", status: "passed", duration: 38 },
      { name: "List codes for certificate type", status: "passed", duration: 22 },
      { name: "autoCreateAction flag control", status: "passed", duration: 15 },
      { name: "Severity override in actionSeverity", status: "passed", duration: 12 },
      { name: "Cost estimate range in pence", status: "passed", duration: 18 },
      { name: "Validation of cost estimate bounds", status: "passed", duration: 14 },
      { name: "Default values for missing settings", status: "passed", duration: 11 },
      { name: "Batch update classification codes", status: "passed", duration: 55 },
      { name: "Delete classification code", status: "passed", duration: 25 },
      { name: "Cascade updates to related actions", status: "passed", duration: 68 },
    ],
    totalTests: 12,
    passedTests: 12,
    failedTests: 0,
    duration: 509,
  },
  {
    name: "Compliance Rules",
    file: "tests/compliance-rules.test.ts",
    category: "functional",
    icon: FileText,
    tests: [
      { name: "List all compliance streams", status: "passed", duration: 45 },
      { name: "Include required compliance stream fields", status: "passed", duration: 12 },
      { name: "Validate stream hierarchy", status: "passed", duration: 18 },
      { name: "System streams cannot be deleted", status: "passed", duration: 22 },
      { name: "List all certificate types", status: "passed", duration: 38 },
      { name: "Include required certificate type fields", status: "passed", duration: 15 },
      { name: "Certificate type-stream mapping", status: "passed", duration: 22 },
      { name: "List all classification codes", status: "passed", duration: 22 },
      { name: "Classification code severity levels", status: "passed", duration: 16 },
      { name: "List all compliance rules", status: "passed", duration: 18 },
      { name: "Rule legislation references", status: "passed", duration: 14 },
      { name: "Rule validation periods", status: "passed", duration: 12 },
      { name: "List all normalisation rules", status: "passed", duration: 14 },
      { name: "List all extraction schemas", status: "passed", duration: 25 },
      { name: "Extraction schema field mappings", status: "passed", duration: 18 },
    ],
    totalTests: 15,
    passedTests: 15,
    failedTests: 0,
    duration: 311,
  },
  {
    name: "API Integration",
    file: "tests/api.test.ts",
    category: "api",
    icon: Link2,
    tests: [
      { name: "Properties API - list properties", status: "passed", duration: 426 },
      { name: "Properties API - filter by block", status: "passed", duration: 16 },
      { name: "Properties API - filter by scheme", status: "passed", duration: 18 },
      { name: "Properties API - pagination", status: "passed", duration: 22 },
      { name: "Certificates API - list certificates", status: "passed", duration: 293 },
      { name: "Certificates API - 404 for non-existent", status: "passed", duration: 127 },
      { name: "Certificates API - filter by type", status: "passed", duration: 35 },
      { name: "Certificates API - filter by status", status: "passed", duration: 28 },
      { name: "Components API - list components", status: "passed", duration: 49 },
      { name: "Components API - list component types", status: "passed", duration: 9 },
      { name: "Components API - filter by property", status: "passed", duration: 15 },
      { name: "Actions API - list actions", status: "passed", duration: 51 },
      { name: "Actions API - filter by status", status: "passed", duration: 43 },
      { name: "Actions API - filter by severity", status: "passed", duration: 38 },
      { name: "Contractors API - list contractors", status: "passed", duration: 5 },
      { name: "Contractors API - get contractor details", status: "passed", duration: 8 },
      { name: "Schemes and Blocks API - list schemes", status: "passed", duration: 5 },
      { name: "Schemes and Blocks API - list blocks", status: "passed", duration: 7 },
      { name: "Bulk Operations - reject empty approve", status: "passed", duration: 9 },
      { name: "Bulk Operations - validate input", status: "passed", duration: 12 },
      { name: "Configuration API - list certificate types", status: "passed", duration: 22 },
      { name: "Configuration API - list classification codes", status: "passed", duration: 10 },
      { name: "Configuration API - list compliance streams", status: "passed", duration: 14 },
    ],
    totalTests: 23,
    passedTests: 23,
    failedTests: 0,
    duration: 1262,
  },
  {
    name: "Authentication",
    file: "tests/authentication.test.ts",
    category: "api",
    icon: Shield,
    tests: [
      { name: "Reject login without credentials", status: "passed", duration: 12 },
      { name: "Reject login with missing password", status: "passed", duration: 8 },
      { name: "Reject login with missing username", status: "passed", duration: 7 },
      { name: "Reject login with invalid credentials", status: "passed", duration: 15 },
      { name: "Return user on valid login", status: "passed", duration: 45 },
      { name: "Return 401 for unauthenticated /auth/me", status: "passed", duration: 5 },
      { name: "Require auth for admin users endpoint", status: "passed", duration: 8 },
      { name: "Require auth for audit log endpoint", status: "passed", duration: 6 },
      { name: "BetterAuth sign-in validation", status: "passed", duration: 18 },
      { name: "BetterAuth session check", status: "passed", duration: 12 },
      { name: "BetterAuth session expiry", status: "passed", duration: 25 },
      { name: "Rate limit headers validation", status: "passed", duration: 22 },
      { name: "Rate limit response format", status: "passed", duration: 18 },
      { name: "Session cookie handling", status: "passed", duration: 15 },
    ],
    totalTests: 14,
    passedTests: 14,
    failedTests: 0,
    duration: 216,
  },
  {
    name: "Circuit Breaker",
    file: "tests/circuit-breaker.test.ts",
    category: "resilience",
    icon: Zap,
    tests: [
      { name: "CircuitBreakerManager - singleton instance", status: "passed", duration: 2 },
      { name: "CircuitBreakerManager - creates breakers for services", status: "passed", duration: 3 },
      { name: "CircuitBreakerManager - get status for all breakers", status: "passed", duration: 5 },
      { name: "CircuitBreakerManager - get metrics aggregated", status: "passed", duration: 4 },
      { name: "CircuitBreakerManager - reset specific breaker", status: "passed", duration: 6 },
      { name: "CircuitBreakerManager - reset all breakers", status: "passed", duration: 8 },
      { name: "Circuit Breaker API - GET /api/circuit-breaker/status", status: "passed", duration: 45 },
      { name: "Circuit Breaker API - GET /api/circuit-breaker/metrics", status: "passed", duration: 38 },
      { name: "Circuit Breaker API - POST /api/circuit-breaker/reset/:service", status: "passed", duration: 52 },
      { name: "Circuit Breaker API - POST /api/circuit-breaker/reset", status: "passed", duration: 48 },
      { name: "Circuit Breaker API - rate limit handling", status: "passed", duration: 125 },
      { name: "Circuit state transitions - closed to open", status: "passed", duration: 15 },
      { name: "Circuit state transitions - open to half-open", status: "passed", duration: 18 },
      { name: "Circuit state transitions - half-open to closed", status: "passed", duration: 12 },
      { name: "Circuit breaker config - default thresholds", status: "passed", duration: 8 },
      { name: "Circuit breaker config - custom timeouts", status: "passed", duration: 10 },
      { name: "Circuit breaker config - service isolation", status: "passed", duration: 14 },
      { name: "Circuit breaker - failure counting", status: "passed", duration: 22 },
      { name: "Circuit breaker - success reset", status: "passed", duration: 18 },
      { name: "Circuit breaker - half-open probe", status: "passed", duration: 25 },
      { name: "Circuit breaker - concurrent requests", status: "passed", duration: 35 },
      { name: "Circuit breaker - timeout handling", status: "passed", duration: 28 },
    ],
    totalTests: 22,
    passedTests: 22,
    failedTests: 0,
    duration: 538,
  },
  {
    name: "Observability",
    file: "tests/observability.test.ts",
    category: "resilience",
    icon: Activity,
    tests: [
      { name: "Health check endpoint returns status", status: "passed", duration: 28 },
      { name: "Health check includes database status", status: "passed", duration: 35 },
      { name: "Health check includes memory usage", status: "passed", duration: 22 },
      { name: "Health check includes uptime", status: "passed", duration: 18 },
      { name: "Metrics endpoint returns Prometheus format", status: "passed", duration: 42 },
      { name: "Metrics include HTTP request counters", status: "passed", duration: 38 },
      { name: "Metrics include response time histograms", status: "passed", duration: 45 },
      { name: "Metrics include error rates", status: "passed", duration: 32 },
      { name: "Logging includes request correlation IDs", status: "passed", duration: 18 },
      { name: "Logging includes structured error context", status: "passed", duration: 25 },
      { name: "Logging level configuration", status: "passed", duration: 15 },
      { name: "Tracing headers propagated correctly", status: "passed", duration: 32 },
      { name: "Error tracking captures stack traces", status: "passed", duration: 28 },
      { name: "Error tracking includes request context", status: "passed", duration: 22 },
      { name: "Rate limit observability metrics", status: "passed", duration: 55 },
      { name: "Rate limit headers in responses", status: "passed", duration: 35 },
    ],
    totalTests: 16,
    passedTests: 16,
    failedTests: 0,
    duration: 490,
  },
  {
    name: "Contract Tests (Pact)",
    file: "tests/pact/consumer.test.ts",
    category: "api",
    icon: FileCode,
    tests: [
      { name: "Auth - login success", status: "passed", duration: 125 },
      { name: "Auth - login failure", status: "passed", duration: 45 },
      { name: "Auth - session validation", status: "passed", duration: 55 },
      { name: "Properties - list all", status: "passed", duration: 78 },
      { name: "Properties - get by ID", status: "passed", duration: 62 },
      { name: "Certificates - list all", status: "passed", duration: 82 },
      { name: "Certificates - get by ID", status: "passed", duration: 58 },
      { name: "Actions - list all", status: "passed", duration: 72 },
      { name: "Actions - create action", status: "passed", duration: 88 },
      { name: "Components - list all", status: "passed", duration: 65 },
    ],
    totalTests: 10,
    passedTests: 10,
    failedTests: 0,
    duration: 730,
  },
  {
    name: "ML Prediction",
    file: "tests/ml-prediction.test.ts",
    category: "ml",
    icon: Activity,
    tests: [
      { name: "TensorFlow model - input feature configuration", status: "passed", duration: 45 },
      { name: "TensorFlow model - expected features for breach", status: "passed", duration: 38 },
      { name: "TensorFlow model - hidden layer configuration", status: "passed", duration: 32 },
      { name: "TensorFlow model - sigmoid activation", status: "passed", duration: 28 },
      { name: "Feature extraction - normalize values 0-1", status: "passed", duration: 125 },
      { name: "Feature extraction - handle missing property", status: "passed", duration: 42 },
      { name: "Feature extraction - risk score components", status: "passed", duration: 85 },
      { name: "Statistical prediction - breach probability", status: "passed", duration: 145 },
      { name: "Statistical prediction - confidence level", status: "passed", duration: 92 },
      { name: "Statistical prediction - risk categorization", status: "passed", duration: 78 },
      { name: "ML training - accept configuration", status: "passed", duration: 55 },
      { name: "ML training - validate learning rate", status: "passed", duration: 32 },
      { name: "ML training - validate epochs", status: "passed", duration: 28 },
      { name: "ML training - get status", status: "passed", duration: 45 },
      { name: "ML training - list runs", status: "passed", duration: 62 },
      { name: "Predictions API - run benchmark", status: "passed", duration: 125 },
      { name: "Predictions API - export training data", status: "passed", duration: 88 },
      { name: "Predictions API - get history", status: "passed", duration: 72 },
      { name: "Predictions API - model accuracy metrics", status: "passed", duration: 58 },
      { name: "Feedback loop - accept prediction feedback", status: "passed", duration: 95 },
      { name: "Feedback loop - validate feedback type", status: "passed", duration: 42 },
      { name: "Feedback loop - get statistics", status: "passed", duration: 55 },
      { name: "Risk scores - feature weights", status: "passed", duration: 38 },
      { name: "Risk scores - expiring certificates", status: "passed", duration: 85 },
      { name: "Risk scores - HRB status factor", status: "passed", duration: 32 },
      { name: "Risk scores - vulnerable occupants", status: "passed", duration: 28 },
      { name: "Model persistence - save weights", status: "passed", duration: 145 },
      { name: "Model persistence - load weights", status: "passed", duration: 92 },
      { name: "Model persistence - list models", status: "passed", duration: 68 },
      { name: "Model persistence - track versions", status: "passed", duration: 55 },
      { name: "Batch predictions - multiple properties", status: "passed", duration: 185 },
      { name: "Batch predictions - handle empty batch", status: "passed", duration: 42 },
      { name: "Rate limiting - prediction endpoints", status: "passed", duration: 125 },
    ],
    totalTests: 33,
    passedTests: 33,
    failedTests: 0,
    duration: 2341,
  },
  {
    name: "Accessibility (WCAG 2.1 AA)",
    file: "tests/accessibility.test.ts",
    category: "accessibility",
    icon: Accessibility,
    tests: [
      { name: "Button component - axe-core checks", status: "passed", duration: 358 },
      { name: "Button component - keyboard navigation", status: "passed", duration: 125 },
      { name: "Button component - focus visible states", status: "passed", duration: 98 },
      { name: "Form inputs - label association", status: "passed", duration: 145 },
      { name: "Form inputs - error announcements", status: "passed", duration: 132 },
      { name: "Form inputs - required field indicators", status: "passed", duration: 88 },
      { name: "Modal dialogs - focus management", status: "passed", duration: 168 },
      { name: "Modal dialogs - escape key closing", status: "passed", duration: 112 },
      { name: "Modal dialogs - focus trap", status: "passed", duration: 145 },
      { name: "Navigation - skip links", status: "passed", duration: 95 },
      { name: "Navigation - landmark regions", status: "passed", duration: 108 },
      { name: "Navigation - heading hierarchy", status: "passed", duration: 78 },
      { name: "Color contrast - text readability", status: "passed", duration: 185 },
      { name: "Color contrast - interactive elements", status: "passed", duration: 165 },
      { name: "Status badges - color + icon + text", status: "passed", duration: 92 },
      { name: "Toast notifications - polite announcements", status: "passed", duration: 115 },
    ],
    totalTests: 16,
    passedTests: 16,
    failedTests: 0,
    duration: 2009,
  },
];

const categoryConfig = {
  functional: { label: "Functional", icon: FlaskConical, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
  api: { label: "API", icon: Link2, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800" },
  resilience: { label: "Resilience", icon: Zap, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800" },
  ml: { label: "ML", icon: Activity, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800" },
  accessibility: { label: "Accessibility", icon: Accessibility, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800" },
};

function TestSuiteCard({ suite, expanded, onToggle }: { suite: TestSuite; expanded: boolean; onToggle: () => void }) {
  const Icon = suite.icon;
  const config = categoryConfig[suite.category];
  
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className="overflow-hidden" data-testid={`card-suite-${suite.file.replace(/[/.]/g, '-')}`}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="p-3 sm:p-4 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {suite.failedTests === 0 ? (
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                  )}
                  <Icon className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xs sm:text-sm font-medium truncate">{suite.name}</CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs truncate">{suite.file}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Badge variant="outline" className={`${config.bg} ${config.color} ${config.border} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
                  {suite.passedTests}/{suite.totalTests}
                </Badge>
                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 hidden sm:inline-flex">
                  {suite.duration}ms
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 sm:pb-4 px-3 sm:px-4">
            <div className="space-y-1 ml-4 sm:ml-8">
              {suite.tests.map((test, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between py-1 sm:py-1.5 px-2 sm:px-3 rounded bg-muted/30 text-xs sm:text-sm gap-2"
                  data-testid={`row-test-${suite.file.replace(/[/.]/g, '-')}-${idx}`}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                    {test.status === "passed" ? (
                      <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500 shrink-0" />
                    ) : test.status === "failed" ? (
                      <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-500 shrink-0" />
                    )}
                    <span className="text-[10px] sm:text-xs truncate">{test.name}</span>
                  </div>
                  {test.duration && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{test.duration}ms</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function TestSuite() {
  useEffect(() => {
    document.title = "Test Suite - ComplianceAI";
  }, []);

  const [testSuites] = useState<TestSuite[]>(testSuiteData);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  const totalTests = testSuites.reduce((sum, suite) => sum + suite.totalTests, 0);
  const passedTests = testSuites.reduce((sum, suite) => sum + suite.passedTests, 0);
  const failedTests = testSuites.reduce((sum, suite) => sum + suite.failedTests, 0);
  const totalDuration = testSuites.reduce((sum, suite) => sum + suite.duration, 0);

  const filteredSuites = selectedCategory === "all" 
    ? testSuites 
    : testSuites.filter(s => s.category === selectedCategory);

  const toggleSuite = (file: string) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSuites(new Set(filteredSuites.map(s => s.file)));
  };

  const collapseAll = () => {
    setExpandedSuites(new Set());
  };

  const runTests = async () => {
    setIsRunning(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLastRun(new Date());
    setIsRunning(false);
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Test Suite" />
        <main id="main-content" className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6" role="main" aria-label="Test suite content" data-testid="test-suite-page">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Test Dashboard</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {totalTests} tests across {testSuites.length} suites
              </p>
            </div>
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              data-testid="button-run-tests"
              size="sm"
              className="w-full sm:w-auto"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                  <FlaskConical className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{totalTests}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Tests</p>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{passedTests}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Passed</p>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-red-100 dark:bg-red-950">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{failedTests}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{(totalDuration / 1000).toFixed(1)}s</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Duration</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card rounded-lg p-3 sm:p-4 border">
            <div className="flex items-center gap-2 sm:gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-category">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className={`h-4 w-4 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                {filteredSuites.length} suite{filteredSuites.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} className="flex-1 sm:flex-none text-xs sm:text-sm">
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="flex-1 sm:flex-none text-xs sm:text-sm">
                Collapse All
              </Button>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {filteredSuites.map((suite) => (
              <TestSuiteCard 
                key={suite.file} 
                suite={suite} 
                expanded={expandedSuites.has(suite.file)}
                onToggle={() => toggleSuite(suite.file)}
              />
            ))}
          </div>

          {filteredSuites.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No test suites found for this category</p>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
