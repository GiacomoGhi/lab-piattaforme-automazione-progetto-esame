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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const core_1 = require("@node-wot/core");
const binding_http_1 = require("@node-wot/binding-http");
const binding_modbus_1 = require("@node-wot/binding-modbus");
const WaterQualitySensorThing_1 = require("./things/WaterQualitySensorThing");
const FilterPumpThing_1 = require("./things/FilterPumpThing");
const WaterThing_1 = require("./things/WaterThing");
const state = {
    lastAlertTime: 0,
    alertCooldown: 10000, // 10 seconds between alerts
    autoCleaningEnabled: true,
    lastDailyCleaningDate: "",
};
function getTDFromFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath).toString());
}
/**
 * Serve static files (index.html, www/*, etc.)
 */
function startStaticFileServer(port = 3000) {
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
                        }
                        else {
                            res.writeHead(200, { "Content-Type": "text/html" });
                            res.end(data2);
                        }
                    });
                }
                else {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("404 Not Found");
                }
                return;
            }
            // Determine content type
            const ext = path.extname(fullPath).toLowerCase();
            const contentTypes = {
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
(function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🐠 Starting Aquarium Monitor System...\n");
        // Start static file server (serves index.html, www/*, etc.)
        startStaticFileServer(3000);
        // Create servient with HTTP server and Modbus client
        const servient = new core_1.Servient();
        servient.addServer(new binding_http_1.HttpServer({ port: 8080 }));
        servient.addClientFactory(new binding_modbus_1.ModbusClientFactory());
        servient.addClientFactory(new binding_http_1.HttpClientFactory(null));
        const wotRuntime = yield servient.start();
        // Read TDs from files
        const waterTD = getTDFromFile("./models/water.tm.json");
        const waterSensorTD = getTDFromFile("./models/water-quality-sensor.tm.json");
        const filterPumpProxyTD = getTDFromFile("./models/filter-pump.tm.json");
        const filterPumpModbusTD = getTDFromFile("./models/filter-pump-modbus.td.json");
        // Create Water Digital Twin (source of truth for water state)
        const water = new WaterThing_1.WaterThing(wotRuntime, waterTD);
        yield water.start();
        console.log("✅ Water Digital Twin exposed (HTTP)\n");
        // Create Water Quality Sensor (HTTP Thing) - subscribes to Water Digital Twin
        // Using 3 second sampling interval for demo (configurable 3s to 30min)
        const waterSensor = new WaterQualitySensorThing_1.WaterQualitySensorThing(wotRuntime, waterSensorTD, 3000);
        yield waterSensor.startAsync();
        console.log("✅ Water Quality Sensor exposed (HTTP)\n");
        // Create Filter Pump (Modbus Proxy Thing) - pass water reference for correction logic
        const filterPump = new FilterPumpThing_1.FilterPumpThing(wotRuntime, filterPumpProxyTD, filterPumpModbusTD, water);
        yield filterPump.start();
        console.log("✅ Filter Pump exposed (HTTP Proxy → Modbus)\n");
        // Start initial water degradation simulation (pump starts off)
        water.startDegradationSimulation();
        console.log("🌊 Water degradation simulation started\n");
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
        console.log("🔗 Things consumed, starting orchestration...\n");
        // ====== ORCHESTRATION LOGIC ======
        // Subscribe to water quality alerts
        consumedSensor.subscribeEvent("parameterAlert", (data) => __awaiter(this, void 0, void 0, function* () {
            const alert = yield data.value();
            const now = Date.now();
            console.log(`\n🚨 Parameter Alert received: ${JSON.stringify(alert)}`);
            // Check cooldown
            if (now - state.lastAlertTime < state.alertCooldown) {
                console.log("⏳ Alert cooldown active, skipping action");
                return;
            }
            state.lastAlertTime = now;
            // Get current pump speed
            const currentSpeed = yield consumedPump.readProperty("pumpSpeed");
            const speedValue = yield currentSpeed.value();
            const speed = Number(speedValue);
            // React based on parameter
            if (alert.parameter === "pH" && alert.status === "alert") {
                // pH critical - increase pump speed to improve water circulation
                const newSpeed = Math.min(100, speed + 20);
                console.log(`🔄 pH critical - increasing pump speed to ${newSpeed}%`);
                yield consumedPump.invokeAction("setPumpSpeed", newSpeed);
            }
            else if (alert.parameter === "temperature" && alert.status === "alert") {
                // Temperature > 26°C - emit alert
                console.log("🌡️ TEMPERATURE ALERT: Water temperature is critical! Check cooling system.");
            }
            else if (alert.parameter === "oxygenLevel" && alert.status === "alert") {
                // Oxygen low - increase pump speed for better aeration
                const newSpeed = Math.min(100, speed + 25);
                console.log(`💨 Oxygen low - increasing pump speed to ${newSpeed}%`);
                yield consumedPump.invokeAction("setPumpSpeed", newSpeed);
            }
        }));
        // Daily automatic cleaning cycle check
        if (state.autoCleaningEnabled) {
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                const today = new Date().toDateString();
                // Check if we've already done daily cleaning today
                if (state.lastDailyCleaningDate !== today) {
                    try {
                        const healthProp = yield consumedPump.readProperty("filterHealth");
                        const health = Number(yield healthProp.value());
                        // Trigger daily cleaning if health is below 50% OR it's a new day
                        if (health < 50) {
                            console.log(`\n🧹 Daily cleaning cycle - Filter health: ${health}%`);
                            yield consumedPump.invokeAction("cleaningCycle");
                            state.lastDailyCleaningDate = today;
                        }
                    }
                    catch (error) {
                        console.error("Error during daily cleaning check:", error);
                    }
                }
            }), 30000); // Check every 30 seconds
        }
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
                console.log("\n📊 === AQUARIUM STATUS ===");
                console.log(`   pH: ${(_a = params.pH) === null || _a === void 0 ? void 0 : _a.toFixed(2)}`);
                console.log(`   Temperature: ${(_b = params.temperature) === null || _b === void 0 ? void 0 : _b.toFixed(1)}°C`);
                console.log(`   Oxygen: ${(_c = params.oxygenLevel) === null || _c === void 0 ? void 0 : _c.toFixed(1)} mg/L`);
                console.log(`   Pump Speed: ${speed}% (${status})`);
                console.log(`   Filter Health: ${health}%`);
                console.log("========================\n");
            }
            catch (error) {
                console.error("Error reading status:", error);
            }
        }), 10000); // Log every 10 seconds
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
    });
})();
