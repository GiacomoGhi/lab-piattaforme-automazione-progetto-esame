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
exports.FilterPumpThing = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_OPTIMAL_TARGETS = {
    pH: 7.0,
    temperature: 25.0,
    oxygenLevel: 7.0,
};
class FilterPumpThing {
    constructor(runtime, proxyTD, modbusTD, waterThing) {
        this.waterThing = null;
        this.state = {
            pumpSpeed: 0,
            filterStatus: "idle",
            filterHealth: 100,
            lastCleaningTime: new Date().toISOString(),
        };
        this.simulationInterval = null;
        this.healthDegradationInterval = null;
        this.waterCorrectionInterval = null;
        this.optimalTargets = Object.assign({}, DEFAULT_OPTIMAL_TARGETS);
        this.runtime = runtime;
        this.proxyTD = proxyTD;
        this.modbusTD = modbusTD;
        this.waterThing = waterThing || null;
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
                const wasRunning = this.state.pumpSpeed > 0;
                const nowRunning = newSpeed > 0;
                this.state.pumpSpeed = newSpeed;
                const statusMap = {
                    0: "idle",
                    1: "running",
                    2: "running", // pump running at set speed
                };
                if (newSpeed === 0) {
                    this.state.filterStatus = "idle";
                    // Pump turning off - stop water correction
                    this.stopWaterCorrection();
                    // Start water degradation if available
                    if (this.waterThing) {
                        this.waterThing.startDegradationSimulation();
                    }
                }
                else if (this.state.filterStatus !== "cleaning") {
                    this.state.filterStatus = "running";
                    // Pump turning on - start water correction
                    if (!wasRunning && nowRunning && this.waterThing) {
                        this.waterThing.stopDegradationSimulation();
                        this.startWaterCorrection();
                    }
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
        }, 1000); // Check every 1 second (accelerated for demo)
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
        if (this.waterCorrectionInterval) {
            clearInterval(this.waterCorrectionInterval);
        }
    }
    /**
     * Start water correction (pump running)
     * Updates water parameters to move towards optimal values
     */
    startWaterCorrection() {
        console.log("[Pump] 💧 Starting water correction...");
        if (this.waterCorrectionInterval) {
            clearInterval(this.waterCorrectionInterval);
        }
        this.waterCorrectionInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (!this.waterThing || this.state.pumpSpeed === 0) {
                this.stopWaterCorrection();
                return;
            }
            const currentState = this.waterThing.getState();
            const optimalTargets = this.loadOptimalTargetsFromConfig();
            const speedFactor = Math.max(0, Math.min(1, this.state.pumpSpeed / 100));
            const maxStep = 0.8 * speedFactor;
            // Calculate correction for each parameter
            const corrections = {};
            for (const [param, targetValue] of Object.entries(optimalTargets)) {
                const currentValue = currentState[param];
                const delta = targetValue - currentValue;
                let correction = 0;
                if (Math.abs(delta) < 0.01 || maxStep === 0) {
                    correction = 0;
                }
                else {
                    correction = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
                }
                if (Math.abs(correction) > 0.01) {
                    corrections[param] = currentValue + correction;
                }
            }
            // Apply corrections
            if (Object.keys(corrections).length > 0) {
                yield this.waterThing.setState(corrections);
            }
        }), 1000); // Every second
    }
    /**
     * Stop water correction
     */
    stopWaterCorrection() {
        if (this.waterCorrectionInterval) {
            clearInterval(this.waterCorrectionInterval);
            this.waterCorrectionInterval = null;
        }
    }
    /**
     * Load optimal targets from config.json (midpoint of optimal ranges)
     */
    loadOptimalTargetsFromConfig() {
        try {
            const configPath = path.join(process.cwd(), "config.json");
            const configContent = fs.readFileSync(configPath, "utf-8");
            const config = JSON.parse(configContent);
            if (!(config === null || config === void 0 ? void 0 : config.parameters)) {
                return this.optimalTargets;
            }
            const nextTargets = Object.assign({}, DEFAULT_OPTIMAL_TARGETS);
            for (const key of ["pH", "temperature", "oxygenLevel"]) {
                const paramConfig = config.parameters[key];
                if (paramConfig === null || paramConfig === void 0 ? void 0 : paramConfig.optimal) {
                    const min = Number(paramConfig.optimal.min);
                    const max = Number(paramConfig.optimal.max);
                    if (!Number.isNaN(min) && !Number.isNaN(max)) {
                        nextTargets[key] = (min + max) / 2;
                    }
                }
            }
            this.optimalTargets = nextTargets;
            return nextTargets;
        }
        catch (error) {
            console.warn("[Pump] ⚠️ Failed to load optimal targets, using cached values.");
            return this.optimalTargets;
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
