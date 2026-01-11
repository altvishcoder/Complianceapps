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

function getDynamicRiskColor(score: number, minRisk: number, maxRisk: number): string {
  const range = maxRisk - minRisk;
  const normalized = range > 0.1 ? (score - minRisk) / range : 0.5;
  const hue = 120 - (normalized * 120);
  return `hsl(${hue}, 70%, 50%)`;
}

function getRiskOpacity(score: number, count: number, maxCount: number, minRisk: number, maxRisk: number): number {
  const countFactor = Math.min(1, count / Math.max(maxCount * 0.3, 1));
  const range = maxRisk - minRisk;
  const normalizedRisk = range > 0.1 ? (score - minRisk) / range : 0.5;
  return 0.4 + (countFactor * 0.35) + (normalizedRisk * 0.2);
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
    const minRisk = Math.min(...cells.map(c => c.avgRisk));
    const maxRisk = Math.max(...cells.map(c => c.avgRisk));
    const layerGroup = L.layerGroup();

    cells.forEach(cell => {
      const halfLat = cellSize.latStep / 2;
      const halfLng = cellSize.lngStep / 2;
      
      const bounds: L.LatLngBoundsExpression = [
        [cell.lat - halfLat, cell.lng - halfLng],
        [cell.lat + halfLat, cell.lng + halfLng]
      ];

      const color = getDynamicRiskColor(cell.avgRisk, minRisk, maxRisk);
      const cellOpacity = getRiskOpacity(cell.avgRisk, cell.count, maxCount, minRisk, maxRisk) * opacity;
      
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
