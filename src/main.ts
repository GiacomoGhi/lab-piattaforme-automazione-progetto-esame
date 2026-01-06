import * as fs from "fs";
import { Servient } from "@node-wot/core";
import { HttpServer, HttpClientFactory } from "@node-wot/binding-http";
import { ModbusClientFactory } from "@node-wot/binding-modbus";

import { WaterQualitySensorThing } from "./things/WaterQualitySensorThing";
import { FilterPumpThing } from "./things/FilterPumpThing";

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

function getTDFromFile(path: string): WoT.ThingDescription {
  return JSON.parse(fs.readFileSync(path).toString());
}

(async function main() {
  console.log("🐠 Starting Aquarium Monitor System...\n");

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
})();
