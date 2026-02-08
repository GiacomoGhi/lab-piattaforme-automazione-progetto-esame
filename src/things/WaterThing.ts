import * as fs from "fs";
import * as path from "path";
import WoT from "wot-typescript-definitions";
import { WaterState } from "../types/WaterTypes";

/**
 * WaterThing - Digital Twin representing the aquarium water state.
 *
 * This Thing acts as the source of truth for water parameters.
 * It exposes pH, temperature, and oxygenLevel as read/write properties.
 * Other Things (like WaterQualitySensor) read from this Thing's properties.
 *
 * Architecture:
 * - WaterThing (Digital Twin) ← publishes state via properties
 * - WaterQualitySensor ← polls and reads from WaterThing
 * - FilterPump ← can affect water state (future: via ModbusMockServer)
 */

interface DegradationConfig {
  currentTestCycle: number; // 0 = increase, 1 = decrease
  acceleratedParameterIndex: number; // 0=pH, 1=temperature, 2=oxygenLevel
}

interface WaterTargets {
  pH: number;
  temperature: number;
  oxygenLevel: number;
}

const OPTIMAL_VALUES = {
  pH: 7.0,
  temperature: 25.0,
  oxygenLevel: 7.0,
};

export class WaterThing {
  private runtime: typeof WoT;
  private td: WoT.ThingDescription;
  private thing!: WoT.ExposedThing;

  // Internal water state (source of truth)
  private state: WaterState = {
    pH: 7.0,
    temperature: 25.0,
    oxygenLevel: 7.0,
  };

  // Simulation state
  private degradationConfig: DegradationConfig = {
    currentTestCycle: 0, // 0 = increase, 1 = decrease
    acceleratedParameterIndex: 0, // 0=pH, 1=temperature, 2=oxygenLevel
  };
  private degradationInterval: NodeJS.Timeout | null = null;
  private cycleRotationInterval: NodeJS.Timeout | null = null;
  private simulationActive: boolean = false;
  private cycleDurationMs: number = 30000;
  private correctionInterval: NodeJS.Timeout | null = null;
  private consumedPump: WoT.ConsumedThing | null = null;
  private pumpReachable: boolean = false;
  private pumpRetryDelayMs: number = 1000;
  private pumpNextRetryAt: number = 0;

  constructor(runtime: typeof WoT, td: WoT.ThingDescription) {
    this.runtime = runtime;
    this.td = td;
  }

  /**
   * Start the Water Digital Twin
   */
  public async start(): Promise<void> {
    this.thing = await this.runtime.produce(this.td);

    // Set up property READ handlers
    this.thing.setPropertyReadHandler("pH", async () => {
      console.log(`[Water DT] > Read pH: ${this.state.pH.toFixed(2)}`);
      return this.state.pH;
    });

    this.thing.setPropertyReadHandler("temperature", async () => {
      console.log(
        `[Water DT] > Read temperature: ${this.state.temperature.toFixed(1)}°C`,
      );
      return this.state.temperature;
    });

    this.thing.setPropertyReadHandler("oxygenLevel", async () => {
      console.log(
        `[Water DT] > Read oxygenLevel: ${this.state.oxygenLevel.toFixed(1)} mg/L`,
      );
      return this.state.oxygenLevel;
    });

    // Set up property WRITE handlers
    this.thing.setPropertyWriteHandler("pH", async (value) => {
      const newValue = await this.extractValue(value);
      await this.updateProperty("pH", newValue);
    });

    this.thing.setPropertyWriteHandler("temperature", async (value) => {
      const newValue = await this.extractValue(value);
      await this.updateProperty("temperature", newValue);
    });

    this.thing.setPropertyWriteHandler("oxygenLevel", async (value) => {
      const newValue = await this.extractValue(value);
      await this.updateProperty("oxygenLevel", newValue);
    });

    // Expose the thing
    await this.thing.expose();
    const title = this.td.title || "Water";
    console.log(
      `💧 ${title} Digital Twin started! Go to: http://localhost:8080/${title.toLowerCase()}`,
    );

    this.startDegradationSimulation();
    console.log("Water degradation simulation started");
    this.scheduleConnectToPump(2000);
    this.startCorrectionLoop();
  }

  /**
   * Extract value from InteractionOutput or raw value
   */
  private async extractValue(input: any): Promise<number> {
    if (input && typeof input.value === "function") {
      return Number(await input.value());
    }
    return Number(input);
  }

  /**
   * Update a water property and emit change event
   */
  private async updateProperty(
    property: keyof WaterState,
    newValue: number,
  ): Promise<{ success: boolean; newValue: number; message: string }> {
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

    console.log(
      `[Water DT] ✏️ ${property} updated: ${oldValue.toFixed(2)} → ${newValue.toFixed(2)}`,
    );

    // Emit property change (for subscribers using observeproperty)
    this.thing.emitPropertyChange(property);

    // PUB/SUB disabled: WaterThing publishes only via properties in this demo.

    return {
      success: true,
      newValue,
      message: `${property} set to ${newValue}`,
    };
  }

  /**
   * Get current state (for external use)
   */
  public getState(): WaterState {
    return { ...this.state };
  }

