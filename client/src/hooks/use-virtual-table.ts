import { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface UseVirtualTableOptions<T> {
  data: T[];
  estimateSize?: number;
  overscan?: number;
}

export function useVirtualTable<T>({ 
  data, 
  estimateSize = 60, 
  overscan = 5 
}: UseVirtualTableOptions<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const getItemProps = useCallback((index: number) => ({
    style: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: `${virtualItems[index]?.size || estimateSize}px`,
      transform: `translateY(${virtualItems[index]?.start || 0}px)`,
    },
  }), [virtualItems, estimateSize]);

  return {
    parentRef,
    virtualizer,
    virtualItems,
    totalSize,
    getItemProps,
    scrollToIndex: virtualizer.scrollToIndex,
    measureElement: virtualizer.measureElement,
  };
}

export function useInfiniteVirtualTable<T>({ 
  data, 
  estimateSize = 60, 
  overscan = 5,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: UseVirtualTableOptions<T> & {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: hasNextPage ? data.length + 1 : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const lastItem = virtualItems[virtualItems.length - 1];
  const isNearEnd = lastItem && lastItem.index >= data.length - 1;
  
  // Use useEffect to trigger fetch when near end (proper side effect handling)
  useEffect(() => {
    if (isNearEnd && hasNextPage && !isFetchingNextPage && fetchNextPage && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchNextPage();
      const timeout = setTimeout(() => { fetchedRef.current = false; }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isNearEnd, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    parentRef,
    virtualizer,
    virtualItems,
    totalSize,
    isLoading: isFetchingNextPage,
  };
}
