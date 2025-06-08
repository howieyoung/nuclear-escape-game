export const TAIWAN_CENTER: [number, number] = [23.5, 121]; // Taiwan's approximate center
export const TAIWAN_ZOOM = 7;

export const WIND_DIRECTIONS = [
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
  'N',
] as const;

export const SPEED_RANGE = {
  MIN: 1,
  MAX: 100,
  DEFAULT: 50,
} as const;

export const SIMULATION_CONFIG = {
  MAX_TIME: 48 * 3600, // 48 hours in seconds
  UPDATE_INTERVAL: 1000, // 1 second
  RADIATION_CLOUD_COLOR: '#ff0000',
  RADIATION_CLOUD_OPACITY: 0.2,
} as const; 