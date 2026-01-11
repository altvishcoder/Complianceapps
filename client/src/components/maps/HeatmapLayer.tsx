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
  if (score <= 30) return '#22c55e';
  if (score <= 50) return '#84cc16';
  if (score <= 70) return '#eab308';
  if (score <= 85) return '#f97316';
  return '#ef4444';
}

function getRiskOpacity(score: number, count: number, maxCount: number): number {
  const countFactor = Math.min(1, count / Math.max(maxCount * 0.3, 1));
  const riskFactor = (100 - score) / 100;
  return 0.3 + (countFactor * 0.4) + (riskFactor * 0.2);
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

      const cellOpacity = getRiskOpacity(cell.avgRisk, cell.count, maxCount) * opacity;
      
      const rect = L.rectangle(bounds, {
        color: getRiskColor(cell.avgRisk),
        weight: 0,
        fillColor: getRiskColor(cell.avgRisk),
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
