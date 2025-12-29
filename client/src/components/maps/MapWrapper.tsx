import { useState, useEffect, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface MapWrapperProps {
  children: ReactNode;
  className?: string;
  loadingText?: string;
}

export function MapWrapper({ children, className = '', loadingText = 'Loading map...' }: MapWrapperProps) {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
      const timer = setTimeout(() => setIsLoading(false), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isClient || isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-muted/30 ${className}`} data-testid="map-loading">
        <div className="text-center space-y-4">
          <Skeleton className="w-full h-full absolute inset-0" />
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{loadingText}</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default MapWrapper;
