"use strict";
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
const configManager_1 = require("../utils/configManager");
/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits parameterAlert events when values are out of range.
 *
 * This sensor subscribes to the Water Digital Twin and reads its values.
 * Architecture: Water (Digital Twin) → publishes → WaterQualitySensor (subscribes)
 */
class WaterQualitySensorThing {
    constructor(runtime, td, samplingIntervalMs) {
        this.consumedWater = null;
        // Local cache of water values (updated via subscription)
        this.pH = 7.0;
        this.temperature = 25.0;
        this.oxygenLevel = 7.0;
        // Sampling configuration (in milliseconds)
        this.samplingInterval = 3000; // Default 3 seconds for demo
        this.samplingTimer = null;
        this.runtime = runtime;
        this.td = td;
        if (samplingIntervalMs) {
            this.samplingInterval = samplingIntervalMs;
        }
    }
    /**
     * Start the thing and subscribe to Water Digital Twin
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
            yield this.thing.expose();
            console.log(`${this.td.title} thing started! Go to: http://localhost:8080/${(_a = this.td.title) === null || _a === void 0 ? void 0 : _a.toLowerCase()}`);
            // Subscribe to Water Digital Twin after a short delay to ensure it's ready
            setTimeout(() => this.subscribeToWaterDigitalTwin(), 2000);
        });
    }
    /**
     * Subscribe to the Water Digital Twin to receive state updates
     */
    subscribeToWaterDigitalTwin() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("[Sensor] 🔗 Connecting to Water Digital Twin...");
                // Fetch the Water Thing Description
                const waterTD = yield this.runtime.requestThingDescription("http://localhost:8080/water");
                this.consumedWater = yield this.runtime.consume(waterTD);
                console.log("[Sensor] ✅ Connected to Water Digital Twin");
                // Subscribe to the waterStateChanged event (pub/sub pattern)
                yield this.consumedWater.subscribeEvent("waterStateChanged", (data) => __awaiter(this, void 0, void 0, function* () {
                    const event = (yield data.value());
                    console.log(`[Sensor] 📨 Received water state change: ${event.parameter} = ${event.newValue}`);
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
                    // Check for alerts and emit events
                    this.checkAndEmitAlerts();
                    // Emit property changes to notify our subscribers
                    this.thing.emitPropertyChange(event.parameter);
                    this.thing.emitPropertyChange("allParameters");
                }));
                console.log("[Sensor] 📡 Subscribed to Water Digital Twin events");
                // Start periodic sampling
                this.startSampling();
                // Initial read of all water properties
                yield this.readInitialWaterState();
            }
            catch (error) {
                console.error("[Sensor] ❌ Failed to connect to Water Digital Twin:", error);
                console.log("[Sensor] ⏳ Will retry in 5 seconds...");
                setTimeout(() => this.subscribeToWaterDigitalTwin(), 5000);
            }
        });
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
    checkAndEmitAlerts() {
        let mostCriticalAlert = null;
        // Check pH
        const pHStatus = this.getParameterStatus("pH", this.pH);
        if (pHStatus !== "ok") {
            const alert = {
                parameter: "pH",
                value: this.pH,
                status: pHStatus,
                message: `pH level is ${pHStatus === "alert" ? "critical" : "not optimal"}: ${this.pH.toFixed(2)}`,
            };
            if (!mostCriticalAlert || pHStatus === "alert") {
                mostCriticalAlert = alert;
            }
        }
        // Check temperature
        const tempStatus = this.getParameterStatus("temperature", this.temperature);
        if (tempStatus !== "ok") {
            const alert = {
                parameter: "temperature",
                value: this.temperature,
                status: tempStatus,
                message: `Temperature is ${tempStatus === "alert" ? "critical" : "not optimal"}: ${this.temperature.toFixed(1)}°C`,
            };
            if (!mostCriticalAlert || tempStatus === "alert") {
                mostCriticalAlert = alert;
            }
        }
        // Check oxygen
        const o2Status = this.getParameterStatus("oxygenLevel", this.oxygenLevel);
        if (o2Status !== "ok") {
            const alert = {
                parameter: "oxygenLevel",
                value: this.oxygenLevel,
                status: o2Status,
                message: `Oxygen level is ${o2Status === "alert" ? "critical" : "not optimal"}: ${this.oxygenLevel.toFixed(1)} mg/L`,
            };
            if (!mostCriticalAlert || o2Status === "alert") {
                mostCriticalAlert = alert;
            }
        }
        // Emit only the most critical alert
        if (mostCriticalAlert) {
            console.log(`⚠️ ALERT: ${mostCriticalAlert.message}`);
            this.thing.emitEvent("parameterAlert", mostCriticalAlert);
        }
    }
    /**
     * Get the status of a parameter based on its value
     */
    getParameterStatus(param, value) {
        try {
            const config = (0, configManager_1.loadConfig)();
            const paramConfig = config.parameters[param];
            if (!paramConfig)
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
            pH: this.getParameterStatus("pH", this.pH),
            temperature: this.getParameterStatus("temperature", this.temperature),
            oxygenLevel: this.getParameterStatus("oxygenLevel", this.oxygenLevel),
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
                // Check and emit alerts
                this.checkAndEmitAlerts();
            }
            catch (error) {
                console.error("[Sensor] ❌ Error during sampling:", error);
            }
        }), this.samplingInterval);
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
