import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Header({ title }: { title: string }) {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-background border-b border-border/40 sticky top-0 z-10 backdrop-blur-sm bg-background/80">
      <h1 className="text-xl font-display font-semibold text-foreground">{title}</h1>
      
      <div className="flex items-center space-x-4 flex-1 justify-end max-w-2xl">
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search properties, certificates, or UPRN..." 
            className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all rounded-full h-9"
          />
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full border-2 border-background"></span>
        </Button>
        
        <div className="flex items-center gap-3 pl-2 border-l border-border/40">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">Sarah Jenkins</p>
            <p className="text-xs text-muted-foreground">Compliance Manager</p>
          </div>
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>SJ</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
