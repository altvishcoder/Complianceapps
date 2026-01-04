import { Bell, Settings, HelpCircle, Search, Sparkles, Building, Mail, Calendar, Shield, Clock, Palette, Bell as BellIcon, Save, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const mockNotifications = [
  { id: 1, title: "Gas Safety Certificate Expiring", message: "Property 45 High Street certificate expires in 7 days", time: "2 hours ago", read: false },
  { id: 2, title: "EICR Inspection Complete", message: "Block A inspection completed successfully", time: "5 hours ago", read: false },
  { id: 3, title: "Remedial Action Overdue", message: "C2 defect at 12 Oak Lane requires attention", time: "1 day ago", read: true },
];

function formatRole(role: string): string {
  const roleDisplayNames: Record<string, string> = {
    'LASHAN_SUPER_USER': 'Super User',
    'SUPER_ADMIN': 'Super Admin',
    'SYSTEM_ADMIN': 'System Admin',
    'COMPLIANCE_MANAGER': 'Compliance Manager',
    'ADMIN': 'Administrator',
    'MANAGER': 'Manager',
    'OFFICER': 'Compliance Officer',
    'VIEWER': 'Viewer'
  };
  return roleDisplayNames[role] || role;
}

export function Header({ title }: { title: string }) {
  const [, navigate] = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
    organisationName: "",
    adminEmail: "",
    defaultExpiryWarningDays: 30,
    criticalExpiryWarningDays: 7,
    sessionTimeoutMinutes: 480,
    autoLogoutEnabled: true,
    emailNotificationsEnabled: true,
    dailyDigestEnabled: true,
    expiryAlertsEnabled: true,
    defaultDateFormat: "DD/MM/YYYY",
    defaultTimezone: "Europe/London",
    showRiskScores: true,
    compactViewDefault: false,
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast({ 
        title: "Settings Saved", 
        description: "Your settings have been updated.",
      });
      setSettingsOpen(false);
    } catch {
      toast({ 
        title: "Error", 
        description: "Failed to save settings.", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <header className="h-20 flex items-center justify-between px-3 md:px-6 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
      <div className="flex items-center gap-2 md:gap-4 pl-12 md:pl-0">
        <h1 className="text-lg md:text-2xl font-display font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate max-w-[180px] md:max-w-none">{title}</h1>
      </div>
      
      <div className="flex items-center gap-1 md:gap-3 flex-1 justify-end max-w-2xl">
        <div className="hidden sm:block">
          <GlobalSearch />
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="sm:hidden text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-9 w-9"
          aria-label="Search"
          data-testid="button-mobile-search"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-global-search'));
          }}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
        
        <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-9 w-9 md:h-10 md:w-10"
              aria-label="Notifications"
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
              <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 h-2 w-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-full ring-2 ring-background animate-pulse" aria-hidden="true"></span>
              <span className="sr-only">You have new notifications</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:w-[400px] md:w-[540px]">
            <SheetHeader>
              <SheetTitle>Notifications</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {mockNotifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 rounded-lg border ${notification.read ? 'bg-muted/50' : 'bg-primary/5 border-primary/20'}`}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    {!notification.read && (
                      <span className="h-2 w-2 bg-primary rounded-full" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden sm:flex text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-9 w-9 md:h-10 md:w-10"
              aria-label="Settings"
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:w-[450px] md:w-[540px] p-0">
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Settings
              </SheetTitle>
              <SheetDescription>Configure system preferences for your organisation.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="p-6">
                <Tabs defaultValue="general" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                    <TabsTrigger value="notifications" className="text-xs">Alerts</TabsTrigger>
                    <TabsTrigger value="display" className="text-xs">Display</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="org-name" className="text-sm">Organisation Name</Label>
                        <Input 
                          id="org-name"
                          value={settings.organisationName}
                          onChange={(e) => setSettings({ ...settings, organisationName: e.target.value })}
                          placeholder="Enter organisation name"
                          data-testid="input-settings-org-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email" className="text-sm">Admin Email</Label>
                        <Input 
                          id="admin-email"
                          type="email"
                          value={settings.adminEmail}
                          onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                          placeholder="admin@example.co.uk"
                          data-testid="input-settings-admin-email"
                        />
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm">Date Format</Label>
                          <Select 
                            value={settings.defaultDateFormat} 
                            onValueChange={(value) => setSettings({ ...settings, defaultDateFormat: value })}
                          >
                            <SelectTrigger data-testid="select-settings-date-format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Timezone</Label>
                          <Select 
                            value={settings.defaultTimezone}
                            onValueChange={(value) => setSettings({ ...settings, defaultTimezone: value })}
                          >
                            <SelectTrigger data-testid="select-settings-timezone">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Europe/London">London (GMT)</SelectItem>
                              <SelectItem value="Europe/Dublin">Dublin</SelectItem>
                              <SelectItem value="UTC">UTC</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-sm">Session Timeout (minutes)</Label>
                        <Input 
                          type="number"
                          min={15}
                          max={1440}
                          value={settings.sessionTimeoutMinutes}
                          onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) || 480 })}
                          data-testid="input-settings-session-timeout"
                        />
                        <p className="text-xs text-muted-foreground">Auto-logout after inactivity.</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="notifications" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Email Notifications</Label>
                          <p className="text-xs text-muted-foreground">Enable email alerts</p>
                        </div>
                        <Switch 
                          checked={settings.emailNotificationsEnabled}
                          onCheckedChange={(checked) => setSettings({ ...settings, emailNotificationsEnabled: checked })}
                          data-testid="switch-settings-email"
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Daily Digest</Label>
                          <p className="text-xs text-muted-foreground">Daily compliance summary</p>
                        </div>
                        <Switch 
                          checked={settings.dailyDigestEnabled}
                          onCheckedChange={(checked) => setSettings({ ...settings, dailyDigestEnabled: checked })}
                          disabled={!settings.emailNotificationsEnabled}
                          data-testid="switch-settings-digest"
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Expiry Alerts</Label>
                          <p className="text-xs text-muted-foreground">Certificate expiry warnings</p>
                        </div>
                        <Switch 
                          checked={settings.expiryAlertsEnabled}
                          onCheckedChange={(checked) => setSettings({ ...settings, expiryAlertsEnabled: checked })}
                          disabled={!settings.emailNotificationsEnabled}
                          data-testid="switch-settings-expiry"
                        />
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm">Warning Days</Label>
                          <Input 
                            type="number"
                            min={1}
                            max={365}
                            value={settings.defaultExpiryWarningDays}
                            onChange={(e) => setSettings({ ...settings, defaultExpiryWarningDays: parseInt(e.target.value) || 30 })}
                            data-testid="input-settings-warning-days"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Critical Days</Label>
                          <Input 
                            type="number"
                            min={1}
                            max={30}
                            value={settings.criticalExpiryWarningDays}
                            onChange={(e) => setSettings({ ...settings, criticalExpiryWarningDays: parseInt(e.target.value) || 7 })}
                            data-testid="input-settings-critical-days"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="display" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Show Risk Scores</Label>
                          <p className="text-xs text-muted-foreground">Display on property cards</p>
                        </div>
                        <Switch 
                          checked={settings.showRiskScores}
                          onCheckedChange={(checked) => setSettings({ ...settings, showRiskScores: checked })}
                          data-testid="switch-settings-risk-scores"
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Compact View</Label>
                          <p className="text-xs text-muted-foreground">Condensed tables by default</p>
                        </div>
                        <Switch 
                          checked={settings.compactViewDefault}
                          onCheckedChange={(checked) => setSettings({ ...settings, compactViewDefault: checked })}
                          data-testid="switch-settings-compact"
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Auto-Logout</Label>
                          <p className="text-xs text-muted-foreground">Log out inactive sessions</p>
                        </div>
                        <Switch 
                          checked={settings.autoLogoutEnabled}
                          onCheckedChange={(checked) => setSettings({ ...settings, autoLogoutEnabled: checked })}
                          data-testid="switch-settings-auto-logout"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full" data-testid="button-save-settings">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="hidden sm:flex text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-9 w-9 md:h-10 md:w-10"
          aria-label="Start guided tour"
          data-testid="button-start-tour"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('start-guided-tour'));
          }}
        >
          <Sparkles className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="hidden md:flex text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 w-10"
          aria-label="Keyboard shortcuts help"
          data-testid="button-keyboard-help"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
          }}
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </Button>
        
        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-3 ml-1 border-l border-border/50">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-foreground">{user?.name || "Guest User"}</p>
            <p className="text-xs text-muted-foreground">{formatRole(user?.role || "VIEWER")}</p>
          </div>
          <Avatar className="h-8 w-8 md:h-9 md:w-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold text-xs md:text-sm">
              {(user?.name || "GU").split(" ").map(n => n.charAt(0)).join("").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
