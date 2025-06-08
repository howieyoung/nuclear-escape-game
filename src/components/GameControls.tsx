'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { SIMULATION_CONFIG } from '@/lib/constants';
import { DiffusionModeSelector } from './DiffusionModeSelector';
import type { GameState } from '@/store/gameStore';
import { calculateDistance } from '@/lib/mapUtils';

const WIND_DIRECTIONS = [
  { label: '北風 (N)', value: 0 },
  { label: '東北風 (NE)', value: 45 },
  { label: '東風 (E)', value: 90 },
  { label: '東南風 (SE)', value: 135 },
  { label: '南風 (S)', value: 180 },
  { label: '西南風 (SW)', value: 225 },
  { label: '西風 (W)', value: 270 },
  { label: '西北風 (NW)', value: 315 },
];

const SPREAD_SPEED_DESCRIPTION = {
  verySlow: "1x - Very slow spread (0-10 km/h, typical for very calm conditions)",
  slow: "1.5x - Slow spread (10-20 km/h, typical for calm conditions)",
  moderate: "2x-3x - Moderate spread (20-30 km/h, typical for light wind conditions)",
  fast: "3.5x-4x - Fast spread (30-40 km/h, typical for moderate wind conditions)",
  veryFast: "4.5x-5x - Very fast spread (40-60 km/h, typical for strong wind conditions)"
};

interface GameControlsProps {
  gameState: GameState;
  onTimeChange: (time: number) => void;
  onWindDirectionChange: (direction: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onToggleDiffusionMode: () => void;
}

// 環境類型定義
const ENVIRONMENT_TYPES = {
  URBAN: 'urban',
  RURAL: 'rural',
  MOUNTAIN: 'mountain'
} as const;

// 擴散係數設定
const DIFFUSION_COEFFICIENTS = {
  [ENVIRONMENT_TYPES.URBAN]: 0.15,    // 都市地區：建築物阻擋
  [ENVIRONMENT_TYPES.RURAL]: 0.20,    // 一般地區：標準值
  [ENVIRONMENT_TYPES.MOUNTAIN]: 0.25  // 山區：地形複雜
} as const;

type DiffusionCoefficient = typeof DIFFUSION_COEFFICIENTS[keyof typeof DIFFUSION_COEFFICIENTS];

// 擴散參數設定
const BLAST_PARAMS = {
  duration: 30,     // 初始事件階段長度（秒）
  speed: 50,        // 初始事件擴散速度（m/s）
  diffusionD: 2.0   // 擴散係數（m²/s）
} as const;

// 季節定義
const SEASONS = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter'
} as const;

// 季節預設風況
const SEASONAL_WIND_CONDITIONS = {
  [SEASONS.SPRING]: {
    direction: 135,   // 東南風 (135度)
    speed: 15,        // 平均風速 15 km/h
    speedRange: { min: 10, max: 20 },
    description: '春季（3-5月）：東南風，平均風速 15 km/h，範圍 10-20 km/h'
  },
  [SEASONS.SUMMER]: {
    direction: 225,   // 西南風 (225度)
    speed: 17.5,      // 平均風速 17.5 km/h
    speedRange: { min: 10, max: 25 },
    description: '夏季（6-8月）：西南風，平均風速 17.5 km/h，範圍 10-25 km/h'
  },
  [SEASONS.AUTUMN]: {
    direction: 225,   // 西南風 (225度)
    speed: 20,        // 平均風速 20 km/h
    speedRange: { min: 15, max: 25 },
    description: '秋季（9-11月）：西南風，平均風速 20 km/h，範圍 15-25 km/h'
  },
  [SEASONS.WINTER]: {
    direction: 45,    // 東北風 (45度)
    speed: 30,        // 平均風速 30 km/h
    speedRange: { min: 20, max: 40 },
    description: '冬季（12-2月）：東北風，平均風速 30 km/h，範圍 20-40 km/h'
  }
} as const;

