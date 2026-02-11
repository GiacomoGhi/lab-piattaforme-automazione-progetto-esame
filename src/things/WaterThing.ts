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
  private simulationActive: boolean = false;

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
   * Start degradation simulation (called when pump turns off)
   */
  public startDegradationSimulation(): void {
    if (this.simulationActive) {
      console.log("[Water DT] 🔄 Degradation simulation already running");
      return;
    }

    this.simulationActive = true;
    console.log(`[Water DT] 🌊 Starting degradation simulation (Cycle ${this.degradationConfig.currentTestCycle === 0 ? "UP" : "DOWN"})`);

    if (this.degradationInterval) {
      clearInterval(this.degradationInterval);
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
  }

  /**
   * Stop degradation simulation and prepare for next cycle
   */
  public stopDegradationSimulation(): void {
    if (!this.simulationActive) return;

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
  }
}
