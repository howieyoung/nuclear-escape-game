import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { NUCLEAR_PLANTS, NuclearPlant } from '@/lib/nuclearPlants';

export default function GameSetup() {
  const { setPlantLocation, setUserLocation } = useGameStore();
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [userLocation, setUserLocationState] = useState<[number, number] | null>(null);

  const handlePlantSelect = (plantId: string) => {
    const plant = NUCLEAR_PLANTS.find(p => p.id === plantId);
    if (plant) {
      setSelectedPlant(plantId);
      setPlantLocation(plant.location);
    }
  };

  const handleUserLocationSelect = (location: [number, number]) => {
    setUserLocationState(location);
    setUserLocation(location);
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Game Setup</h2>
      
      {/* Nuclear Plant Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Select Nuclear Power Plant</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NUCLEAR_PLANTS.map((plant) => (
            <button
              key={plant.id}
              onClick={() => handlePlantSelect(plant.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedPlant === plant.id
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <h4 className="font-semibold text-gray-800">{plant.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{plant.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* User Location Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Your Location</h3>
        <p className="text-gray-600 mb-4">
          Click on the map to set your current location. This will help calculate the radiation spread
          and evacuation time to your position.
        </p>
        {userLocation && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              Selected location: {userLocation[0].toFixed(4)}°N, {userLocation[1].toFixed(4)}°E
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 