export default function GameControls() {
  const {
    plantLocation,
    setPlantLocation,
    windDirection,
    setWindDirection,
    windSpeed,
    setWindSpeed,
    simulationTime,
    setSimulationTime,
    isSimulationRunning,
    startSimulation,
    pauseSimulation,
    spreadSpeed,
    setSpreadSpeed,
    timeRemaining,
    updateTimeRemaining,
    userLocation,
    setUserLocation,
    resetGame
  } = useGameStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetType, setResetType] = useState<'plant' | 'user' | 'all'>('all');
  const [displayTimeRemaining, setDisplayTimeRemaining] = useState<string>('N/A');
  const [currentDiffusionD, setCurrentDiffusionD] = useState<DiffusionCoefficient>(DIFFUSION_COEFFICIENTS[ENVIRONMENT_TYPES.RURAL]);

  // 季節選擇狀態
  const [currentSeason, setCurrentSeason] = useState<typeof SEASONS[keyof typeof SEASONS]>(SEASONS.SUMMER);

  // Convert km/h to m/s
  const windSpeedMS = Math.round(windSpeed * 1000 / 3600);

  const [radiationTimeRemaining, setRadiationTimeRemaining] = useState<number | null>(null);

  const [isTimeAccelerated, setIsTimeAccelerated] = useState(false);
  const [acceleratedHours, setAcceleratedHours] = useState(0);

  // 格式化時間顯示
  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 格式化模擬時間顯示（分鐘轉換為時間格式）
  const formatSimulationTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}:00:00`;
  };

  // 格式化輻射到達時間顯示
  const formatTimeRemaining = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds <= 0) return '已到達';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 計算輻射到達時間
  const calculateTimeRemaining = () => {
    if (!userLocation || !plantLocation) {
      console.log('Missing location data:', { userLocation, plantLocation });
      return null;
    }

    // 計算用戶位置到核電廠的距離（公里）
    const distanceKm = calculateDistance(
      userLocation[0],
      userLocation[1],
      plantLocation[0],
      plantLocation[1]
    );
    const distanceMeters = distanceKm * 1000;

    // 將風速從 km/h 轉換為 m/s
    const windSpeedMS = windSpeed * 1000 / 3600;

    // 計算風向與用戶位置的夾角
    const userAngle = Math.atan2(
      userLocation[1] - plantLocation[1],
      userLocation[0] - plantLocation[0]
    );
    const windRad = (windDirection * Math.PI) / 180;
    // 計算風向影響因子 (0 到 1)，減少 60% 的影響
    const windFactor = (Math.cos(userAngle + windRad) * 0.4 + 1) / 2;

    console.log('Initial parameters:', {
      distanceKm,
      distanceMeters,
      windSpeedMS,
      windFactor,
      userAngle: userAngle * 180 / Math.PI,
      windDirection
    });

    // 計算擴散距離函數
    const calculateSpreadDistance = (time: number) => {
      if (time <= BLAST_PARAMS.duration) {
        // 初始事件階段：線性擴散，但速度較慢
        return BLAST_PARAMS.speed * time * 0.5; // 減慢初始擴散速度
      } else {
        // 自然擴散階段
        const blastRadius = BLAST_PARAMS.speed * BLAST_PARAMS.duration * 0.5; // 調整初始半徑
        const timeFactor = Math.sqrt(time / BLAST_PARAMS.duration);
        const diffusionRadius = Math.sqrt(2 * BLAST_PARAMS.diffusionD * (time - BLAST_PARAMS.duration)) * timeFactor;
        return Math.max(1000, blastRadius + diffusionRadius);
      }
    };

    // 二分搜尋找到輻射到達時間
    let left = 0;
    let right = 72 * 3600; // 最大搜尋時間：72小時
    let result = null;

    console.log('Search range:', { left, right });

    for (let i = 0; i < 100; i++) { // 最多搜尋100次
      const mid = (left + right) / 2;
      
      // 計算基礎擴散距離
      const baseDistance = calculateSpreadDistance(mid);
      
      // 計算風向影響的距離（考慮風向因子）
      const windInfluence = windSpeedMS * mid;
      const windDiffusion = windInfluence * windFactor;
      
      // 計算總擴散距離
      const totalDistance = baseDistance + windDiffusion;

      console.log('Time calculation iteration:', {
        iteration: i,
        time: mid,
        baseDistance,
        windInfluence,
        windDiffusion,
        totalDistance,
        targetDistance: distanceMeters,
        difference: Math.abs(totalDistance - distanceMeters),
        windFactor
      });

      // 如果找到足夠接近的結果，就停止搜尋
      if (Math.abs(totalDistance - distanceMeters) < 1000) { // 誤差小於1公里
        result = mid;
        break;
      }

      // 更新搜尋範圍
      if (totalDistance < distanceMeters) {
        left = mid;
      } else {
        right = mid;
      }
    }

    console.log('Final time calculation:', {
      distanceKm,
      distanceMeters,
      windSpeedMS,
      windFactor,
      userAngle: userAngle * 180 / Math.PI,
      windDirection,
      result
    });

    return result;
  };

  // 計算實際剩餘時間
  const calculateActualTimeRemaining = () => {
    const initialTime = calculateTimeRemaining();
    console.log('Initial time from calculateTimeRemaining:', initialTime);
    
    if (initialTime === null) {
      console.log('No initial time calculated');
      return null;
    }
    
    // 將模擬時間從分鐘轉換為秒
    const simulationTimeSeconds = simulationTime * 60;
    console.log('Simulation time in seconds:', simulationTimeSeconds);
    
    // 如果輻射已經到達，返回 0
    if (simulationTimeSeconds >= initialTime) {
      console.log('Radiation has already reached the user');
      return 0;
    }
    
    const remainingTime = Math.max(0, initialTime - simulationTimeSeconds);
    console.log('Calculated remaining time:', remainingTime);
    return remainingTime;
  };

  // 將角度轉換為最接近的風向描述
  const getWindDirectionText = (angle: number): string => {
    // 將角度轉換到 0-360 範圍
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    // 定義風向及其對應的角度範圍
    const directions = [
      { name: '北風', range: [337.5, 22.5] },
      { name: '東北風', range: [22.5, 67.5] },
      { name: '東風', range: [67.5, 112.5] },
      { name: '東南風', range: [112.5, 157.5] },
      { name: '南風', range: [157.5, 202.5] },
      { name: '西南風', range: [202.5, 247.5] },
      { name: '西風', range: [247.5, 292.5] },
      { name: '西北風', range: [292.5, 337.5] }
    ];

    // 找到最接近的風向
    for (const direction of directions) {
      const [start, end] = direction.range;
      if (start > end) {
        // 處理跨越 0 度的情況（北風）
        if (normalizedAngle >= start || normalizedAngle < end) {
          return direction.name;
        }
      } else {
        if (normalizedAngle >= start && normalizedAngle < end) {
          return direction.name;
        }
      }
    }

    return '北風'; // 預設值
  };

  // 更新風向
  const handleWindDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDirection = parseInt(e.target.value);
    console.log('Wind direction changed:', newDirection);
    setWindDirection(newDirection);
    // 強制立即重新計算
    setTimeout(() => {
      const timeRemaining = calculateActualTimeRemaining();
      console.log('Recalculated time after wind direction change:', timeRemaining);
      setDisplayTimeRemaining(formatTimeRemaining(timeRemaining));
    }, 0);
  };

  // 更新風向角度
  const handleWindAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAngle = parseInt(e.target.value);
    console.log('Wind angle changed:', newAngle);
    setWindDirection(newAngle);
  };

  // 更新風速
  const handleWindSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value);
    console.log('Wind speed changed:', newSpeed);
    setWindSpeed(newSpeed);
    // 強制立即重新計算
    setTimeout(() => {
      const timeRemaining = calculateActualTimeRemaining();
      console.log('Recalculated time after wind speed change:', timeRemaining);
      setDisplayTimeRemaining(formatTimeRemaining(timeRemaining));
    }, 0);
  };

  // 更新時間顯示
  const updateTimeDisplay = useCallback(() => {
    console.log('Updating time display with current parameters:', {
      windSpeed,
      windDirection,
      userLocation,
      plantLocation,
      simulationTime
    });
    const timeRemaining = calculateActualTimeRemaining();
    console.log('Time remaining:', timeRemaining);
    setDisplayTimeRemaining(formatTimeRemaining(timeRemaining));
  }, [userLocation, plantLocation, windSpeed, windDirection, simulationTime, isSimulationRunning]);

  // 當任何相關參數變化時更新時間
  useEffect(() => {
    console.log('Parameters changed:', {
      userLocation,
      plantLocation,
      windSpeed,
      windDirection,
      simulationTime,
      isSimulationRunning
    });
    
    if (userLocation && plantLocation) {
      updateTimeDisplay();
    }
  }, [userLocation, plantLocation, windSpeed, windDirection, simulationTime, isSimulationRunning, updateTimeDisplay]);

  // 使用 requestAnimationFrame 來確保平滑更新
  useEffect(() => {
    let animationFrameId: number;

    const updateDisplay = () => {
      if (isSimulationRunning && userLocation && plantLocation) {
        updateTimeDisplay();
      }
      animationFrameId = requestAnimationFrame(updateDisplay);
    };

    if (isSimulationRunning) {
      animationFrameId = requestAnimationFrame(updateDisplay);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isSimulationRunning, userLocation, plantLocation, updateTimeDisplay]);


  // 重置時更新時間顯示
  const handleReset = () => {
    // 停止動態模擬
    setIsTimeAccelerated(false);
    setAcceleratedHours(0);
    
    // 重置模擬時間
    setSimulationTime(0);
    
    // 根據當前日期設定季節
    const currentSeason = getCurrentSeason();
    setCurrentSeason(currentSeason);
    
    // 設定對應季節的風向和風速
    const seasonConditions = SEASONAL_WIND_CONDITIONS[currentSeason];
    setWindDirection(seasonConditions.direction);
    setWindSpeed(seasonConditions.speed);
    
    // 重置擴散速度
    setSpreadSpeed(1);
    
    // 重置其他遊戲狀態，但保留風向和風速
    resetGame();
    setRadiationTimeRemaining(null);
    updateTimeDisplay();
  };

  // 計算兩點之間的距離（公里）
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // 地球半徑（公里）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isSimulationRunning && timeRemaining > 0) {
      timer = setInterval(() => {
        updateTimeRemaining(Math.max(0, timeRemaining - 1));
      }, SIMULATION_CONFIG.UPDATE_INTERVAL);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isSimulationRunning, timeRemaining, updateTimeRemaining]);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    setSpreadSpeed(speed);
  };

  const handleResetType = (type: 'plant' | 'user' | 'all') => {
    if (isSimulationRunning || isTimeAccelerated) {
      setResetType(type);
      setShowResetConfirm(true);
    } else {
      performReset(type);
    }
  };

  const performReset = (type: 'plant' | 'user' | 'all') => {
    switch (type) {
      case 'plant':
        setPlantLocation(null);
        break;
      case 'user':
        setUserLocation(null);
        break;
      case 'all':
        // 停止動態模擬
        setIsTimeAccelerated(false);
        setAcceleratedHours(0);
        
        // 重置模擬時間
        setSimulationTime(0);
        
        // 根據當前日期設定季節
        const currentSeason = getCurrentSeason();
        setCurrentSeason(currentSeason);
        
        // 設定對應季節的風向和風速
        const seasonConditions = SEASONAL_WIND_CONDITIONS[currentSeason];
        setWindDirection(seasonConditions.direction);
        setWindSpeed(seasonConditions.speed);
        
        // 重置擴散速度
        setSpreadSpeed(1);
        
        // 重置位置
        setPlantLocation(null);
        setUserLocation(null);
        
        // 重置其他遊戲狀態，但保留風向和風速
        resetGame();
        setRadiationTimeRemaining(null);
        updateTimeDisplay();
        break;
    }
  };

  const getSpeedDescription = (speed: number) => {
    if (speed === 1) return SPREAD_SPEED_DESCRIPTION.verySlow;
    if (speed === 1.5) return SPREAD_SPEED_DESCRIPTION.slow;
    if (speed >= 2 && speed <= 3) return SPREAD_SPEED_DESCRIPTION.moderate;
    if (speed >= 3.5 && speed <= 4) return SPREAD_SPEED_DESCRIPTION.fast;
    if (speed >= 4.5) return SPREAD_SPEED_DESCRIPTION.veryFast;
    return SPREAD_SPEED_DESCRIPTION.moderate; // fallback
  };

  const updateWindSpeed = (speed: number) => {
    setWindSpeed(speed);
  };

  // 判斷環境類型
  const detectEnvironmentType = async (lat: number, lng: number): Promise<typeof ENVIRONMENT_TYPES[keyof typeof ENVIRONMENT_TYPES]> => {
    // 從 GeoJSON 資料中獲取縣市資訊
    const countyData = await fetch('/data/taiwan_counties.geojson').then(res => res.json());
    
    // 檢查點是否在任何縣市範圍內
    for (const feature of countyData.features) {
      const county = feature.properties;
      const coordinates = feature.geometry.coordinates[0];
      
      // 檢查點是否在縣市範圍內
      if (isPointInPolygon([lng, lat], coordinates)) {
        console.log(`位置在${county.name}範圍內`);
        
        // 根據縣市特性判斷環境類型
        // 1. 先判斷是否為山區
        if (county.evacuation_difficulty === 'extreme') {
          // 檢查是否在已知的山區範圍內
          const isInMountainArea = checkMountainArea(lat, lng);
          if (isInMountainArea) {
            console.log('判定為山區（基於地形資料）');
            return ENVIRONMENT_TYPES.MOUNTAIN;
          }
        }
        
        // 2. 判斷是否為都市地區
        if (county.density === 'high' && 
            (county.evacuation_difficulty === 'high' || county.evacuation_difficulty === 'extreme')) {
          // 檢查是否在已知的都市範圍內
          const isInUrbanArea = checkUrbanArea(lat, lng);
          if (isInUrbanArea) {
            console.log('判定為都市地區（基於人口密度和地形）');
            return ENVIRONMENT_TYPES.URBAN;
          }
        }
        
        // 3. 預設為一般地區
        console.log('判定為一般地區');
        return ENVIRONMENT_TYPES.RURAL;
      }
    }
    
    // 如果不在任何縣市範圍內，檢查是否在山區
    const isInMountainArea = checkMountainArea(lat, lng);
    if (isInMountainArea) {
      console.log('不在縣市範圍內，但位於山區');
      return ENVIRONMENT_TYPES.MOUNTAIN;
    }
    
    // 預設為一般地區
    console.log('不在任何縣市範圍內，預設為一般地區');
    return ENVIRONMENT_TYPES.RURAL;
  };

  // 檢查是否在山區範圍內
  const checkMountainArea = (lat: number, lng: number): boolean => {
    // 定義台灣主要山區範圍
    const mountainAreas = [
      // 中央山脈
      {
        name: '中央山脈',
        bounds: {
          north: 24.5,
          south: 22.0,
          east: 121.5,
          west: 120.5
        }
      },
      // 雪山山脈
      {
        name: '雪山山脈',
        bounds: {
          north: 25.0,
          south: 24.0,
          east: 121.5,
          west: 120.8
        }
      },
      // 阿里山山脈
      {
        name: '阿里山山脈',
        bounds: {
          north: 23.8,
          south: 23.0,
          east: 121.0,
          west: 120.5
        }
      }
    ];

    // 檢查點是否在任何山區範圍內
    return mountainAreas.some(area => {
      const inBounds = lat <= area.bounds.north &&
                      lat >= area.bounds.south &&
                      lng <= area.bounds.east &&
                      lng >= area.bounds.west;
      
      if (inBounds) {
        console.log(`位於${area.name}範圍內`);
      }
      
      return inBounds;
    });
  };

  // 檢查是否在都市範圍內
  const checkUrbanArea = (lat: number, lng: number): boolean => {
    // 定義台灣主要都市範圍
    const urbanAreas = [
      // 台北市
      {
        name: '台北市',
        bounds: {
          north: 25.2,
          south: 25.0,
          east: 121.6,
          west: 121.4
        }
      },
      // 新北市
      {
        name: '新北市',
        bounds: {
          north: 25.2,
          south: 24.9,
          east: 121.5,
          west: 121.2
        }
      },
      // 台中市
      {
        name: '台中市',
        bounds: {
          north: 24.3,
          south: 24.1,
          east: 120.7,
          west: 120.5
        }
      },
      // 高雄市
      {
        name: '高雄市',
        bounds: {
          north: 22.7,
          south: 22.5,
          east: 120.4,
          west: 120.2
        }
      }
    ];

    // 檢查點是否在任何都市範圍內
    return urbanAreas.some(area => {
      const inBounds = lat <= area.bounds.north &&
                      lat >= area.bounds.south &&
                      lng <= area.bounds.east &&
                      lng >= area.bounds.west;
      
      if (inBounds) {
        console.log(`位於${area.name}都市範圍內`);
      }
      
      return inBounds;
    });
  };

  // 檢查點是否在多邊形內
  const isPointInPolygon = (point: [number, number], polygon: number[][]) => {
    const x = point[0];
    const y = point[1];
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  };

  // 更新擴散參數
  const updateDiffusionParameters = async (lat: number, lng: number) => {
    try {
      const environmentType = await detectEnvironmentType(lat, lng);
      const diffusionCoefficient = DIFFUSION_COEFFICIENTS[environmentType];
      
      // 更新擴散係數
      setCurrentDiffusionD(diffusionCoefficient);
      setCurrentEnvironment(environmentType);
      
      console.log('更新擴散參數:', {
        environmentType,
        diffusionCoefficient,
        location: { lat, lng }
      });

      // 立即重新計算輻射擴散
      if (simulationTime > 0) {
        const timeSeconds = simulationTime * 60;
        const baseRadius = calculateSpreadDistance(timeSeconds);
        const windSpeedMS = windSpeed * 1000 / 3600;
        const windInfluence = windSpeedMS * timeSeconds;
        
        console.log('重新計算擴散:', {
          timeSeconds,
          baseRadius,
          windSpeedMS,
          windInfluence,
          diffusionCoefficient
        });
      }
    } catch (error) {
      console.error('更新擴散參數時發生錯誤:', error);
      // 發生錯誤時使用預設值
      setCurrentDiffusionD(DIFFUSION_COEFFICIENTS[ENVIRONMENT_TYPES.RURAL]);
      setCurrentEnvironment(ENVIRONMENT_TYPES.RURAL);
    }
  };

  // 在 plantLocation 改變時更新擴散參數
  useEffect(() => {
    if (plantLocation) {
      updateDiffusionParameters(plantLocation[0], plantLocation[1]);
    }
  }, [plantLocation]);

  // 更新擴散參數說明
  const getEnvironmentDescription = (type: typeof ENVIRONMENT_TYPES[keyof typeof ENVIRONMENT_TYPES]) => {
    switch (type) {
      case ENVIRONMENT_TYPES.URBAN:
        return '都市地區：建築物阻擋，擴散係數較低';
      case ENVIRONMENT_TYPES.MOUNTAIN:
        return '山區：地形複雜，擴散係數較高';
      case ENVIRONMENT_TYPES.RURAL:
        return '一般地區：標準擴散係數';
      default:
        return '未知環境類型';
    }
  };

  // 獲取當前環境資訊
  const [currentEnvironment, setCurrentEnvironment] = useState<typeof ENVIRONMENT_TYPES[keyof typeof ENVIRONMENT_TYPES]>(ENVIRONMENT_TYPES.RURAL);

  // 更新當前環境資訊
  useEffect(() => {
    if (plantLocation) {
      detectEnvironmentType(plantLocation[0], plantLocation[1])
        .then(type => {
          setCurrentEnvironment(type);
        })
        .catch(error => {
          console.error('環境檢測錯誤:', error);
          setCurrentEnvironment(ENVIRONMENT_TYPES.RURAL);
        });
    }
  }, [plantLocation]);

  // 在計算擴散距離時使用更新後的參數
  const calculateSpreadDistance = (time: number) => {
    if (time <= BLAST_PARAMS.duration) {
      // 初始事件階段：線性擴散，但速度較慢
      return BLAST_PARAMS.speed * time * 0.5; // 減慢初始擴散速度
    } else {
      // 自然擴散階段
      const blastRadius = BLAST_PARAMS.speed * BLAST_PARAMS.duration * 0.5; // 調整初始半徑
      const timeFactor = Math.sqrt(time / BLAST_PARAMS.duration);
      const diffusionRadius = Math.sqrt(2 * BLAST_PARAMS.diffusionD * (time - BLAST_PARAMS.duration)) * timeFactor;
      return Math.max(1000, blastRadius + diffusionRadius);
    }
  };

  // 在風速或風向改變時重新計算
  useEffect(() => {
    if (plantLocation && simulationTime > 0) {
      const timeSeconds = simulationTime * 60;
      const baseRadius = calculateSpreadDistance(timeSeconds);
      const windSpeedMS = windSpeed * 1000 / 3600;
      const windInfluence = windSpeedMS * timeSeconds;
      
      console.log('風況改變，重新計算擴散:', {
        timeSeconds,
        baseRadius,
        windSpeedMS,
        windInfluence,
        currentDiffusionD
      });
    }
  }, [windSpeed, windDirection, currentDiffusionD]);

  // 在模擬時間改變時重新計算
  useEffect(() => {
    if (plantLocation && simulationTime > 0) {
      const timeSeconds = simulationTime * 60;
      const baseRadius = calculateSpreadDistance(timeSeconds);
      const windSpeedMS = windSpeed * 1000 / 3600;
      const windInfluence = windSpeedMS * timeSeconds;
      
      console.log('時間改變，重新計算擴散:', {
        timeSeconds,
        baseRadius,
        windSpeedMS,
        windInfluence,
        currentDiffusionD
      });
    }
  }, [simulationTime]);

  // 計算有效擴散係數
  const calculateEffectiveDiffusionCoefficient = () => {
    // 環境因素
    const environmentFactor = currentDiffusionD;
    
    // 放射性物質類型（預設使用微粒狀放射性物質）
    const materialFactor = 0.2; // 微粒狀放射性物質
    
    // 氣象條件（預設使用中性大氣）
    const weatherFactor = 0.2; // 中性大氣
    
    // 計算有效擴散係數
    return environmentFactor * materialFactor * weatherFactor;
  };

  // 在資訊顯示區域中更新擴散參數說明
  const renderDiffusionParametersInfo = () => {
    const effectiveDiffusionD = calculateEffectiveDiffusionCoefficient();
    
    return (
      <div className="mt-4 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">環境參數說明</h3>
        
        {/* 環境因素說明 */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">地形因素</h4>
          <p className="text-sm mb-2">當前環境：{getEnvironmentDescription(currentEnvironment)}</p>
          <div className="text-sm space-y-1">
            <p>都市地區：0.15（建築物阻擋）</p>
            <p>一般地區：0.20（標準值）</p>
            <p>山區：0.25（地形複雜）</p>
          </div>
        </div>

        {/* 放射性物質類型 */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">放射性物質類型</h4>
          <div className="text-sm space-y-1">
            <p>氣態放射性物質：0.3 m²/s</p>
            <p>微粒狀放射性物質：0.2 m²/s (當前使用)</p>
            <p>重金屬微粒：0.1 m²/s</p>
          </div>
        </div>

        {/* 氣象條件 */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">氣象條件</h4>
          <div className="text-sm space-y-1">
            <p>穩定大氣：0.15（擴散較慢）</p>
            <p>中性大氣：0.2（標準值）(當前使用)</p>
            <p>不穩定大氣：0.25（擴散較快）</p>
          </div>
        </div>

        {/* 綜合說明 */}
        <div className="text-sm text-gray-600 italic">
          註：擴散係數會根據以上因素綜合計算，影響放射性物質的擴散速度和範圍。
        </div>

        {/* 當前有效擴散係數 */}
        <div className="mt-4 p-2 bg-gray-100 rounded">
          <p className="text-sm font-medium">
            當前有效擴散係數：{effectiveDiffusionD.toFixed(2)} m²/s
            <span className="text-xs text-gray-500 ml-2">
              ({currentDiffusionD.toFixed(2)} × 0.2 × 0.2)
            </span>
          </p>
        </div>
      </div>
    );
  };

  // 更新季節風況
  const updateSeasonalWindConditions = (season: typeof SEASONS[keyof typeof SEASONS]) => {
    const conditions = SEASONAL_WIND_CONDITIONS[season];
    setWindDirection(conditions.direction);
    setWindSpeed(conditions.speed);
    setCurrentSeason(season);
  };

  // 處理時間加速模擬
  const handleTimeAcceleration = () => {
    if (isTimeAccelerated) {
      // 停止加速模擬
      setIsTimeAccelerated(false);
      setAcceleratedHours(0);
    } else {
      // 開始加速模擬
      setIsTimeAccelerated(true);
      setAcceleratedHours(0);
    }
  };

  // 時間加速效果
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isTimeAccelerated) {
      intervalId = setInterval(() => {
        setAcceleratedHours(prev => {
          const nextHour = prev + 1;
          if (nextHour > 48) {
            setIsTimeAccelerated(false);
            return 0;
          }
          // 更新模擬時間（轉換為分鐘）
          setSimulationTime(nextHour * 60);
          return nextHour;
        });
      }, 2500); // 每2.5秒更新一次
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTimeAccelerated]);

  // 根據當前日期確定季節
  const getCurrentSeason = (): typeof SEASONS[keyof typeof SEASONS] => {
    const currentMonth = new Date().getMonth() + 1; // getMonth() 返回 0-11
    
    if (currentMonth >= 3 && currentMonth <= 5) {
      return SEASONS.SPRING;
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      return SEASONS.SUMMER;
    } else if (currentMonth >= 9 && currentMonth <= 11) {
      return SEASONS.AUTUMN;
    } else {
      return SEASONS.WINTER;
    }
  };

  // 在組件初始化時設定當前季節
  useEffect(() => {
    const currentSeason = getCurrentSeason();
    setCurrentSeason(currentSeason);
    updateSeasonalWindConditions(currentSeason);
  }, []); // 只在組件掛載時執行一次

  // 更新季節選擇的處理函數
  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const season = e.target.value as typeof SEASONS[keyof typeof SEASONS];
    setCurrentSeason(season);
    updateSeasonalWindConditions(season);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white rounded-lg shadow-lg"
    >
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>
            <span className="font-medium">設置核災發生地：</span>
            在地圖上點擊第一個位置，這將被設定為核災發生地
            {plantLocation && (
              <button
                onClick={() => handleResetType('plant')}
                className="ml-2 px-2 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
              >
                重新設定
              </button>
            )}
          </li>
          <li>
            <span className="font-medium">設置用戶位置：</span>
            在地圖上點擊第二個位置，這將被設定為用戶所在地
            {userLocation && (
              <button
                onClick={() => handleResetType('user')}
                className="ml-2 px-2 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
              >
                重新設定
              </button>
            )}
          </li>
          <li>
            <span className="font-medium">調整模擬參數：</span>
            可以調整季節、風向、風速等參數
          </li>
          <li>
            <span className="font-medium">開始模擬：</span>
            點擊「開始動態模擬」按鈕開始模擬
          </li>
        </ol>
      </div>

      {/* 原有的控制項 */}
      <div className="mt-4 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">模擬控制</h3>
        <div className="flex gap-4">
          <button
            onClick={handleTimeAcceleration}
            disabled={!plantLocation}
            className={`px-4 py-2 rounded-lg font-medium transition-colors
              ${!plantLocation 
                ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                : isTimeAccelerated 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            {isTimeAccelerated ? '停止動態模擬' : '開始動態模擬'}
          </button>
          <button
            onClick={() => handleResetType('all')}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            重置模擬
          </button>
        </div>
        <div className="flex items-center gap-4 mt-2">
          {isTimeAccelerated && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-700">
                當前模擬時間：{acceleratedHours} 小時
              </span>
            </div>
          )}
          {!plantLocation && (
            <span className="text-sm text-gray-500">
              （請先設置核災初始地）
            </span>
          )}
        </div>
        {isTimeAccelerated && (
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(acceleratedHours / 48) * 100}%` }}
            ></div>
          </div>
        )}
        <p className="mt-2 text-sm text-gray-600">
          剩餘時間：{displayTimeRemaining}
        </p>
      </div>
      {/* 風向＆季節選擇 */}
      <div className="mt-4 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">風向控制</h3>
        {/* 季節選擇 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            季節選擇
          </label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(SEASONS).map(([key, value]) => (
              <button
                key={value}
                onClick={() => {
                  setCurrentSeason(value);
                  updateSeasonalWindConditions(value);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${currentSeason === value 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                {key === 'SPRING' ? '春季 (3-5月)' :
                 key === 'SUMMER' ? '夏季 (6-8月)' :
                 key === 'AUTUMN' ? '秋季 (9-11月)' : '冬季 (12-2月)'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {currentSeason === getCurrentSeason() 
              ? '當前季節（根據系統日期）' 
              : SEASONAL_WIND_CONDITIONS[currentSeason].description}
          </p>
        </div>

        {/* 風向控制 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">風向角度</label>
          <input
            type="range"
            min="0"
            max="359"
            value={windDirection}
            onChange={handleWindAngleChange}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-600">
            <span>北 (0°)</span>
            <span>東 (90°)</span>
            <span>南 (180°)</span>
            <span>西 (270°)</span>
          </div>
          <p className="mt-1 text-sm">當前風向：{windDirection}°</p>
        </div>

        {/* 風速控制 */}
        <div>
          <label className="block text-sm font-medium mb-2">風速 (km/h)</label>
          <input
            type="range"
            min="0"
            max="100"
            value={windSpeed}
            onChange={handleWindSpeedChange}
            className="w-full"
          />
          <p className="mt-1 text-sm">當前風速：{windSpeed} km/h</p>
        </div>
        {/* 顯示當前設置狀態 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">當前設置：</h3>
          <div className="space-y-2 text-gray-700">
            <p>
              <span className="font-medium">核災發生地：</span>
              {plantLocation 
                ? `已設置 (${plantLocation[0].toFixed(4)}, ${plantLocation[1].toFixed(4)})`
                : '未設置'}
            </p>
            <p>
              <span className="font-medium">用戶位置：</span>
              {userLocation 
                ? `已設置 (${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)})`
                : '未設置'}
            </p>
            <p>
              <span className="font-medium">當前季節：</span>
              {currentSeason}
              {currentSeason === getCurrentSeason() && ' (根據系統日期)'}
            </p>
            <p>
              <span className="font-medium">風向：</span>
              {getWindDirectionText(windDirection)} ({windDirection}°)
            </p>
            <p>
              <span className="font-medium">風速：</span>
              {windSpeed} km/h
            </p>
          </div>
        </div>
      </div>

      {/* 環境資訊顯示 */}
      <div className="mt-4 p-4 bg-white rounded shadow">
        <h3 className="text-lg font-bold mb-2">初始事件環境資訊</h3>
        <div className="space-y-4">
          {plantLocation ? (
            <>
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-medium">當前環境：</p>
                <p className="text-yellow-600">
                  {getEnvironmentDescription(currentEnvironment)}
                </p>
                <p className="mt-1">擴散係數：{currentDiffusionD}</p>
                <p className="text-sm mt-1">
                  位置：緯度 {plantLocation[0].toFixed(4)}, 經度 {plantLocation[1].toFixed(4)}
                </p>
              </div>
              <div>
                <p className="font-medium">環境類型說明：</p>
                <ul className="list-disc list-inside ml-2 text-sm">
                  <li className={currentEnvironment === ENVIRONMENT_TYPES.URBAN ? 'text-yellow-600' : ''}>
                    都市地區：0.15（建築物阻擋）
                  </li>
                  <li className={currentEnvironment === ENVIRONMENT_TYPES.RURAL ? 'text-yellow-600' : ''}>
                    一般地區：0.20（標準值）
                  </li>
                  <li className={currentEnvironment === ENVIRONMENT_TYPES.MOUNTAIN ? 'text-yellow-600' : ''}>
                    山區：0.25（地形複雜）
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-gray-500">請先選擇核災地點以顯示環境資訊</p>
          )}
        </div>
      </div>

      {/* 擴散參數說明 */}
      <div className="mt-4 p-4 bg-white rounded shadow">
        <h3 className="text-lg font-bold mb-2">擴散參數說明</h3>
        <div className="space-y-4 text-sm">
          {/* 擴散參數說明 */}
          <div>
            <h4 className="font-medium mb-2">擴散參數說明</h4>
            <div className="pl-4 space-y-2">
              <div>
                <p className="font-medium">初始事件階段：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>持續時間：30 秒</li>
                  <li>擴散速度：50 m/s</li>
                  <li>最小擴散半徑：1000 公尺</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">自然擴散階段：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>擴散係數 (D)：2.0 m²/s</li>
                  <li>時間影響因子：√(t/t₀)</li>
                  <li>t₀ = 初始事件階段時間 (30秒)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 擴散方程式說明 */}
          <div>
            <h4 className="font-medium mb-2">擴散方程式說明</h4>
            <div className="pl-4 space-y-2">
              <div>
                <p>1. 初始事件階段 (t ≤ 30秒)：</p>
                <p className="font-mono">r = max(1000, v × t)</p>
                <p>其中：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>v = 50 m/s (初始擴散速度)</li>
                  <li>t = 時間 (秒)</li>
                </ul>
              </div>
              
              <div>
                <p>2. 自然擴散階段 (t &gt; 30秒)：</p>
                <p className="font-mono">r = r₀ + √(2 × D × (t - t₀)) × √(t/t₀)</p>
                <p>其中：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>r₀ = 初始事件階段結束時的半徑</li>
                  <li>D = 2.0 m²/s (擴散係數)</li>
                  <li>t₀ = 30秒 (初始階段時間)</li>
                  <li>t = 總時間 (秒)</li>
                </ul>
              </div>
              
              <div>
                <p>3. 風向影響因子：</p>
                <p className="font-mono">f = (cos(θ + θ_w) + 1) / 2</p>
                <p>其中：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>θ = 擴散角度</li>
                  <li>θ_w = 風向角度</li>
                  <li>f 範圍：0 到 1</li>
                </ul>
              </div>
              
              <div>
                <p>4. 風速影響距離：</p>
                <p className="font-mono">d_w = v_w × t × f</p>
                <p>其中：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>v_w = 風速 (m/s)</li>
                  <li>t = 時間 (秒)</li>
                  <li>f = 風向影響因子</li>
                </ul>
              </div>
              
              <div>
                <p>5. 總擴散距離：</p>
                <p className="font-mono">d_total = r + d_w</p>
                <p>其中：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>r = 基礎擴散半徑</li>
                  <li>d_w = 風速影響距離</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 座標轉換說明 */}
          <div>
            <h4 className="font-medium mb-2">座標轉換說明</h4>
            <div className="pl-4">
              <p>將擴散距離轉換為地理座標：</p>
              <p className="font-mono">緯度 = 原點緯度 - (d_total × cos(θ)) / 111000</p>
              <p className="font-mono">經度 = 原點經度 + (d_total × sin(θ)) / (111000 × cos(原點緯度))</p>
              <p className="text-xs mt-1">註：111000 為地球緯度 1 度對應的距離（公尺）</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {resetType === 'plant' 
                ? 'Reset Plant Location?' 
                : resetType === 'user'
                ? 'Reset User Location?'
                : 'Reset All Settings?'}
            </h3>
            <p className="text-gray-600 mb-6">
              {resetType === 'plant'
                ? 'This will remove the nuclear power plant location. Are you sure?'
                : resetType === 'user'
                ? 'This will remove your current location. Are you sure?'
                : 'This will stop the current simulation and reset all settings. Are you sure?'}
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  performReset(resetType);
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
} 