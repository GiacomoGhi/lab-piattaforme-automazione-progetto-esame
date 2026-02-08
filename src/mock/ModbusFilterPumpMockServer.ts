import ModbusRTU from "modbus-serial";

/**
 * ModbusFilterPumpMockServer (Simulator)
 *
 * Simulates a Modbus TCP device representing a filter pump.
 * Uses a real Modbus TCP server (modbus-serial) with an in-memory register map.
 *
 * Simulates the following holding registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger cleaning)
 *
 * Note: This is still a mock for testing and demo purposes.
 */

interface ModbusRegisters {
  [key: number]: number;
}

interface WaterTargets {
  pH: number;
  temperature: number;
  oxygenLevel: number;
}

class ModbusFilterPumpMockServer {
  private port: number = 502;
  private waterEndpoint: string = "http://localhost:8080/water";
  private server: any = null;


  private registers: ModbusRegisters = {
    0: 30, // pumpSpeed (initial 30%)
    1: 0, // filterStatus (0=idle)
    2: 100, // filterHealth (100%)
    3: 0, // cleaningCommand (no cleaning)
  };

  private simulationActive: boolean = true;
  private lastCleaningTime: number = Date.now();
  private simulationIntervals: NodeJS.Timeout[] = [];
  private waterCorrectionInterval: NodeJS.Timeout | null = null;
  private waterReachable: boolean = false;
  private waterRetryDelayMs: number = 1000;
  private waterNextRetryAt: number = 0;

  constructor(port?: number, waterEndpoint?: string) {
    if (port) this.port = port;
    if (waterEndpoint) this.waterEndpoint = waterEndpoint;
  }

