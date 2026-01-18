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
        this.state = {
            pumpSpeed: 30,
            filterStatus: "idle",
            filterHealth: 100,
            lastCleaningTime: new Date().toISOString(),
        };
        this.simulationInterval = null;
        this.healthDegradationInterval = null;
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
            // Set up property read handlers
            this.thing.setPropertyReadHandler("pumpSpeed", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`> Read pumpSpeed: ${this.state.pumpSpeed}%`);
                return this.state.pumpSpeed;
            }));
            this.thing.setPropertyReadHandler("filterStatus", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`> Read filterStatus: ${this.state.filterStatus}`);
                return this.state.filterStatus;
            }));
            this.thing.setPropertyReadHandler("filterHealth", () => __awaiter(this, void 0, void 0, function* () {
                const roundedHealth = Math.round(this.state.filterHealth);
                console.log(`> Read filterHealth: ${roundedHealth}%`);
                return roundedHealth;
            }));
            this.thing.setPropertyReadHandler("lastCleaningTime", () => __awaiter(this, void 0, void 0, function* () {
                console.log(`> Read lastCleaningTime: ${this.state.lastCleaningTime}`);
                return this.state.lastCleaningTime;
            }));
            // Set up action handlers
            this.thing.setActionHandler("setPumpSpeed", (speed) => __awaiter(this, void 0, void 0, function* () {
                const newSpeed = Math.max(0, Math.min(100, Number(speed)));
                this.state.pumpSpeed = newSpeed;
                const statusMap = {
                    0: "idle",
                    1: "running",
                    2: "running", // pump running at set speed
                };
                if (newSpeed === 0) {
                    this.state.filterStatus = "idle";
                }
                else if (this.state.filterStatus !== "cleaning") {
                    this.state.filterStatus = "running";
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
                this.state.filterStatus = "cleaning";
                this.thing.emitPropertyChange("filterStatus");
                // Simulate cleaning
                yield new Promise((resolve) => setTimeout(resolve, 8000)); // 8 seconds cleaning
                this.state.filterStatus = "running";
                this.state.filterHealth = 100;
                this.state.lastCleaningTime = new Date().toISOString();
                console.log(`✨ Cleaning cycle complete! Filter health restored to 100%`);
                this.thing.emitPropertyChange("filterStatus");
                this.thing.emitPropertyChange("filterHealth");
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
            // Start health degradation simulation
            this.startSimulation();
        });
    }
    /**
     * Simulate filter health degradation and status changes
     */
    startSimulation() {
        // Degrade filter health based on pump speed
        this.healthDegradationInterval = setInterval(() => {
            // Health degrades faster at higher speeds
            const degradationRate = (this.state.pumpSpeed / 100) * 0.5; // 0-0.5% per interval
            this.state.filterHealth = Math.max(0, this.state.filterHealth - degradationRate);
            // Emit changes
            this.thing.emitPropertyChange("filterHealth");
        }, 5000); // Check every 5 seconds
        // Simulate occasional status changes
        this.simulationInterval = setInterval(() => {
            // If pump is running and speed > 0, keep it running
            if (this.state.pumpSpeed > 0 && this.state.filterStatus !== "cleaning") {
                this.state.filterStatus = "running";
            }
            else if (this.state.pumpSpeed === 0) {
                this.state.filterStatus = "idle";
            }
            this.thing.emitPropertyChange("filterStatus");
        }, 3000);
    }
    /**
     * Stop the thing
     */
    stop() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        if (this.healthDegradationInterval) {
            clearInterval(this.healthDegradationInterval);
        }
    }
    /**
     * Get current state for external use
     */
    getState() {
        return Object.assign({}, this.state);
    }
}
exports.FilterPumpThing = FilterPumpThing;
