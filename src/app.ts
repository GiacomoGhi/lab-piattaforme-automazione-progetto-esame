import * as fs from "fs";
import express from "express";
import cors from "cors";
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

/**
 * Serve static files (index.html, www/*, etc.)
 */
function startStaticFileServer(port: number = 3000): void {
  const app = express();
  app.use(cors());
  app.use(express.static("www"));
  app.listen(port, () => {
    console.log(`Static file server listening on http://localhost:${port}`);
    console.log(`   Open: http://localhost:${port}\n`);
  });
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
  const waterTD = JSON.parse(fs.readFileSync("./models/water.tm.json").toString());
  const waterSensorTD = JSON.parse(fs.readFileSync("./models/water-quality-sensor.tm.json").toString());
  const filterPumpProxyTD = JSON.parse(fs.readFileSync("./models/filter-pump.tm.json").toString());
  const filterPumpModbusTD = JSON.parse(fs.readFileSync("./models/filter-pump-modbus.td.json").toString());

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

  /**
   * Synchronizes pump speed based on current water parameter statuses.
   * Calculates target speed proportional to number of warnings (20% each) and alerts (40% each).
   * If target speed differs from previous value, sends command to pump via WoT action.
   */
  async function syncPumpSpeed(): Promise<void> {
    // Calcola velocità target in base agli status correnti
    let warningCount = 0;
    let alertCount = 0;

    for (const status of Object.values(statuses)) {
      if (status === "warning") {
        warningCount += 1;
      } else if (status === "alert") {
        alertCount += 1;
      }
    }

    const targetSpeed = Math.min(100, Math.max(0, warningCount * 20 + alertCount * 40));

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
  let lastDailyCleaningDate = "";
  setInterval(async () => {
    const today = new Date().toDateString();

    if (lastDailyCleaningDate !== today) {
      try {
        const healthProp = await consumedPump.readProperty("filterHealth");
        const health = Number(await healthProp.value());

        if (health < 50) {
          console.log(`\nDaily cleaning cycle - Filter health: ${health}%`);
          await consumedPump.invokeAction("cleaningCycle");
          lastDailyCleaningDate = today;
        }
      } catch (error) {
        console.error("Error during daily cleaning check:", error);
      }
    }
  }, 30000);

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
