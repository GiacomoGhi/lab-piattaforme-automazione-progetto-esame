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
exports.WaterThing = void 0;
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
        this.simulationActive = false;
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
            // Emit waterStateChanged event (for subscribers using subscribeevent)
            const event = {
                parameter: property,
                oldValue,
                newValue,
                timestamp: new Date().toISOString(),
            };
            this.thing.emitEvent("waterStateChanged", event);
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
     * Start degradation simulation (called when pump turns off)
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
    }
    /**
     * Stop degradation simulation and prepare for next cycle
     */
    stopDegradationSimulation() {
        if (!this.simulationActive)
            return;
        this.simulationActive = false;
        if (this.degradationInterval) {
            clearInterval(this.degradationInterval);
            this.degradationInterval = null;
        }
        // Rotate to next cycle
        this.degradationConfig.currentTestCycle = this.degradationConfig.currentTestCycle === 0 ? 1 : 0;
        this.degradationConfig.acceleratedParameterIndex = (this.degradationConfig.acceleratedParameterIndex + 1) % 3;
        console.log(`[Water DT] ⏹️ Degradation simulation stopped. Next: Cycle ${this.degradationConfig.currentTestCycle === 0 ? "UP" : "DOWN"}, Accelerated param: ${["pH", "temperature", "oxygenLevel"][this.degradationConfig.acceleratedParameterIndex]}`);
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
    }
}
exports.WaterThing = WaterThing;
