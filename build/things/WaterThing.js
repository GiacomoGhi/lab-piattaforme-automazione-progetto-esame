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
exports.WaterThing = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const OPTIMAL_VALUES = {
    pH: 7.0,
    temperature: 25.0,
    oxygenLevel: 7.0,
};
class WaterThing {
    constructor(runtime, td) {
        // Internal water state (source of truth)
        this.state = {
            pH: 7.0,
            temperature: 25.0,
            oxygenLevel: 7.0,
        };
        // Simulation state
        this.degradationConfig = {
            currentTestCycle: 0, // 0 = increase, 1 = decrease
            acceleratedParameterIndex: 0, // 0=pH, 1=temperature, 2=oxygenLevel
        };
        this.degradationInterval = null;
        this.cycleRotationInterval = null;
        this.simulationActive = false;
        this.cycleDurationMs = 30000;
        this.correctionInterval = null;
        this.consumedPump = null;
        this.pumpReachable = false;
        this.pumpRetryDelayMs = 1000;
        this.pumpNextRetryAt = 0;
        this.runtime = runtime;
        this.td = td;
    }
    /**
     * Start the Water Digital Twin
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            this.thing = yield this.runtime.produce(this.td);
            // Set up property READ handlers
            this.thing.setPropertyReadHandler("pH", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`[Water DT] > Read pH: ${this.state.pH.toFixed(2)}`);
                return this.state.pH;
            }));
            this.thing.setPropertyReadHandler("temperature", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`[Water DT] > Read temperature: ${this.state.temperature.toFixed(1)}°C`);
                return this.state.temperature;
            }));
            this.thing.setPropertyReadHandler("oxygenLevel", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`[Water DT] > Read oxygenLevel: ${this.state.oxygenLevel.toFixed(1)} mg/L`);
                return this.state.oxygenLevel;
            }));
            // Set up property WRITE handlers
            this.thing.setPropertyWriteHandler("pH", (value) => __awaiter(this, void 0, void 0, function* () {
                const newValue = yield this.extractValue(value);
                yield this.updateProperty("pH", newValue);
            }));
            this.thing.setPropertyWriteHandler("temperature", (value) => __awaiter(this, void 0, void 0, function* () {
                const newValue = yield this.extractValue(value);
                yield this.updateProperty("temperature", newValue);
            }));
            this.thing.setPropertyWriteHandler("oxygenLevel", (value) => __awaiter(this, void 0, void 0, function* () {
                const newValue = yield this.extractValue(value);
                yield this.updateProperty("oxygenLevel", newValue);
            }));
            // Expose the thing
            yield this.thing.expose();
            const title = this.td.title || "Water";
            console.log(`💧 ${title} Digital Twin started! Go to: http://localhost:8080/${title.toLowerCase()}`);
            this.startDegradationSimulation();
            console.log("Water degradation simulation started");
            this.scheduleConnectToPump(2000);
            this.startCorrectionLoop();
        });
    }
    /**
     * Extract value from InteractionOutput or raw value
     */
    extractValue(input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (input && typeof input.value === "function") {
                return Number(yield input.value());
            }
            return Number(input);
        });
    }
    /**
     * Update a water property and emit change event
     */
    updateProperty(property, newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldValue = this.state[property];
            // Validate and clamp values
            switch (property) {
                case "pH":
                    newValue = Math.max(0, Math.min(14, newValue));
                    break;
                case "temperature":
                    newValue = Math.max(0, Math.min(40, newValue));
                    break;
                case "oxygenLevel":
                    newValue = Math.max(0, Math.min(20, newValue));
                    break;
            }
            this.state[property] = newValue;
            console.log(`[Water DT] ✏️ ${property} updated: ${oldValue.toFixed(2)} → ${newValue.toFixed(2)}`);
            // Emit property change (for subscribers using observeproperty)
            this.thing.emitPropertyChange(property);
            // PUB/SUB disabled: WaterThing publishes only via properties in this demo.
            return {
                success: true,
                newValue,
                message: `${property} set to ${newValue}`,
            };
        });
    }
    /**
     * Get current state (for external use)
     */
    getState() {
        return Object.assign({}, this.state);
    }
    /**
     * Programmatically update state (for use by other components like mock server)
     */
    setState(updates) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined) {
                    yield this.updateProperty(key, value);
                }
            }
        });
    }
    /**
     * Start degradation simulation (runs continuously)
     */
    startDegradationSimulation() {
        if (this.simulationActive) {
            console.log("[Water DT] 🔄 Degradation simulation already running");
            return;
        }
        this.simulationActive = true;
        console.log(`[Water DT] 🌊 Starting degradation simulation (Cycle ${this.degradationConfig.currentTestCycle === 0 ? "UP" : "DOWN"})`);
        if (this.degradationInterval) {
            clearInterval(this.degradationInterval);
        }
        if (this.cycleRotationInterval) {
            clearInterval(this.cycleRotationInterval);
        }
        const parametersMap = ["pH", "temperature", "oxygenLevel"];
        this.degradationInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const isIncreasing = this.degradationConfig.currentTestCycle === 0;
            const direction = isIncreasing ? 1 : -1;
            // Apply 0.2 to all parameters
            const baseChange = 0.2 * direction;
            // Apply 0.4 extra to accelerated parameter
            const acceleratedParam = parametersMap[this.degradationConfig.acceleratedParameterIndex];
            const acceleratedChange = 0.4 * direction;
            for (let i = 0; i < parametersMap.length; i++) {
                const param = parametersMap[i];
                const extraChange = i === this.degradationConfig.acceleratedParameterIndex ? acceleratedChange : 0;
                const totalChange = baseChange + extraChange;
                let newValue = this.state[param] + totalChange;
                // Clamp values
                switch (param) {
                    case "pH":
                        newValue = Math.max(0, Math.min(14, newValue));
                        break;
                    case "temperature":
                        newValue = Math.max(0, Math.min(40, newValue));
                        break;
                    case "oxygenLevel":
                        newValue = Math.max(0, Math.min(20, newValue));
                        break;
                }
                this.state[param] = newValue;
            }
            // Emit changes
            yield this.thing.emitPropertyChange("pH");
            yield this.thing.emitPropertyChange("temperature");
            yield this.thing.emitPropertyChange("oxygenLevel");
        }), 1000); // Every second
        this.cycleRotationInterval = setInterval(() => {
            if (!this.simulationActive)
                return;
            this.degradationConfig.currentTestCycle =
                this.degradationConfig.currentTestCycle === 0 ? 1 : 0;
            this.degradationConfig.acceleratedParameterIndex =
                (this.degradationConfig.acceleratedParameterIndex + 1) % 3;
            console.log(`[Water DT] 🔁 Cycle switched to ${this.degradationConfig.currentTestCycle === 0 ? "UP" : "DOWN"}, Accelerated param: ${["pH", "temperature", "oxygenLevel"][this.degradationConfig.acceleratedParameterIndex]}`);
        }, this.cycleDurationMs);
    }
    /**
     * Stop degradation simulation (used on shutdown)
     */
    stopDegradationSimulation() {
        if (!this.simulationActive)
            return;
        this.simulationActive = false;
        if (this.degradationInterval) {
            clearInterval(this.degradationInterval);
            this.degradationInterval = null;
        }
        if (this.cycleRotationInterval) {
            clearInterval(this.cycleRotationInterval);
            this.cycleRotationInterval = null;
        }
        console.log("[Water DT] ⏹️ Degradation simulation stopped");
    }
    scheduleConnectToPump(delayMs) {
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            const connected = yield this.connectToPump();
            if (!connected) {
                console.log("[Water DT] Will retry pump connection in 5 seconds...");
                this.scheduleConnectToPump(5000);
            }
        }), delayMs);
    }
    connectToPump() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const pumpTD = yield this.runtime.requestThingDescription("http://localhost:8080/filterpump");
                this.consumedPump = yield this.runtime.consume(pumpTD);
                if (!this.pumpReachable) {
                    console.log("[Water DT] Connected to Filter Pump proxy");
                }
                this.pumpReachable = true;
                this.pumpRetryDelayMs = 1000;
                this.pumpNextRetryAt = 0;
                return true;
            }
            catch (error) {
                if (this.pumpReachable) {
                    console.warn(`[Water DT] Pump proxy unavailable, retrying in ${this.pumpRetryDelayMs}ms.`);
                }
                this.pumpReachable = false;
                this.pumpNextRetryAt = Date.now() + this.pumpRetryDelayMs;
                this.pumpRetryDelayMs = Math.min(this.pumpRetryDelayMs * 2, 15000);
                return false;
            }
        });
    }
    canAttemptPumpRead() {
        if (this.pumpNextRetryAt === 0) {
            return true;
        }
        return Date.now() >= this.pumpNextRetryAt;
    }
    startCorrectionLoop() {
        if (this.correctionInterval) {
            clearInterval(this.correctionInterval);
        }
        this.correctionInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (!this.simulationActive)
                return;
            if (!this.consumedPump)
                return;
            if (!this.canAttemptPumpRead())
                return;
            let pumpSpeed = 0;
            try {
                const pumpSpeedProp = yield this.consumedPump.readProperty("pumpSpeed");
                pumpSpeed = Number(yield pumpSpeedProp.value());
            }
            catch (error) {
                this.consumedPump = null;
                this.pumpReachable = false;
                this.scheduleConnectToPump(2000);
                return;
            }
            if (pumpSpeed <= 0)
                return;
            const targets = this.loadOptimalTargetsFromConfig();
            const speedFactor = Math.max(0, Math.min(1, pumpSpeed / 100));
            const maxStep = 2.2 * speedFactor;
            yield this.applyWaterCorrections(targets, maxStep);
        }), 1000);
    }
    applyWaterCorrections(targets, maxStep) {
        return __awaiter(this, void 0, void 0, function* () {
            const updates = {};
            const current = {
                pH: this.state.pH,
                temperature: this.state.temperature,
                oxygenLevel: this.state.oxygenLevel,
            };
            for (const key of ["pH", "temperature", "oxygenLevel"]) {
                const delta = targets[key] - current[key];
                if (Math.abs(delta) < 0.01 || maxStep === 0) {
                    continue;
                }
                const correction = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
                if (Math.abs(correction) > 0.01) {
                    updates[key] = current[key] + correction;
                }
            }
            const entries = Object.entries(updates);
            for (const [key, value] of entries) {
                yield this.updateProperty(key, value);
            }
        });
    }
    loadOptimalTargetsFromConfig() {
        try {
            const configPath = path.join(process.cwd(), "config.json");
            const configContent = fs.readFileSync(configPath, "utf-8");
            const config = JSON.parse(configContent);
            const defaults = {
                pH: 7.0,
                temperature: 25.0,
                oxygenLevel: 7.0,
            };
            if (!(config === null || config === void 0 ? void 0 : config.parameters)) {
                return defaults;
            }
            const targets = Object.assign({}, defaults);
            for (const key of ["pH", "temperature", "oxygenLevel"]) {
                const paramConfig = config.parameters[key];
                if (paramConfig === null || paramConfig === void 0 ? void 0 : paramConfig.optimal) {
                    const min = Number(paramConfig.optimal.min);
                    const max = Number(paramConfig.optimal.max);
                    if (!Number.isNaN(min) && !Number.isNaN(max)) {
                        targets[key] = (min + max) / 2;
                    }
                }
            }
            return targets;
        }
        catch (error) {
            return {
                pH: 7.0,
                temperature: 25.0,
                oxygenLevel: 7.0,
            };
        }
    }
    /**
     * Check if all parameters are within optimal range
     */
    allParametersOptimal() {
        const OPTIMAL_RANGES = {
            pH: { min: 6.5, max: 7.5 },
            temperature: { min: 24, max: 26 },
            oxygenLevel: { min: 6, max: 8 },
        };
        return (this.state.pH >= OPTIMAL_RANGES.pH.min &&
            this.state.pH <= OPTIMAL_RANGES.pH.max &&
            this.state.temperature >= OPTIMAL_RANGES.temperature.min &&
            this.state.temperature <= OPTIMAL_RANGES.temperature.max &&
            this.state.oxygenLevel >= OPTIMAL_RANGES.oxygenLevel.min &&
            this.state.oxygenLevel <= OPTIMAL_RANGES.oxygenLevel.max);
    }
    /**
     * Stop everything on shutdown
     */
    stop() {
        this.stopDegradationSimulation();
        if (this.correctionInterval) {
            clearInterval(this.correctionInterval);
            this.correctionInterval = null;
        }
    }
}
exports.WaterThing = WaterThing;
