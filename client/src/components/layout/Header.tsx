import { Bell, Settings, HelpCircle, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLocation } from "wouter";
import { useState } from "react";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  
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
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="hidden sm:flex text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-9 w-9 md:h-10 md:w-10"
          aria-label="Settings"
          data-testid="button-settings"
          onClick={() => navigate('/admin/setup')}
        >
          <Settings className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
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
