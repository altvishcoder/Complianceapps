import { CircleMarker, Popup } from 'react-leaflet';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export interface PropertyMarker {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  riskScore: number;
  propertyCount?: number;
  unitCount?: number;
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

export function PropertyMarkers({ properties, onPropertyClick }: PropertyMarkersProps) {
  return (
    <>
      {properties.map((property) => {
        const color = getRiskColor(property.riskScore);
        const { label, variant } = getRiskLabel(property.riskScore);
        
        return (
          <CircleMarker
            key={property.id}
            center={[property.lat, property.lng]}
            radius={8}
            pathOptions={{
              color: 'white',
              weight: 2,
              fillColor: color,
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              click: () => onPropertyClick?.(property),
              mouseover: (e) => {
                e.target.setRadius(12);
              },
              mouseout: (e) => {
                e.target.setRadius(8);
              },
            }}
            data-testid={`marker-property-${property.id}`}
          >
            <Popup>
              <div className="min-w-[200px] p-2 space-y-3">
                <div>
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
          </CircleMarker>
        );
      })}
    </>
  );
}

export default PropertyMarkers;
