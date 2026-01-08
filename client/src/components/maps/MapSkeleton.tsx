import { Skeleton } from '@/components/ui/skeleton';

interface MapSkeletonProps {
  className?: string;
}

export function MapSkeleton({ className = '' }: MapSkeletonProps) {
  return (
    <div className={`w-full h-full relative bg-muted/50 overflow-hidden ${className}`} data-testid="map-skeleton">
      <Skeleton className="absolute inset-0 rounded-none" />
      
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[20%] left-[15%] w-[30%] h-[25%] bg-muted-foreground/10 rounded-lg" />
        <div className="absolute top-[10%] right-[20%] w-[25%] h-[20%] bg-muted-foreground/10 rounded-lg" />
        <div className="absolute bottom-[25%] left-[25%] w-[40%] h-[30%] bg-muted-foreground/10 rounded-lg" />
        <div className="absolute bottom-[15%] right-[10%] w-[20%] h-[15%] bg-muted-foreground/10 rounded-lg" />
      </div>
      
      <div className="absolute bottom-4 left-4 space-y-2 z-10">
        <Skeleton className="h-4 w-24 bg-muted-foreground/20" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-3 rounded-full bg-red-400/30" />
          <Skeleton className="h-3 w-14 bg-muted-foreground/20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-3 w-3 rounded-full bg-amber-400/30" />
          <Skeleton className="h-3 w-14 bg-muted-foreground/20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-3 w-3 rounded-full bg-green-400/30" />
          <Skeleton className="h-3 w-14 bg-muted-foreground/20" />
        </div>
      </div>
      
      <div className="absolute top-4 right-4 space-y-1 z-10">
        <Skeleton className="h-8 w-8 bg-muted-foreground/20" />
        <Skeleton className="h-8 w-8 bg-muted-foreground/20" />
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <Skeleton className="h-3 w-32 bg-muted-foreground/20" />
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm">
          <span className="text-sm text-muted-foreground font-medium animate-pulse">Loading map data...</span>
        </div>
      </div>
    </div>
  );
}

export default MapSkeleton;
