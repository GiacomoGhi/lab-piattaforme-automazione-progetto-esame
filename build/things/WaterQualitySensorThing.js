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
const sampling_config_1 = require("../config/sampling.config");
// Optimal ranges for aquarium
const OPTIMAL_RANGES = {
    pH: { min: 6.5, max: 7.5, warningMin: 6.0, warningMax: 8.0 },
    temperature: { min: 24, max: 26, warningMin: 22, warningMax: 28 },
    oxygenLevel: { min: 6, max: 8, warningMin: 5, warningMax: 10 },
};
/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits parameterAlert events when values are out of range.
 */
class WaterQualitySensorThing {
    constructor(runtime, td) {
        this.pH = 7.0;
        this.temperature = 25.0;
        this.oxygenLevel = 7.0;
        this.simulationInterval = null;
        this.controlledTest = {
            enabled: process.env.TEST_MODE === "controlled",
            currentParameter: "pH",
            pumpCompensationActive: false,
        };
        this.runtime = runtime;
        this.td = td;
    }
    /**
     * Start the thing and begin simulating sensor readings
     *
     * NOTE: Sensor update interval is 3 seconds for TESTING purposes only.
     * In production environments, this would typically be 30-60 seconds or longer
     * depending on the actual sensor hardware capabilities and requirements.
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
            this.startSimulation();
        });
    }
    /**
     * Simulate sensor readings with realistic variations.
     *
     * RANDOM MODE (default): Readings vary randomly around baseline.
     * CONTROLLED TEST MODE (TEST_MODE=controlled): Sequential parameter degradation to ALERT level,
     *   then pump compensation to recover. Cycle repeats for each parameter (pH → Temp → O2).
     *
     * Interval: 3000ms (3 seconds) for testing.
     */
    startSimulation() {
        if (this.controlledTest.enabled) {
            console.log("\n🧪 CONTROLLED TEST MODE ENABLED");
            console.log("   Parameters will degrade sequentially to ALERT level.");
            console.log("   Pump activation will compensate and restore parameters.\n");
            this.startControlledTest();
        }
        else {
            this.startRandomSimulation();
        }
    }
    /**
     * CONTROLLED TEST MODE: Sequential parameter degradation
     *
     * Primary parameter (in test): Degrades by -0.2 to -0.7 per cycle (random)
     * Other parameters: Degrade by -0.2 per cycle (fixed, minor alteration)
     *
     * Pump compensation (when active): +1.5 per cycle for each metric towards optimal value
     * Optimal values: pH=7.0, Temperature=25.0, Oxygen=7.0
     */
    startControlledTest() {
        this.simulationInterval = setInterval(() => {
            const primaryDegradation = -(Math.random() * 0.5 + 0.2); // -0.2 to -0.7 for tested parameter
            const secondaryDegradation = -0.2; // Fixed minor degradation for other parameters
            const compensationDelta = this.controlledTest.pumpCompensationActive ? 1.5 : 0; // +0.5/sec = +1.5/3sec
            // Define optimal values
            const optimalValues = { pH: 7.0, temperature: 25.0, oxygenLevel: 7.0 };
            // Calculate compensation direction (towards optimal)
            const pHCompensation = this.controlledTest.pumpCompensationActive
                ? Math.sign(optimalValues.pH - this.pH) * compensationDelta
                : 0;
            const tempCompensation = this.controlledTest.pumpCompensationActive
                ? Math.sign(optimalValues.temperature - this.temperature) * compensationDelta
                : 0;
            const o2Compensation = this.controlledTest.pumpCompensationActive
                ? Math.sign(optimalValues.oxygenLevel - this.oxygenLevel) * compensationDelta
                : 0;
            if (this.controlledTest.currentParameter === "pH") {
                // pH in test: Random degradation + compensation
                this.pH += primaryDegradation + pHCompensation;
                // Temperature: Fixed minor degradation + compensation
                this.temperature += secondaryDegradation + tempCompensation;
                // Oxygen: Fixed minor degradation + compensation
                this.oxygenLevel += secondaryDegradation + o2Compensation;
                this.pH = Math.max(5, Math.min(9, this.pH));
                this.temperature = Math.max(18, Math.min(32, this.temperature));
                this.oxygenLevel = Math.max(3, Math.min(12, this.oxygenLevel));
                // Check if pH reached ALERT threshold
                if (this.getParameterStatus("pH", this.pH) === "alert") {
                    console.log(`🚨 pH ALERT reached (${this.pH.toFixed(2)}). Pump should activate.`);
                }
                else if (this.getParameterStatus("pH", this.pH) === "ok" && this.controlledTest.pumpCompensationActive) {
                    console.log(`✅ pH restored to optimal (${this.pH.toFixed(2)}). Moving to Temperature test.`);
                    this.controlledTest.pumpCompensationActive = false;
                    this.controlledTest.currentParameter = "temperature";
                }
            }
            else if (this.controlledTest.currentParameter === "temperature") {
                // Temperature in test: Random degradation + compensation
                this.temperature += primaryDegradation + tempCompensation;
                // pH: Fixed minor degradation + compensation
                this.pH += secondaryDegradation + pHCompensation;
                // Oxygen: Fixed minor degradation + compensation
                this.oxygenLevel += secondaryDegradation + o2Compensation;
                this.pH = Math.max(5, Math.min(9, this.pH));
                this.temperature = Math.max(18, Math.min(32, this.temperature));
                this.oxygenLevel = Math.max(3, Math.min(12, this.oxygenLevel));
                // Check if temperature reached ALERT threshold
                if (this.getParameterStatus("temperature", this.temperature) === "alert") {
                    console.log(`🚨 Temperature ALERT reached (${this.temperature.toFixed(1)}°C). Pump should activate.`);
                }
                else if (this.getParameterStatus("temperature", this.temperature) === "ok" && this.controlledTest.pumpCompensationActive) {
                    console.log(`✅ Temperature restored to optimal (${this.temperature.toFixed(1)}°C). Moving to Oxygen test.`);
                    this.controlledTest.pumpCompensationActive = false;
                    this.controlledTest.currentParameter = "oxygenLevel";
                }
            }
            else if (this.controlledTest.currentParameter === "oxygenLevel") {
                // Oxygen in test: Random degradation + compensation
                this.oxygenLevel += primaryDegradation + o2Compensation;
                // pH: Fixed minor degradation + compensation
                this.pH += secondaryDegradation + pHCompensation;
                // Temperature: Fixed minor degradation + compensation
                this.temperature += secondaryDegradation + tempCompensation;
                this.pH = Math.max(5, Math.min(9, this.pH));
                this.temperature = Math.max(18, Math.min(32, this.temperature));
                this.oxygenLevel = Math.max(3, Math.min(12, this.oxygenLevel));
                // Check if oxygen reached ALERT threshold
                if (this.getParameterStatus("oxygenLevel", this.oxygenLevel) === "alert") {
                    console.log(`🚨 Oxygen ALERT reached (${this.oxygenLevel.toFixed(1)} mg/L). Pump should activate.`);
                }
                else if (this.getParameterStatus("oxygenLevel", this.oxygenLevel) === "ok" && this.controlledTest.pumpCompensationActive) {
                    console.log(`✅ Oxygen restored to optimal (${this.oxygenLevel.toFixed(1)} mg/L). Cycling back to pH test.`);
                    this.controlledTest.pumpCompensationActive = false;
                    this.controlledTest.currentParameter = "pH";
                }
            }
            // Check for alerts and emit events
            this.checkAndEmitAlerts();
            // Emit property changes
            this.thing.emitPropertyChange("pH");
            this.thing.emitPropertyChange("temperature");
            this.thing.emitPropertyChange("oxygenLevel");
            this.thing.emitPropertyChange("allParameters");
        }, sampling_config_1.SAMPLING_CONFIG.WATER_SENSOR_INTERVAL);
    }
    /**
     * RANDOM TEST MODE: Standard random variations
     */
    startRandomSimulation() {
        this.simulationInterval = setInterval(() => {
            // Simulate larger variations in readings to trigger alerts (TEST ONLY - unrealistic variations)
            this.pH += (Math.random() - 0.5) * 0.6;
            this.pH = Math.max(5, Math.min(9, this.pH)); // Clamp between 5-9
            this.temperature += (Math.random() - 0.5) * 1.2;
            this.temperature = Math.max(18, Math.min(32, this.temperature)); // Clamp between 18-32
            this.oxygenLevel += (Math.random() - 0.5) * 0.8;
            this.oxygenLevel = Math.max(3, Math.min(12, this.oxygenLevel)); // Clamp between 3-12
            // Check for alerts and emit events
            this.checkAndEmitAlerts();
            // Emit property changes
            this.thing.emitPropertyChange("pH");
            this.thing.emitPropertyChange("temperature");
            this.thing.emitPropertyChange("oxygenLevel");
            this.thing.emitPropertyChange("allParameters");
        }, sampling_config_1.SAMPLING_CONFIG.WATER_SENSOR_INTERVAL);
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
        const range = OPTIMAL_RANGES[param];
        if (value < range.warningMin || value > range.warningMax) {
            return "alert";
        }
        else if (value < range.min || value > range.max) {
            return "warning";
        }
        return "ok";
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
     * Set pump compensation state (for controlled test mode)
     * When active, parameters will recover at +0.6 per 3-second cycle
     */
    setPumpCompensation(active) {
        this.controlledTest.pumpCompensationActive = active;
        if (active) {
            console.log(`💧 Pump compensation ACTIVATED for ${this.controlledTest.currentParameter}`);
        }
        else {
            console.log(`💧 Pump compensation DEACTIVATED`);
        }
    }
    /**
     * Get controlled test state
     */
    getControlledTestState() {
        return Object.assign({}, this.controlledTest);
    }
}
exports.WaterQualitySensorThing = WaterQualitySensorThing;
