import { useEffect } from 'react';
import { MapContainer, TileLayer, ZoomControl, ScaleControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
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

const UK_CENTER: [number, number] = [54.5, -2];
const UK_ZOOM = 6;

const LIGHT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export function BaseMap({
  center = UK_CENTER,
  zoom = UK_ZOOM,
  children,
  className = '',
  onMapReady,
  darkMode = false,
}: BaseMapProps) {
  const tileUrl = darkMode ? DARK_TILES : LIGHT_TILES;
  const attribution = darkMode 
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
        attribution={attribution}
        url={tileUrl}
      />
      <ZoomControl position="topright" />
      <ScaleControl position="bottomleft" metric={true} imperial={false} />
      <MapReadyHandler onMapReady={onMapReady} />
      {children}
    </MapContainer>
  );
}

export default BaseMap;
