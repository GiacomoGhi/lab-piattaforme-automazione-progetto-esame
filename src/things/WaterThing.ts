import WoT from "wot-typescript-definitions";
import { WaterState, WaterStateChangedEvent } from "../types/WaterTypes";

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

    // Emit waterStateChanged event (for subscribers using subscribeevent)
    const event: WaterStateChangedEvent = {
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
}
