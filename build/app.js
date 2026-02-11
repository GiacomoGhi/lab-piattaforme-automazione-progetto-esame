"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const core_1 = require("@node-wot/core");
const binding_http_1 = require("@node-wot/binding-http");
const binding_modbus_1 = require("@node-wot/binding-modbus");
const WaterQualitySensorThing_1 = require("./things/WaterQualitySensorThing");
const FilterPumpThing_1 = require("./things/FilterPumpThing");
const WaterThing_1 = require("./things/WaterThing");
// ====================================
// AQUARIUM MONITOR - ORCHESTRATOR
// ====================================
/**
 * Serve static files (index.html, www/*, etc.)
 */
function startStaticFileServer(port = 3000) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.static("www"));
    app.listen(port, () => {
        console.log(`Static file server listening on http://localhost:${port}`);
        console.log(`   Open: http://localhost:${port}\n`);
    });
}
(function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting Aquarium Monitor System...\n");
        // Start static file server (serves index.html, www/*, etc.)
        startStaticFileServer(3000);
        // Create servient with HTTP server and Modbus client
        const servient = new core_1.Servient();
        servient.addServer(new binding_http_1.HttpServer({ port: 8080 }));
        servient.addClientFactory(new binding_modbus_1.ModbusClientFactory());
        servient.addClientFactory(new binding_http_1.HttpClientFactory(null));
        const wotRuntime = yield servient.start();
        // Read TDs from files
        const waterTD = JSON.parse(fs.readFileSync("./models/water.tm.json").toString());
        const waterSensorTD = JSON.parse(fs.readFileSync("./models/water-quality-sensor.tm.json").toString());
        const filterPumpProxyTD = JSON.parse(fs.readFileSync("./models/filter-pump.tm.json").toString());
        const filterPumpModbusTD = JSON.parse(fs.readFileSync("./models/filter-pump-modbus.td.json").toString());
        // Create Water Digital Twin (source of truth for water state)
        const water = new WaterThing_1.WaterThing(wotRuntime, waterTD);
        yield water.start();
        console.log("OK: Water Digital Twin exposed (HTTP)\n");
        // Create Water Quality Sensor (HTTP Thing)
        const waterSensor = new WaterQualitySensorThing_1.WaterQualitySensorThing(wotRuntime, waterSensorTD);
        yield waterSensor.startAsync();
        console.log("OK: Water Quality Sensor exposed (HTTP)\n");
        // Create Filter Pump (Modbus Proxy Thing)
        const filterPump = new FilterPumpThing_1.FilterPumpThing(wotRuntime, filterPumpProxyTD, filterPumpModbusTD);
        yield filterPump.start();
        console.log("OK: Filter Pump exposed (HTTP Proxy -> Modbus)\n");
        // Create HTTP client to consume things for orchestration
        const clientServient = new core_1.Servient();
        clientServient.addClientFactory(new binding_http_1.HttpClientFactory(null));
        const clientRuntime = yield clientServient.start();
        // Wait a moment for server to be ready
        yield new Promise((resolve) => setTimeout(resolve, 1000));
        // Consume the Things via HTTP
        const sensorTD = yield clientRuntime.requestThingDescription("http://localhost:8080/waterqualitysensor");
        const consumedSensor = yield clientRuntime.consume(sensorTD);
        const pumpTD = yield clientRuntime.requestThingDescription("http://localhost:8080/filterpump");
        const consumedPump = yield clientRuntime.consume(pumpTD);
        console.log("Things consumed, starting orchestration...\n");
        // ====== ORCHESTRATION LOGIC ======
        const statuses = {
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
        function syncPumpSpeed() {
            return __awaiter(this, void 0, void 0, function* () {
                // Calcola velocità target in base agli status correnti
                let warningCount = 0;
                let alertCount = 0;
                for (const status of Object.values(statuses)) {
                    if (status === "warning") {
                        warningCount += 1;
                    }
                    else if (status === "alert") {
                        alertCount += 1;
                    }
                }
                const targetSpeed = Math.min(100, Math.max(0, warningCount * 20 + alertCount * 40));
                if (targetSpeed === lastSpeed)
                    return;
                lastSpeed = targetSpeed;
                if (targetSpeed === 0) {
                    console.log("All parameters OK. Turning pump off.");
                }
                else {
                    console.log(`Adjusting pump speed to ${targetSpeed}% based on alerts.`);
                }
                try {
                    yield consumedPump.invokeAction("setPumpSpeed", targetSpeed);
                }
                catch (error) {
                    console.error("[Orchestrator] Unable to set pump speed:", error);
                }
            });
        }
        // Subscribe to water quality status changes
        function handleStatusEvent(parameter, data) {
            return __awaiter(this, void 0, void 0, function* () {
                const event = (yield data.value());
                const targetParam = event.parameter || parameter;
                console.log(`[Orchestrator] Status change: ${targetParam} => ${event.status} (${event.value.toFixed(2)})`);
                statuses[targetParam] = event.status;
                yield syncPumpSpeed();
            });
        }
        // Load initial statuses (if available)
        try {
            const pHStatusProp = yield consumedSensor.readProperty("pHStatus");
            const tempStatusProp = yield consumedSensor.readProperty("temperatureStatus");
            const o2StatusProp = yield consumedSensor.readProperty("oxygenLevelStatus");
            statuses.pH = (yield pHStatusProp.value());
            statuses.temperature = (yield tempStatusProp.value());
            statuses.oxygenLevel = (yield o2StatusProp.value());
            yield syncPumpSpeed();
        }
        catch (error) {
            console.warn("[Orchestrator] Unable to read initial statuses:", error);
        }
        consumedSensor.subscribeEvent("pHStatusChanged", (data) => __awaiter(this, void 0, void 0, function* () {
            yield handleStatusEvent("pH", data);
        }));
        consumedSensor.subscribeEvent("temperatureStatusChanged", (data) => __awaiter(this, void 0, void 0, function* () {
            yield handleStatusEvent("temperature", data);
        }));
        consumedSensor.subscribeEvent("oxygenLevelStatusChanged", (data) => __awaiter(this, void 0, void 0, function* () {
            yield handleStatusEvent("oxygenLevel", data);
        }));
        // Daily automatic cleaning cycle check
        let lastDailyCleaningDate = "";
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const today = new Date().toDateString();
            if (lastDailyCleaningDate !== today) {
                try {
                    const healthProp = yield consumedPump.readProperty("filterHealth");
                    const health = Number(yield healthProp.value());
                    if (health < 50) {
                        console.log(`\nDaily cleaning cycle - Filter health: ${health}%`);
                        yield consumedPump.invokeAction("cleaningCycle");
                        lastDailyCleaningDate = today;
                    }
                }
                catch (error) {
                    console.error("Error during daily cleaning check:", error);
                }
            }
        }), 30000);
        // Periodic status logging
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const allParams = yield consumedSensor.readProperty("allParameters");
                const params = yield allParams.value();
                const pumpSpeedProp = yield consumedPump.readProperty("pumpSpeed");
                const speed = yield pumpSpeedProp.value();
                const filterHealthProp = yield consumedPump.readProperty("filterHealth");
                const health = yield filterHealthProp.value();
                const filterStatusProp = yield consumedPump.readProperty("filterStatus");
                const status = yield filterStatusProp.value();
                console.log("\n=== AQUARIUM STATUS ===");
                console.log(`   pH: ${(_a = params.pH) === null || _a === void 0 ? void 0 : _a.toFixed(2)} (${statuses.pH})`);
                console.log(`   Temperature: ${(_b = params.temperature) === null || _b === void 0 ? void 0 : _b.toFixed(1)}°C (${statuses.temperature})`);
                console.log(`   Oxygen: ${(_c = params.oxygenLevel) === null || _c === void 0 ? void 0 : _c.toFixed(1)} mg/L (${statuses.oxygenLevel})`);
                console.log(`   Pump Speed: ${speed}% (${status})`);
                console.log(`   Filter Health: ${health}%`);
                console.log("========================\n");
            }
            catch (error) {
                console.error("Error reading status:", error);
            }
        }), 12000);
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
    });
})();
