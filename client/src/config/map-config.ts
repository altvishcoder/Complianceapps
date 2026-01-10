export const MAP_CONFIG = {
  markers: {
    iconUrl: '/assets/leaflet/marker-icon.png',
    iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
    shadowUrl: '/assets/leaflet/marker-shadow.png',
  },
  tiles: {
    light: {
      url: import.meta.env.VITE_TILE_SOURCE_LIGHT || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
      url: import.meta.env.VITE_TILE_SOURCE_DARK || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  defaults: {
    center: [54.5, -2] as [number, number],
    zoom: 6,
  },
};

export type MapTileTheme = 'light' | 'dark';

export function getTileConfig(theme: MapTileTheme) {
  return MAP_CONFIG.tiles[theme];
}

export function getMarkerConfig() {
  return MAP_CONFIG.markers;
}
