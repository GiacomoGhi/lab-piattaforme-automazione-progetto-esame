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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const modbus_serial_1 = __importDefault(require("modbus-serial"));
class ModbusFilterPumpMockServer {
    constructor(port, waterEndpoint) {
        this.port = 502;
        this.waterEndpoint = "http://localhost:8080/water";
        this.server = null;
        this.registers = {
            0: 30, // pumpSpeed (initial 30%)
            1: 0, // filterStatus (0=idle)
            2: 100, // filterHealth (100%)
            3: 0, // cleaningCommand (no cleaning)
        };
        this.simulationActive = true;
        this.lastCleaningTime = Date.now();
        this.simulationIntervals = [];
        this.waterCorrectionInterval = null;
        this.waterReachable = false;
        this.waterRetryDelayMs = 1000;
        this.waterNextRetryAt = 0;
        if (port)
            this.port = port;
        if (waterEndpoint)
            this.waterEndpoint = waterEndpoint;
    }
    /**
     * Start the mock Modbus simulator
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("🔧 Starting Modbus Mock Server Simulator...");
            const vector = this.getModbusVector();
            this.server = new modbus_serial_1.default.ServerTCP(vector, {
                host: "127.0.0.1",
                port: this.port,
                unitID: 1,
                debug: false,
            });
            yield new Promise((resolve) => setTimeout(resolve, 100));
            console.log(`✅ Mock Modbus Server listening on 127.0.0.1:${this.port}`);
            // Start simulation loop
            this.startSimulation();
            this.startWaterCorrectionLoop();
        });
    }
    /**
     * Handle register changes
     */
    onRegisterChange(address, value) {
        switch (address) {
            case 0: // pumpSpeed
                console.log(`[Modbus] Register 0 (pumpSpeed) = ${value}%`);
                // Update filter status based on speed
                if (value === 0) {
                    this.registers[1] = 0; // idle
                }
                else {
                    this.registers[1] = 1; // running
                }
                break;
            case 1: // filterStatus
                console.log(`[Modbus] Register 1 (filterStatus) = ${this.getStatusName(value)}`);
                break;
            case 3: // cleaningCommand
                if (value === 1) {
                    console.log(`[Modbus] Register 3: Cleaning cycle triggered!`);
                    this.executeCleaning();
                }
                break;
            default:
                console.log(`[Modbus] Register ${address} = ${value}`);
        }
    }
    /**
     * Execute cleaning cycle
     */
    executeCleaning() {
        console.log("🧹 [Modbus] Executing cleaning cycle...");
        // Set status to cleaning
        this.registers[1] = 2;
        setTimeout(() => {
            // Reset health to 100
            this.registers[2] = 100;
            // Reset to idle
            this.registers[1] = 0;
            // Clear cleaning command
            this.registers[3] = 0;
            this.lastCleaningTime = Date.now();
            console.log("✨ [Modbus] Cleaning cycle completed!");
        }, 8000); // 8 second cleaning duration
    }
    /**
     * Simulate gradual health degradation
     */
    startSimulation() {
        const degradationInterval = setInterval(() => {
            if (!this.simulationActive)
                return;
            // Degrade health based on pump speed
            const pumpSpeed = this.registers[0];
            const degradationRate = (pumpSpeed / 100) * 0.3; // 0-0.3% per interval
            if (this.registers[2] > 0) {
                this.registers[2] = Math.max(0, this.registers[2] - degradationRate);
            }
            // Emit status
            if (pumpSpeed > 0 && this.registers[1] !== 2) {
                // Running (if not cleaning)
                this.registers[1] = 1;
            }
            else if (pumpSpeed === 0) {
                this.registers[1] = 0; // Idle
            }
            // Log health status periodically
            if (Math.random() < 0.1) {
                console.log(`📊 [Modbus] Pump: ${pumpSpeed}% | Status: ${this.getStatusName(this.registers[1])} | Health: ${this.registers[2].toFixed(1)}%`);
            }
        }, 5000); // Update every 5 seconds
        this.simulationIntervals.push(degradationInterval);
    }
    /**
     * Apply water correction based on pump speed
     */
    startWaterCorrectionLoop() {
        if (this.waterCorrectionInterval) {
            clearInterval(this.waterCorrectionInterval);
        }
        this.waterCorrectionInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (!this.simulationActive)
                return;
            const pumpSpeed = this.registers[0];
            if (pumpSpeed <= 0)
                return;
            if (!this.canAttemptWaterRead()) {
                return;
            }
            try {
                const waterState = yield this.readWaterState();
                if (!waterState) {
                    this.onWaterReadFailure();
                    return;
                }
                this.onWaterReadSuccess();
                const targets = this.loadOptimalTargetsFromConfig();
                const speedFactor = Math.max(0, Math.min(1, pumpSpeed / 100));
                const maxStep = 0.8 * speedFactor;
                yield this.applyWaterCorrections(waterState, targets, maxStep);
            }
            catch (error) {
                this.onWaterReadFailure();
            }
        }), 1000);
    }
    readWaterState() {
        return __awaiter(this, void 0, void 0, function* () {
            let response;
            try {
                response = yield fetch(`${this.waterEndpoint}/properties`);
            }
            catch (error) {
                return null;
            }
            if (!response.ok) {
                return null;
            }
            const data = yield response.json();
            if (typeof data.pH !== "number" ||
                typeof data.temperature !== "number" ||
                typeof data.oxygenLevel !== "number") {
                return null;
            }
            return {
                pH: data.pH,
                temperature: data.temperature,
                oxygenLevel: data.oxygenLevel,
            };
        });
    }
    canAttemptWaterRead() {
        if (this.waterNextRetryAt === 0) {
            return true;
        }
        return Date.now() >= this.waterNextRetryAt;
    }
    onWaterReadSuccess() {
        if (!this.waterReachable) {
            console.log("[Modbus] Water endpoint available.");
        }
        this.waterReachable = true;
        this.waterRetryDelayMs = 1000;
        this.waterNextRetryAt = 0;
    }
    onWaterReadFailure() {
        if (this.waterReachable) {
            console.warn(`[Modbus] Water endpoint unavailable, retrying in ${this.waterRetryDelayMs}ms.`);
        }
        this.waterReachable = false;
        this.waterNextRetryAt = Date.now() + this.waterRetryDelayMs;
        this.waterRetryDelayMs = Math.min(this.waterRetryDelayMs * 2, 15000);
    }
    applyWaterCorrections(current, targets, maxStep) {
        return __awaiter(this, void 0, void 0, function* () {
            const updates = {};
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
                yield this.writeWaterProperty(key, value);
            }
        });
    }
    writeWaterProperty(property, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch(`${this.waterEndpoint}/properties/${property}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(value),
            });
        });
    }
    loadOptimalTargetsFromConfig() {
        try {
            const fs = require("fs");
            const path = require("path");
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
     * Get human-readable status name
     */
    getStatusName(status) {
        const statuses = {
            0: "idle",
            1: "running",
            2: "cleaning",
            3: "error",
        };
        return statuses[status] || `unknown(${status})`;
    }
    /**
     * Read a register value (simulates Modbus read)
     */
    readRegister(address) {
        const value = this.registers[address] || 0;
        // console.log(`[Modbus Read] Register ${address} = ${value}`);
        return value;
    }
    /**
     * Write to a register (simulates Modbus write)
     */
    writeRegister(address, value) {
        this.registers[address] = value;
        this.onRegisterChange(address, value);
    }
    getModbusVector() {
        return {
            getHoldingRegister: (address) => {
                const value = this.readRegister(address);
                return Math.round(value);
            },
            setRegister: (address, value) => {
                this.writeRegister(address, value);
            },
        };
    }
    /**
     * Stop the server
     */
    stop() {
        console.log("🛑 Stopping Modbus Mock Server...");
        this.simulationActive = false;
        this.simulationIntervals.forEach((interval) => clearInterval(interval));
        if (this.waterCorrectionInterval) {
            clearInterval(this.waterCorrectionInterval);
            this.waterCorrectionInterval = null;
        }
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
    /**
     * Get current register values
     */
    getRegisters() {
        return Object.assign({}, this.registers);
    }
    /**
     * Set register value
     */
    setRegister(address, value) {
        this.writeRegister(address, value);
    }
}
// ===== MAIN EXECUTION =====
const modbusServer = new ModbusFilterPumpMockServer(502, "http://localhost:8080/water");
modbusServer.start().catch((error) => {
    console.error("Failed to start Modbus server:", error);
    process.exit(1);
});
// Handle graceful shutdown
process.on("SIGINT", () => {
    console.log("\n");
    modbusServer.stop();
    process.exit(0);
});
exports.default = modbusServer;