  /**
   * Programmatically update state (for use by other components like mock server)
   */
  public async setState(updates: Partial<WaterState>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await this.updateProperty(key as keyof WaterState, value);
      }
    }
  }

  /**
   * Start degradation simulation (runs continuously)
   */
  private startDegradationSimulation(): void {
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

    const parametersMap: (keyof WaterState)[] = ["pH", "temperature", "oxygenLevel"];

    this.degradationInterval = setInterval(async () => {
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
      await this.thing.emitPropertyChange("pH");
      await this.thing.emitPropertyChange("temperature");
      await this.thing.emitPropertyChange("oxygenLevel");
    }, 1000); // Every second

    this.cycleRotationInterval = setInterval(() => {
      if (!this.simulationActive) return;

      this.degradationConfig.currentTestCycle =
        this.degradationConfig.currentTestCycle === 0 ? 1 : 0;
      this.degradationConfig.acceleratedParameterIndex =
        (this.degradationConfig.acceleratedParameterIndex + 1) % 3;

      console.log(
        `[Water DT] 🔁 Cycle switched to ${
          this.degradationConfig.currentTestCycle === 0 ? "UP" : "DOWN"
        }, Accelerated param: ${
          ["pH", "temperature", "oxygenLevel"][
            this.degradationConfig.acceleratedParameterIndex
          ]
        }`,
      );
    }, this.cycleDurationMs);
  }

  /**
   * Stop degradation simulation (used on shutdown)
   */
  private stopDegradationSimulation(): void {
    if (!this.simulationActive) return;

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

  private scheduleConnectToPump(delayMs: number): void {
    setTimeout(async () => {
      const connected = await this.connectToPump();
      if (!connected) {
        console.log("[Water DT] Will retry pump connection in 5 seconds...");
        this.scheduleConnectToPump(5000);
      }
    }, delayMs);
  }

  private async connectToPump(): Promise<boolean> {
    try {
      const pumpTD = await this.runtime.requestThingDescription(
        "http://localhost:8080/filterpump",
      );
      this.consumedPump = await this.runtime.consume(pumpTD);
      if (!this.pumpReachable) {
        console.log("[Water DT] Connected to Filter Pump proxy");
      }
      this.pumpReachable = true;
      this.pumpRetryDelayMs = 1000;
      this.pumpNextRetryAt = 0;
      return true;
    } catch (error) {
      if (this.pumpReachable) {
        console.warn(
          `[Water DT] Pump proxy unavailable, retrying in ${this.pumpRetryDelayMs}ms.`,
        );
      }
      this.pumpReachable = false;
      this.pumpNextRetryAt = Date.now() + this.pumpRetryDelayMs;
      this.pumpRetryDelayMs = Math.min(this.pumpRetryDelayMs * 2, 15000);
      return false;
    }
  }

  private canAttemptPumpRead(): boolean {
    if (this.pumpNextRetryAt === 0) {
      return true;
    }
    return Date.now() >= this.pumpNextRetryAt;
  }

  private startCorrectionLoop(): void {
    if (this.correctionInterval) {
      clearInterval(this.correctionInterval);
    }

    this.correctionInterval = setInterval(async () => {
      if (!this.simulationActive) return;
      if (!this.consumedPump) return;
      if (!this.canAttemptPumpRead()) return;

      let pumpSpeed = 0;
      try {
        const pumpSpeedProp = await this.consumedPump.readProperty("pumpSpeed");
        pumpSpeed = Number(await pumpSpeedProp.value());
      } catch (error) {
        this.consumedPump = null;
        this.pumpReachable = false;
        this.scheduleConnectToPump(2000);
        return;
      }

      if (pumpSpeed <= 0) return;

      const targets = this.loadOptimalTargetsFromConfig();
      const speedFactor = Math.max(0, Math.min(1, pumpSpeed / 100));
      const maxStep = 2.2 * speedFactor;

      await this.applyWaterCorrections(targets, maxStep);
    }, 1000);
  }

  private async applyWaterCorrections(
    targets: WaterTargets,
    maxStep: number,
  ): Promise<void> {
    const updates: Partial<WaterTargets> = {};

    const current: WaterTargets = {
      pH: this.state.pH,
      temperature: this.state.temperature,
      oxygenLevel: this.state.oxygenLevel,
    };

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
      await this.updateProperty(key, value);
    }
  }

  private loadOptimalTargetsFromConfig(): WaterTargets {
    try {
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
   * Check if all parameters are within optimal range
   */
  public allParametersOptimal(): boolean {
    const OPTIMAL_RANGES = {
      pH: { min: 6.5, max: 7.5 },
      temperature: { min: 24, max: 26 },
      oxygenLevel: { min: 6, max: 8 },
    };

    return (
      this.state.pH >= OPTIMAL_RANGES.pH.min &&
      this.state.pH <= OPTIMAL_RANGES.pH.max &&
      this.state.temperature >= OPTIMAL_RANGES.temperature.min &&
      this.state.temperature <= OPTIMAL_RANGES.temperature.max &&
      this.state.oxygenLevel >= OPTIMAL_RANGES.oxygenLevel.min &&
      this.state.oxygenLevel <= OPTIMAL_RANGES.oxygenLevel.max
    );
  }

  /**
   * Stop everything on shutdown
   */
  public stop(): void {
    this.stopDegradationSimulation();
    if (this.correctionInterval) {
      clearInterval(this.correctionInterval);
      this.correctionInterval = null;
    }
  }
}
