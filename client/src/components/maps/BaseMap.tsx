import { useEffect } from 'react';
import { MapContainer, TileLayer, ZoomControl, ScaleControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MAP_CONFIG, getTileConfig } from '@/config/map-config';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: MAP_CONFIG.markers.iconRetinaUrl,
  iconUrl: MAP_CONFIG.markers.iconUrl,
  shadowUrl: MAP_CONFIG.markers.shadowUrl,
});

interface BaseMapProps {
  center?: [number, number];
  zoom?: number;
  children?: React.ReactNode;
  className?: string;
  onMapReady?: (map: L.Map) => void;
  darkMode?: boolean;
}

function MapReadyHandler({ onMapReady }: { onMapReady?: (map: L.Map) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return null;
}

export function BaseMap({
  center = MAP_CONFIG.defaults.center,
  zoom = MAP_CONFIG.defaults.zoom,
  children,
  className = '',
  onMapReady,
  darkMode = false,
}: BaseMapProps) {
  const tileConfig = getTileConfig(darkMode ? 'dark' : 'light');

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`w-full h-full ${className}`}
      zoomControl={false}
      scrollWheelZoom={true}
      data-testid="base-map"
    >
      <TileLayer
        attribution={tileConfig.attribution}
        url={tileConfig.url}
      />
      <ZoomControl position="topright" />
      <ScaleControl position="bottomleft" metric={true} imperial={false} />
      <MapReadyHandler onMapReady={onMapReady} />
      {children}
    </MapContainer>
  );
}

export default BaseMap;
