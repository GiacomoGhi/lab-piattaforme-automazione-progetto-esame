import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { Servient } from "@node-wot/core";
import { HttpServer, HttpClientFactory } from "@node-wot/binding-http";
import { ModbusClientFactory } from "@node-wot/binding-modbus";
import WoT from "wot-typescript-definitions";

import { WaterQualitySensorThing } from "./things/WaterQualitySensorThing";
import { FilterPumpThing } from "./things/FilterPumpThing";
import { SAMPLING_CONFIG, logConfiguration } from "./config/sampling.config";

// ====================================
// AQUARIUM MONITOR - ORCHESTRATOR
// ====================================
// Water Quality Sensor (HTTP) + Filter Pump (Modbus)
// Logic:
// - pH out of range (< 6.5 or > 7.5) → increase pump speed
// - Temperature > 26°C → emit alert
// - Low oxygen (< 6 mg/L) → increase pump speed
// - Automatic daily cleaning cycle
// ====================================

// ====== FILE LOGGING UTILITY ======
const logsDir = path.join(__dirname, "..", "test-logs");
const logFile = path.join(logsDir, `test-${new Date().toISOString().split("T")[0]}-${Date.now()}.log`);

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function logEvent(event: string, level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO") {
  ensureLogsDir();
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [${level}] ${event}\n`;
  fs.appendFileSync(logFile, message);
  console.log(message.trim());
}

interface OrchestratorState {
  lastAlertTime: number;
  alertCooldown: number; // ms
  autoCleaningEnabled: boolean;
  lastDailyCleaningDate: string;
}

const state: OrchestratorState = {
  lastAlertTime: 0,
  alertCooldown: 10000, // 10 seconds between alerts
  autoCleaningEnabled: true,
  lastDailyCleaningDate: "",
};

function getTDFromFile(filePath: string): WoT.ThingDescription {
  return JSON.parse(fs.readFileSync(filePath).toString());
}

/**
 * Serve static files (index.html, www/*, etc.)
 */
function startStaticFileServer(port: number = 3000): void {
  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Route to index.html by default
    let filePath = (req.url === "/" || !req.url) ? "/index.html" : req.url;

    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");

    // Map URL to file system
    const fullPath = path.join(process.cwd(), filePath);

    // Try to serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        // If file not found and it's not a special path, try index.html
        if (filePath !== "/index.html" && !filePath.includes(".")) {
          fs.readFile(path.join(process.cwd(), "index.html"), (err2, data2) => {
            if (err2) {
              res.writeHead(404, { "Content-Type": "text/plain" });
              res.end("404 Not Found");
            } else {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(data2);
            }
          });
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
        }
        return;
      }

      // Determine content type
      const ext = path.extname(fullPath).toLowerCase();
      const contentTypes: { [key: string]: string } = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
      };

      const contentType = contentTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });

  server.listen(port, () => {
    console.log(`📡 Static file server listening on http://localhost:${port}`);
    console.log(`   Open: http://localhost:${port}\n`);
  });
}

