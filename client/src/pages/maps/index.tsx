import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function MapsIndexPage() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/maps/risk-heatmap');
  }, [setLocation]);
  
  return null;
}
