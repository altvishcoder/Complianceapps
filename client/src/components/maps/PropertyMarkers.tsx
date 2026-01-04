import { CircleMarker, Marker, Popup } from 'react-leaflet';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import L from 'leaflet';

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
  let size = 24;
  
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
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
      </svg>`;
      break;
  }
  
  return L.divIcon({
    html: shape,
    className: 'custom-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function PropertyMarkers({ properties, onPropertyClick }: PropertyMarkersProps) {
  return (
    <>
      {properties.map((property) => {
        const color = getRiskColor(property.riskScore);
        const { label, variant } = getRiskLabel(property.riskScore);
        const icon = createCustomIcon(color, property.assetType);
        
        return (
          <Marker
            key={property.id}
            position={[property.lat, property.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onPropertyClick?.(property),
            }}
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
          </Marker>
        );
      })}
    </>
  );
}

export default PropertyMarkers;
