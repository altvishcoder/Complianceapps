import { ChevronRight, Home, ArrowLeft } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  homeHref?: string;
  showHome?: boolean;
}

export function Breadcrumb({ items, homeHref = "/dashboard", showHome = true }: BreadcrumbProps) {
  const searchString = useSearch();
  
  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const from = params.get('from');
    return from ? decodeURIComponent(from) : null;
  }, [searchString]);

  const contextLabel = useMemo(() => {
    if (!returnUrl) return null;
    if (returnUrl.startsWith('/calendar')) return "Calendar";
    if (returnUrl.startsWith('/properties/')) return "Property";
    if (returnUrl.startsWith('/properties')) return "Properties";
    if (returnUrl.startsWith('/certificates/')) return "Certificate";
    if (returnUrl.startsWith('/certificates')) return "Certificates";
    return null;
  }, [returnUrl]);

  const allItems = useMemo(() => {
    const result: BreadcrumbItem[] = [];
    
    if (showHome) {
      result.push({ label: "Home", href: homeHref, icon: <Home className="h-4 w-4" /> });
    }
    
    return [...result, ...items];
  }, [showHome, homeHref, items]);

  if (allItems.length === 0) return null;

  return (
    <div className="flex items-center gap-3" data-testid="breadcrumb-container">
      {returnUrl && contextLabel && (
        <Link href={returnUrl}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-muted-foreground hover:text-foreground"
            data-testid="breadcrumb-back-button"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Back to </span>
            {contextLabel}
          </Button>
        </Link>
      )}
      
      <nav 
        aria-label="Breadcrumb navigation" 
        className="flex items-center text-sm text-muted-foreground"
        data-testid="breadcrumb-nav"
      >
        <ol className="flex items-center gap-1" role="list">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            const isClickable = !isLast && item.href;
            
            return (
              <li key={index} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                )}
                {isClickable ? (
                  <Link 
                    href={item.href!}
                    className="flex items-center gap-1 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-1"
                    data-testid={`breadcrumb-link-${index}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <span 
                    className="flex items-center gap-1 text-foreground font-medium"
                    aria-current={isLast ? "page" : undefined}
                    data-testid={`breadcrumb-current-${index}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

export function useBreadcrumbContext() {
  const searchString = useSearch();
  
  return useMemo(() => {
    const params = new URLSearchParams(searchString);
    const from = params.get('from');
    const returnUrl = from ? decodeURIComponent(from) : null;
    
    return {
      returnUrl,
      isFromCalendar: returnUrl?.startsWith('/calendar') || false,
      isFromProperty: returnUrl?.startsWith('/properties') || false,
      isFromCertificates: returnUrl?.startsWith('/certificates') || false,
      buildContextUrl: (targetPath: string) => {
        if (!returnUrl) return targetPath;
        return `${targetPath}?from=${encodeURIComponent(returnUrl)}`;
      }
    };
  }, [searchString]);
}
