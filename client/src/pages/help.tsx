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
  Search, HelpCircle, Layers
} from "lucide-react";

export default function HelpPage() {
  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Help & User Guide" />
        <main id="main-content" className="flex-1 overflow-hidden" role="main" aria-label="Help content">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-5xl mx-auto space-y-6">
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight font-display">ComplianceAI User Guide</h1>
                <p className="text-muted-foreground text-lg">
                  Complete guide to managing compliance for UK social housing organisations
                </p>
              </div>

              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="overview" className="gap-2"><BookOpen className="h-4 w-4" /> Overview</TabsTrigger>
                  <TabsTrigger value="dashboard" className="gap-2"><Home className="h-4 w-4" /> Dashboard</TabsTrigger>
                  <TabsTrigger value="properties" className="gap-2"><Building2 className="h-4 w-4" /> Properties</TabsTrigger>
                  <TabsTrigger value="certificates" className="gap-2"><FileText className="h-4 w-4" /> Certificates</TabsTrigger>
                  <TabsTrigger value="actions" className="gap-2"><AlertTriangle className="h-4 w-4" /> Actions</TabsTrigger>
                  <TabsTrigger value="maps" className="gap-2"><Map className="h-4 w-4" /> Risk Maps</TabsTrigger>
                  <TabsTrigger value="admin" className="gap-2"><Settings className="h-4 w-4" /> Admin</TabsTrigger>
                </TabsList>

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
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg space-y-2">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Layers className="h-4 w-4 text-blue-500" />
                            Asset Hierarchy
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Properties are organised following the HACT/UKHDS 5-level hierarchy:
                          </p>
                          <ul className="text-sm space-y-1 ml-4">
                            <li><strong>Organisation</strong> → Housing Association</li>
                            <li><strong>Scheme</strong> → Estate or development</li>
                            <li><strong>Block</strong> → Individual building</li>
                            <li><strong>Property</strong> → Residential unit</li>
                            <li><strong>Component</strong> → Equipment (boiler, alarms)</li>
                          </ul>
                        </div>
                        <div className="p-4 border rounded-lg space-y-2">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4 text-green-500" />
                            Compliance Streams
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Track certificates across all major compliance areas:
                          </p>
                          <ul className="text-sm space-y-1 ml-4">
                            <li><strong>Gas Safety</strong> - CP12/LGSR certificates</li>
                            <li><strong>Electrical</strong> - EICR reports</li>
                            <li><strong>Fire Risk</strong> - FRA assessments</li>
                            <li><strong>Energy</strong> - EPC ratings</li>
                            <li><strong>Asbestos</strong> - Management surveys</li>
                            <li><strong>Legionella</strong> - Risk assessments</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">AI-Powered Extraction</h4>
                        <p className="text-sm text-blue-700">
                          When you upload compliance certificates, our AI automatically extracts key data including 
                          expiry dates, outcomes, contractor details, and any defects that need attention. This 
                          creates remedial actions automatically for issues found.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="dashboard" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" />
                        Dashboard
                      </CardTitle>
                      <CardDescription>Your compliance overview at a glance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="stats">
                          <AccordionTrigger>Compliance Statistics</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>The dashboard displays key metrics:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Total Properties</strong> - Number of properties in your portfolio</li>
                              <li><strong>Compliance Rate</strong> - Percentage of properties with valid certificates</li>
                              <li><strong>Expiring Soon</strong> - Certificates due within 30 days</li>
                              <li><strong>Overdue</strong> - Properties with expired certificates</li>
                              <li><strong>Open Actions</strong> - Remedial work awaiting completion</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="charts">
                          <AccordionTrigger>Charts and Trends</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Visual representations of your compliance data:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Compliance by Stream</strong> - See which areas need attention</li>
                              <li><strong>Monthly Trends</strong> - Track improvements over time</li>
                              <li><strong>Action Status</strong> - Monitor remedial work progress</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="alerts">
                          <AccordionTrigger>Alerts and Notifications</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Stay informed about critical items:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Red alerts</strong> - Overdue certificates requiring immediate attention</li>
                              <li><strong>Amber alerts</strong> - Certificates expiring within 30 days</li>
                              <li><strong>Blue notices</strong> - Pending reviews and approvals</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="properties" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Property Management
                      </CardTitle>
                      <CardDescription>Managing your property portfolio</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="view">
                          <AccordionTrigger>Viewing Properties</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>The Properties page shows all residential units:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Search</strong> - Find by address, postcode, or UPRN</li>
                              <li><strong>Filter by Scheme</strong> - View properties within a specific estate</li>
                              <li><strong>Filter by Block</strong> - Narrow down to a building</li>
                              <li><strong>Filter by Status</strong> - See compliant, non-compliant, or pending review</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="add">
                          <AccordionTrigger>Adding Properties</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>To add a new property:</p>
                            <ol className="list-decimal ml-6 space-y-1">
                              <li>Click the <strong>"Add Property"</strong> button</li>
                              <li>Select the Scheme (estate) and Block (building)</li>
                              <li>Enter the address details and postcode</li>
                              <li>Set property type, bedrooms, and tenure</li>
                              <li>Click <strong>"Create Property"</strong></li>
                            </ol>
                            <p className="mt-2">Properties can also be imported in bulk via CSV from the Admin section.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="edit">
                          <AccordionTrigger>Editing Location Data</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>For Risk Maps to work, properties need coordinates:</p>
                            <ol className="list-decimal ml-6 space-y-1">
                              <li>Properties are automatically geocoded from their postcode</li>
                              <li>If automatic geocoding fails, click the <strong>edit icon</strong> on a property</li>
                              <li>Enter the latitude and longitude manually</li>
                              <li>Tip: Find coordinates on Google Maps by right-clicking on the location</li>
                            </ol>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="review">
                          <AccordionTrigger>Bulk Actions and Review</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>When properties are created via AI extraction, they need review:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>Select multiple properties using checkboxes</li>
                              <li><strong>Approve</strong> - Mark as verified and accurate</li>
                              <li><strong>Reject</strong> - Remove incorrect properties</li>
                              <li><strong>Delete</strong> - Permanently remove selected properties</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="certificates" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Certificate Management
                      </CardTitle>
                      <CardDescription>Uploading and managing compliance documents</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="upload">
                          <AccordionTrigger>Uploading Certificates</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>To upload a new certificate:</p>
                            <ol className="list-decimal ml-6 space-y-1">
                              <li>Go to <strong>Certificates → Upload</strong></li>
                              <li>Select the certificate type (Gas Safety, EICR, etc.)</li>
                              <li>Choose the property the certificate relates to</li>
                              <li>Upload the PDF or image file</li>
                              <li>Our AI will automatically extract the data</li>
                            </ol>
                            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded">
                              <p className="text-amber-800 text-xs">
                                <strong>Tip:</strong> For best results, upload clear scans or photos. 
                                The AI works best with standard certificate formats.
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="types">
                          <AccordionTrigger>Certificate Types</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Supported certificate types:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Gas Safety (CP12/LGSR)</strong> - Annual requirement, 12 months validity</li>
                              <li><strong>EICR</strong> - Electrical installation report, typically 5 years</li>
                              <li><strong>EPC</strong> - Energy Performance Certificate, 10 years validity</li>
                              <li><strong>Fire Risk Assessment</strong> - Review frequency varies by building type</li>
                              <li><strong>Asbestos Survey</strong> - Management or refurbishment surveys</li>
                              <li><strong>Legionella Risk Assessment</strong> - Water hygiene checks</li>
                              <li><strong>Lift Inspection</strong> - LOLER compliance certificates</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="extraction">
                          <AccordionTrigger>AI Data Extraction</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>When a certificate is uploaded, the AI extracts:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Property address</strong> - Matched to your portfolio</li>
                              <li><strong>Inspection date</strong> and <strong>expiry date</strong></li>
                              <li><strong>Outcome</strong> - Pass, Fail, Satisfactory, etc.</li>
                              <li><strong>Contractor details</strong> - Company and engineer information</li>
                              <li><strong>Defects/Issues</strong> - Classification codes and descriptions</li>
                            </ul>
                            <p className="mt-2">
                              Any defects found automatically create remedial actions with appropriate severity levels.
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="review-cert">
                          <AccordionTrigger>Review and Approval</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>After AI extraction, certificates may need human review:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>Check the <strong>Model Insights</strong> page for confidence scores</li>
                              <li>Low confidence extractions are flagged for review</li>
                              <li>Use <strong>Human Review</strong> to approve or correct data</li>
                              <li>Approved certificates update the property's compliance status</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="actions" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-primary" />
                        Remedial Actions
                      </CardTitle>
                      <CardDescription>Managing defects and required work</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="auto">
                          <AccordionTrigger>Automatic Action Creation</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Remedial actions are created automatically when:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>AI extraction finds defects in a certificate</li>
                              <li>A certificate outcome is unsatisfactory</li>
                              <li>Classification codes indicate required work (C1, C2, C3 for electrical)</li>
                            </ul>
                            <p className="mt-2">
                              Severity levels and cost estimates are configured in Factory Settings based on 
                              industry standards.
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="severity">
                          <AccordionTrigger>Severity Levels</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Actions are categorised by urgency:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><Badge variant="destructive">Critical</Badge> - Immediate danger, 24-hour response</li>
                              <li><Badge className="bg-red-500">High</Badge> - Serious risk, complete within 7 days</li>
                              <li><Badge className="bg-amber-500">Medium</Badge> - Moderate risk, complete within 28 days</li>
                              <li><Badge className="bg-blue-500">Low</Badge> - Advisory, schedule at next service</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="manage">
                          <AccordionTrigger>Managing Actions</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>From the Actions page you can:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Filter</strong> - By severity, property, or compliance stream</li>
                              <li><strong>Assign</strong> - Allocate work to contractors</li>
                              <li><strong>Update Status</strong> - Mark as in progress or complete</li>
                              <li><strong>Add Notes</strong> - Record updates and completion details</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="maps" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Map className="h-5 w-5 text-primary" />
                        Risk Maps
                      </CardTitle>
                      <CardDescription>Geographic visualisation of compliance risk</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="overview-map">
                          <AccordionTrigger>Map Overview</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>The Risk Maps show your properties on an interactive map:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Colour coding</strong> - Red (high risk), Amber (medium), Green (low)</li>
                              <li><strong>Click markers</strong> - View property details and certificates</li>
                              <li><strong>Summary cards</strong> - Quick stats on risk distribution</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="geocoding">
                          <AccordionTrigger>Geocoding Properties</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>For properties to appear on the map, they need coordinates:</p>
                            <ol className="list-decimal ml-6 space-y-1">
                              <li><strong>Automatic</strong> - Click "Geocode Properties" to convert UK postcodes</li>
                              <li><strong>Manual</strong> - Edit individual properties to set lat/lng</li>
                              <li><strong>CSV Import</strong> - Bulk upload coordinates from a spreadsheet</li>
                            </ol>
                            <p className="mt-2">
                              The status banner shows how many properties still need geocoding.
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="heatmap">
                          <AccordionTrigger>Risk Heatmap</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>The heatmap view aggregates risk by area:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>See concentrations of high-risk properties</li>
                              <li>Filter by compliance stream (gas, electrical, fire)</li>
                              <li>Identify geographic patterns in compliance issues</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="evidence">
                          <AccordionTrigger>Evidence View</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Click on any map area to see detailed evidence:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>List of properties in that area</li>
                              <li>Certificate status for each property</li>
                              <li>Outstanding remedial actions</li>
                              <li>Drill down to individual documents</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>

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
                            <p>Manage system users and their roles:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Admin</strong> - Full access to all features</li>
                              <li><strong>Manager</strong> - View and edit properties, certificates</li>
                              <li><strong>Viewer</strong> - Read-only access to reports</li>
                              <li><strong>Contractor</strong> - Limited access to assigned work</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="hierarchy">
                          <AccordionTrigger>Asset Hierarchy</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Configure your organisation structure:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>Create and manage <strong>Schemes</strong> (estates/sites)</li>
                              <li>Add <strong>Blocks</strong> (buildings) within schemes</li>
                              <li>Properties are then added to blocks</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="imports">
                          <AccordionTrigger>Data Import</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Bulk import data from spreadsheets:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Properties</strong> - Import from CSV with address, postcode</li>
                              <li><strong>Components</strong> - Boilers, alarms, lifts with serial numbers</li>
                              <li><strong>Geocoding</strong> - Bulk upload coordinates</li>
                            </ul>
                            <p className="mt-2">Download sample templates to see the required format.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="factory">
                          <AccordionTrigger>Factory Settings</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Advanced configuration (Super Admin only):</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li><strong>Extraction Settings</strong> - AI confidence thresholds</li>
                              <li><strong>Remedial Action Rules</strong> - Severity levels and cost estimates</li>
                              <li><strong>API Rate Limits</strong> - External integration controls</li>
                              <li><strong>Classification Codes</strong> - EICR, Gas Safety code mappings</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="api">
                          <AccordionTrigger>API Integration</AccordionTrigger>
                          <AccordionContent className="space-y-2 text-sm">
                            <p>Connect external systems via REST API:</p>
                            <ul className="list-disc ml-6 space-y-1">
                              <li>Generate API keys for secure access</li>
                              <li>Submit certificates programmatically</li>
                              <li>Receive webhook notifications</li>
                              <li>Documentation includes code examples</li>
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
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <HelpCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Need more help?</h4>
                      <p className="text-sm text-muted-foreground">
                        Contact support at support@lashandigital.com or use the in-app chat for assistance.
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
