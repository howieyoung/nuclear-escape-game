'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import GameControls from '@/components/GameControls';
import GameResults from '@/components/GameResults';
import GameSetup from '@/components/GameSetup';
import { useGameStore } from '@/store/gameStore';

// Dynamically import GameMap to avoid SSR issues with Leaflet
const GameMap = dynamic(() => import('@/components/GameMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

export default function Home() {
  const { isSimulationRunning, timeRemaining } = useGameStore();

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
      <h1 className="text-4xl font-bold text-center mb-8">Nuclear Crisis Simulator</h1>
        <h3 className="font-bold text-center mb-8">If a Nuclear Disaster Strikes… Where Can You Still Breathe?</h3>
        
        {/* Game Setup */}
        {!isSimulationRunning && timeRemaining === 300 && (
          <div className="mb-8">
            <GameSetup />
          </div>
        )}

        {/* Game Map */}
        <div className="flex-1 mb-8">
          <GameMap />
        </div>

        {/* Game Controls */}
        <div className="mb-8">
          <GameControls />
        </div>

        {/* Game Results */}
        {timeRemaining === 0 && <GameResults />}
      </div>
    </main>
  );
} 