  /**
   * Start the mock Modbus simulator
   */
  public async start(): Promise<void> {
    console.log("🔧 Starting Modbus Mock Server Simulator...");

    const vector = this.getModbusVector();
    this.server = new (ModbusRTU as any).ServerTCP(vector, {
      host: "127.0.0.1",
      port: this.port,
      unitID: 1,
      debug: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`✅ Mock Modbus Server listening on 127.0.0.1:${this.port}`);

    // Start simulation loop
    this.startSimulation();
    this.startWaterCorrectionLoop();
  }

  /**
   * Handle register changes
   */
  private onRegisterChange(address: number, value: number): void {
    switch (address) {
      case 0: // pumpSpeed
        console.log(`[Modbus] Register 0 (pumpSpeed) = ${value}%`);
        // Update filter status based on speed
        if (value === 0) {
          this.registers[1] = 0; // idle
        } else {
          this.registers[1] = 1; // running
        }
        break;

      case 1: // filterStatus
        console.log(
          `[Modbus] Register 1 (filterStatus) = ${this.getStatusName(value)}`
        );
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
  private executeCleaning(): void {
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
  private startSimulation(): void {
    const degradationInterval = setInterval(() => {
      if (!this.simulationActive) return;

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
      } else if (pumpSpeed === 0) {
        this.registers[1] = 0; // Idle
      }

      // Log health status periodically
      if (Math.random() < 0.1) {
        console.log(
          `📊 [Modbus] Pump: ${pumpSpeed}% | Status: ${this.getStatusName(
            this.registers[1]
          )} | Health: ${this.registers[2].toFixed(1)}%`
        );
      }
    }, 5000); // Update every 5 seconds

    this.simulationIntervals.push(degradationInterval);
  }

  /**
   * Apply water correction based on pump speed
   */
  private startWaterCorrectionLoop(): void {
    if (this.waterCorrectionInterval) {
      clearInterval(this.waterCorrectionInterval);
    }

    this.waterCorrectionInterval = setInterval(async () => {
      if (!this.simulationActive) return;

      const pumpSpeed = this.registers[0];
      if (pumpSpeed <= 0) return;

      if (!this.canAttemptWaterRead()) {
        return;
      }

      try {
        const waterState = await this.readWaterState();
        if (!waterState) {
          this.onWaterReadFailure();
          return;
        }

        this.onWaterReadSuccess();

        const targets = this.loadOptimalTargetsFromConfig();
        const speedFactor = Math.max(0, Math.min(1, pumpSpeed / 100));
        const maxStep = 0.8 * speedFactor;

        await this.applyWaterCorrections(waterState, targets, maxStep);
      } catch (error) {
        this.onWaterReadFailure();
      }
    }, 1000);
  }

  private async readWaterState(): Promise<WaterTargets | null> {
    let response: Response;
    try {
      response = await fetch(`${this.waterEndpoint}/properties`);
    } catch (error) {
      return null;
    }
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (
      typeof data.pH !== "number" ||
      typeof data.temperature !== "number" ||
      typeof data.oxygenLevel !== "number"
    ) {
      return null;
    }

    return {
      pH: data.pH,
      temperature: data.temperature,
      oxygenLevel: data.oxygenLevel,
    };
  }

  private canAttemptWaterRead(): boolean {
    if (this.waterNextRetryAt === 0) {
      return true;
    }
    return Date.now() >= this.waterNextRetryAt;
  }

  private onWaterReadSuccess(): void {
    if (!this.waterReachable) {
      console.log("[Modbus] Water endpoint available.");
    }
    this.waterReachable = true;
    this.waterRetryDelayMs = 1000;
    this.waterNextRetryAt = 0;
  }

  private onWaterReadFailure(): void {
    if (this.waterReachable) {
      console.warn(
        `[Modbus] Water endpoint unavailable, retrying in ${this.waterRetryDelayMs}ms.`
      );
    }
    this.waterReachable = false;
    this.waterNextRetryAt = Date.now() + this.waterRetryDelayMs;
    this.waterRetryDelayMs = Math.min(this.waterRetryDelayMs * 2, 15000);
  }

  private async applyWaterCorrections(
    current: WaterTargets,
    targets: WaterTargets,
    maxStep: number
  ): Promise<void> {
    const updates: Partial<WaterTargets> = {};

    for (const key of ["pH", "temperature", "oxygenLevel"] as const) {
      const delta = targets[key] - current[key];
      if (Math.abs(delta) < 0.01 || maxStep === 0) {
        continue;
      }

      const correction = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
      if (Math.abs(correction) > 0.01) {
        updates[key] = current[key] + correction;
      }
    }

    const entries = Object.entries(updates) as Array<[keyof WaterTargets, number]>;
    for (const [key, value] of entries) {
      await this.writeWaterProperty(key, value);
    }
  }

  private async writeWaterProperty(property: keyof WaterTargets, value: number): Promise<void> {
    await fetch(`${this.waterEndpoint}/properties/${property}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  }

  private loadOptimalTargetsFromConfig(): WaterTargets {
    try {
      const fs = require("fs") as typeof import("fs");
      const path = require("path") as typeof import("path");
      const configPath = path.join(process.cwd(), "config.json");
      const configContent = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(configContent) as any;

      const defaults: WaterTargets = {
        pH: 7.0,
        temperature: 25.0,
        oxygenLevel: 7.0,
      };

      if (!config?.parameters) {
        return defaults;
      }

      const targets: WaterTargets = { ...defaults };
      for (const key of ["pH", "temperature", "oxygenLevel"] as const) {
        const paramConfig = config.parameters[key];
        if (paramConfig?.optimal) {
          const min = Number(paramConfig.optimal.min);
          const max = Number(paramConfig.optimal.max);
          if (!Number.isNaN(min) && !Number.isNaN(max)) {
            targets[key] = (min + max) / 2;
          }
        }
      }

      return targets;
    } catch (error) {
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
  private getStatusName(status: number): string {
    const statuses: Record<number, string> = {
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
  public readRegister(address: number): number {
    const value = this.registers[address] || 0;
    // console.log(`[Modbus Read] Register ${address} = ${value}`);
    return value;
  }

  /**
   * Write to a register (simulates Modbus write)
   */
  public writeRegister(address: number, value: number): void {
    this.registers[address] = value;
    this.onRegisterChange(address, value);
  }

  private getModbusVector(): any {
    return {
      getHoldingRegister: (address: number) => {
        const value = this.readRegister(address);
        return Math.round(value);
      },
      setRegister: (address: number, value: number) => {
        this.writeRegister(address, value);
      },
    };
  }

  /**
   * Stop the server
   */
  public stop(): void {
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
  public getRegisters(): ModbusRegisters {
    return { ...this.registers };
  }

  /**
   * Set register value
   */
  public setRegister(address: number, value: number): void {
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

export default modbusServer;

