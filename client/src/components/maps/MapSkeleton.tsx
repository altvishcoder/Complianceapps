import { Skeleton } from '@/components/ui/skeleton';

interface MapSkeletonProps {
  className?: string;
}

export function MapSkeleton({ className = '' }: MapSkeletonProps) {
  return (
    <div className={`w-full h-full relative bg-muted/30 ${className}`} data-testid="map-skeleton">
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-medium">Loading map...</span>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="absolute top-4 right-4 space-y-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

export default MapSkeleton;
