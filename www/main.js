// Aquarium Monitor - Frontend JavaScript
// Polls the Things via HTTP and updates the UI

const BASE_URL = "http://localhost:8080";
const POLL_INTERVAL = 3000; // ms

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
    const response = await fetch(`${BASE_URL}/waterqualitysensor/properties/config`);
    if (!response.ok) throw new Error("Failed to load configuration");

    const config = await response.json();
    console.log("✅ Configuration loaded:", config);

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
    const configMin = paramConfig.configurable.min;
    const configMax = paramConfig.configurable.max;
    paramDiv.innerHTML = `
      <h4>${paramConfig.description} <span class="unit">(${paramConfig.unit})</span></h4>
      <div class="config-limits">
        Configurable range: ${configMin} - ${configMax}
      </div>
      <div class="range-input">
        <label>Min:</label>
        <input type="number" step="0.1" class="param-input" data-param="${paramName}" data-bound="min" value="${paramConfig.optimal.min}" min="${configMin}" max="${configMax}" title="Min must be less than Max (${configMin}-${configMax})">
      </div>
      <div class="range-input">
        <label>Max:</label>
        <input type="number" step="0.1" class="param-input" data-param="${paramName}" data-bound="max" value="${paramConfig.optimal.max}" min="${configMin}" max="${configMax}" title="Max must be greater than Min (${configMin}-${configMax})">
      </div>
    `;
    container.appendChild(paramDiv);
  }

  // Add Save button at the end
  const saveDiv = document.createElement("div");
  saveDiv.className = "save-config-container";
  saveDiv.innerHTML = `
    <button id="save-config-btn">💾 Save Configuration</button>
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
        const response = await fetch(`${BASE_URL}/waterqualitysensor/properties/mode`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMode),
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
    const inputs = document.querySelectorAll(".param-input");
    const config = await fetch(`${BASE_URL}/waterqualitysensor/properties/config`).then(r => r.json());

    // Validate min < max for each parameter
    const paramNames = new Set([...inputs].map(i => i.dataset.param));
    for (const paramName of paramNames) {
      const min = parseFloat(document.querySelector(`[data-param="${paramName}"][data-bound="min"]`).value);
      const max = parseFloat(document.querySelector(`[data-param="${paramName}"][data-bound="max"]`).value);
      if (min >= max) {
        alert(`❌ ${paramName}: Min must be less than Max`);
        return;
      }
    }

    // Update config with new values
    inputs.forEach(input => {
      const { param, bound } = input.dataset;
      if (config.parameters[param]) {
        config.parameters[param].optimal[bound] = parseFloat(input.value);
      }
    });

    const response = await fetch(`${BASE_URL}/waterqualitysensor/properties/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (response.ok) {
      alert("✅ Configuration saved!");
      await loadConfiguration();
    } else {
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
  if (!confirm("⚠️ Are you sure you want to reset all parameters to defaults?")) return;

  try {
    const config = await fetch(`${BASE_URL}/waterqualitysensor/properties/config`).then(r => r.json());

    // Reset optimal ranges, keeping everything else intact
    const defaults = { pH: [6.5, 7.5], temperature: [24, 26], oxygenLevel: [6, 8] };
    for (const [param, [min, max]] of Object.entries(defaults)) {
      if (config.parameters[param]) {
        config.parameters[param].optimal = { min, max };
      }
    }
    config.mode = "demo";

    const response = await fetch(`${BASE_URL}/waterqualitysensor/properties/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (response.ok) {
      alert("✅ Configuration reset to defaults!");
      await loadConfiguration();
    } else {
      alert("❌ Failed to reset configuration");
    }
  } catch (error) {
    console.error("Error resetting configuration:", error);
    alert("❌ Error: " + error.message);
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
      pHStatus: data.pHStatus,
      temperatureStatus: data.temperatureStatus,
      oxygenLevelStatus: data.oxygenLevelStatus,
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
  document.getElementById("ph-value").textContent = data.pH.toFixed(2);
  updateStatusIndicator("ph-status", data.pHStatus);
  updateProgress("ph-progress", data.pH, 0, 14);
  checkAndAddAlert("pH", data.pH, data.pHStatus);

  document.getElementById("temp-value").textContent = `${data.temperature.toFixed(1)}°C`;
  updateStatusIndicator("temp-status", data.temperatureStatus);
  updateProgress("temp-progress", data.temperature, 18, 32);
  checkAndAddAlert("Temperature", data.temperature, data.temperatureStatus);

  document.getElementById("oxygen-value").textContent = `${data.oxygenLevel.toFixed(1)} mg/L`;
  updateStatusIndicator("oxygen-status", data.oxygenLevelStatus);
  updateProgress("oxygen-progress", data.oxygenLevel, 3, 12);
  checkAndAddAlert("Oxygen", data.oxygenLevel, data.oxygenLevelStatus);
}

function updatePumpUI(data) {
  document.getElementById("pump-speed").textContent = data.speed;
  document.getElementById("speed-slider").value = data.speed;

  const statusEl = document.getElementById("pump-status");
  statusEl.textContent = data.status;
  statusEl.className = `status-value ${data.status}`;

  document.getElementById("filter-health").textContent = `${data.health}%`;
  document.getElementById("health-fill").style.width = `${data.health}%`;

  const healthEl = document.getElementById("filter-health");
  healthEl.className = `health-value ${data.health > 60 ? "health-good" : data.health > 30 ? "health-warning" : "health-critical"}`;

  if (data.lastCleaning) {
    document.getElementById("last-cleaning-time").textContent =
      new Date(data.lastCleaning).toLocaleTimeString();
  }
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