(async function main() {
  console.log("🐠 Starting Aquarium Monitor System...\n");

  // Start static file server (serves index.html, www/*, etc.)
  startStaticFileServer(3000);

  // Create servient with HTTP server and Modbus client
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8080 }));
  servient.addClientFactory(new ModbusClientFactory());
  servient.addClientFactory(new HttpClientFactory(null));

  const wotRuntime = await servient.start();

  // Read TDs from files
  const waterSensorTD = getTDFromFile("./models/water-quality-sensor.tm.json");
  const filterPumpProxyTD = getTDFromFile("./models/filter-pump.tm.json");
  const filterPumpModbusTD = getTDFromFile(
    "./models/filter-pump-modbus.td.json"
  );

  // Create Water Quality Sensor (HTTP Thing)
  const waterSensor = new WaterQualitySensorThing(wotRuntime, waterSensorTD);
  await waterSensor.startAsync();
  console.log("✅ Water Quality Sensor exposed (HTTP)\n");

  // Create Filter Pump (Modbus Proxy Thing)
  const filterPump = new FilterPumpThing(
    wotRuntime,
    filterPumpProxyTD,
    filterPumpModbusTD
  );
  await filterPump.start();
  console.log("✅ Filter Pump exposed (HTTP Proxy → Modbus)\n");

  // Create HTTP client to consume things for orchestration
  const clientServient = new Servient();
  clientServient.addClientFactory(new HttpClientFactory(null));
  const clientRuntime = await clientServient.start();

  // Wait a moment for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Consume the Things via HTTP
  const sensorTD = await clientRuntime.requestThingDescription(
    "http://localhost:8080/waterqualitysensor"
  );
  const consumedSensor = await clientRuntime.consume(sensorTD);

  const pumpTD = await clientRuntime.requestThingDescription(
    "http://localhost:8080/filterpump"
  );
  const consumedPump = await clientRuntime.consume(pumpTD);

  console.log("🔗 Things consumed, starting orchestration...\n");

  // ====== ORCHESTRATION LOGIC ======

  // Subscribe to water quality alerts
  consumedSensor.subscribeEvent("parameterAlert", async (data) => {
    const alert: any = await data.value();
    const now = Date.now();

    logEvent(`ALERT [${alert.status.toUpperCase()}] ${alert.parameter}: ${alert.value.toFixed(2)} - ${alert.message}`, "WARN");

    // Check cooldown
    if (now - state.lastAlertTime < state.alertCooldown) {
      logEvent(`Cooldown active, skipping action (${Math.round((state.alertCooldown - (now - state.lastAlertTime)) / 1000)}s remaining)`, "DEBUG");
      return;
    }
    state.lastAlertTime = now;

    // Get current pump speed
    const currentSpeed = await consumedPump.readProperty("pumpSpeed");
    const speedValue = await currentSpeed.value();
    const speed = Number(speedValue);

    // React based on parameter
    if (alert.parameter === "pH" && alert.status === "alert") {
      // pH critical - increase pump speed to improve water circulation
      const newSpeed = Math.min(100, speed + 20);
      logEvent(`ACTION: pH CRITICAL - Increasing pump speed from ${speed}% to ${newSpeed}%`, "WARN");
      await consumedPump.invokeAction("setPumpSpeed", newSpeed);
      // Wait for action to complete before reading back the value (avoids NaN race condition)
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Activate pump compensation in controlled test mode
      waterSensor.setPumpCompensation(true);
      logEvent(`✓ Pump speed updated to ${newSpeed}%`, "INFO");
    } else if (alert.parameter === "temperature" && alert.status === "alert") {
      // Temperature critical - increase pump speed for cooling
      const newSpeed = Math.min(100, speed + 20);
      logEvent(`ACTION: TEMPERATURE CRITICAL - Increasing pump speed from ${speed}% to ${newSpeed}% for cooling`, "WARN");
      await consumedPump.invokeAction("setPumpSpeed", newSpeed);
      // Wait for action to complete before reading back the value (avoids NaN race condition)
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Activate pump compensation in controlled test mode
      waterSensor.setPumpCompensation(true);
      logEvent(`✓ Pump speed updated to ${newSpeed}%`, "INFO");
    } else if (alert.parameter === "oxygenLevel" && alert.status === "alert") {
      // Oxygen low - increase pump speed for better aeration
      const newSpeed = Math.min(100, speed + 25);
      logEvent(`ACTION: OXYGEN LOW - Increasing pump speed from ${speed}% to ${newSpeed}% for aeration`, "WARN");
      await consumedPump.invokeAction("setPumpSpeed", newSpeed);
      // Wait for action to complete before reading back the value (avoids NaN race condition)
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Activate pump compensation in controlled test mode
      waterSensor.setPumpCompensation(true);
      logEvent(`✓ Pump speed updated to ${newSpeed}%`, "INFO");
    }
  });

  // Daily automatic cleaning cycle check
  if (state.autoCleaningEnabled) {
    setInterval(async () => {
      const today = new Date().toDateString();

      // Check if we've already done daily cleaning today
      if (state.lastDailyCleaningDate !== today) {
        try {
          const healthProp = await consumedPump.readProperty("filterHealth");
          const health = Number(await healthProp.value());

          // Trigger daily cleaning if health is below 50% OR it's a new day
          if (health < 50) {
            logEvent(`CLEANING CYCLE INITIATED - Filter health: ${health}%`, "WARN");
            await consumedPump.invokeAction("cleaningCycle");
            state.lastDailyCleaningDate = today;
            logEvent(`✓ Cleaning cycle completed`, "INFO");
          }
        } catch (error) {
          logEvent(`Error during daily cleaning check: ${error}`, "ERROR");
        }
      }
    }, SAMPLING_CONFIG.ORCHESTRATION_CHECK_INTERVAL); // Configured via ORCHESTRATION_CHECK_INTERVAL env var
  }

  // Periodic status logging
  let statusLogCount = 0;
  setInterval(async () => {
    try {
      const allParams = await consumedSensor.readProperty("allParameters");
      const params: any = await allParams.value();

      const pumpSpeedProp = await consumedPump.readProperty("pumpSpeed");
      const speed = await pumpSpeedProp.value();

      const filterHealthProp = await consumedPump.readProperty("filterHealth");
      const health = await filterHealthProp.value();

      const filterStatusProp = await consumedPump.readProperty("filterStatus");
      const status = await filterStatusProp.value();

      // Log status report
      logEvent(`STATUS REPORT: pH=${params.pH?.toFixed(2)} Temp=${params.temperature?.toFixed(1)}°C O2=${params.oxygenLevel?.toFixed(1)} PumpSpeed=${speed}% PumpStatus=${status} FilterHealth=${health}%`, "DEBUG");
    } catch (error) {
      logEvent(`Error reading status: ${error}`, "ERROR");
    }
  }, SAMPLING_CONFIG.ORCHESTRATION_CHECK_INTERVAL); // Configured via ORCHESTRATION_CHECK_INTERVAL env var

  // Log configuration on startup
  logConfiguration();
  logEvent("🎮 Aquarium Monitor started - Test session begun", "INFO");
  logEvent("Waiting for critical alerts to trigger pump action...", "INFO");
  console.log("🎮 Aquarium Monitor running. Press Ctrl+C to stop.");
  console.log("⚠️  Make sure the Modbus mock server is running!");
  console.log("    Run: npx ts-node src/mock/ModbusFilterPumpMockServer.ts\n");
  console.log(`📝 Test log: ${logFile}\n`);
})();
