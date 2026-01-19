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
/**
 * WaterThing - Digital Twin representing the aquarium water state.
 *
 * This Thing acts as the source of truth for water parameters.
 * It exposes pH, temperature, and oxygenLevel as read/write properties.
 * Other Things (like WaterQualitySensor) subscribe to this Thing's events.
 *
 * Architecture:
 * - WaterThing (Digital Twin) ← publishes state changes
 * - WaterQualitySensor ← subscribes and reads from WaterThing
 * - FilterPump ← can affect water state (future: via ModbusMockServer)
 */
class WaterThing {
    constructor(runtime, td) {
        // Internal water state (source of truth)
        this.state = {
            pH: 7.0,
            temperature: 25.0,
            oxygenLevel: 7.0,
        };
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
}
exports.WaterThing = WaterThing;
