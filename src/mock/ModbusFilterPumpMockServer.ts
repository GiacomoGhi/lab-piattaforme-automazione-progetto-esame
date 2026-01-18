/**
 * ModbusFilterPumpMockServer (Simulator)
 *
 * Simulates a Modbus TCP device representing a filter pump.
 * This is a simplified in-memory simulator that doesn't require a real Modbus server library.
 *
 * Simulates the following holding registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger cleaning)
 *
 * Note: For a real Modbus server, use libraries like 'node-modbus' or 'modbus-tcp-server'.
 * This is a mock for testing and demo purposes.
 */

interface ModbusRegisters {
  [key: number]: number;
}

class ModbusFilterPumpMockServer {
  private port: number = 502;

  private registers: ModbusRegisters = {
    0: 30, // pumpSpeed (initial 30%)
    1: 0, // filterStatus (0=idle)
    2: 100, // filterHealth (100%)
    3: 0, // cleaningCommand (no cleaning)
  };

  private simulationActive: boolean = true;
  private lastCleaningTime: number = Date.now();
  private simulationIntervals: NodeJS.Timeout[] = [];

  constructor(port?: number) {
    if (port) this.port = port;
  }

  /**
   * Start the mock Modbus simulator
   */
  public async start(): Promise<void> {
    console.log("🔧 Starting Modbus Mock Server Simulator...");

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`✅ Mock Modbus Server listening on 127.0.0.1:${this.port}`);

    // Start simulation loop
    this.startSimulation();
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

  /**
   * Stop the server
   */
  public stop(): void {
    console.log("🛑 Stopping Modbus Mock Server...");
    this.simulationActive = false;
    this.simulationIntervals.forEach((interval) => clearInterval(interval));
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

const modbusServer = new ModbusFilterPumpMockServer(502);

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

