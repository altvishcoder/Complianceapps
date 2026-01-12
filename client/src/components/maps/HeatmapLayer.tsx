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
  onCellClick?: (cell: HeatmapCell) => void;
}

function getRiskColor(score: number): string {
  const hue = Math.max(0, Math.min(120, (score / 100) * 120));
  return `hsl(${hue}, 75%, 45%)`;
}

function getBorderColor(score: number): string {
  const hue = Math.max(0, Math.min(120, (score / 100) * 120));
  return `hsl(${hue}, 85%, 30%)`;
}

function getRiskOpacity(count: number, maxCount: number): number {
  const countFactor = Math.min(1, count / Math.max(maxCount * 0.3, 1));
  return 0.5 + (countFactor * 0.4);
}

export function HeatmapLayer({ 
  cells, 
  cellSize,
  opacity = 0.7,
  onCellClick
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

      const fillColor = getRiskColor(cell.avgRisk);
      const borderColor = getBorderColor(cell.avgRisk);
      const cellOpacity = getRiskOpacity(cell.count, maxCount) * opacity;
      
      const rect = L.rectangle(bounds, {
        color: borderColor,
        weight: 2,
        fillColor: fillColor,
        fillOpacity: cellOpacity,
        interactive: true
      });

      rect.bindTooltip(
        `<div class="text-xs p-1">
          <div class="font-semibold text-sm">Risk Score: ${cell.avgRisk.toFixed(0)}%</div>
          <div class="text-muted-foreground mt-1">${cell.count.toLocaleString()} properties</div>
          <div class="text-muted-foreground text-[10px] mt-1">Click to drill down</div>
        </div>`,
        { direction: 'top', className: 'leaflet-tooltip-custom' }
      );

      if (onCellClick) {
        rect.on('click', () => onCellClick(cell));
      }

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
  }, [map, cells, cellSize, opacity, onCellClick]);

  return null;
}
