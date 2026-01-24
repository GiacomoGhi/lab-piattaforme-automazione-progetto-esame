import WoT from "wot-typescript-definitions";
import { WaterParameters, WaterStateChangedEvent } from "../types/WaterTypes";

interface ParameterAlert {
  parameter: string;
  value: number;
  status: "ok" | "warning" | "alert";
  message: string;
}

// Optimal ranges for aquarium
const OPTIMAL_RANGES = {
  pH: { min: 6.5, max: 7.5, warningMin: 6.0, warningMax: 8.0 },
  temperature: { min: 24, max: 26, warningMin: 22, warningMax: 28 },
  oxygenLevel: { min: 6, max: 8, warningMin: 5, warningMax: 10 },
};

/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits parameterAlert events when values are out of range.
 *
 * This sensor subscribes to the Water Digital Twin and reads its values.
 * Architecture: Water (Digital Twin) → publishes → WaterQualitySensor (subscribes)
 */
export class WaterQualitySensorThing {
  private runtime: typeof WoT;
  private td: WoT.ThingDescription;
  private thing!: WoT.ExposedThing;
  private consumedWater: WoT.ConsumedThing | null = null;

  // Local cache of water values (updated via subscription)
  private pH: number = 7.0;
  private temperature: number = 25.0;
  private oxygenLevel: number = 7.0;

  // Sampling configuration (in milliseconds)
  private samplingInterval: number = 3000; // Default 3 seconds for demo
  private samplingTimer: NodeJS.Timeout | null = null;

  constructor(runtime: typeof WoT, td: WoT.ThingDescription, samplingIntervalMs?: number) {
    this.runtime = runtime;
    this.td = td;
    if (samplingIntervalMs) {
      this.samplingInterval = samplingIntervalMs;
    }
  }

  /**
   * Start the thing and subscribe to Water Digital Twin
   */
  public async startAsync(): Promise<void> {
    this.thing = await this.runtime.produce(this.td);

    // Register property read handlers
    this.thing.setPropertyReadHandler("pH", async () => {
      console.log("> Read pH:", this.pH.toFixed(2));
      return this.pH;
    });

    this.thing.setPropertyReadHandler("temperature", async () => {
      console.log("> Read temperature:", this.temperature.toFixed(1));
      return this.temperature;
    });

    this.thing.setPropertyReadHandler("oxygenLevel", async () => {
      console.log("> Read oxygenLevel:", this.oxygenLevel.toFixed(1));
      return this.oxygenLevel;
    });

    this.thing.setPropertyReadHandler("allParameters", async () => {
      const params: WaterParameters = {
        pH: this.pH,
        temperature: this.temperature,
        oxygenLevel: this.oxygenLevel,
        timestamp: new Date().toISOString(),
      };
      console.log("> Read allParameters:", JSON.stringify(params));
      return params;
    });

    await this.thing.expose();
    console.log(
      `${
        this.td.title
      } thing started! Go to: http://localhost:8080/${this.td.title?.toLowerCase()}`
    );

    // Subscribe to Water Digital Twin after a short delay to ensure it's ready
    setTimeout(() => this.subscribeToWaterDigitalTwin(), 2000);
  }

  /**
   * Subscribe to the Water Digital Twin to receive state updates
   */
  private async subscribeToWaterDigitalTwin(): Promise<void> {
    try {
      console.log("[Sensor] 🔗 Connecting to Water Digital Twin...");

      // Fetch the Water Thing Description
      const waterTD = await this.runtime.requestThingDescription(
        "http://localhost:8080/water"
      );
      this.consumedWater = await this.runtime.consume(waterTD);

      console.log("[Sensor] ✅ Connected to Water Digital Twin");

      // Subscribe to the waterStateChanged event (pub/sub pattern)
      await this.consumedWater.subscribeEvent(
        "waterStateChanged",
        async (data) => {
          const event = (await data.value()) as WaterStateChangedEvent;
          console.log(
            `[Sensor] 📨 Received water state change: ${event.parameter} = ${event.newValue}`
          );

          // Update local cache
          switch (event.parameter) {
            case "pH":
              this.pH = event.newValue;
              break;
            case "temperature":
              this.temperature = event.newValue;
              break;
            case "oxygenLevel":
              this.oxygenLevel = event.newValue;
              break;
          }

          // Check for alerts and emit events
          this.checkAndEmitAlerts();

          // Emit property changes to notify our subscribers
          this.thing.emitPropertyChange(event.parameter);
          this.thing.emitPropertyChange("allParameters");
        }
      );

      console.log("[Sensor] 📡 Subscribed to Water Digital Twin events");

      // Start periodic sampling
      this.startSampling();

      // Initial read of all water properties
      await this.readInitialWaterState();
    } catch (error) {
      console.error("[Sensor] ❌ Failed to connect to Water Digital Twin:", error);
      console.log("[Sensor] ⏳ Will retry in 5 seconds...");
      setTimeout(() => this.subscribeToWaterDigitalTwin(), 5000);
    }
  }

  /**
   * Read initial state from Water Digital Twin
   */
  private async readInitialWaterState(): Promise<void> {
    if (!this.consumedWater) return;

    try {
      const pHProp = await this.consumedWater.readProperty("pH");
      this.pH = Number(await pHProp.value());

      const tempProp = await this.consumedWater.readProperty("temperature");
      this.temperature = Number(await tempProp.value());

      const o2Prop = await this.consumedWater.readProperty("oxygenLevel");
      this.oxygenLevel = Number(await o2Prop.value());

      console.log(
        `[Sensor] 📖 Initial water state: pH=${this.pH.toFixed(2)}, temp=${this.temperature.toFixed(1)}°C, O₂=${this.oxygenLevel.toFixed(1)} mg/L`
      );
    } catch (error) {
      console.error("[Sensor] Failed to read initial water state:", error);
    }
  }

