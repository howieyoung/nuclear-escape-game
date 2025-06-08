// Game Configuration
const CONFIG = {
    SPREAD_SPEED_KM_PER_HOUR: 50,
    MAX_SIMULATION_TIME: 48,
    RADIATION_CLOUD_RADIUS: 100,
    RADIATION_CLOUD_COLOR: '#ff0000',
    SAFE_COLOR: '#4CAF50',
    WARNING_COLOR: '#FFA500',
    DANGER_COLOR: '#FF0000',
    EVACUATION_DIFFICULTY: {
        LOW: 1.0,
        MEDIUM: 1.5,
        HIGH: 2.0,
        EXTREME: 2.5
    },
    EXPANSION_RATE: 100, // Radiation cloud expansion rate in meters per second
    UPDATE_INTERVAL: 1000 // Update interval in milliseconds
};

// Map and Sound Constants
const SOUNDS = {
    ALARM: document.getElementById('alarmSound'),
    EXPLOSION: document.getElementById('explosionSound')
};

// Global State
let map;
let nuclearPlantMarker;
let radiationCircle;
let simulationInterval;
let timeRemaining = CONFIG.MAX_SIMULATION_TIME;
let isPaused = false;
let isSoundOn = true;
let currentSpeed = CONFIG.SPREAD_SPEED_KM_PER_HOUR;
let currentWindDirection = 'NE';
let plantLocation = null;
let isSimulationRunning = false;

// Initialize Game
function initializeGame() {
    // Initialize map
    map = L.map('map').setView(TAIWAN_COORDS, 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load Taiwan counties GeoJSON
    loadTaiwanCounties();

    // Add click event listener for nuclear plant placement
    map.on('click', (e) => {
        if (!isSimulationRunning) {
            // Remove existing plant marker
            if (nuclearPlantMarker) {
                map.removeLayer(nuclearPlantMarker);
            }

            // Add new nuclear plant marker
            nuclearPlantMarker = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'nuclear-marker',
                    html: `
                        <div class="plant-icon">
                            <span>☢️</span>
                            <div class="plant-label">Nuclear Plant</div>
                        </div>
                    `
                })
            }).addTo(map);

            plantLocation = e.latlng;
            updatePlantButtonState();
        }
    });

    // Initialize event listeners
    document.getElementById('startButton').addEventListener('click', () => {
        document.getElementById('startButton').style.display = 'none';
        document.getElementById('simulateButton').style.display = 'block';
        document.getElementById('setPlantButton').style.display = 'block';
    });

    document.getElementById('simulateButton').addEventListener('click', startSimulation);
    document.getElementById('setPlantButton').addEventListener('click', clearPlantLocation);
    document.getElementById('pauseButton').addEventListener('click', togglePause);
    document.getElementById('speedSlider').addEventListener('input', updateSpeed);
    document.getElementById('windDirection').addEventListener('change', updateWindDirection);
    document.getElementById('soundIcon').addEventListener('click', toggleSound);
    document.getElementById('retryButton').addEventListener('click', () => window.location.reload());
    document.getElementById('map').addEventListener('mousemove', updateInfoBoxPosition);
}

// Load Taiwan counties GeoJSON
function loadTaiwanCounties() {
    fetch('taiwan_counties.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: feature => ({
                    fillColor: feature.properties.color,
                    weight: 2,
                    opacity: 1,
                    color: 'white',
                    dashArray: '3',
                    fillOpacity: 0.7
                }),
                onEachFeature: (feature, layer) => {
                    layer.on('mouseover', e => {
                        const content = `
                            <div class="county-info">
                                <h3>${feature.properties.name}</h3>
                                <p>Population: ${feature.properties.population.toLocaleString()}</p>
                                <p>Density: ${feature.properties.density}</p>
                                <p>Evacuation Difficulty: ${feature.properties.evacuation_difficulty}</p>
                            </div>
                        `;
                        document.getElementById('infoBox').innerHTML = content;
                        document.getElementById('infoBox').style.display = 'block';
                    });
                    
                    layer.on('mouseout', () => {
                        document.getElementById('infoBox').style.display = 'none';
                    });
                }
            }).addTo(map);
        });
}

// Update plant button state
function updatePlantButtonState() {
    const button = document.getElementById('setPlantButton');
    if (button) {
        if (plantLocation) {
            button.textContent = 'Clear Plant Location';
            button.classList.remove('set-button');
            button.classList.add('clear-button');
        } else {
            button.textContent = 'Set Plant Location';
            button.classList.remove('clear-button');
            button.classList.add('set-button');
        }
    }
}

// Clear plant location
function clearPlantLocation() {
    if (plantLocation) {
        map.removeLayer(nuclearPlantMarker);
        plantLocation = null;
        nuclearPlantMarker = null;
        updatePlantButtonState();
    }
}

// Toggle pause
function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseButton').textContent = isPaused ? 'Resume' : 'Pause';
}

// Update speed
function updateSpeed(e) {
    currentSpeed = parseInt(e.target.value);
    document.getElementById('speedValue').textContent = `${currentSpeed} km/h`;
}

// Update wind direction
function updateWindDirection(e) {
    currentWindDirection = e.target.value;
}

// Toggle sound
function toggleSound() {
    isSoundOn = !isSoundOn;
    document.getElementById('soundIcon').className = isSoundOn ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    SOUNDS.ALARM.muted = !isSoundOn;
    SOUNDS.EXPLOSION.muted = !isSoundOn;
}

// Update info box position
function updateInfoBoxPosition(e) {
    const infoBox = document.getElementById('infoBox');
    if (infoBox.style.display === 'block') {
        infoBox.style.left = `${e.clientX + 10}px`;
        infoBox.style.top = `${e.clientY + 10}px`;
    }
}

