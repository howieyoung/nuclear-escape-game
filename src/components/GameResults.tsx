'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

export default function GameResults() {
  const { affectedCounties, plantLocation, userLocation, resetGame } = useGameStore();

  const handleRetry = () => {
    resetGame();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Simulation Results
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-3">Affected Areas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Array.from(affectedCounties).map((county) => (
                <div
                  key={county}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm"
                >
                  {county}
                </div>
              ))}
            </div>
          </div>

          {userLocation && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Your Location</h3>
              <p className="text-gray-700">
                Latitude: {userLocation[0].toFixed(4)}°N, Longitude: {userLocation[1].toFixed(4)}°E
              </p>
            </div>
          )}

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-3 text-yellow-800">
              Key Takeaways
            </h3>
            <ul className="list-disc list-inside space-y-2 text-yellow-700">
              <li>
                When a nuclear disaster strikes, time is life. Taiwan's dense
                population and limited area make our response time exceptionally
                precious.
              </li>
              <li>
                When considering nuclear safety, we must look beyond efficiency
                and assess whether we have adequate capabilities to handle the
                worst-case scenario.
              </li>
              <li>
                Emergency preparedness and evacuation planning are crucial for
                densely populated areas.
              </li>
            </ul>
          </div>

          <div className="text-center">
            <button
              onClick={handleRetry}
              className="btn btn-primary text-lg px-8 py-3"
            >
              Try Another Scenario
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 