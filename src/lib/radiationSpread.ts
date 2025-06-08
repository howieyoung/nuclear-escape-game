// Constants for the Gaussian plume model
const A = 0.2;  // Diffusion coefficient
const B = 0.4;  // Time exponent
const Q = 5.0;  // Source strength for more visible effect

// Scale factor to convert lat/lng to meters (approximate for Taiwan)
const LAT_TO_METERS = 111000; // 1 degree of latitude ≈ 111km
const LNG_TO_METERS = 111000 * Math.cos(23.5 * Math.PI / 180); // Adjust for Taiwan's latitude

interface Point {
  lat: number;
  lng: number;
}

interface WindConditions {
  speed: number;    // m/s
  direction: number; // degrees
}

export function calculateRadiationConcentration(
  point: Point,
  center: Point,
  windConditions: WindConditions,
  timeSeconds: number
): number {
  // Convert wind direction to radians
  const theta = (windConditions.direction * Math.PI) / 180;
  
  // Convert lat/lng to meters from center
  const x = (point.lng - center.lng) * LNG_TO_METERS;
  const y = (point.lat - center.lat) * LAT_TO_METERS;

  // Rotate coordinates to align with wind direction
  const xPrime = x * Math.cos(theta) + y * Math.sin(theta);
  const yPrime = -x * Math.sin(theta) + y * Math.cos(theta);

  // Calculate diffusion width (in meters)
  const sigma = A * Math.pow(timeSeconds, B) * 1000; // Scale up for visibility

  // Calculate concentration using Gaussian plume model
  const concentration = (Q / (2 * Math.PI * windConditions.speed * sigma * sigma)) *
    Math.exp(-Math.pow(yPrime, 2) / (2 * sigma * sigma)) *
    Math.exp(-Math.pow(xPrime - windConditions.speed * timeSeconds * 1000, 2) / (2 * sigma * sigma));

  return concentration;
}

export function calculateRadiationRadius(
  windSpeed: number,
  timeSeconds: number
): number {
  // Calculate the radius in meters
  const sigma = A * Math.pow(timeSeconds, B) * 1000;
  const radiusMeters = windSpeed * timeSeconds * 1000 + 3 * sigma;
  
  // Convert back to degrees for map display
  return radiusMeters / LAT_TO_METERS;
}

export function getRadiationColor(concentration: number): string {
  // Convert concentration to a color (red scale)
  const intensity = Math.min(concentration * 1000, 1); // Increased multiplier for more visible colors
  const r = Math.floor(255 * intensity);
  const g = Math.floor(255 * (1 - intensity));
  const b = Math.floor(255 * (1 - intensity));
  return `rgb(${r}, ${g}, ${b})`;
} 