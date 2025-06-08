'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useGameStore } from '@/store/gameStore';
import { TAIWAN_CENTER, TAIWAN_ZOOM } from '@/lib/constants';
import { loadTaiwanCounties } from '@/lib/mapUtils';
import { calculateRadiationConcentration, calculateRadiationRadius, getRadiationColor } from '@/lib/radiationSpread';
import 'leaflet/dist/leaflet.css';
import { NUCLEAR_PLANTS } from '@/lib/nuclearPlants';

// Fix for default marker icons
const defaultIcon = L.icon({
  iconUrl: '/icons/nuclear-plant.svg',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
  className: 'nuclear-plant-icon'
});

const userLocationIcon = L.icon({
  iconUrl: '/icons/user-location.svg',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
  className: 'user-location-icon'
});

// 添加自定義樣式
const customIconStyle = `
  .nuclear-plant-icon {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    transition: transform 0.2s ease;
  }
  .nuclear-plant-icon:hover {
    transform: scale(1.1);
  }
  .user-location-icon {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    transition: transform 0.2s ease;
  }
  .user-location-icon:hover {
    transform: scale(1.1);
  }
`;

// 添加樣式到 head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = customIconStyle;
  document.head.appendChild(style);
}

L.Marker.prototype.options.icon = defaultIcon;

// Map click handler component
function MapClickHandler() {
  const { setPlantLocation, setUserLocation, isSimulationRunning, plantLocation } = useGameStore();
  const map = useMap();

  useMapEvents({
    click: (e) => {
      if (!isSimulationRunning) {
        if (!plantLocation) {
          setPlantLocation([e.latlng.lat, e.latlng.lng]);
        } else {
          setUserLocation([e.latlng.lat, e.latlng.lng]);
        }
      }
    },
  });

  // Reset map view when plant location is cleared
  useEffect(() => {
    if (!plantLocation && !isSimulationRunning) {
      map.setView([23.5, 121], 8);
    }
  }, [plantLocation, isSimulationRunning, map]);

  return null;
}

function MapController() {
  const map = useMap();
  const { plantLocation, isSimulationRunning } = useGameStore();

  // Reset map view when plant location is cleared
  useEffect(() => {
    if (!plantLocation && !isSimulationRunning) {
      map.setView([23.5, 121], 8);
    }
  }, [plantLocation, isSimulationRunning, map]);

  return null;
}

