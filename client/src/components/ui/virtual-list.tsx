import { useRef, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { getIcon } from '@/config/icons';

const Loader2 = getIcon('Loader2');

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  itemClassName?: string;
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 60,
  overscan = 5,
  className,
  itemClassName,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hasNextPage ? items.length + 1 : items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  
  if (virtualItems.length > 0 && hasNextPage && !isFetchingNextPage && onLoadMore) {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem && lastItem.index >= items.length - 1) {
      onLoadMore();
    }
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const isLoaderRow = virtualItem.index >= items.length;
          const item = items[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              className={cn(itemClassName)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
                </div>
              ) : (
                renderItem(item, virtualItem.index)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VirtualTableProps<T> {
  items: T[];
  columns: {
    key: string;
    header: ReactNode;
    width?: string;
    render: (item: T, index: number) => ReactNode;
  }[];
  rowHeight?: number;
  overscan?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  onRowHover?: (item: T, index: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function VirtualTable<T>({
  items,
  columns,
  rowHeight = 52,
  overscan = 10,
  className,
  onRowClick,
  onRowHover,
  isLoading,
  emptyMessage = "No items found",
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <div className="bg-muted/50 border-b">
        <div className="flex items-center px-4 py-3 text-sm font-medium text-muted-foreground">
          {columns.map((col) => (
            <div key={col.key} style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}>
              {col.header}
            </div>
          ))}
        </div>
      </div>
      
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: Math.min(items.length * rowHeight, 600), contain: 'strict' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                className={cn(
                  "flex items-center px-4 border-b hover:bg-muted/30 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={() => onRowClick?.(item, virtualItem.index)}
                onMouseEnter={() => onRowHover?.(item, virtualItem.index)}
              >
                {columns.map((col) => (
                  <div key={col.key} style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}>
                    {col.render(item, virtualItem.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
