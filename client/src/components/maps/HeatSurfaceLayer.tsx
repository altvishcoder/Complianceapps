import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export interface HeatPoint {
  lat: number;
  lng: number;
  riskScore: number;
  count: number;
}

interface HeatSurfaceLayerProps {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
  minOpacity?: number;
}

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number]>,
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: { [key: number]: string };
    }
  ): L.Layer;
}

export function HeatSurfaceLayer({
  points,
  radius = 35,
  blur = 25,
  maxZoom = 18,
  minOpacity = 0.4
}: HeatSurfaceLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map || points.length === 0) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const heatData: Array<[number, number, number]> = points.map(p => {
      const riskWeight = (100 - p.riskScore) / 100;
      const countWeight = Math.log10(p.count + 1) + 0.5;
      const intensity = riskWeight * countWeight;
      return [p.lat, p.lng, intensity];
    });

    const gradient = {
      0.0: '#22c55e',
      0.3: '#84cc16',
      0.5: '#eab308',
      0.7: '#f97316',
      1.0: '#ef4444'
    };

    const layer = L.heatLayer(heatData, {
      radius,
      blur,
      maxZoom,
      minOpacity,
      gradient,
      max: Math.max(...heatData.map(d => d[2])) || 1
    });

    layer.addTo(map);
    heatLayerRef.current = layer;

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, radius, blur, maxZoom, minOpacity]);

  return null;
}
