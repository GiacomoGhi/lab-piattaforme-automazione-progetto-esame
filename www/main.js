// Aquarium Monitor - Frontend JavaScript
// Polls the Things via HTTP and updates the UI

const BASE_URL = "http://localhost:8080";
const CONFIG_API_URL = "http://localhost:3001";
const POLL_INTERVAL = 2000; // ms

// Configuration loaded from API
let OPTIMAL_RANGES = {
  pH: { min: 6.5, max: 7.5, warningMin: 6.0, warningMax: 8.0 },
  temperature: { min: 24, max: 26, warningMin: 22, warningMax: 28 },
  oxygenLevel: { min: 6, max: 8, warningMin: 5, warningMax: 10 },
};

// Alerts data
const alerts = [];
const MAX_ALERTS = 10;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🐠 Aquarium Monitor UI starting...");

  // Load configuration from API
  await loadConfiguration();

  // Set up event listeners
  setupEventListeners();

  // Start polling
  startPolling();
});

/**
 * Load configuration from API and update UI
 */
async function loadConfiguration() {
  try {
    const response = await fetch(`${CONFIG_API_URL}/api/config`);
    if (!response.ok) throw new Error("Failed to load configuration");
    
    const config = await response.json();
    console.log("✅ Configuration loaded:", config);

    // Update OPTIMAL_RANGES from config
    for (const [paramName, paramConfig] of Object.entries(config.parameters)) {
      OPTIMAL_RANGES[paramName] = {
        min: paramConfig.optimal.min,
        max: paramConfig.optimal.max,
      };
    }

    // Update mode selector
    document.getElementById("mode-select").value = config.mode;

    // Populate parameter configuration UI
    populateParametersConfig(config.parameters);
  } catch (error) {
    console.error("❌ Error loading configuration:", error);
    console.warn("⚠️ Using default configuration");
  }
}

/**
 * Populate the parameters configuration section
 */
function populateParametersConfig(parameters) {
  const container = document.getElementById("parameters-config");
  container.innerHTML = "";

  for (const [paramName, paramConfig] of Object.entries(parameters)) {
    const paramDiv = document.createElement("div");
    paramDiv.className = "parameter-config";
    paramDiv.innerHTML = `
      <h4>${paramConfig.description} <span class="unit">(${paramConfig.unit})</span></h4>
      <div class="range-input">
        <label>Min:</label>
        <input type="number" step="0.1" class="param-input" data-param="${paramName}" data-bound="min" value="${paramConfig.optimal.min}">
      </div>
      <div class="range-input">
        <label>Max:</label>
        <input type="number" step="0.1" class="param-input" data-param="${paramName}" data-bound="max" value="${paramConfig.optimal.max}">
      </div>
    `;
    container.appendChild(paramDiv);
  }

  // Add Save button at the end
  const saveDiv = document.createElement("div");
  saveDiv.style.gridColumn = "1 / -1";
  saveDiv.style.marginTop = "20px";
  saveDiv.innerHTML = `
    <button id="save-config-btn" style="
      padding: 12px 30px;
      background: linear-gradient(135deg, #00d9ff, #0066cc);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    ">💾 Save Configuration</button>
  `;
  container.appendChild(saveDiv);

  // Add event listener to save button
  document.getElementById("save-config-btn").addEventListener("click", saveConfiguration);
}

