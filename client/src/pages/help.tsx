import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  Home, Building2, FileText, AlertTriangle, Map, Users, Settings, 
  Upload, CheckCircle2, Clock, Shield, BarChart3, Wrench, BookOpen,
  Search, HelpCircle, Layers, Brain, MessageSquare, Activity, Target,
  Calendar, TrendingUp, Radar, Eye, Video, Database, Bot, Cog
} from "lucide-react";

export default function HelpPage() {
  useEffect(() => {
    document.title = "Help & User Guide - ComplianceAI";
  }, []);

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Help & User Guide" />
        <main id="main-content" className="flex-1 overflow-hidden" role="main" aria-label="Help content">
          <ScrollArea className="h-full">
            <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
              
              <div className="space-y-1">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">ComplianceAI User Guide</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Complete guide to managing compliance for UK social housing organisations
                </p>
              </div>

              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                  <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1"><BookOpen className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
                  <TabsTrigger value="command" className="text-xs sm:text-sm gap-1"><Home className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Command</span></TabsTrigger>
                  <TabsTrigger value="assets" className="text-xs sm:text-sm gap-1"><Building2 className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Assets</span></TabsTrigger>
                  <TabsTrigger value="operations" className="text-xs sm:text-sm gap-1"><FileText className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Ops</span></TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs sm:text-sm gap-1"><Brain className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">AI</span></TabsTrigger>
                  <TabsTrigger value="admin" className="text-xs sm:text-sm gap-1"><Settings className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Admin</span></TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Getting Started with ComplianceAI
                      </CardTitle>
                      <CardDescription>
                        ComplianceAI helps UK social housing organisations manage compliance certificates, 
                        track remedial actions, and visualise risk across their property portfolio.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="rounded-lg p-3 border-l-4 border-l-blue-500 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="p-1 rounded-md bg-blue-500">
                              <Layers className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Hierarchy</span>
                          </div>
                          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">5-Level</span>
                          <p className="text-[10px] text-muted-foreground">UKHDS standard</p>
                        </div>
                        <div className="rounded-lg p-3 border-l-4 border-l-emerald-500 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="p-1 rounded-md bg-emerald-500">
                              <Shield className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Streams</span>
                          </div>
                          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">16</span>
                          <p className="text-[10px] text-muted-foreground">Compliance areas</p>
                        </div>
                        <div className="rounded-lg p-3 border-l-4 border-l-purple-500 border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="p-1 rounded-md bg-purple-500">
                              <FileText className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Cert Types</span>
                          </div>
                          <span className="text-xl font-bold text-purple-600 dark:text-purple-400">80+</span>
                          <p className="text-[10px] text-muted-foreground">CP12, EICR, FRA</p>
                        </div>
                        <div className="rounded-lg p-3 border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="p-1 rounded-md bg-amber-500">
                              <Brain className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">AI Schemas</span>
                          </div>
                          <span className="text-xl font-bold text-amber-600 dark:text-amber-400">45</span>
                          <p className="text-[10px] text-muted-foreground">Auto extraction</p>
                        </div>
                      </div>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="hierarchy" className="border rounded-lg px-3">
                          <AccordionTrigger className="text-sm py-2">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-blue-500" />
                              UKHDS Asset Hierarchy Details
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="text-xs space-y-1 pb-3">
                            <p><strong>Organisation</strong> → Your housing association</p>
                            <p><strong>Scheme</strong> → Estate, development, or site</p>
                            <p><strong>Block</strong> → Physical building structure</p>
                            <p><strong>Dwelling</strong> → The lettable home</p>
                            <p><strong>Space</strong> → Rooms and communal areas</p>
                            <p><strong>Component</strong> → Equipment (boilers, alarms)</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="streams" className="border rounded-lg px-3 mt-2">
                          <AccordionTrigger className="text-sm py-2">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-green-500" />
                              16 Compliance Streams
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <span>Gas & Heating</span>
                              <span>Electrical</span>
                              <span>Fire Safety</span>
                              <span>Energy (EPC)</span>
                              <span>Asbestos</span>
                              <span>Water Safety</span>
                              <span>Lifting Equipment</span>
                              <span>Building Safety</span>
                              <span>External Areas</span>
                              <span>Security</span>
                              <span>HRB-specific</span>
                              <span>Housing Health</span>
                              <span>Accessibility</span>
                              <span>Pest Control</span>
                              <span>Waste</span>
                              <span>Communal</span>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        User Roles
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Super Admin</Badge>
                          <span>Full system access including factory settings and configuration</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-500">System Admin</Badge>
                          <span>User management, system health, and API configuration</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-500">Compliance Manager</Badge>
                          <span>Certificate upload, property management, remedial actions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500">Manager</Badge>
                          <span>View and edit properties, certificates, and actions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Officer</Badge>
                          <span>Day-to-day operations and certificate processing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Viewer</Badge>
                          <span>Read-only access to reports and dashboards</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* COMMAND CENTRE TAB */}
                <TabsContent value="command" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" />
                        Command Centre
                      </CardTitle>
                      <CardDescription>Your compliance overview and control hub</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="overview">
                          <AccordionTrigger>Overview Dashboard</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>The main dashboard displays key metrics using colour-coded cards:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><Badge variant="destructive">Critical</Badge> Overdue certificates requiring immediate attention</li>
                              <li><Badge className="bg-orange-500">High</Badge> Expiring within 7 days</li>
                              <li><Badge className="bg-amber-500">Medium</Badge> Expiring within 30 days</li>
                              <li><Badge className="bg-blue-500">Low</Badge> Items pending review</li>
                              <li><Badge className="bg-emerald-500">Good</Badge> Compliant properties</li>
                            </ul>
                            <p className="mt-2">Click any card to drill down to the relevant data.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="analytics">
                          <AccordionTrigger>Analytics</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Detailed analysis of your compliance data:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Compliance by Stream</strong> - See which areas need attention</li>
                              <li><strong>Monthly Trends</strong> - Track improvements over time</li>
                              <li><strong>Property Distribution</strong> - Breakdown by scheme and block</li>
                              <li><strong>Action Completion Rates</strong> - Monitor remedial work progress</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="ingestion">
                          <AccordionTrigger>Ingestion Dashboard</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Monitor document processing status:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Queue Status</strong> - Documents awaiting processing</li>
                              <li><strong>Processing</strong> - Currently being extracted by AI</li>
                              <li><strong>Completed</strong> - Successfully processed today</li>
                              <li><strong>Failed</strong> - Documents requiring attention</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="reporting">
                          <AccordionTrigger>Reporting</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Generate and export compliance reports:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Compliance Summary</strong> - Overall status report</li>
                              <li><strong>Expiry Report</strong> - Upcoming certificate renewals</li>
                              <li><strong>Remedial Actions</strong> - Outstanding work summary</li>
                              <li><strong>Audit Trail</strong> - System activity log</li>
                            </ul>
                            <p className="mt-2">Reports can be exported to PDF or Excel format.</p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ASSETS TAB */}
                <TabsContent value="assets" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Asset Management
                      </CardTitle>
                      <CardDescription>Managing your property portfolio and components</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="hierarchy">
                          <AccordionTrigger>Property Hierarchy</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Manage your organisation's asset structure (Admin/Manager only):</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Schemes</strong> - Create estates, developments, or sites</li>
                              <li><strong>Blocks</strong> - Add buildings within schemes</li>
                              <li><strong>Properties</strong> - Residential units within blocks</li>
                              <li><strong>Spaces</strong> - Rooms (in properties) or communal areas (in blocks/schemes)</li>
                            </ul>
                            <p className="mt-2">Use the tree view to navigate and expand the hierarchy.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="properties">
                          <AccordionTrigger>Properties (Dwellings)</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>View and manage residential units:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Search</strong> - Find by address, postcode, or UPRN</li>
                              <li><strong>Filter</strong> - By scheme, block, compliance status</li>
                              <li><strong>Add Property</strong> - Create new units manually</li>
                              <li><strong>Bulk Import</strong> - Upload via CSV from Data Import</li>
                            </ul>
                            <p className="mt-2">Each property shows its compliance status across all streams.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="components">
                          <AccordionTrigger>Components (Assets)</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Track equipment and assets requiring compliance:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Boilers</strong> - Gas appliances with CP12 requirements</li>
                              <li><strong>Consumer Units</strong> - Electrical installations needing EICR</li>
                              <li><strong>Smoke Alarms</strong> - Fire detection equipment</li>
                              <li><strong>Lifts</strong> - LOLER inspection requirements</li>
                              <li><strong>Water Systems</strong> - Legionella risk assessments</li>
                            </ul>
                            <p className="mt-2">Components link certificates to specific equipment, not just properties.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="spaces">
                          <AccordionTrigger>Spaces</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Spaces can be attached at three levels:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Property-level</strong> - Rooms within a dwelling (Kitchen, Bedroom)</li>
                              <li><strong>Block-level</strong> - Communal areas in a building (Stairwell, Plant Room)</li>
                              <li><strong>Scheme-level</strong> - Estate-wide spaces (Community Hall, Grounds)</li>
                            </ul>
                            <p className="mt-2">Components can be placed in specific spaces for precise tracking.</p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* OPERATIONS TAB */}
                <TabsContent value="operations" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Operations
                      </CardTitle>
                      <CardDescription>Day-to-day compliance management</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="certificates">
                          <AccordionTrigger>Certificates</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Upload and manage compliance documents:</p>
                            <ol className="list-decimal ml-6 space-y-1">
                              <li>Click <strong>Upload Certificate</strong></li>
                              <li>Select file (PDF or image)</li>
                              <li>AI automatically detects certificate type</li>
                              <li>AI extracts property, dates, outcome, and defects</li>
                              <li>Review and approve the extraction</li>
                            </ol>
                            <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded">
                              <p className="text-amber-800 dark:text-amber-300 text-xs">
                                <strong>Tip:</strong> Upload clear scans for best AI accuracy. Supported: CP12, LGSR, EICR, FRA, EPC, Asbestos surveys, and 70+ more certificate types.
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="risk-radar">
                          <AccordionTrigger>Risk Radar</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>ML-powered predictive compliance dashboard:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Predicted Failures</strong> - Properties likely to fail upcoming inspections</li>
                              <li><strong>Risk Scores</strong> - Combined statistical and ML confidence</li>
                              <li><strong>Priority Queue</strong> - Which properties need attention first</li>
                              <li><strong>Trend Analysis</strong> - Risk patterns over time</li>
                            </ul>
                            <p className="mt-2">The system learns from human feedback to improve predictions.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="actions">
                          <AccordionTrigger>Remedial Actions</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Actions are created automatically when AI finds defects:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><Badge variant="destructive">Critical</Badge> Immediate danger - 24hr response</li>
                              <li><Badge className="bg-red-500">High</Badge> Serious risk - 7 days</li>
                              <li><Badge className="bg-amber-500">Medium</Badge> Moderate risk - 28 days</li>
                              <li><Badge className="bg-blue-500">Low</Badge> Advisory - next service</li>
                            </ul>
                            <p className="mt-2">Assign to contractors, track progress, and record completion.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="calendar">
                          <AccordionTrigger>Calendar</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>View compliance events on a calendar:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Expiry Dates</strong> - Certificates due for renewal</li>
                              <li><strong>Inspection Due</strong> - Scheduled inspections</li>
                              <li><strong>Action Deadlines</strong> - Remedial work due dates</li>
                            </ul>
                            <p className="mt-2">Switch between month, week, and day views.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="risk-maps">
                          <AccordionTrigger>Risk Maps</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Geographic visualisation of compliance risk:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Property Markers</strong> - Colour-coded by risk level</li>
                              <li><strong>Heatmap Mode</strong> - See concentrations of risk</li>
                              <li><strong>Click to Drill Down</strong> - View property details</li>
                              <li><strong>Filter by Stream</strong> - Gas, electrical, fire, etc.</li>
                            </ul>
                            <p className="mt-2">Properties need geocoding (coordinates) to appear on the map.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="human-review">
                          <AccordionTrigger>Human Review</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Review AI extractions with low confidence:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Queue</strong> - Documents flagged for human review</li>
                              <li><strong>Side-by-side View</strong> - Original document vs extracted data</li>
                              <li><strong>Correct & Approve</strong> - Fix errors and confirm</li>
                              <li><strong>Reject</strong> - Mark as unprocessable</li>
                            </ul>
                            <p className="mt-2">Your corrections train the AI to improve over time.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="contractors">
                          <AccordionTrigger>Contractor Management</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Manage your approved contractors:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Add Contractors</strong> - Company details and certifications</li>
                              <li><strong>Assign Work</strong> - Link actions to contractors</li>
                              <li><strong>Track Performance</strong> - Completion rates and response times</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* AI & ML TAB */}
                <TabsContent value="ai" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        AI & Machine Learning
                      </CardTitle>
                      <CardDescription>Intelligent features powered by AI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="extraction">
                          <AccordionTrigger>AI Document Extraction</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>When you upload a certificate, our AI automatically extracts:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Certificate Type</strong> - Automatically detected from 80+ types</li>
                              <li><strong>Property Address</strong> - Matched to your portfolio</li>
                              <li><strong>Dates</strong> - Inspection and expiry dates</li>
                              <li><strong>Outcome</strong> - Pass, Fail, Satisfactory, etc.</li>
                              <li><strong>Contractor</strong> - Company and engineer details</li>
                              <li><strong>Defects</strong> - Classification codes and descriptions</li>
                            </ul>
                            <p className="mt-2">Defects automatically create remedial actions with appropriate severity.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="chatbot">
                          <AccordionTrigger>AI Assistant Chatbot</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Get instant help from our 5-layer AI assistant:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>FAQ Answers</strong> - Quick responses to common compliance questions</li>
                              <li><strong>Property Lookups</strong> - "Show me properties in Oakwood Estate"</li>
                              <li><strong>Certificate Searches</strong> - "Which gas certificates expire this month?"</li>
                              <li><strong>Compliance Guidance</strong> - Legislation references and best practices</li>
                              <li><strong>Navigation Help</strong> - "How do I upload a certificate?"</li>
                            </ul>
                            <p className="mt-2">Click the chat icon in the bottom corner to start a conversation.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="model-insights">
                          <AccordionTrigger>Model Insights</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Monitor AI performance (Admin/Manager only):</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Accuracy</strong> - Percentage of correct predictions</li>
                              <li><strong>Confidence Scores</strong> - Statistical vs ML confidence</li>
                              <li><strong>Feedback Loop</strong> - How human corrections improve the model</li>
                              <li><strong>Training Status</strong> - When the model was last updated</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="confidence">
                          <AccordionTrigger>Two-Tier Confidence System</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>The system uses two types of confidence scores:</p>
                            <div className="space-y-3 mt-2">
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                                <h5 className="font-medium text-blue-800 dark:text-blue-300">Statistical Score (85-95%)</h5>
                                <p className="text-xs text-blue-700 dark:text-blue-400">Based on proven compliance rules, certificate expiry patterns, and historical data. Always reliable.</p>
                              </div>
                              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded border border-purple-200 dark:border-purple-800">
                                <h5 className="font-medium text-purple-800 dark:text-purple-300">ML Prediction (30-95%)</h5>
                                <p className="text-xs text-purple-700 dark:text-purple-400">Learning from patterns and human feedback. Improves over time as more feedback is provided.</p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="knowledge">
                          <AccordionTrigger>Knowledge Training</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Train the AI chatbot with custom knowledge:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>FAQ Management</strong> - Add questions and answers</li>
                              <li><strong>Compliance Guidance</strong> - Upload policy documents</li>
                              <li><strong>Organisation-specific</strong> - Custom procedures and contacts</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ADMIN TAB */}
                <TabsContent value="admin" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Administration
                      </CardTitle>
                      <CardDescription>System configuration and management</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="users">
                          <AccordionTrigger>User Management</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Manage system users and access:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Invite Users</strong> - Send email invitations</li>
                              <li><strong>Assign Roles</strong> - Control access levels</li>
                              <li><strong>Deactivate</strong> - Disable user accounts</li>
                              <li><strong>Microsoft SSO</strong> - Optional single sign-on integration</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="configuration">
                          <AccordionTrigger>Configuration</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Configure compliance settings:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Compliance Streams</strong> - Enable/disable categories</li>
                              <li><strong>Certificate Types</strong> - Customize available types</li>
                              <li><strong>Classification Codes</strong> - EICR, Gas Safety code mappings</li>
                              <li><strong>Extraction Schemas</strong> - AI document parsing rules</li>
                              <li><strong>Domain Rules</strong> - Compliance rules and legislation</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="factory">
                          <AccordionTrigger>Factory Settings</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Advanced configuration (Super Admin only):</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>AI Thresholds</strong> - Confidence levels for auto-approval</li>
                              <li><strong>Action Automation</strong> - Auto-create remedial actions</li>
                              <li><strong>Cost Estimates</strong> - Default repair costs by code</li>
                              <li><strong>SLA Settings</strong> - Response time requirements</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="imports">
                          <AccordionTrigger>Data Import</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Bulk import data from CSV files:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Properties</strong> - Address, postcode, UPRN</li>
                              <li><strong>Components</strong> - Boilers, alarms with serial numbers</li>
                              <li><strong>Geocoding</strong> - Bulk upload coordinates</li>
                            </ul>
                            <p className="mt-2">Download templates from the Data Import page.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="api">
                          <AccordionTrigger>API Integration</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Connect external systems via REST API:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>API Keys</strong> - Generate secure access tokens</li>
                              <li><strong>Certificate Ingestion</strong> - Submit documents programmatically</li>
                              <li><strong>Webhooks</strong> - Receive event notifications</li>
                              <li><strong>Documentation</strong> - OpenAPI spec at /api/docs</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="system-health">
                          <AccordionTrigger>System Health</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Monitor system status:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Database</strong> - Connection status and performance</li>
                              <li><strong>API Server</strong> - Uptime and response times</li>
                              <li><strong>Job Queue</strong> - Background processing status</li>
                              <li><strong>Version Info</strong> - Current system version</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="audit">
                          <AccordionTrigger>Audit Log</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Track all system activity:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>User Actions</strong> - Who did what and when</li>
                              <li><strong>Data Changes</strong> - Property and certificate updates</li>
                              <li><strong>Login History</strong> - Access tracking</li>
                              <li><strong>API Calls</strong> - External system interactions</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="video">
                          <AccordionTrigger>Video Library</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Training videos for users:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Getting Started</strong> - Platform overview</li>
                              <li><strong>Certificate Upload</strong> - Step-by-step guide</li>
                              <li><strong>Managing Actions</strong> - Remedial workflow</li>
                              <li><strong>Risk Maps</strong> - Geographic visualisation</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Need more help?</h4>
                      <p className="text-sm text-muted-foreground">
                        Use the AI chatbot for instant help, or contact support at support@lashandigital.com
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
