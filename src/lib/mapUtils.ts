import L from 'leaflet';
import { CountyData } from '@/types/map';

export async function loadTaiwanCounties(
  map: L.Map,
  onCountyAffected: (countyName: string) => void
) {
  try {
    const response = await fetch('/data/taiwan_counties.geojson');
    const data = await response.json();

    L.geoJSON(data, {
      style: (feature) => ({
        fillColor: feature?.properties?.color || '#4CAF50',
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7,
      }),
      onEachFeature: (feature, layer) => {
        layer.on('mouseover', (e) => {
          const layer = e.target;
          layer.setStyle({
            fillOpacity: 0.9,
            weight: 3,
          });
        });

        layer.on('mouseout', (e) => {
          const layer = e.target;
          layer.setStyle({
            fillOpacity: 0.7,
            weight: 2,
          });
        });

        layer.on('click', () => {
          if (feature.properties) {
            onCountyAffected(feature.properties.name);
          }
        });
      },
    }).addTo(map);
  } catch (error) {
    console.error('Error loading Taiwan counties data:', error);
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateArrivalTime(
  distance: number,
  speed: number,
  windDirection: string
): number {
  // Simple calculation based on distance and speed
  // In a real simulation, this would be more complex and consider wind direction
  return (distance / speed) * 3600; // Convert to seconds
} 