import { create } from 'zustand';
import { SIMULATION_CONFIG } from '@/lib/constants';

export interface GameState {
  isSimulationRunning: boolean;
  timeRemaining: number;
  windDirection: number;
  windSpeed: number;    // m/s
  simulationTime: number; // minutes
  affectedCounties: Set<string>;
  plantLocation: [number, number] | null;
  userLocation: [number, number] | null;
  isUserSafe: boolean;
  isUserInDanger: boolean;
  dangerLevel: 'safe' | 'warning' | 'danger';
  lastUpdate: number;
  diffusionMode: 'natural' | 'combined';
  spreadSpeed: number;
  startSimulation: () => void;
  pauseSimulation: () => void;
  updateWindDirection: (direction: number) => void;
  updateSpreadSpeed: (speed: number) => void;
  addAffectedCounty: (county: string) => void;
  setPlantLocation: (location: [number, number] | null) => void;
  setUserLocation: (location: [number, number] | null) => void;
  updateTimeRemaining: (time: number) => void;
  decrementTime: () => void;
  resetGame: () => void;
  setWindDirection: (direction: number) => void;
  setWindSpeed: (speed: number) => void;
  setSpreadSpeed: (speed: number) => void;
  updateSimulation: () => void;
  setSimulationTime: (minutes: number) => void;
  setDiffusionMode: (mode: 'natural' | 'combined') => void;
}

const INITIAL_STATE: Omit<GameState, keyof {
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetGame: () => void;
  setPlantLocation: (location: [number, number] | null) => void;
  setUserLocation: (location: [number, number] | null) => void;
  setWindDirection: (direction: number) => void;
  setWindSpeed: (speed: number) => void;
  setSpreadSpeed: (speed: number) => void;
  updateSimulation: () => void;
  setSimulationTime: (minutes: number) => void;
  setDiffusionMode: (mode: 'natural' | 'combined') => void;
  updateWindDirection: (direction: number) => void;
  updateSpreadSpeed: (speed: number) => void;
  addAffectedCounty: (county: string) => void;
  updateTimeRemaining: (time: number) => void;
  decrementTime: () => void;
}> = {
  isSimulationRunning: false,
  timeRemaining: SIMULATION_CONFIG.MAX_TIME,
  windDirection: 0,
  windSpeed: 5, // Default to 5 m/s
  simulationTime: 60, // Default to 1 hour
  affectedCounties: new Set<string>(),
  plantLocation: null,
  userLocation: null,
  isUserSafe: true,
  isUserInDanger: false,
  dangerLevel: 'safe',
  lastUpdate: Date.now(),
  diffusionMode: 'combined', // Default to combined mode
  spreadSpeed: 0,
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_STATE,

  startSimulation: () => set((state) => ({
    ...state,
    isSimulationRunning: true,
    lastUpdate: Date.now(),
  })),

  pauseSimulation: () => set((state) => ({
    ...state,
    isSimulationRunning: false,
  })),

  resetGame: () => {
    set((state) => ({
      ...state,
      isSimulationRunning: false,
      plantLocation: null,
      userLocation: null,
      simulationTime: 60,
      isUserSafe: true,
      isUserInDanger: false,
      dangerLevel: 'safe',
      lastUpdate: Date.now(),
      diffusionMode: 'combined',
      spreadSpeed: 0,
    }));
  },

  setPlantLocation: (location) => set((state) => ({
    ...state,
    plantLocation: location,
  })),

  setUserLocation: (location) => set((state) => ({
    ...state,
    userLocation: location,
  })),

  setWindDirection: (direction) => set((state) => ({
    ...state,
    windDirection: direction,
  })),

  setWindSpeed: (speed) => set((state) => ({
    ...state,
    windSpeed: speed,
  })),

  setSpreadSpeed: (speed) => set((state) => ({
    ...state,
    spreadSpeed: speed,
  })),

  updateSimulation: () => set((state) => {
    if (!state.isSimulationRunning) return state;

    const now = Date.now();
    const deltaTime = (now - state.lastUpdate) / 1000; // Convert to seconds
    const deltaMinutes = deltaTime / 60;

    return {
      ...state,
      simulationTime: state.simulationTime + deltaMinutes,
      lastUpdate: now,
    };
  }),

  updateWindDirection: (direction) => set({ windDirection: direction }),

  updateSpreadSpeed: (speed) => set({ spreadSpeed: speed }),

  addAffectedCounty: (county) =>
    set((state) => ({
      ...state,
      affectedCounties: new Set([...Array.from(state.affectedCounties), county]),
    })),

  updateTimeRemaining: (time) => set((state) => ({
    ...state,
    timeRemaining: time,
  })),

  decrementTime: () => set((state) => ({
    ...state,
    timeRemaining: Math.max(0, state.timeRemaining - 1),
  })),

  setSimulationTime: (minutes) => set((state) => ({
    ...state,
    simulationTime: minutes,
  })),

  setDiffusionMode: (mode) => set((state) => ({
    ...state,
    diffusionMode: mode,
  })),
})); 