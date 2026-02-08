import * as fs from "fs";
import * as path from "path";
import WoT from "wot-typescript-definitions";
import { ModbusClient } from "@node-wot/binding-modbus";
import type { WaterThing } from "./WaterThing";
import type { WaterState } from "../types/WaterTypes";

/**
 * FilterPumpThing - Modbus Proxy for aquarium filter pump.
 *
 * This Thing acts as an HTTP proxy to a Modbus device.
 * It exposes pumpSpeed and filterStatus properties via HTTP,
 * while communicating with the actual pump via Modbus protocol.
 *
 * Modbus Registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger)
 */

interface PumpState {
  pumpSpeed: number;
  filterStatus: "idle" | "running" | "cleaning" | "error";
  filterHealth: number;
  lastCleaningTime: string;
}

const DEFAULT_OPTIMAL_TARGETS: WaterState = {
  pH: 7.0,
  temperature: 25.0,
  oxygenLevel: 7.0,
};

export class FilterPumpThing {
  private runtime: typeof WoT;
  private proxyTD: WoT.ThingDescription;
  private modbusTD: WoT.ThingDescription;
  private thing!: WoT.ExposedThing;
  private modbusClient!: any;
  private waterThing: WaterThing | null = null;

  private state: PumpState = {
    pumpSpeed: 0,
    filterStatus: "idle",
    filterHealth: 100,
    lastCleaningTime: new Date().toISOString(),
  };

  private simulationInterval: NodeJS.Timeout | null = null;
  private healthDegradationInterval: NodeJS.Timeout | null = null;
  private waterCorrectionInterval: NodeJS.Timeout | null = null;
  private optimalTargets: WaterState = { ...DEFAULT_OPTIMAL_TARGETS };

  constructor(
    runtime: typeof WoT,
    proxyTD: WoT.ThingDescription,
    modbusTD: WoT.ThingDescription,
    waterThing?: WaterThing,
  ) {
    this.runtime = runtime;
    this.proxyTD = proxyTD;
    this.modbusTD = modbusTD;
    this.waterThing = waterThing || null;
  }

