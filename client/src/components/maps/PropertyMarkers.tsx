import React, { useEffect, useMemo, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getIcon } from '@/config/icons';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const ExternalLink = getIcon('ExternalLink');

export type AssetType = 'scheme' | 'block' | 'property';

export interface PropertyMarker {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  riskScore: number;
  propertyCount?: number;
  unitCount?: number;
  assetType?: AssetType;
}

interface PropertyMarkersProps {
  properties: PropertyMarker[];
  onPropertyClick?: (property: PropertyMarker) => void;
}

function RiskMarker({ 
  property, 
  icon, 
  onPropertyClick, 
  children 
}: { 
  property: PropertyMarker; 
  icon: L.DivIcon; 
  onPropertyClick?: (property: PropertyMarker) => void;
  children: React.ReactNode;
}) {
  const markerRef = useRef<L.Marker>(null);
  
  useEffect(() => {
    if (markerRef.current) {
      (markerRef.current as any).options.riskScore = property.riskScore;
    }
  }, [property.riskScore]);
  
  return (
    <Marker
      ref={markerRef}
      position={[property.lat, property.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onPropertyClick?.(property),
      }}
    >
      {children}
    </Marker>
  );
}

export function getRiskColor(score: number): string {
  if (score < 60) return '#EF4444';
  if (score < 85) return '#F59E0B';
  return '#10B981';
}

export function getRiskLabel(score: number): { label: string; variant: 'destructive' | 'warning' | 'success' } {
  if (score < 60) return { label: 'High Risk', variant: 'destructive' };
  if (score < 85) return { label: 'Medium Risk', variant: 'warning' };
  return { label: 'Low Risk', variant: 'success' };
}

export function getAssetTypeLabel(type?: AssetType): string {
  switch (type) {
    case 'scheme': return 'Scheme/Estate';
    case 'block': return 'Block';
    case 'property': return 'Property';
    default: return 'Property';
  }
}

function createCustomIcon(color: string, assetType?: AssetType): L.DivIcon {
  let shape = '';
  let size = 32;
  
  switch (assetType) {
    case 'scheme':
      shape = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 22,20 2,20" fill="${color}" stroke="white" stroke-width="2"/>
      </svg>`;
      break;
    case 'block':
      shape = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" fill="${color}" stroke="white" stroke-width="2"/>
      </svg>`;
      break;
    case 'property':
    default:
      shape = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="houseGrad-${color.replace('#', '')}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0.8" />
          </linearGradient>
        </defs>
        <path d="M12 2L2 9V22H9V15H15V22H22V9L12 2Z" fill="url(#houseGrad-${color.replace('#', '')})" stroke="white" stroke-width="1.5"/>
        <rect x="10" y="11" width="4" height="4" fill="white" opacity="0.9"/>
      </svg>`;
      break;
  }
  
  return L.divIcon({
    html: shape,
    className: 'custom-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function createClusterCustomIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  const childMarkers = cluster.getAllChildMarkers();
  
  let totalRisk = 0;
  let validCount = 0;
  
  childMarkers.forEach((marker: any) => {
    const riskScore = marker.options?.riskScore;
    if (typeof riskScore === 'number' && !isNaN(riskScore)) {
      totalRisk += riskScore;
      validCount++;
    }
  });
  
  const avgRisk = validCount > 0 ? totalRisk / validCount : 75;
  const color = getRiskColor(avgRisk);
  
  let sizeClass = 'small';
  let size = 40;
  if (count >= 100) {
    sizeClass = 'large';
    size = 50;
  } else if (count >= 10) {
    sizeClass = 'medium';
    size = 45;
  }
  
  return L.divIcon({
    html: `<div style="
      background-color: ${color}; 
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: white; 
      font-weight: bold;
      font-size: ${count >= 1000 ? '11px' : count >= 100 ? '12px' : '14px'};
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    ">${count >= 1000 ? (count/1000).toFixed(1) + 'k' : count}</div>`,
    className: `marker-cluster marker-cluster-${sizeClass}`,
    iconSize: L.point(size, size),
  });
}

function MapBoundsUpdater({ properties }: { properties: PropertyMarker[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (properties.length > 0) {
      const validProps = properties.filter(p => 
        p.lat && p.lng && 
        !isNaN(p.lat) && !isNaN(p.lng) &&
        p.lat >= -90 && p.lat <= 90 &&
        p.lng >= -180 && p.lng <= 180
      );
      
      if (validProps.length > 0) {
        const bounds = L.latLngBounds(
          validProps.map(p => [p.lat, p.lng] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [properties.length > 0]);
  
  return null;
}

export function PropertyMarkers({ properties, onPropertyClick }: PropertyMarkersProps) {
  const validProperties = useMemo(() => 
    properties.filter(p => 
      p.lat && p.lng && 
      !isNaN(p.lat) && !isNaN(p.lng) &&
      p.lat >= -90 && p.lat <= 90 &&
      p.lng >= -180 && p.lng <= 180
    ), [properties]);

  if (validProperties.length === 0) {
    return null;
  }

  return (
    <>
      <MapBoundsUpdater properties={validProperties} />
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={80}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        disableClusteringAtZoom={16}
        iconCreateFunction={createClusterCustomIcon}
      >
        {validProperties.map((property) => {
          const color = getRiskColor(property.riskScore);
          const { label, variant } = getRiskLabel(property.riskScore);
          const icon = createCustomIcon(color, property.assetType);
          
          return (
            <RiskMarker
              key={property.id}
              property={property}
              icon={icon}
              onPropertyClick={onPropertyClick}
            >
              <Popup>
                <div className="min-w-[200px] p-2 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {getAssetTypeLabel(property.assetType)}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm">{property.name}</h3>
                    {property.address && (
                      <p className="text-xs text-muted-foreground mt-1">{property.address}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Risk Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold" style={{ color }}>
                        {property.riskScore}%
                      </span>
                      <Badge 
                        variant={variant === 'warning' ? 'secondary' : variant === 'success' ? 'default' : 'destructive'}
                        className={`text-xs ${variant === 'success' ? 'bg-green-100 text-green-800' : variant === 'warning' ? 'bg-amber-100 text-amber-800' : ''}`}
                      >
                        {label}
                      </Badge>
                    </div>
                  </div>
                  
                  {(property.propertyCount || property.unitCount) && (
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {property.propertyCount && (
                        <span>{property.propertyCount} properties</span>
                      )}
                      {property.unitCount && (
                        <span>{property.unitCount} units</span>
                      )}
                    </div>
                  )}
                  
                  {property.id.startsWith('prop-') ? (
                    <div className="text-xs text-muted-foreground text-center py-1 bg-muted rounded">
                      Sample data - connect real properties to enable details
                    </div>
                  ) : (
                    <Link href={`/properties/${property.id}`}>
                      <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-property-${property.id}`}>
                        <ExternalLink className="h-3 w-3 mr-2" />
                        View Details
                      </Button>
                    </Link>
                  )}
                </div>
              </Popup>
            </RiskMarker>
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}

export default PropertyMarkers;
