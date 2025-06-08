export interface CountyData {
  type: string;
  properties: {
    name: string;
    population: number;
    density: string;
    evacuation_difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    color?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

export interface CountyInfo {
  name: string;
  population: number;
  density: string;
  evacuationDifficulty: string;
  timeToArrival: number;
  isAffected: boolean;
}

export interface MapState {
  center: [number, number];
  zoom: number;
  selectedCounty: string | null;
  affectedCounties: Set<string>;
} 