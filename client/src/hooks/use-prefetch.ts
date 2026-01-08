import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchCertificates = useCallback((propertyId: string) => {
    queryClient.prefetchQuery({
      queryKey: [`/api/certificates?propertyId=${propertyId}`],
      staleTime: 30 * 1000,
    });
  }, [queryClient]);

  const prefetchProperty = useCallback((propertyId: string) => {
    queryClient.prefetchQuery({
      queryKey: [`/api/properties/${propertyId}`],
      staleTime: 30 * 1000,
    });
  }, [queryClient]);

  const prefetchRemedialActions = useCallback((propertyId: string) => {
    queryClient.prefetchQuery({
      queryKey: [`/api/remedial-actions?propertyId=${propertyId}`],
      staleTime: 30 * 1000,
    });
  }, [queryClient]);

  const prefetchOnHover = useCallback((prefetchFn: () => void) => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    return {
      onMouseEnter: () => {
        timeoutId = setTimeout(prefetchFn, 100);
      },
      onMouseLeave: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      },
    };
  }, []);

  return {
    prefetchCertificates,
    prefetchProperty,
    prefetchRemedialActions,
    prefetchOnHover,
  };
}
