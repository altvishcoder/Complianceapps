import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
    }
  ): L.Layer;
}

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

export function HeatmapLayer({ 
  points, 
  radius = 25, 
  blur = 15,
  maxIntensity = 100
}: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (points.length === 0) return;

    const heatData: Array<[number, number, number]> = points
      .filter(p => typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng))
      .map(p => {
        const normalizedIntensity = Math.max(0, Math.min(1, (100 - p.intensity) / 100));
        return [p.lat, p.lng, normalizedIntensity];
      });

    if (heatData.length === 0) return;

    const heatLayer = L.heatLayer(heatData, {
      radius,
      blur,
      maxZoom: 17,
      max: 1,
      minOpacity: 0.4,
      gradient: {
        0.0: '#22c55e',
        0.3: '#84cc16',
        0.5: '#eab308',
        0.7: '#f97316',
        0.85: '#ef4444',
        1.0: '#dc2626'
      }
    });

    heatLayer.addTo(map);
    layerRef.current = heatLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, radius, blur, maxIntensity]);

  return null;
}
