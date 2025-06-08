import { useGameStore } from '@/store/gameStore';

export const DiffusionModeSelector = () => {
  const { diffusionMode, setDiffusionMode } = useGameStore();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="diffusionMode" style={{width: '85px'}} className="text-sm font-medium text-gray-700">
        擴散方式:
      </label>
      <select 
        value={diffusionMode}
        onChange={(e) => setDiffusionMode(e.target.value as 'natural' | 'combined')}
        className="w-full p-2 border rounded bg-white"
      >
        <option value="natural">純自然擴散</option>
        <option value="combined">自然擴散 + 風向影響</option>
      </select>
    </div>
  );
}; 