import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { Servient } from "@node-wot/core";
import { HttpServer, HttpClientFactory } from "@node-wot/binding-http";
import { ModbusClientFactory } from "@node-wot/binding-modbus";

import { WaterQualitySensorThing } from "./things/WaterQualitySensorThing";
import { FilterPumpThing } from "./things/FilterPumpThing";
import { WaterThing } from "./things/WaterThing";
import type { ParameterStatus } from "./types/WaterTypes";

// ====================================
// AQUARIUM MONITOR - ORCHESTRATOR
// ====================================

interface OrchestratorState {
  autoCleaningEnabled: boolean;
  lastDailyCleaningDate: string;
}

const state: OrchestratorState = {
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
    let filePath = req.url === "/" || !req.url ? "/index.html" : req.url;

    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");

    // Map URL to file system
    const fullPath = path.join(process.cwd(), filePath);

    // Try to serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
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
    console.log(`Static file server listening on http://localhost:${port}`);
    console.log(`   Open: http://localhost:${port}\n`);
  });
}

function computePumpSpeed(statuses: Record<string, ParameterStatus>): number {
  let warningCount = 0;
  let alertCount = 0;

  for (const status of Object.values(statuses)) {
    if (status === "warning") {
      warningCount += 1;
    } else if (status === "alert") {
      alertCount += 1;
    }
  }

  const speed = warningCount * 20 + alertCount * 40;
  return Math.min(100, Math.max(0, speed));
}

(async function main() {
  console.log("Starting Aquarium Monitor System...\n");

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
  console.log("OK: Water Digital Twin exposed (HTTP)\n");

  // Create Water Quality Sensor (HTTP Thing)
  const waterSensor = new WaterQualitySensorThing(wotRuntime, waterSensorTD);
  await waterSensor.startAsync();
  console.log("OK: Water Quality Sensor exposed (HTTP)\n");

  // Create Filter Pump (Modbus Proxy Thing)
  const filterPump = new FilterPumpThing(
    wotRuntime,
    filterPumpProxyTD,
    filterPumpModbusTD,
  );
  await filterPump.start();
  console.log("OK: Filter Pump exposed (HTTP Proxy -> Modbus)\n");

  // Water degradation simulation is managed internally by WaterThing

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

  console.log("Things consumed, starting orchestration...\n");

  // ====== ORCHESTRATION LOGIC ======
  const statuses: Record<string, ParameterStatus> = {
    pH: "ok",
    temperature: "ok",
    oxygenLevel: "ok",
  };

  let lastSpeed = -1;

  async function syncPumpSpeed(): Promise<void> {
    const targetSpeed = computePumpSpeed(statuses);
    if (targetSpeed === lastSpeed) return;

    lastSpeed = targetSpeed;
    if (targetSpeed === 0) {
      console.log("All parameters OK. Turning pump off.");
    } else {
      console.log(`Adjusting pump speed to ${targetSpeed}% based on alerts.`);
    }

    try {
      await consumedPump.invokeAction("setPumpSpeed", targetSpeed);
    } catch (error) {
      console.error("[Orchestrator] Unable to set pump speed:", error);
    }
  }

  // Load initial statuses (if available)
  try {
    const pHStatusProp = await consumedSensor.readProperty("pHStatus");
    const tempStatusProp = await consumedSensor.readProperty("temperatureStatus");
    const o2StatusProp = await consumedSensor.readProperty("oxygenLevelStatus");

    statuses.pH = (await pHStatusProp.value()) as ParameterStatus;
    statuses.temperature = (await tempStatusProp.value()) as ParameterStatus;
    statuses.oxygenLevel = (await o2StatusProp.value()) as ParameterStatus;

    await syncPumpSpeed();
  } catch (error) {
    console.warn("[Orchestrator] Unable to read initial statuses:", error);
  }

  // Subscribe to water quality status changes
  async function handleStatusEvent(
    parameter: "pH" | "temperature" | "oxygenLevel",
    data: WoT.InteractionOutput
  ): Promise<void> {
    const event = (await data.value()) as {
      parameter?: "pH" | "temperature" | "oxygenLevel";
      status: ParameterStatus;
      value: number;
    };

    const targetParam = event.parameter || parameter;

    console.log(
      `[Orchestrator] Status change: ${targetParam} => ${event.status} (${event.value.toFixed(2)})`
    );

    statuses[targetParam] = event.status;
    await syncPumpSpeed();
  }

  consumedSensor.subscribeEvent("pHStatusChanged", async (data) => {
    await handleStatusEvent("pH", data);
  });

  consumedSensor.subscribeEvent("temperatureStatusChanged", async (data) => {
    await handleStatusEvent("temperature", data);
  });

  consumedSensor.subscribeEvent("oxygenLevelStatusChanged", async (data) => {
    await handleStatusEvent("oxygenLevel", data);
  });

  // Daily automatic cleaning cycle check
  if (state.autoCleaningEnabled) {
    setInterval(async () => {
      const today = new Date().toDateString();

      if (state.lastDailyCleaningDate !== today) {
        try {
          const healthProp = await consumedPump.readProperty("filterHealth");
          const health = Number(await healthProp.value());

          if (health < 50) {
            console.log(`\nDaily cleaning cycle - Filter health: ${health}%`);
            await consumedPump.invokeAction("cleaningCycle");
            state.lastDailyCleaningDate = today;
          }
        } catch (error) {
          console.error("Error during daily cleaning check:", error);
        }
      }
    }, 30000);
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

      console.log("\n=== AQUARIUM STATUS ===");
      console.log(`   pH: ${params.pH?.toFixed(2)} (${statuses.pH})`);
      console.log(`   Temperature: ${params.temperature?.toFixed(1)}°C (${statuses.temperature})`);
      console.log(`   Oxygen: ${params.oxygenLevel?.toFixed(1)} mg/L (${statuses.oxygenLevel})`);
      console.log(`   Pump Speed: ${speed}% (${status})`);
      console.log(`   Filter Health: ${health}%`);
      console.log("========================\n");
    } catch (error) {
      console.error("Error reading status:", error);
    }
  }, 12000);

  console.log("Aquarium Monitor running. Press Ctrl+C to stop.");
  console.log("Make sure the Modbus mock server is running!");
  console.log("Run: npx ts-node src/mock/ModbusFilterPumpMockServer.ts\n");

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\nShutting down...");
    water.stop();
    waterSensor.stop();
    filterPump.stop();
    process.exit(0);
  });
})();
