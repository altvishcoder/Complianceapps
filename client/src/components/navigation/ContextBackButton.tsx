import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ContextBackButtonProps {
  fallbackPath?: string;
  fallbackLabel?: string;
  className?: string;
}

export function ContextBackButton({ 
  fallbackPath = "/dashboard", 
  fallbackLabel = "Dashboard",
  className = ""
}: ContextBackButtonProps) {
  const [, setLocation] = useLocation();
  
  const params = new URLSearchParams(window.location.search);
  const fromPath = params.get('from');
  
  const pathLabels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/compliance': 'Compliance Overview',
    '/certificates': 'Certificates',
    '/properties': 'Properties',
    '/actions': 'Remedial Actions',
    '/maps': 'Maps',
    '/maps/risk-heatmap': 'Risk Map',
  };
  
  const targetPath = fromPath || fallbackPath;
  const label = pathLabels[targetPath] || fallbackLabel;
  
  const handleBack = () => {
    if (fromPath) {
      setLocation(fromPath);
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(fallbackPath);
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={`gap-2 text-muted-foreground hover:text-foreground ${className}`}
      aria-label={`Go back to ${label}`}
      data-testid="button-back"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>Back to {label}</span>
    </Button>
  );
}
