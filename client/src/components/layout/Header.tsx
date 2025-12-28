import { Bell, Search, Settings, Command, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Header({ title }: { title: string }) {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{title}</h1>
      </div>
      
      <div className="flex items-center gap-3 flex-1 justify-end max-w-2xl">
        <div className="relative w-full max-w-sm hidden md:block group" role="search">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" aria-hidden="true"></div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="global-search" className="sr-only">Search the application</label>
            <Input 
              id="global-search"
              type="search" 
              placeholder="Search..." 
              aria-label="Search the application"
              className="pl-10 pr-12 bg-muted/50 border-transparent hover:bg-muted focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl h-10"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground" aria-hidden="true">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 w-10"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-full ring-2 ring-background animate-pulse" aria-hidden="true"></span>
          <span className="sr-only">You have new notifications</span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 w-10"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-10 w-10"
          aria-label="Keyboard shortcuts help"
          data-testid="button-keyboard-help"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
          }}
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </Button>
        
        <div className="flex items-center gap-3 pl-3 ml-1 border-l border-border/50">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">Sarah Jenkins</p>
            <p className="text-xs text-muted-foreground">Compliance Manager</p>
          </div>
          <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold">SJ</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