// Format time
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Update timer
function updateTimer() {
    document.getElementById('timer').textContent = formatTime(timeRemaining * 3600);
}

// Start simulation
function startSimulation() {
    if (!plantLocation) {
        alert('Please select a nuclear plant location first!');
        return;
    }

    if (isSimulationRunning) {
        // Reset simulation
        clearInterval(simulationInterval);
        if (radiationCircle) {
            map.removeLayer(radiationCircle);
        }
        // Reset county colors
        map.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                layer.setStyle({ fillColor: layer.feature.properties.color });
            }
        });
        isSimulationRunning = false;
        document.getElementById('simulateButton').textContent = 'Simulate Disaster';
        return;
    }

    // Start new simulation
    isSimulationRunning = true;
    document.getElementById('simulateButton').textContent = 'Reset Simulation';

    // Play explosion sound
    if (isSoundOn) {
        SOUNDS.EXPLOSION.play();
        SOUNDS.ALARM.play();
    }

    // Initialize radiation circle
    radiationCircle = L.circle(plantLocation, {
        color: CONFIG.RADIATION_CLOUD_COLOR,
        fillColor: CONFIG.RADIATION_CLOUD_COLOR,
        fillOpacity: 0.2,
        radius: CONFIG.RADIATION_CLOUD_RADIUS * 1000
    }).addTo(map);

    // Start simulation loop
    timeRemaining = CONFIG.MAX_SIMULATION_TIME;
    updateTimer();
    
    simulationInterval = setInterval(() => {
        if (isPaused) return;

        timeRemaining--;
        updateTimer();
        
        if (timeRemaining <= 0) {
            endSimulation();
            return;
        }

        // Update radiation circle radius
        const newRadius = CONFIG.RADIATION_CLOUD_RADIUS * 1000 + (timeRemaining * currentSpeed * 1000);
        radiationCircle.setRadius(newRadius);
        updateCountyStatus(plantLocation.lat, plantLocation.lng, newRadius / 1000);
    }, CONFIG.UPDATE_INTERVAL);
}

// Update county status
function updateCountyStatus(lat, lng, radius) {
    // Get all county layers
    const countyLayers = map._layers;
    
    Object.entries(countyLayers).forEach(([id, layer]) => {
        if (layer.feature && layer.feature.properties) {
            const county = layer.feature.properties;
            const distance = calculateDistance(lat, lng, layer.getBounds().getCenter().lat, layer.getBounds().getCenter().lng);
            
            let timeToImpact = Math.round((radius - distance) / currentSpeed);
            
            // Apply evacuation difficulty multiplier
            const difficultyMultiplier = CONFIG.EVACUATION_DIFFICULTY[county.evacuation_difficulty.toUpperCase()];
            timeToImpact = Math.max(0, Math.floor(timeToImpact / difficultyMultiplier));
            
            // Update county status
            if (timeToImpact <= 6) {
                layer.setStyle({ fillColor: CONFIG.DANGER_COLOR });
            } else if (timeToImpact <= 24) {
                layer.setStyle({ fillColor: CONFIG.WARNING_COLOR });
            } else {
                layer.setStyle({ fillColor: CONFIG.SAFE_COLOR });
            }
        }
    });
}

// Calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// End simulation
function endSimulation() {
    clearInterval(simulationInterval);
    SOUNDS.ALARM.pause();
    
    const results = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    
    if (results && resultsContent) {
        results.style.display = 'block';
        
        // Generate evacuation summary
        const summary = document.createElement('div');
        summary.className = 'evacuation-summary';
        
        // Get all county layers
        const countyLayers = map._layers;
        let safeCount = 0;
        let warningCount = 0;
        let dangerCount = 0;
        
        Object.entries(countyLayers).forEach(([id, layer]) => {
            if (layer.feature && layer.feature.properties) {
                const county = layer.feature.properties;
                const distance = calculateDistance(plantLocation.lat, plantLocation.lng, 
                    layer.getBounds().getCenter().lat, layer.getBounds().getCenter().lng);
                
                let timeToImpact = Math.round((radius - distance) / currentSpeed);
                
                if (timeToImpact <= 6) dangerCount++;
                else if (timeToImpact <= 24) warningCount++;
                else safeCount++;
            }
        });
        
        summary.innerHTML = `
            <h3>Evacuation Summary</h3>
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-number ${safeCount > 0 ? 'safe' : ''}">${safeCount}</div>
                    <div class="stat-label">Safe Counties</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number ${warningCount > 0 ? 'warning' : ''}">${warningCount}</div>
                    <div class="stat-label">Warning Counties</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number ${dangerCount > 0 ? 'danger' : ''}">${dangerCount}</div>
                    <div class="stat-label">Danger Counties</div>
                </div>
            </div>
        `;
        
        resultsContent.appendChild(summary);
        
        document.getElementById('resultsText').textContent = 'The simulation has ended. Please reflect on the importance of nuclear safety and emergency preparedness.';
    }
    
    // Reset simulation state
    isSimulationRunning = false;
    document.getElementById('simulateButton').textContent = 'Simulate Disaster';
    
    // Reset county colors
    map.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            layer.setStyle({ fillColor: layer.feature.properties.color });
        }
    });
}

// Initialize game when page loads
window.addEventListener('load', initializeGame);

// Update info box position based on mouse movement
document.getElementById('map').addEventListener('mousemove', updateInfoBoxPosition);

// Add loading spinner
document.getElementById('loading').style.display = 'block';
window.addEventListener('load', () => {
    document.getElementById('loading').style.display = 'none';
});
