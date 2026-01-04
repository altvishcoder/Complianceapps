import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, Mail, Building, Lock, AlertTriangle, Bell, Clock, 
  Calendar, Eye, Palette, Globe, Save, Loader2, CheckCircle2,
  FileText, Users, Settings
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminSetup() {
  useEffect(() => {
    document.title = "System Settings - ComplianceAI";
  }, []);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    organisationName: "",
    adminEmail: "",
    defaultExpiryWarningDays: 30,
    criticalExpiryWarningDays: 7,
    sessionTimeoutMinutes: 480,
    autoLogoutEnabled: true,
    emailNotificationsEnabled: true,
    dailyDigestEnabled: true,
    weeklyReportEnabled: true,
    expiryAlertsEnabled: true,
    defaultDateFormat: "DD/MM/YYYY",
    defaultTimezone: "Europe/London",
    showRiskScores: true,
    compactViewDefault: false,
    requireMfaForAdmins: true,
    passwordExpiryDays: 90,
    maxLoginAttempts: 5,
  });

  const userRole = user?.role || "";
  const isAuthorized = userRole === "super_admin" || userRole === "SUPER_ADMIN" || 
                       userRole === "LASHAN_SUPER_USER" || userRole === "SYSTEM_ADMIN";

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast({ 
        title: "Settings Saved", 
        description: "Your system settings have been updated successfully.",
      });
    } catch {
      toast({ 
        title: "Error", 
        description: "Failed to save settings. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <div className="text-center">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Please log in to access this page</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex h-screen bg-muted/30 items-center justify-center">
        <Card className="max-w-md w-full border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2 text-destructive">
               <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view System Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="bg-destructive/5 border border-destructive/20 p-3 rounded text-sm text-destructive/80 flex gap-2 items-start">
               <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
               <p>This area is restricted to Administrator accounts only.</p>
             </div>
             <Button className="w-full" variant="outline" onClick={() => setLocation("/dashboard")}>
               Return to Dashboard
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="System Settings" />
        <main id="main-content" className="flex-1 overflow-y-auto p-6 space-y-6" role="main" aria-label="System settings content">
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-display" data-testid="text-settings-title">System Settings</h2>
                <p className="text-muted-foreground">Configure system-wide settings for your organisation.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/users">
                  <Button variant="outline">
                    <Users className="mr-2 h-4 w-4" />
                    User Management
                  </Button>
                </Link>
                <Button onClick={handleSaveSettings} disabled={isSaving} data-testid="button-save-all-settings">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save All Settings
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Tabs defaultValue="organisation" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="organisation" data-testid="tab-organisation">
                  <Building className="h-4 w-4 mr-2" />
                  Organisation
                </TabsTrigger>
                <TabsTrigger value="compliance" data-testid="tab-compliance">
                  <FileText className="h-4 w-4 mr-2" />
                  Compliance
                </TabsTrigger>
                <TabsTrigger value="notifications" data-testid="tab-notifications">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="security" data-testid="tab-security">
                  <Shield className="h-4 w-4 mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>

              <TabsContent value="organisation" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Organisation Details
                    </CardTitle>
                    <CardDescription>Basic information about your organisation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="org-name">Organisation Name</Label>
                        <Input 
                          id="org-name"
                          value={settings.organisationName}
                          onChange={(e) => setSettings({ ...settings, organisationName: e.target.value })}
                          placeholder="Enter your organisation name"
                          data-testid="input-org-name"
                        />
                        <p className="text-xs text-muted-foreground">This will appear in reports and exports.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Primary Admin Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="admin-email"
                            type="email"
                            value={settings.adminEmail}
                            onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                            placeholder="admin@example.co.uk"
                            className="pl-9"
                            data-testid="input-admin-email"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">System notifications will be sent here.</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Date Format</Label>
                        <Select 
                          value={settings.defaultDateFormat} 
                          onValueChange={(value) => setSettings({ ...settings, defaultDateFormat: value })}
                        >
                          <SelectTrigger data-testid="select-date-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (UK)</SelectItem>
                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select 
                          value={settings.defaultTimezone}
                          onValueChange={(value) => setSettings({ ...settings, defaultTimezone: value })}
                        >
                          <SelectTrigger data-testid="select-timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                            <SelectItem value="Europe/Dublin">Europe/Dublin</SelectItem>
                            <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Display Preferences
                    </CardTitle>
                    <CardDescription>Customise how information is displayed across the platform.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Show Risk Scores</Label>
                        <p className="text-sm text-muted-foreground">Display risk scores on property cards and lists.</p>
                      </div>
                      <Switch 
                        checked={settings.showRiskScores}
                        onCheckedChange={(checked) => setSettings({ ...settings, showRiskScores: checked })}
                        data-testid="switch-show-risk-scores"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Compact View by Default</Label>
                        <p className="text-sm text-muted-foreground">Use condensed tables and cards for data-dense views.</p>
                      </div>
                      <Switch 
                        checked={settings.compactViewDefault}
                        onCheckedChange={(checked) => setSettings({ ...settings, compactViewDefault: checked })}
                        data-testid="switch-compact-view"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compliance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Certificate Expiry Alerts
                    </CardTitle>
                    <CardDescription>Configure when users receive alerts about expiring certificates.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="warning-days">Standard Warning (days before expiry)</Label>
                        <Input 
                          id="warning-days"
                          type="number"
                          min={1}
                          max={365}
                          value={settings.defaultExpiryWarningDays}
                          onChange={(e) => setSettings({ ...settings, defaultExpiryWarningDays: parseInt(e.target.value) || 30 })}
                          data-testid="input-warning-days"
                        />
                        <p className="text-xs text-muted-foreground">Certificates expiring within this period will show as "Due Soon".</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="critical-days">Critical Warning (days before expiry)</Label>
                        <Input 
                          id="critical-days"
                          type="number"
                          min={1}
                          max={30}
                          value={settings.criticalExpiryWarningDays}
                          onChange={(e) => setSettings({ ...settings, criticalExpiryWarningDays: parseInt(e.target.value) || 7 })}
                          data-testid="input-critical-days"
                        />
                        <p className="text-xs text-muted-foreground">Certificates expiring within this period will show as "Critical".</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Compliance Defaults
                    </CardTitle>
                    <CardDescription>Default settings for compliance workflows.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Compliance streams, certificate types, and classification codes are managed in the{" "}
                        <Link href="/admin/configuration" className="text-primary hover:underline">Configuration</Link> section.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Email Notifications
                    </CardTitle>
                    <CardDescription>Control which email notifications are sent to users.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Master switch for all email notifications.</p>
                      </div>
                      <Switch 
                        checked={settings.emailNotificationsEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, emailNotificationsEnabled: checked })}
                        data-testid="switch-email-notifications"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Daily Digest</Label>
                        <p className="text-sm text-muted-foreground">Send a daily summary of compliance status and pending actions.</p>
                      </div>
                      <Switch 
                        checked={settings.dailyDigestEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, dailyDigestEnabled: checked })}
                        disabled={!settings.emailNotificationsEnabled}
                        data-testid="switch-daily-digest"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Weekly Report</Label>
                        <p className="text-sm text-muted-foreground">Send a weekly compliance report to managers.</p>
                      </div>
                      <Switch 
                        checked={settings.weeklyReportEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, weeklyReportEnabled: checked })}
                        disabled={!settings.emailNotificationsEnabled}
                        data-testid="switch-weekly-report"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Expiry Alerts</Label>
                        <p className="text-sm text-muted-foreground">Send immediate alerts when certificates are about to expire.</p>
                      </div>
                      <Switch 
                        checked={settings.expiryAlertsEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, expiryAlertsEnabled: checked })}
                        disabled={!settings.emailNotificationsEnabled}
                        data-testid="switch-expiry-alerts"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Session Settings
                    </CardTitle>
                    <CardDescription>Configure session timeout and auto-logout behaviour.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                        <Input 
                          id="session-timeout"
                          type="number"
                          min={15}
                          max={1440}
                          value={settings.sessionTimeoutMinutes}
                          onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) || 480 })}
                          data-testid="input-session-timeout"
                        />
                        <p className="text-xs text-muted-foreground">Users will be logged out after this period of inactivity.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-attempts">Max Login Attempts</Label>
                        <Input 
                          id="max-attempts"
                          type="number"
                          min={3}
                          max={10}
                          value={settings.maxLoginAttempts}
                          onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 5 })}
                          data-testid="input-max-attempts"
                        />
                        <p className="text-xs text-muted-foreground">Account locks after this many failed attempts.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-Logout on Inactivity</Label>
                        <p className="text-sm text-muted-foreground">Automatically log out inactive sessions.</p>
                      </div>
                      <Switch 
                        checked={settings.autoLogoutEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, autoLogoutEnabled: checked })}
                        data-testid="switch-auto-logout"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Authentication Settings
                    </CardTitle>
                    <CardDescription>Configure authentication and password policies.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Require MFA for Administrators</Label>
                        <p className="text-sm text-muted-foreground">Administrators must use multi-factor authentication.</p>
                      </div>
                      <Switch 
                        checked={settings.requireMfaForAdmins}
                        onCheckedChange={(checked) => setSettings({ ...settings, requireMfaForAdmins: checked })}
                        data-testid="switch-require-mfa"
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                      <Input 
                        id="password-expiry"
                        type="number"
                        min={30}
                        max={365}
                        value={settings.passwordExpiryDays}
                        onChange={(e) => setSettings({ ...settings, passwordExpiryDays: parseInt(e.target.value) || 90 })}
                        className="max-w-[200px]"
                        data-testid="input-password-expiry"
                      />
                      <p className="text-xs text-muted-foreground">Users will be prompted to change their password after this period.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

        </main>
      </div>
    </div>
  );
}
