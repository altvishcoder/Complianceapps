import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export interface HeatmapCell {
  lat: number;
  lng: number;
  avgRisk: number;
  count: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface HeatmapLayerProps {
  cells: HeatmapCell[];
  cellSize: { latStep: number; lngStep: number };
  opacity?: number;
}

function getRiskColor(score: number): string {
  const hue = Math.max(0, Math.min(120, (score / 100) * 120));
  return `hsl(${hue}, 75%, 45%)`;
}

function getRiskOpacity(count: number, maxCount: number): number {
  const countFactor = Math.min(1, count / Math.max(maxCount * 0.3, 1));
  return 0.5 + (countFactor * 0.4);
}

export function HeatmapLayer({ 
  cells, 
  cellSize,
  opacity = 0.7
}: HeatmapLayerProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    if (cells.length === 0 || cellSize.latStep === 0 || cellSize.lngStep === 0) return;

    const maxCount = Math.max(...cells.map(c => c.count));
    const layerGroup = L.layerGroup();

    cells.forEach(cell => {
      const halfLat = cellSize.latStep / 2;
      const halfLng = cellSize.lngStep / 2;
      
      const bounds: L.LatLngBoundsExpression = [
        [cell.lat - halfLat, cell.lng - halfLng],
        [cell.lat + halfLat, cell.lng + halfLng]
      ];

      const color = getRiskColor(cell.avgRisk);
      const cellOpacity = getRiskOpacity(cell.count, maxCount) * opacity;
      
      const rect = L.rectangle(bounds, {
        color: color,
        weight: 0,
        fillColor: color,
        fillOpacity: cellOpacity,
        interactive: true
      });

      rect.bindTooltip(
        `<div class="text-xs">
          <div class="font-medium">Risk: ${cell.avgRisk.toFixed(0)}%</div>
          <div class="text-muted-foreground">${cell.count} properties</div>
        </div>`,
        { direction: 'top', className: 'leaflet-tooltip-custom' }
      );

      layerGroup.addLayer(rect);
    });

    layerGroup.addTo(map);
    layerGroupRef.current = layerGroup;

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map, cells, cellSize, opacity]);

  return null;
}
