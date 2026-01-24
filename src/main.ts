import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { Servient } from "@node-wot/core";
import { HttpServer, HttpClientFactory } from "@node-wot/binding-http";
import { ModbusClientFactory } from "@node-wot/binding-modbus";

import { WaterQualitySensorThing } from "./things/WaterQualitySensorThing";
import { FilterPumpThing } from "./things/FilterPumpThing";
import { WaterThing } from "./things/WaterThing";

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
  const waterTD = getTDFromFile("./models/water.tm.json");
  const waterSensorTD = getTDFromFile("./models/water-quality-sensor.tm.json");
  const filterPumpProxyTD = getTDFromFile("./models/filter-pump.tm.json");
  const filterPumpModbusTD = getTDFromFile(
    "./models/filter-pump-modbus.td.json"
  );

  // Create Water Digital Twin (source of truth for water state)
  const water = new WaterThing(wotRuntime, waterTD);
  await water.start();
  console.log("✅ Water Digital Twin exposed (HTTP)\n");

  // Create Water Quality Sensor (HTTP Thing) - subscribes to Water Digital Twin
  // Using 3 second sampling interval for demo (configurable 3s to 30min)
  const waterSensor = new WaterQualitySensorThing(wotRuntime, waterSensorTD, 3000);
  await waterSensor.startAsync();
  console.log("✅ Water Quality Sensor exposed (HTTP)\n");

  // Create Filter Pump (Modbus Proxy Thing) - pass water reference for correction logic
  const filterPump = new FilterPumpThing(
    wotRuntime,
    filterPumpProxyTD,
    filterPumpModbusTD,
    water
  );
  await filterPump.start();
  console.log("✅ Filter Pump exposed (HTTP Proxy → Modbus)\n");

  // Start initial water degradation simulation (pump starts off)
  water.startDegradationSimulation();
  console.log("🌊 Water degradation simulation started\n");

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

    console.log(`\n🚨 Parameter Alert received: ${JSON.stringify(alert)}`);

    // Check cooldown
    if (now - state.lastAlertTime < state.alertCooldown) {
      console.log("⏳ Alert cooldown active, skipping action");
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
      console.log(`🔄 pH critical - increasing pump speed to ${newSpeed}%`);
      await consumedPump.invokeAction("setPumpSpeed", newSpeed);
    } else if (alert.parameter === "temperature" && alert.status === "alert") {
      // Temperature > 26°C - emit alert
      console.log(
        "🌡️ TEMPERATURE ALERT: Water temperature is critical! Check cooling system."
      );
    } else if (alert.parameter === "oxygenLevel" && alert.status === "alert") {
      // Oxygen low - increase pump speed for better aeration
      const newSpeed = Math.min(100, speed + 25);
      console.log(`💨 Oxygen low - increasing pump speed to ${newSpeed}%`);
      await consumedPump.invokeAction("setPumpSpeed", newSpeed);
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
            console.log(
              `\n🧹 Daily cleaning cycle - Filter health: ${health}%`
            );
            await consumedPump.invokeAction("cleaningCycle");
            state.lastDailyCleaningDate = today;
          }
        } catch (error) {
          console.error("Error during daily cleaning check:", error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Periodic status logging
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

      console.log("\n📊 === AQUARIUM STATUS ===");
      console.log(`   pH: ${params.pH?.toFixed(2)}`);
      console.log(`   Temperature: ${params.temperature?.toFixed(1)}°C`);
      console.log(`   Oxygen: ${params.oxygenLevel?.toFixed(1)} mg/L`);
      console.log(`   Pump Speed: ${speed}% (${status})`);
      console.log(`   Filter Health: ${health}%`);
      console.log("========================\n");
    } catch (error) {
      console.error("Error reading status:", error);
    }
  }, 10000); // Log every 10 seconds

  console.log("🎮 Aquarium Monitor running. Press Ctrl+C to stop.");
  console.log("⚠️  Make sure the Modbus mock server is running!");
  console.log("    Run: npx ts-node src/mock/ModbusFilterPumpMockServer.ts\n");

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Shutting down...");
    water.stop();
    waterSensor.stop();
    filterPump.stop();
    process.exit(0);
  });
})();
