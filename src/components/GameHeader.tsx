import { motion } from 'framer-motion';

interface GameHeaderProps {
  isGameStarted: boolean;
  onStartGame: () => void;
}

export default function GameHeader({ isGameStarted, onStartGame }: GameHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Nuclear Crisis Simulation: Your Escape Window...?
      </h1>
      <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
        When a nuclear disaster strikes, time is life. Taiwan is densely populated with limited land. 
        How much time do you have to escape?
      </p>
      
      {!isGameStarted && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartGame}
          className="btn btn-primary text-lg px-8 py-3"
        >
          Start Simulation
        </motion.button>
      )}
    </motion.div>
  );
} 