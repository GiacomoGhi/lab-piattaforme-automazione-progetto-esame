// Aquarium Monitor - Frontend JavaScript
// Polls the Things via HTTP and updates the UI

const BASE_URL = "http://localhost:8080";
const POLL_INTERVAL = 2000; // ms

// Optimal ranges for status calculation
const OPTIMAL_RANGES = {
  pH: { min: 6.5, max: 7.5, warningMin: 6.0, warningMax: 8.0 },
  temperature: { min: 24, max: 26, warningMin: 22, warningMax: 28 },
  oxygenLevel: { min: 6, max: 8, warningMin: 5, warningMax: 10 },
};

// Alerts data
const alerts = [];
const MAX_ALERTS = 10;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  console.log("🐠 Aquarium Monitor UI starting...");

  // Set up event listeners
  setupEventListeners();

  // Start polling
  startPolling();
});

function setupEventListeners() {
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
  document.getElementById("temp-value").textContent = `${tempValue.toFixed(
    1
  )}°C`;
  const tempStatus = getParameterStatus("temperature", tempValue);
  updateStatusIndicator("temp-status", tempStatus);
  updateProgress("temp-progress", tempValue, 18, 32);
  checkAndAddAlert("Temperature", tempValue, tempStatus);

  // Update oxygen
  const oxygenValue =
    typeof data.oxygenLevel === "number"
      ? data.oxygenLevel
      : parseFloat(data.oxygenLevel);
  document.getElementById("oxygen-value").textContent = `${oxygenValue.toFixed(
    1
  )} mg/L`;
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

  if (value < range.warningMin || value > range.warningMax) {
    return "alert";
  } else if (value < range.min || value > range.max) {
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
    (a) => a.param === param && Date.now() - a.time < 10000
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
      (alert) => `
      <div class="alert-item ${alert.status}">
        <span class="alert-time">${new Date(
          alert.time
        ).toLocaleTimeString()}</span>
        <span class="alert-message">${alert.message}</span>
      </div>
    `
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
      }
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
      }
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
    const response = await fetch(`${BASE_URL}/filterpump/actions/stopPump`, {
      method: "POST",
    });

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
