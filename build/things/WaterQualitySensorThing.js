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
        this.runtime = runtime;
        this.td = td;
    }
    /**
     * Start the thing and begin simulating sensor readings
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
     * Simulate sensor readings with realistic variations
     */
    startSimulation() {
        this.simulationInterval = setInterval(() => {
            // Simulate small variations in readings
            this.pH += (Math.random() - 0.5) * 0.2;
            this.pH = Math.max(5, Math.min(9, this.pH)); // Clamp between 5-9
            this.temperature += (Math.random() - 0.5) * 0.5;
            this.temperature = Math.max(18, Math.min(32, this.temperature)); // Clamp between 18-32
            this.oxygenLevel += (Math.random() - 0.5) * 0.3;
            this.oxygenLevel = Math.max(3, Math.min(12, this.oxygenLevel)); // Clamp between 3-12
            // Check for alerts and emit events
            this.checkAndEmitAlerts();
            // Emit property changes
            this.thing.emitPropertyChange("pH");
            this.thing.emitPropertyChange("temperature");
            this.thing.emitPropertyChange("oxygenLevel");
            this.thing.emitPropertyChange("allParameters");
        }, 3000); // Update every 3 seconds
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
}
exports.WaterQualitySensorThing = WaterQualitySensorThing;
