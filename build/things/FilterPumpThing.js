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
exports.FilterPumpThing = void 0;
class FilterPumpThing {
    constructor(runtime, proxyTD, modbusTD) {
        this.consumedModbus = null;
        this.state = {
            pumpSpeed: 0,
            filterStatus: "idle",
            filterHealth: 100,
            lastCleaningTime: new Date().toISOString(),
        };
        this.modbusPollInterval = null;
        this.runtime = runtime;
        this.proxyTD = proxyTD;
        this.modbusTD = modbusTD;
    }
    /**
     * Start the filter pump thing
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // Create the HTTP proxy thing
            this.thing = yield this.runtime.produce(this.proxyTD);
            yield this.connectToModbus();
            // Set up property read handlers
            this.thing.setPropertyReadHandler("pumpSpeed", () => __awaiter(this, void 0, void 0, function* () {
                yield this.syncStateFromModbus();
                console.log(`> Read pumpSpeed: ${this.state.pumpSpeed}%`);
                return this.state.pumpSpeed;
            }));
            this.thing.setPropertyReadHandler("filterStatus", () => __awaiter(this, void 0, void 0, function* () {
                yield this.syncStateFromModbus();
                console.log(`> Read filterStatus: ${this.state.filterStatus}`);
                return this.state.filterStatus;
            }));
            this.thing.setPropertyReadHandler("filterHealth", () => __awaiter(this, void 0, void 0, function* () {
                yield this.syncStateFromModbus();
                const roundedHealth = Math.round(this.state.filterHealth);
                console.log(`> Read filterHealth: ${roundedHealth}%`);
                return roundedHealth;
            }));
            this.thing.setPropertyReadHandler("lastCleaningTime", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`> Read lastCleaningTime: ${this.state.lastCleaningTime}`);
                return this.state.lastCleaningTime;
            }));
            // Set up action handlers
            this.thing.setActionHandler("setPumpSpeed", (params) => __awaiter(this, void 0, void 0, function* () {
                // Extract the actual value from InteractionOutput if needed
                let speedValue;
                if (params && typeof params.value === "function") {
                    speedValue = yield params.value();
                }
                else {
                    speedValue = params;
                }
                const newSpeed = Math.max(0, Math.min(100, Number(speedValue)));
                this.state.pumpSpeed = newSpeed;
                if (newSpeed === 0) {
                    this.state.filterStatus = "idle";
                }
                else if (this.state.filterStatus !== "cleaning") {
                    this.state.filterStatus = "running";
                }
                try {
                    if (this.consumedModbus) {
                        yield this.consumedModbus.invokeAction("writePumpSpeed", newSpeed);
                        yield this.syncStateFromModbus();
                    }
                }
                catch (error) {
                    console.error("[FilterPump] Modbus write failed:", error);
                    return {
                        success: false,
                        newSpeed: newSpeed,
                        message: "Modbus write failed",
                    };
                }
                console.log(`⚙️ Pump speed set to ${newSpeed}%`);
                // Emit property change
                this.thing.emitPropertyChange("pumpSpeed");
                this.thing.emitPropertyChange("filterStatus");
                return {
                    success: true,
                    newSpeed: newSpeed,
                    message: `Pump speed set to ${newSpeed}%`,
                };
            }));
            this.thing.setActionHandler("cleaningCycle", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`🧹 Starting cleaning cycle...`);
                try {
                    if (this.consumedModbus) {
                        yield this.consumedModbus.invokeAction("triggerCleaning", 1);
                        yield this.syncStateFromModbus();
                    }
                }
                catch (error) {
                    console.error("[FilterPump] Modbus cleaning failed:", error);
                    return {
                        success: false,
                        status: "error",
                        message: "Modbus cleaning failed",
                    };
                }
                this.state.lastCleaningTime = new Date().toISOString();
                this.thing.emitPropertyChange("lastCleaningTime");
                return {
                    success: true,
                    status: "completed",
                    message: `Cleaning cycle completed. Filter health: ${this.state.filterHealth}%`,
                };
            }));
            // Expose the thing
            yield this.thing.expose();
            const title = this.proxyTD.title || "FilterPump";
            console.log(`${title} thing started! Go to: http://localhost:8080/${title.toLowerCase()}`);
            // Start Modbus polling to emit property changes
            this.startModbusPolling();
        });
    }
    /**
     * Simulate filter health degradation and status changes
     */
    startModbusPolling() {
        if (this.modbusPollInterval) {
            clearInterval(this.modbusPollInterval);
        }
        this.modbusPollInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const previousState = Object.assign({}, this.state);
            yield this.syncStateFromModbus();
            if (this.state.pumpSpeed !== previousState.pumpSpeed) {
                this.thing.emitPropertyChange("pumpSpeed");
            }
            if (this.state.filterStatus !== previousState.filterStatus) {
                this.thing.emitPropertyChange("filterStatus");
            }
            if (this.state.filterHealth !== previousState.filterHealth) {
                this.thing.emitPropertyChange("filterHealth");
            }
        }), 3000);
    }
    /**
     * Stop the thing
     */
    stop() {
        if (this.modbusPollInterval) {
            clearInterval(this.modbusPollInterval);
        }
    }
    connectToModbus() {
        return __awaiter(this, void 0, void 0, function* () {
            this.consumedModbus = yield this.runtime.consume(this.modbusTD);
        });
    }
    readModbusNumber(property) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.consumedModbus)
                return 0;
            const prop = yield this.consumedModbus.readProperty(property);
            const raw = yield prop.value();
            if (typeof raw === "number")
                return raw;
            if (Buffer.isBuffer(raw))
                return raw.readUInt16BE(0);
            return Number(raw);
        });
    }
    mapStatusFromRegister(value) {
        switch (value) {
            case 0:
                return "idle";
            case 1:
                return "running";
            case 2:
                return "cleaning";
            case 3:
                return "error";
            default:
                return "error";
        }
    }
    syncStateFromModbus() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.consumedModbus)
                return;
            const pumpSpeed = yield this.readModbusNumber("pumpSpeed");
            const filterStatus = yield this.readModbusNumber("filterStatus");
            const filterHealth = yield this.readModbusNumber("filterHealth");
            this.state.pumpSpeed = pumpSpeed;
            this.state.filterStatus = this.mapStatusFromRegister(filterStatus);
            this.state.filterHealth = filterHealth;
        });
    }
}
exports.FilterPumpThing = FilterPumpThing;