  /**
   * Check parameter values and emit alerts if necessary
   * Only emits the most critical alert to avoid concatenation issues
   */
  private checkAndEmitAlerts(): void {
    let mostCriticalAlert: ParameterAlert | null = null;

    // Check pH
    const pHStatus = this.getParameterStatus("pH", this.pH);
    if (pHStatus !== "ok") {
      const alert: ParameterAlert = {
        parameter: "pH",
        value: this.pH,
        status: pHStatus,
        message: `pH level is ${
          pHStatus === "alert" ? "critical" : "not optimal"
        }: ${this.pH.toFixed(2)}`,
      };
      if (!mostCriticalAlert || pHStatus === "alert") {
        mostCriticalAlert = alert;
      }
    }

    // Check temperature
    const tempStatus = this.getParameterStatus("temperature", this.temperature);
    if (tempStatus !== "ok") {
      const alert: ParameterAlert = {
        parameter: "temperature",
        value: this.temperature,
        status: tempStatus,
        message: `Temperature is ${
          tempStatus === "alert" ? "critical" : "not optimal"
        }: ${this.temperature.toFixed(1)}°C`,
      };
      if (!mostCriticalAlert || tempStatus === "alert") {
        mostCriticalAlert = alert;
      }
    }

    // Check oxygen
    const o2Status = this.getParameterStatus("oxygenLevel", this.oxygenLevel);
    if (o2Status !== "ok") {
      const alert: ParameterAlert = {
        parameter: "oxygenLevel",
        value: this.oxygenLevel,
        status: o2Status,
        message: `Oxygen level is ${
          o2Status === "alert" ? "critical" : "not optimal"
        }: ${this.oxygenLevel.toFixed(1)} mg/L`,
      };
      if (!mostCriticalAlert || o2Status === "alert") {
        mostCriticalAlert = alert;
      }
    }

    // Emit only the most critical alert
    if (mostCriticalAlert) {
      console.log(`⚠️ ALERT: ${mostCriticalAlert.message}`);
      this.thing.emitEvent("parameterAlert", mostCriticalAlert);
    }
  }

  /**
   * Get the status of a parameter based on its value
   */
  private getParameterStatus(
    param: keyof typeof OPTIMAL_RANGES,
    value: number
  ): "ok" | "warning" | "alert" {
    const range = OPTIMAL_RANGES[param];

    if (value < range.warningMin || value > range.warningMax) {
      return "alert";
    } else if (value < range.min || value > range.max) {
      return "warning";
    }
    return "ok";
  }

  /**
   * Get current parameter status for external use
   */
  public getStatus(): {
    pH: "ok" | "warning" | "alert";
    temperature: "ok" | "warning" | "alert";
    oxygenLevel: "ok" | "warning" | "alert";
  } {
    return {
      pH: this.getParameterStatus("pH", this.pH),
      temperature: this.getParameterStatus("temperature", this.temperature),
      oxygenLevel: this.getParameterStatus("oxygenLevel", this.oxygenLevel),
    };
  }

  /**
   * Get current values for external use
   */
  public getValues(): { pH: number; temperature: number; oxygenLevel: number } {
    return {
      pH: this.pH,
      temperature: this.temperature,
      oxygenLevel: this.oxygenLevel,
    };
  }

  /**
   * Set sampling interval (in milliseconds)
   * Valid range: 3000 (3 sec) to 1800000 (30 min)
   */
  public setSamplingInterval(intervalMs: number): void {
    const MIN_INTERVAL = 3000; // 3 seconds
    const MAX_INTERVAL = 1800000; // 30 minutes

    if (intervalMs < MIN_INTERVAL || intervalMs > MAX_INTERVAL) {
      console.warn(
        `[Sensor] ⚠️ Sampling interval ${intervalMs}ms out of range [${MIN_INTERVAL}-${MAX_INTERVAL}]. Using default 3s.`
      );
      this.samplingInterval = MIN_INTERVAL;
    } else {
      this.samplingInterval = intervalMs;
      console.log(`[Sensor] 📊 Sampling interval set to ${intervalMs}ms`);
    }

    // Restart sampling with new interval
    if (this.consumedWater) {
      this.startSampling();
    }
  }

  /**
   * Start periodic sampling of water parameters
   */
  private startSampling(): void {
    // Clear existing timer
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
    }

    console.log(`[Sensor] 📡 Starting periodic sampling every ${this.samplingInterval}ms`);

    this.samplingTimer = setInterval(async () => {
      if (!this.consumedWater) return;

      try {
        // Read individual properties (allParameters not available when consuming)
        const pHProp = await this.consumedWater.readProperty("pH");
        this.pH = Number(await pHProp.value());

        const tempProp = await this.consumedWater.readProperty("temperature");
        this.temperature = Number(await tempProp.value());

        const o2Prop = await this.consumedWater.readProperty("oxygenLevel");
        this.oxygenLevel = Number(await o2Prop.value());

        // Emit property changes (cast to any to avoid type issues)
        (this.thing.emitPropertyChange as any)("pH");
        (this.thing.emitPropertyChange as any)("temperature");
        (this.thing.emitPropertyChange as any)("oxygenLevel");
        (this.thing.emitPropertyChange as any)("allParameters");

        // Check and emit alerts
        this.checkAndEmitAlerts();
      } catch (error) {
        console.error("[Sensor] ❌ Error during sampling:", error);
      }
    }, this.samplingInterval);
  }

  /**
   * Stop periodic sampling
   */
  private stopSampling(): void {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }
  }

  /**
   * Stop the sensor
   */
  public stop(): void {
    this.stopSampling();
  }
}
