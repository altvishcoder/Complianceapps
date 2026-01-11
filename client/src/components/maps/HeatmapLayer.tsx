import { useMemo } from 'react';
import { CircleMarker } from 'react-leaflet';

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface HeatmapLayerProps {
  points: HeatmapPoint[];
  radius?: number;
  blur?: number;
  maxIntensity?: number;
}

function getRiskColor(score: number): string {
  if (score <= 20) return '#22c55e';
  if (score <= 40) return '#84cc16';
  if (score <= 60) return '#eab308';
  if (score <= 80) return '#f97316';
  return '#ef4444';
}

export function HeatmapLayer({ 
  points, 
  radius = 12,
}: HeatmapLayerProps) {
  const validPoints = useMemo(() => 
    points.filter(p => 
      typeof p.lat === 'number' && !isNaN(p.lat) && 
      typeof p.lng === 'number' && !isNaN(p.lng)
    ),
    [points]
  );

  if (validPoints.length === 0) return null;

  return (
    <>
      {validPoints.map((point, index) => (
        <CircleMarker
          key={`heat-${index}-${point.lat}-${point.lng}`}
          center={[point.lat, point.lng]}
          radius={radius}
          pathOptions={{
            fillColor: getRiskColor(point.intensity),
            fillOpacity: 0.6,
            color: getRiskColor(point.intensity),
            weight: 0,
          }}
        />
      ))}
    </>
  );
}