  /**
   * Start the filter pump thing
   */
  public async start(): Promise<void> {
    // Create the HTTP proxy thing
    this.thing = await this.runtime.produce(this.proxyTD);

    // Set up property read handlers
    this.thing.setPropertyReadHandler("pumpSpeed", async () => {
      console.log(`> Read pumpSpeed: ${this.state.pumpSpeed}%`);
      return this.state.pumpSpeed;
    });

    this.thing.setPropertyReadHandler("filterStatus", async () => {
      console.log(`> Read filterStatus: ${this.state.filterStatus}`);
      return this.state.filterStatus;
    });

    this.thing.setPropertyReadHandler("filterHealth", async () => {
      const roundedHealth = Math.round(this.state.filterHealth);
      console.log(`> Read filterHealth: ${roundedHealth}%`);
      return roundedHealth;
    });

    this.thing.setPropertyReadHandler("lastCleaningTime", async () => {
      console.log(`> Read lastCleaningTime: ${this.state.lastCleaningTime}`);
      return this.state.lastCleaningTime;
    });

    // Set up action handlers
    this.thing.setActionHandler("setPumpSpeed", async (params: any) => {
      // Extract the actual value from InteractionOutput if needed
      let speedValue: number;
      if (params && typeof params.value === "function") {
        speedValue = await params.value();
      } else {
        speedValue = params;
      }
      const newSpeed = Math.max(0, Math.min(100, Number(speedValue)));
      
      const wasRunning = this.state.pumpSpeed > 0;
      const nowRunning = newSpeed > 0;

      this.state.pumpSpeed = newSpeed;

      const statusMap: Record<
        number,
        "idle" | "running" | "cleaning" | "error"
      > = {
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
      } else if (this.state.filterStatus !== "cleaning") {
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
    });

    this.thing.setActionHandler("cleaningCycle", async () => {
      console.log(`🧹 Starting cleaning cycle...`);

      this.state.filterStatus = "cleaning";
      this.thing.emitPropertyChange("filterStatus");

      // Simulate cleaning
      await new Promise((resolve) => setTimeout(resolve, 8000)); // 8 seconds cleaning

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
    });

    // Expose the thing
    await this.thing.expose();
    const title = this.proxyTD.title || "FilterPump";
    console.log(
      `${title} thing started! Go to: http://localhost:8080/${title.toLowerCase()}`,
    );

    // Start health degradation simulation
    this.startSimulation();
  }

  /**
   * Simulate filter health degradation and status changes
   */
  private startSimulation(): void {
    // Degrade filter health based on pump speed
    this.healthDegradationInterval = setInterval(() => {
      // Health degrades faster at higher speeds
      const degradationRate = (this.state.pumpSpeed / 100) * 0.5; // 0-0.5% per interval
      this.state.filterHealth = Math.max(
        0,
        this.state.filterHealth - degradationRate,
      );

      // Emit changes
      this.thing.emitPropertyChange("filterHealth");
    }, 1000); // Check every 1 second (accelerated for demo)

    // Simulate occasional status changes
    this.simulationInterval = setInterval(() => {
      // If pump is running and speed > 0, keep it running
      if (this.state.pumpSpeed > 0 && this.state.filterStatus !== "cleaning") {
        this.state.filterStatus = "running";
      } else if (this.state.pumpSpeed === 0) {
        this.state.filterStatus = "idle";
      }

      this.thing.emitPropertyChange("filterStatus");
    }, 3000);
  }

  /**
   * Stop the thing
   */
  public stop(): void {
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
  private startWaterCorrection(): void {
    console.log("[Pump] 💧 Starting water correction...");

    if (this.waterCorrectionInterval) {
      clearInterval(this.waterCorrectionInterval);
    }

    this.waterCorrectionInterval = setInterval(async () => {
      if (!this.waterThing || this.state.pumpSpeed === 0) {
        this.stopWaterCorrection();
        return;
      }

      const currentState = this.waterThing.getState();
      const optimalTargets = this.loadOptimalTargetsFromConfig();

      const speedFactor = Math.max(0, Math.min(1, this.state.pumpSpeed / 100));
      const maxStep = 0.8 * speedFactor;

      // Calculate correction for each parameter
      const corrections: Partial<WaterState> = {};

      for (const [param, targetValue] of Object.entries(optimalTargets)) {
        const currentValue = currentState[param as keyof WaterState];
        const delta = targetValue - currentValue;
        let correction = 0;

        if (Math.abs(delta) < 0.01 || maxStep === 0) {
          correction = 0;
        } else {
          correction = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
        }

        if (Math.abs(correction) > 0.01) {
          corrections[param as keyof WaterState] = currentValue + correction;
        }
      }

      // Apply corrections
      if (Object.keys(corrections).length > 0) {
        await this.waterThing.setState(corrections);
      }

    }, 1000); // Every second
  }

  /**
   * Stop water correction
   */
  private stopWaterCorrection(): void {
    if (this.waterCorrectionInterval) {
      clearInterval(this.waterCorrectionInterval);
      this.waterCorrectionInterval = null;
    }
  }

  /**
   * Load optimal targets from config.json (midpoint of optimal ranges)
   */
  private loadOptimalTargetsFromConfig(): WaterState {
    try {
      const configPath = path.join(process.cwd(), "config.json");
      const configContent = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(configContent) as any;

      if (!config?.parameters) {
        return this.optimalTargets;
      }

      const nextTargets: WaterState = { ...DEFAULT_OPTIMAL_TARGETS };

      for (const key of ["pH", "temperature", "oxygenLevel"]) {
        const paramConfig = config.parameters[key];
        if (paramConfig?.optimal) {
          const min = Number(paramConfig.optimal.min);
          const max = Number(paramConfig.optimal.max);
          if (!Number.isNaN(min) && !Number.isNaN(max)) {
            nextTargets[key as keyof WaterState] = (min + max) / 2;
          }
        }
      }

      this.optimalTargets = nextTargets;
      return nextTargets;
    } catch (error) {
      console.warn("[Pump] ⚠️ Failed to load optimal targets, using cached values.");
      return this.optimalTargets;
    }
  }

  /**
   * Get current state for external use
   */
  public getState(): PumpState {
    return { ...this.state };
  }
}
