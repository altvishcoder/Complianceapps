import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useExtractionEvents() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'extraction_complete') {
          queryClient.invalidateQueries({ queryKey: ['properties'] });
          queryClient.invalidateQueries({ queryKey: ['certificates'] });
          queryClient.invalidateQueries({ queryKey: ['extraction-runs'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
        
        if (data.type === 'property_updated') {
          queryClient.invalidateQueries({ queryKey: ['properties'] });
        }
        
        if (data.type === 'certificate_updated') {
          queryClient.invalidateQueries({ queryKey: ['certificates'] });
        }
      } catch (e) {
        // Ignore parse errors (e.g., ping messages)
      }
    };
    
    eventSource.onerror = () => {
      // EventSource will automatically reconnect
    };
    
    return () => {
      eventSource.close();
    };
  }, [queryClient]);
}
