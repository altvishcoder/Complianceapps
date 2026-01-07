import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === 0 ? "w-32" : i === columns - 1 ? "w-20" : "w-24")} />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

function CardSkeleton({ hasHeader = true, contentHeight = 200 }: { hasHeader?: boolean; contentHeight?: number }) {
  return (
    <div className="rounded-lg border bg-card animate-pulse">
      {hasHeader && (
        <div className="p-6 border-b">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}
      <div className="p-6">
        <Skeleton className={`w-full`} style={{ height: contentHeight }} />
      </div>
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b animate-pulse">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

function PageSkeleton({ 
  showStats = true, 
  statsCount = 4,
  showTable = true,
  tableRows = 8,
  tableColumns = 5 
}: { 
  showStats?: boolean;
  statsCount?: number;
  showTable?: boolean;
  tableRows?: number;
  tableColumns?: number;
}) {
  const gridCols = statsCount <= 4 
    ? "grid-cols-2 md:grid-cols-4" 
    : statsCount === 5 
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" 
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";

  return (
    <div className="space-y-6">
      {showStats && (
        <div className={`grid ${gridCols} gap-3`}>
          {Array.from({ length: statsCount }).map((_, i) => (
            <div key={i} className="rounded-lg p-4 border border-muted bg-muted/30 h-[120px] animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      )}
      
      {showTable && <TableSkeleton rows={tableRows} columns={tableColumns} />}
    </div>
  );
}

function TreeSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2" style={{ paddingLeft: `${(i % 3) * 24 + 8}px` }}>
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4" style={{ width: `${120 - (i % 3) * 20}px` }} />
        </div>
      ))}
    </div>
  );
}

export { 
  Skeleton, 
  TableRowSkeleton, 
  TableSkeleton, 
  CardSkeleton, 
  ListItemSkeleton, 
  PageSkeleton,
  TreeSkeleton
}