function GameLoop() {
  const { isSimulationRunning, updateSimulation } = useGameStore();

  useEffect(() => {
    let animationFrameId: number;

    const gameLoop = () => {
      if (isSimulationRunning) {
        updateSimulation();
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    if (isSimulationRunning) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isSimulationRunning, updateSimulation]);

  return null;
}

// Add diffusion mode type
type DiffusionMode = 'natural' | 'combined';

function RadiationCloud() {
  const { plantLocation, windDirection, windSpeed, simulationTime, diffusionMode } = useGameStore();
  const map = useMap();

  // Early return if no plant location or no simulation time
  if (!plantLocation || simulationTime === 0) {
    return null;
  }

  // Calculate the radiation spread pattern
  const points = useMemo(() => {
    const timeSeconds = simulationTime * 60; // 轉換為秒
    
    // 擴散參數
    const BLAST_PARAMS = {
      duration: 30,     // 初始事件擴散階段長度（秒）
      speed: 50,        // 初始事件擴散速度（m/s），增加初始擴散速度
      diffusionD: 2.0   // 擴散係數（m²/s），增加自然擴散速度
    };
    
    // Convert wind speed from km/h to m/s
    const windSpeedMS = windSpeed * 1000 / 3600;
    
    // 計算基礎擴散半徑
    const getBaseRadius = (t: number) => {
      // 確保最小擴散半徑為 1000 公尺
      const minRadius = 1000;
      
      if (t <= BLAST_PARAMS.duration) {
        // 初始事件發生階段：線性擴散
        return Math.max(minRadius, BLAST_PARAMS.speed * t);
      } else {
        // 自然擴散階段：初始事件階段 + 擴散階段
        const blastRadius = BLAST_PARAMS.speed * BLAST_PARAMS.duration;
        // 增加時間影響因子，使擴散隨時間增長更明顯
        const timeFactor = Math.sqrt(t / BLAST_PARAMS.duration);
        const diffusionRadius = Math.sqrt(2 * BLAST_PARAMS.diffusionD * (t - BLAST_PARAMS.duration)) * timeFactor;
        return Math.max(minRadius, blastRadius + diffusionRadius);
      }
    };
    
    // 計算基礎擴散半徑
    const baseRadius = getBaseRadius(timeSeconds);
    
    // Calculate the spread pattern points
    const numPoints = 36; // Number of points to create the polygon
    const spreadPoints: [number, number][] = [];
    
    // Calculate points for the spread pattern
    for (let i = 0; i < numPoints; i++) {
      // Calculate angle in radians, starting from North (0 degrees)
      const angle = (i * 2 * Math.PI) / numPoints;
      
      let totalDistance: number;
      
      if (diffusionMode === 'natural') {
        // 純自然擴散模式：只使用基礎擴散半徑
        totalDistance = baseRadius;
      } else {
        // 組合模式：加入風向影響
        const windRad = (windDirection * Math.PI) / 180;
        // 計算風向影響因子 (0 到 1)，減少 60% 的影響
        const windFactor = (Math.cos(angle + windRad) * 0.4 + 1) / 2;
        const windInfluence = windSpeedMS * timeSeconds;
        const windDiffusion = windInfluence * windFactor;
        totalDistance = baseRadius + windDiffusion;
      }
      
      // 計算點的位置
      // For latitude (north-south), use -cos to reverse the direction
      const lat = plantLocation[0] - (totalDistance * Math.cos(angle)) / 111000;
      // For longitude (east-west), use sin
      const lng = plantLocation[1] + (totalDistance * Math.sin(angle)) / (111000 * Math.cos(plantLocation[0] * Math.PI / 180));
      
      spreadPoints.push([lat, lng]);
    }
    
    return spreadPoints;
  }, [plantLocation, windDirection, windSpeed, simulationTime, diffusionMode]);

  // 計算調試信息
  const timeSeconds = simulationTime * 60;
  const BLAST_PARAMS = {
    duration: 30,
    speed: 50,
    diffusionD: 2.0
  };
  
  const getBaseRadius = (t: number) => {
    // 確保最小擴散半徑為 1000 公尺
    const minRadius = 1000;
    
    if (t <= BLAST_PARAMS.duration) {
      return Math.max(minRadius, BLAST_PARAMS.speed * t);
    } else {
      const blastRadius = BLAST_PARAMS.speed * BLAST_PARAMS.duration;
      const timeFactor = Math.sqrt(t / BLAST_PARAMS.duration);
      const diffusionRadius = Math.sqrt(2 * BLAST_PARAMS.diffusionD * (t - BLAST_PARAMS.duration)) * timeFactor;
      return Math.max(minRadius, blastRadius + diffusionRadius);
    }
  };
  
  const baseRadius = getBaseRadius(timeSeconds);
  const windSpeedMS = windSpeed * 1000 / 3600;
  const windInfluence = windSpeedMS * timeSeconds;

  return (
    <>
      {/* Debug information */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded shadow">
        <div className="mt-2 text-sm">
          <div>時間: {simulationTime} 分鐘 ({timeSeconds} 秒)</div>
          <div>風速: {windSpeed} km/h ({windSpeedMS.toFixed(2)} m/s)</div>
          <div>風向: {windDirection}°</div>
          <div>基礎擴散半徑: {baseRadius.toFixed(2)} 公尺</div>
          {diffusionMode === 'combined' && (
            <div>風向影響距離: {windInfluence.toFixed(2)} 公尺</div>
          )}
        </div>
      </div>

      {/* Radiation spread area */}
      <Polygon
        positions={points}
        pathOptions={{
          fillColor: '#ff0000',
          fillOpacity: 0.2,
          color: '#ff0000',
          weight: 2,
          opacity: 0.5,
        }}
      />
      
      {/* Nuclear plant location marker */}
      <Circle
        center={plantLocation}
        radius={1000}
        pathOptions={{
          fillColor: '#ff0000',
          fillOpacity: 0.4,
          color: '#ff0000',
          weight: 2,
          opacity: 0.8,
        }}
      />
    </>
  );
}

function TimeSelector() {
  const { simulationTime, setSimulationTime } = useGameStore();

  const timeOptions = [
    { label: '1小時', value: 60 },
    { label: '3小時', value: 180 },
    { label: '6小時', value: 360 },
    { label: '12小時', value: 720 },
    { label: '24小時', value: 1440 },
    { label: '36小時', value: 2160 },
    { label: '48小時', value: 2880 },
  ];

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[10] bg-white/90 p-2 rounded-lg shadow-lg">
      <div className="flex gap-2">
        {timeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setSimulationTime(option.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${simulationTime === option.value 
                ? 'bg-rose-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GameMap() {
  const {
    plantLocation,
    userLocation,
    isSimulationRunning,
    windDirection,
    spreadSpeed,
    simulationTime,
  } = useGameStore();

  const mapRef = useRef<L.Map>(null);

  return (
    <div className="relative w-full h-[600px]">
      <MapContainer
        center={[23.5, 121]}
        zoom={7}
        className="w-full h-full rounded-lg"
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler />
        <MapController />

        {/* Nuclear Plant Marker */}
        {plantLocation && (
          <Marker position={plantLocation} icon={defaultIcon}>
            <Popup>
              <div className="text-center">
                <div className="font-bold">核電廠位置</div>
                <div>緯度: {plantLocation[0].toFixed(4)}</div>
                <div>經度: {plantLocation[1].toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>
              <div className="text-center">
                <div className="font-bold">您的位置</div>
                <div>緯度: {userLocation[0].toFixed(4)}</div>
                <div>經度: {userLocation[1].toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Radiation Cloud - Show when time is selected */}
        {plantLocation && simulationTime > 0 && (
          <RadiationCloud />
        )}

        {/* Simulation Info Box */}
        {isSimulationRunning && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg z-10">
            <h3 className="text-lg font-semibold mb-2">Simulation Info</h3>
            <p>Wind Direction: {windDirection}°</p>
            <p>Spread Speed: {spreadSpeed}x</p>
          </div>
        )}

        {/* Plant Selection Prompt */}
        {!plantLocation && !isSimulationRunning && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg z-10 text-center">
            <p className="text-gray-700">Click on the map to place a nuclear power plant</p>
          </div>
        )}

        {/* User Location Prompt */}
        {plantLocation && !userLocation && !isSimulationRunning && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg z-10 text-center">
            <p className="text-gray-700">Click on the map to set your location</p>
          </div>
        )}
      </MapContainer>

      {/* Time Selector - Moved outside MapContainer */}
      <TimeSelector />
    </div>
  );
} 