function setupEventListeners() {
  // Mode selector
  const modeSelect = document.getElementById("mode-select");
  if (modeSelect) {
    modeSelect.addEventListener("change", async (e) => {
      const newMode = e.target.value;
      console.log(`🔄 Changing mode to: ${newMode}`);
      try {
        const response = await fetch(`${CONFIG_API_URL}/api/mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: newMode }),
        });
        if (response.ok) {
          console.log(`✅ Mode changed to: ${newMode}`);
        } else {
          console.error("Failed to change mode");
          // Revert selector
          await loadConfiguration();
        }
      } catch (error) {
        console.error("Error changing mode:", error);
        // Revert selector
        await loadConfiguration();
      }
    });
  }

  // Speed slider
  const speedSlider = document.getElementById("speed-slider");
  speedSlider.addEventListener("input", (e) => {
    // Preview the value
    document.getElementById("pump-speed").textContent = e.target.value;
  });

  // Set Speed button
  document
    .getElementById("set-speed-btn")
    .addEventListener("click", async () => {
      const speed = document.getElementById("speed-slider").value;
      await setPumpSpeed(speed);
    });

  // Cleaning button
  document
    .getElementById("cleaning-btn")
    .addEventListener("click", async () => {
      await startCleaningCycle();
    });

  // Stop button
  document.getElementById("stop-btn").addEventListener("click", async () => {
    await stopPump();
  });

  // Reset configuration button
  const resetBtn = document.getElementById("reset-config-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetConfiguration);
  }
}

/**
 * Save configuration changes to the server
 */
async function saveConfiguration() {
  try {
    // Gather all input values
    const inputs = document.querySelectorAll(".param-input");
    const config = await fetch(`${CONFIG_API_URL}/api/config`).then(r => r.json());

    // Update config with new values from inputs
    inputs.forEach(input => {
      const paramName = input.dataset.param;
      const bound = input.dataset.bound;
      const value = parseFloat(input.value);

      if (config.parameters[paramName]) {
        config.parameters[paramName].optimal[bound] = value;
      }
    });

    // Send updated config to server
    const response = await fetch(`${CONFIG_API_URL}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (response.ok) {
      console.log("✅ Configuration saved successfully");
      alert("✅ Configuration saved! Changes will apply to new measurements.");
      // Reload to ensure UI reflects saved values
      await loadConfiguration();
    } else {
      console.error("Failed to save configuration");
      alert("❌ Failed to save configuration");
    }
  } catch (error) {
    console.error("Error saving configuration:", error);
    alert("❌ Error saving configuration: " + error.message);
  }
}

/**
 * Reset configuration to defaults
 */
async function resetConfiguration() {
  if (!confirm("⚠️ Are you sure you want to reset all parameters to defaults?")) {
    return;
  }

  try {
    // Fetch default config from server (fresh from file)
    const response = await fetch(`${CONFIG_API_URL}/api/config`);
    if (!response.ok) throw new Error("Failed to fetch configuration");
    
    const config = await response.json();
    
    // Create default values based on original config structure
    const defaultConfig = {
      mode: "demo",
      description: config.description,
      parameters: {},
      modes: config.modes
    };

    // Reset all parameters to their hardcoded defaults
    defaultConfig.parameters.pH = {
      unit: "pH",
      description: "Water pH Level",
      optimal: { min: 6.5, max: 7.5 }
    };
    defaultConfig.parameters.temperature = {
      unit: "°C",
      description: "Water Temperature",
      optimal: { min: 24, max: 26 }
    };
    defaultConfig.parameters.oxygenLevel = {
      unit: "mg/L",
      description: "Dissolved Oxygen Level",
      optimal: { min: 6, max: 8 }
    };

    // Save reset config to server
    const saveResponse = await fetch(`${CONFIG_API_URL}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultConfig),
    });

    if (saveResponse.ok) {
      console.log("✅ Configuration reset to defaults");
      alert("✅ Configuration reset to defaults!");
      // Reload to ensure UI reflects default values
      await loadConfiguration();
    } else {
      console.error("Failed to reset configuration");
      alert("❌ Failed to reset configuration");
    }
  } catch (error) {
    console.error("Error resetting configuration:", error);
    alert("❌ Error resetting configuration: " + error.message);
  }
}

function startPolling() {
  // Initial fetch
  fetchAllData();

  // Poll periodically
  setInterval(fetchAllData, POLL_INTERVAL);
}

async function fetchAllData() {
  try {
    // Fetch sensor data
    const sensorData = await fetchSensorData();

    // Fetch pump data
    const pumpData = await fetchPumpData();

    // Update UI
    if (sensorData) {
      updateSensorUI(sensorData);
    }

    if (pumpData) {
      updatePumpUI(pumpData);
    }

    // Update connection status
    updateConnectionStatus(true);
  } catch (error) {
    console.error("Error fetching data:", error);
    updateConnectionStatus(false);
  }
}

async function fetchSensorData() {
  try {
    // Fetch all properties at once using the WoT readallproperties endpoint
    const res = await fetch(`${BASE_URL}/waterqualitysensor/properties`);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    // node-wot returns all properties in the response
    return {
      pH: data.pH !== undefined ? data.pH : 7.0,
      temperature: data.temperature !== undefined ? data.temperature : 25.0,
      oxygenLevel: data.oxygenLevel !== undefined ? data.oxygenLevel : 7.0,
    };
  } catch (error) {
    console.error("Error fetching sensor data:", error);
    return null;
  }
}

async function fetchPumpData() {
  try {
    // Fetch all properties at once using the WoT readallproperties endpoint
    const res = await fetch(`${BASE_URL}/filterpump/properties`);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    // node-wot returns all properties in the response
    return {
      speed: data.pumpSpeed !== undefined ? data.pumpSpeed : 0,
      status: data.filterStatus !== undefined ? data.filterStatus : "idle",
      health: data.filterHealth !== undefined ? data.filterHealth : 100,
      lastCleaning: data.lastCleaningTime || null,
    };
  } catch (error) {
    console.error("Error fetching pump data:", error);
    return null;
  }
}

function updateSensorUI(data) {
  // Update pH
  const phValue = typeof data.pH === "number" ? data.pH : parseFloat(data.pH);
  document.getElementById("ph-value").textContent = phValue.toFixed(2);
  const phStatus = getParameterStatus("pH", phValue);
  updateStatusIndicator("ph-status", phStatus);
  updateProgress("ph-progress", phValue, 0, 14);
  checkAndAddAlert("pH", phValue, phStatus);

  // Update temperature
  const tempValue =
    typeof data.temperature === "number"
      ? data.temperature
      : parseFloat(data.temperature);
  document.getElementById("temp-value").textContent =
    `${tempValue.toFixed(1)}°C`;
  const tempStatus = getParameterStatus("temperature", tempValue);
  updateStatusIndicator("temp-status", tempStatus);
  updateProgress("temp-progress", tempValue, 18, 32);
  checkAndAddAlert("Temperature", tempValue, tempStatus);

  // Update oxygen
  const oxygenValue =
    typeof data.oxygenLevel === "number"
      ? data.oxygenLevel
      : parseFloat(data.oxygenLevel);
  document.getElementById("oxygen-value").textContent =
    `${oxygenValue.toFixed(1)} mg/L`;
  const oxygenStatus = getParameterStatus("oxygenLevel", oxygenValue);
  updateStatusIndicator("oxygen-status", oxygenStatus);
  updateProgress("oxygen-progress", oxygenValue, 3, 12);
  checkAndAddAlert("Oxygen", oxygenValue, oxygenStatus);
}

function updatePumpUI(data) {
  // Update speed
  const speed =
    typeof data.speed === "number" ? data.speed : parseInt(data.speed);
  document.getElementById("pump-speed").textContent = speed;
  document.getElementById("speed-slider").value = speed;

  // Update status
  const statusEl = document.getElementById("pump-status");
  statusEl.textContent = data.status;
  statusEl.className = `status-value ${data.status}`;

  // Update filter health
  const health =
    typeof data.health === "number" ? data.health : parseInt(data.health);
  document.getElementById("filter-health").textContent = `${health}%`;
  document.getElementById("health-fill").style.width = `${health}%`;

  // Update health color
  const healthEl = document.getElementById("filter-health");
  if (health > 60) {
    healthEl.style.color = "#00c853";
  } else if (health > 30) {
    healthEl.style.color = "#ffc107";
  } else {
    healthEl.style.color = "#ff4444";
  }

  // Update last cleaning time
  if (data.lastCleaning) {
    const date = new Date(data.lastCleaning);
    document.getElementById("last-cleaning-time").textContent =
      date.toLocaleTimeString();
  }
}

function getParameterStatus(param, value) {
  const range = OPTIMAL_RANGES[param];
  if (!range) return "ok";

  const optimal = range;
  const rangeSize = optimal.max - optimal.min;
  const margin = rangeSize * 0.15; // 15% beyond optimal range
  
  const criticalMin = optimal.min - margin;
  const criticalMax = optimal.max + margin;

  if (value < criticalMin || value > criticalMax) {
    return "alert";
  } else if (value < optimal.min || value > optimal.max) {
    return "warning";
  }
  return "ok";
}

function updateStatusIndicator(elementId, status) {
  const el = document.getElementById(elementId);
  el.className = `status-indicator ${status}`;
}

function updateProgress(elementId, value, min, max) {
  const el = document.getElementById(elementId);
  const percent = ((value - min) / (max - min)) * 100;
  el.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById("Status");
  if (connected) {
    statusEl.textContent = "Status: connected";
    statusEl.classList.add("connected");
  } else {
    statusEl.textContent = "Status: disconnected";
    statusEl.classList.remove("connected");
  }
}

function checkAndAddAlert(param, value, status) {
  if (status === "ok") return;

  // Check if similar alert exists recently
  const recentAlert = alerts.find(
    (a) => a.param === param && Date.now() - a.time < 10000,
  );
  if (recentAlert) return;

  const message =
    status === "alert"
      ? `${param} is critical: ${value.toFixed(2)}`
      : `${param} is not optimal: ${value.toFixed(2)}`;

  addAlert(param, message, status);
}

function addAlert(param, message, status) {
  const alert = {
    param,
    message,
    status,
    time: Date.now(),
  };

  alerts.unshift(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts.pop();
  }

  renderAlerts();
}

function renderAlerts() {
  const container = document.getElementById("alerts-container");

  if (alerts.length === 0) {
    container.innerHTML = '<p class="no-alerts">No alerts yet</p>';
    return;
  }

  container.innerHTML = alerts
    .map(
      (alert) => {
        const date = new Date(alert.time);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        const formattedTime = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
        
        return `
      <div class="alert-item ${alert.status}">
        <span class="alert-time">${formattedTime}</span>
        <span class="alert-message">${alert.message}</span>
      </div>
    `;
      }
    )
    .join("");
}

// Pump control actions
async function setPumpSpeed(speed) {
  try {
    const response = await fetch(
      `${BASE_URL}/filterpump/actions/setPumpSpeed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseInt(speed)),
      },
    );

    if (response.ok) {
      console.log(`Pump speed set to ${speed}%`);
    } else {
      console.error("Failed to set pump speed");
    }
  } catch (error) {
    console.error("Error setting pump speed:", error);
  }
}

async function startCleaningCycle() {
  try {
    document.getElementById("cleaning-btn").disabled = true;
    document.getElementById("cleaning-btn").textContent = "🔄 Cleaning...";

    const response = await fetch(
      `${BASE_URL}/filterpump/actions/cleaningCycle`,
      {
        method: "POST",
      },
    );

    if (response.ok) {
      console.log("Cleaning cycle started");
      addAlert("Filter", "Cleaning cycle started", "warning");
    } else {
      console.error("Failed to start cleaning cycle");
    }
  } catch (error) {
    console.error("Error starting cleaning cycle:", error);
  } finally {
    document.getElementById("cleaning-btn").disabled = false;
    document.getElementById("cleaning-btn").textContent = "🧹 Start Cleaning";
  }
}

async function stopPump() {
  try {
    const response = await fetch(
      `${BASE_URL}/filterpump/actions/setPumpSpeed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseInt(0)),
      },
    );

    if (response.ok) {
      console.log("Pump stopped");
      addAlert("Pump", "Pump stopped manually", "warning");
    } else {
      console.error("Failed to stop pump");
    }
  } catch (error) {
    console.error("Error stopping pump:", error);
  }
}
