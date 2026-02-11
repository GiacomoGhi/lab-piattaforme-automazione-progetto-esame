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
exports.WaterQualitySensorThing = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits per-parameter status change events when status levels change.
 *
 * This sensor polls the Water Digital Twin at regular intervals (default: 3 seconds).
 * PUB/SUB pattern is disabled to avoid continuous notifications.
 * Architecture: WaterQualitySensor (polls) → Water Digital Twin (provides data)
 */
class WaterQualitySensorThing {
    constructor(runtime, td, samplingIntervalMs) {
        this.consumedWater = null;
        // Local cache of water values (updated via subscription)
        this.pH = 7.0;
        this.temperature = 25.0;
        this.oxygenLevel = 7.0;
        this.pHStatus = "ok";
        this.temperatureStatus = "ok";
        this.oxygenLevelStatus = "ok";
        // Sampling configuration (in milliseconds)
        this.samplingInterval = 3000; // Default 3 seconds for demo
        this.samplingTimer = null;
        this.runtime = runtime;
        this.td = td;
        this.config = this.loadConfigFromFile();
        this.applyMode(this.config.mode, false);
        if (samplingIntervalMs) {
            this.setSamplingInterval(samplingIntervalMs);
        }
    }
    /**
     * Start the thing and connect to Water Digital Twin
     */
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.thing = yield this.runtime.produce(this.td);
            // Register property read handlers
            this.thing.setPropertyReadHandler("pH", () => __awaiter(this, void 0, void 0, function* () {
                console.log("> Read pH:", this.pH.toFixed(2));
                return this.pH;
            }));
            this.thing.setPropertyReadHandler("temperature", () => __awaiter(this, void 0, void 0, function* () {
                console.log("> Read temperature:", this.temperature.toFixed(1));
                return this.temperature;
            }));
            this.thing.setPropertyReadHandler("oxygenLevel", () => __awaiter(this, void 0, void 0, function* () {
                console.log("> Read oxygenLevel:", this.oxygenLevel.toFixed(1));
                return this.oxygenLevel;
            }));
            this.thing.setPropertyReadHandler("pHStatus", () => __awaiter(this, void 0, void 0, function* () {
                return this.pHStatus;
            }));
            this.thing.setPropertyReadHandler("temperatureStatus", () => __awaiter(this, void 0, void 0, function* () {
                return this.temperatureStatus;
            }));
            this.thing.setPropertyReadHandler("oxygenLevelStatus", () => __awaiter(this, void 0, void 0, function* () {
                return this.oxygenLevelStatus;
            }));
            this.thing.setPropertyReadHandler("allParameters", () => __awaiter(this, void 0, void 0, function* () {
                const params = {
                    pH: this.pH,
                    temperature: this.temperature,
                    oxygenLevel: this.oxygenLevel,
                    timestamp: new Date().toISOString(),
                };
                console.log("> Read allParameters:", JSON.stringify(params));
                return params;
            }));
            this.thing.setPropertyReadHandler("mode", () => __awaiter(this, void 0, void 0, function* () {
                return this.config.mode;
            }));
            this.thing.setPropertyReadHandler("config", () => __awaiter(this, void 0, void 0, function* () {
                return this.config;
            }));
            this.thing.setPropertyReadHandler("samplingIntervalMs", () => __awaiter(this, void 0, void 0, function* () {
                return this.samplingInterval;
            }));
            this.thing.setPropertyWriteHandler("mode", (value) => __awaiter(this, void 0, void 0, function* () {
                const nextMode = yield this.extractString(value);
                if (nextMode !== "demo" && nextMode !== "production") {
                    console.warn(`[Sensor] ⚠️ Invalid mode: ${nextMode}`);
                    return;
                }
                this.config.mode = nextMode;
                this.applyMode(nextMode, true);
                this.saveConfigToFile(this.config);
                this.thing.emitPropertyChange("mode");
                this.thing.emitPropertyChange("config");
                this.thing.emitPropertyChange("samplingIntervalMs");
                this.thing.emitEvent("configChanged", {
                    mode: this.config.mode,
                    parameters: this.config.parameters,
                });
            }));
            this.thing.setPropertyWriteHandler("config", (value) => __awaiter(this, void 0, void 0, function* () {
                const nextConfig = yield this.extractObject(value);
                if (!(nextConfig === null || nextConfig === void 0 ? void 0 : nextConfig.parameters) || !nextConfig.mode) {
                    console.warn("[Sensor] Invalid config payload, ignoring.");
                    return;
                }
                const validation = this.validateConfigPayload(nextConfig);
                if (!validation.ok) {
                    console.warn(`[Sensor] Invalid config payload: ${validation.message}`);
                    return;
                }
                this.config = nextConfig;
                this.applyMode(this.config.mode, true);
                this.saveConfigToFile(this.config);
                this.thing.emitPropertyChange("config");
                this.thing.emitPropertyChange("mode");
                this.thing.emitPropertyChange("samplingIntervalMs");
                this.thing.emitEvent("configChanged", {
                    mode: this.config.mode,
                    parameters: this.config.parameters,
                });
            }));
            yield this.thing.expose();
            console.log(`${this.td.title} thing started! Go to: http://localhost:8080/${(_a = this.td.title) === null || _a === void 0 ? void 0 : _a.toLowerCase()}`);
            // Connect after a short delay to ensure the Water Thing is ready
            this.scheduleConnectAndStartPolling(2000);
        });
    }
    /**
     * Connect to the Water Digital Twin (polling mode)
     */
    connectToWaterDigitalTwin() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("[Sensor] 🔗 Connecting to Water Digital Twin...");
                // Fetch the Water Thing Description
                const waterTD = yield this.runtime.requestThingDescription("http://localhost:8080/water");
                this.consumedWater = yield this.runtime.consume(waterTD);
                console.log("[Sensor] ✅ Connected to Water Digital Twin");
                // ===== PUB/SUB PATTERN DISABLED =====
                // In questo scenario, il PUB/SUB è controproducente perché creerebbe continue segnalazioni
                // ad ogni cambiamento dei parametri dell'acqua. Manteniamo solo il polling a intervalli.
                /*
                // Subscribe to the waterStateChanged event (pub/sub pattern)
                await this.consumedWater.subscribeEvent(
                  "waterStateChanged",
                  async (data) => {
                    const event = (await data.value()) as WaterStateChangedEvent;
                    console.log(
                      `[Sensor] 📨 Received water state change: ${event.parameter} = ${event.newValue}`
                    );
          
                    // Update local cache
                    switch (event.parameter) {
                      case "pH":
                        this.pH = event.newValue;
                        break;
                      case "temperature":
                        this.temperature = event.newValue;
                        break;
                      case "oxygenLevel":
                        this.oxygenLevel = event.newValue;
                        break;
                    }
          
                    // Check statuses and emit events
                    this.updateStatusesAndEmitEvents();
          
                    // Emit property changes to notify our subscribers
                    this.thing.emitPropertyChange(event.parameter);
                    this.thing.emitPropertyChange("allParameters");
                  }
                );
          
                console.log("[Sensor] 📡 Subscribed to Water Digital Twin events");
                */
                console.log("[Sensor] 📡 PUB/SUB disabled - using polling mode only");
                return true;
            }
            catch (error) {
                console.error("[Sensor] ❌ Failed to connect to Water Digital Twin:", error);
                return false;
            }
        });
    }
    scheduleConnectAndStartPolling(delayMs) {
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            const connected = yield this.connectToWaterDigitalTwin();
            if (!connected) {
                console.log("[Sensor] Will retry connection in 5 seconds...");
                this.scheduleConnectAndStartPolling(5000);
                return;
            }
            // Start periodic sampling
            this.startSampling();
            // Initial read of all water properties
            yield this.readInitialWaterState();
        }), delayMs);
    }
    /**
     * Read initial state from Water Digital Twin
     */
    readInitialWaterState() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.consumedWater)
                return;
            try {
                const pHProp = yield this.consumedWater.readProperty("pH");
                this.pH = Number(yield pHProp.value());
                const tempProp = yield this.consumedWater.readProperty("temperature");
                this.temperature = Number(yield tempProp.value());
                const o2Prop = yield this.consumedWater.readProperty("oxygenLevel");
                this.oxygenLevel = Number(yield o2Prop.value());
                console.log(`[Sensor] 📖 Initial water state: pH=${this.pH.toFixed(2)}, temp=${this.temperature.toFixed(1)}°C, O₂=${this.oxygenLevel.toFixed(1)} mg/L`);
                this.updateStatusesAndEmitEvents();
            }
            catch (error) {
                console.error("[Sensor] Failed to read initial water state:", error);
            }
        });
    }
    /**
     * Check parameter values and emit alerts if necessary
     * Only emits the most critical alert to avoid concatenation issues
     */
    updateStatusesAndEmitEvents() {
        this.updateParameterStatus("pH", this.pH);
        this.updateParameterStatus("temperature", this.temperature);
        this.updateParameterStatus("oxygenLevel", this.oxygenLevel);
    }
    updateParameterStatus(parameter, value) {
        const nextStatus = this.getParameterStatus(parameter, value);
        let previousStatus = "ok";
        switch (parameter) {
            case "pH":
                previousStatus = this.pHStatus;
                this.pHStatus = nextStatus;
                break;
            case "temperature":
                previousStatus = this.temperatureStatus;
                this.temperatureStatus = nextStatus;
                break;
            case "oxygenLevel":
                previousStatus = this.oxygenLevelStatus;
                this.oxygenLevelStatus = nextStatus;
                break;
        }
        if (nextStatus !== previousStatus) {
            const message = `${parameter} status changed to ${nextStatus}: ${value.toFixed(2)}`;
            console.log(`[Sensor] ⚠️ ${message}`);
            const statusEvent = {
                parameter,
                status: nextStatus,
                value,
                timestamp: new Date().toISOString(),
            };
            const eventName = parameter === "pH"
                ? "pHStatusChanged"
                : parameter === "temperature"
                    ? "temperatureStatusChanged"
                    : "oxygenLevelStatusChanged";
            this.thing.emitEvent(eventName, statusEvent);
            const statusProperty = parameter === "pH"
                ? "pHStatus"
                : parameter === "temperature"
                    ? "temperatureStatus"
                    : "oxygenLevelStatus";
            this.thing.emitPropertyChange(statusProperty);
        }
    }
    /**
     * Get the status of a parameter based on its value
     */
    getParameterStatus(param, value) {
        try {
            const paramConfig = this.config.parameters[param];
            if (!(paramConfig === null || paramConfig === void 0 ? void 0 : paramConfig.optimal))
                return "ok";
            const optimal = paramConfig.optimal;
            const range = optimal.max - optimal.min;
            const margin = range * 0.15; // 15% beyond optimal range
            const criticalMin = optimal.min - margin;
            const criticalMax = optimal.max + margin;
            // Alert (critical) if outside critical range (15% beyond optimal)
            if (value < criticalMin || value > criticalMax) {
                return "alert";
            }
            // Warning if outside optimal range but within critical
            else if (value < optimal.min || value > optimal.max) {
                return "warning";
            }
            // OK if within optimal range
            return "ok";
        }
        catch (error) {
            console.error(`Error getting parameter status for ${param}:`, error);
            return "ok";
        }
    }
    /**
     * Get current parameter status for external use
     */
    getStatus() {
        return {
            pH: this.pHStatus,
            temperature: this.temperatureStatus,
            oxygenLevel: this.oxygenLevelStatus,
        };
    }
    /**
     * Get current values for external use
     */
    getValues() {
        return {
            pH: this.pH,
            temperature: this.temperature,
            oxygenLevel: this.oxygenLevel,
        };
    }
    /**
     * Set sampling interval (in milliseconds)
     * Valid range: 3000 (3 sec) to 1800000 (30 min)
     */
    setSamplingInterval(intervalMs) {
        const MIN_INTERVAL = 3000; // 3 seconds
        const MAX_INTERVAL = 1800000; // 30 minutes
        if (intervalMs < MIN_INTERVAL || intervalMs > MAX_INTERVAL) {
            console.warn(`[Sensor] ⚠️ Sampling interval ${intervalMs}ms out of range [${MIN_INTERVAL}-${MAX_INTERVAL}]. Using default 3s.`);
            this.samplingInterval = MIN_INTERVAL;
        }
        else {
            this.samplingInterval = intervalMs;
            console.log(`[Sensor] 📊 Sampling interval set to ${intervalMs}ms`);
        }
        // Restart sampling with new interval
        if (this.consumedWater) {
            this.startSampling();
        }
    }
    /**
     * Start periodic sampling of water parameters
     */
    startSampling() {
        // Clear existing timer
        if (this.samplingTimer) {
            clearInterval(this.samplingTimer);
        }
        console.log(`[Sensor] 📡 Starting periodic sampling every ${this.samplingInterval}ms`);
        this.samplingTimer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (!this.consumedWater)
                return;
            try {
                // Read individual properties (allParameters not available when consuming)
                const pHProp = yield this.consumedWater.readProperty("pH");
                this.pH = Number(yield pHProp.value());
                const tempProp = yield this.consumedWater.readProperty("temperature");
                this.temperature = Number(yield tempProp.value());
                const o2Prop = yield this.consumedWater.readProperty("oxygenLevel");
                this.oxygenLevel = Number(yield o2Prop.value());
                // Emit property changes (cast to any to avoid type issues)
                this.thing.emitPropertyChange("pH");
                this.thing.emitPropertyChange("temperature");
                this.thing.emitPropertyChange("oxygenLevel");
                this.thing.emitPropertyChange("allParameters");
                // Check and emit status changes
                this.updateStatusesAndEmitEvents();
            }
            catch (error) {
                console.error("[Sensor] ❌ Error during sampling:", error);
            }
        }), this.samplingInterval);
    }
    applyMode(mode, logChange) {
        const demoInterval = 3000;
        const productionInterval = 1800000;
        const nextInterval = mode === "demo" ? demoInterval : productionInterval;
        if (logChange) {
            console.log(`[Sensor] 🎛️ Mode set to ${mode} (sampling ${nextInterval}ms)`);
        }
        this.setSamplingInterval(nextInterval);
    }
    loadConfigFromFile() {
        try {
            const configPath = path.join(process.cwd(), "config.json");
            const configContent = fs.readFileSync(configPath, "utf-8");
            return JSON.parse(configContent);
        }
        catch (error) {
            console.warn("[Sensor] ⚠️ Failed to load config.json, using defaults.");
            return {
                mode: "demo",
                description: "Fallback configuration",
                parameters: {
                    pH: {
                        unit: "pH",
                        description: "Water pH Level",
                        optimal: { min: 6.5, max: 7.5 },
                    },
                    temperature: {
                        unit: "°C",
                        description: "Water Temperature",
                        optimal: { min: 24, max: 26 },
                    },
                    oxygenLevel: {
                        unit: "mg/L",
                        description: "Dissolved Oxygen Level",
                        optimal: { min: 6, max: 8 },
                    },
                },
                modes: {
                    demo: { samplingIntervalMs: 3000 },
                    production: { samplingIntervalMs: 1800000 },
                },
            };
        }
    }
    saveConfigToFile(config) {
        try {
            const configPath = path.join(process.cwd(), "config.json");
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log("[Sensor] 📝 Configuration saved");
        }
        catch (error) {
            console.error("[Sensor] ❌ Failed to save config.json:", error);
        }
    }
    extractString(input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (input && typeof input.value === "function") {
                return String(yield input.value());
            }
            return String(input);
        });
    }
    extractObject(input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (input && typeof input.value === "function") {
                return (yield input.value());
            }
            return input;
        });
    }
    validateConfigPayload(config) {
        var _a, _b, _c, _d;
        if (config.mode !== "demo" && config.mode !== "production") {
            return { ok: false, message: "mode must be demo or production" };
        }
        const requiredParams = ["pH", "temperature", "oxygenLevel"];
        for (const param of requiredParams) {
            const paramConfig = config.parameters[param];
            if (!paramConfig) {
                return { ok: false, message: `${param} is missing` };
            }
            const optimalMin = Number((_a = paramConfig.optimal) === null || _a === void 0 ? void 0 : _a.min);
            const optimalMax = Number((_b = paramConfig.optimal) === null || _b === void 0 ? void 0 : _b.max);
            const confMin = Number((_c = paramConfig.configurable) === null || _c === void 0 ? void 0 : _c.min);
            const confMax = Number((_d = paramConfig.configurable) === null || _d === void 0 ? void 0 : _d.max);
            if (!Number.isFinite(optimalMin) ||
                !Number.isFinite(optimalMax) ||
                !Number.isFinite(confMin) ||
                !Number.isFinite(confMax)) {
                return { ok: false, message: `${param} has non-numeric bounds` };
            }
            if (confMin >= confMax) {
                return { ok: false, message: `${param} configurable min must be less than max` };
            }
            if (optimalMin >= optimalMax) {
                return { ok: false, message: `${param} optimal min must be less than max` };
            }
            if (optimalMin < confMin || optimalMax > confMax) {
                return { ok: false, message: `${param} optimal range must be within configurable range` };
            }
        }
        return { ok: true };
    }
    /**
     * Stop periodic sampling
     */
    stopSampling() {
        if (this.samplingTimer) {
            clearInterval(this.samplingTimer);
            this.samplingTimer = null;
        }
    }
    /**
     * Stop the sensor
     */
    stop() {
        this.stopSampling();
    }
}
exports.WaterQualitySensorThing = WaterQualitySensorThing;
