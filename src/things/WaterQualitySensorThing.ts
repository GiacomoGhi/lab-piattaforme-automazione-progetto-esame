import * as fs from "fs";
import * as path from "path";
import WoT from "wot-typescript-definitions";
import {
  ParameterStatus,
  ParameterStatusChangedEvent,
  WaterParameters,
} from "../types/WaterTypes";

interface ParameterRange {
  unit: string;
  description: string;
  configurable?: { min: number; max: number };
  optimal: { min: number; max: number };
}

interface AppConfig {
  mode: "demo" | "production";
  description?: string;
  parameters: Record<string, ParameterRange>;
  modes?: {
    demo?: { samplingIntervalMs: number };
    production?: { samplingIntervalMs: number };
  };
}

/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits per-parameter status change events when status levels change.
 *
 * This sensor polls the Water Digital Twin at regular intervals (default: 3 seconds).
 * PUB/SUB pattern is disabled to avoid continuous notifications.
 * Architecture: WaterQualitySensor (polls) → Water Digital Twin (provides data)
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

  private pHStatus: ParameterStatus = "ok";
  private temperatureStatus: ParameterStatus = "ok";
  private oxygenLevelStatus: ParameterStatus = "ok";

  // Sampling configuration (in milliseconds)
  private samplingInterval: number = 3000; // Default 3 seconds for demo
  private samplingTimer: NodeJS.Timeout | null = null;

  private config: AppConfig;

  constructor(runtime: typeof WoT, td: WoT.ThingDescription, samplingIntervalMs?: number) {
    this.runtime = runtime;
    this.td = td;
    this.config = this.loadConfigFromFile();
    this.applyMode(this.config.mode, false);
    if (samplingIntervalMs) {
      this.setSamplingInterval(samplingIntervalMs);
    }
  }

  /**
   * Start the thing and connect to Water Digital Twin
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

    this.thing.setPropertyReadHandler("pHStatus", async () => {
      return this.pHStatus;
    });

    this.thing.setPropertyReadHandler("temperatureStatus", async () => {
      return this.temperatureStatus;
    });

    this.thing.setPropertyReadHandler("oxygenLevelStatus", async () => {
      return this.oxygenLevelStatus;
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

    this.thing.setPropertyReadHandler("mode", async () => {
      return this.config.mode;
    });

    this.thing.setPropertyReadHandler("config", async () => {
      return this.config;
    });

    this.thing.setPropertyReadHandler("samplingIntervalMs", async () => {
      return this.samplingInterval;
    });

    this.thing.setPropertyWriteHandler("mode", async (value) => {
      const nextMode = await this.extractString(value);
      if (nextMode !== "demo" && nextMode !== "production") {
        console.warn(`[Sensor] ⚠️ Invalid mode: ${nextMode}`);
        return;
      }

      this.config.mode = nextMode;
      this.applyMode(nextMode, true);
      this.saveConfigToFile(this.config);

      this.thing.emitPropertyChange("mode");
      this.thing.emitPropertyChange("config");
      this.thing.emitPropertyChange("samplingIntervalMs");

      this.thing.emitEvent("configChanged", {
        mode: this.config.mode,
        parameters: this.config.parameters,
      });
    });

    this.thing.setPropertyWriteHandler("config", async (value) => {
      const nextConfig = await this.extractObject<AppConfig>(value);
      if (!nextConfig?.parameters || !nextConfig.mode) {
        console.warn("[Sensor] Invalid config payload, ignoring.");
        return;
      }

      const validation = this.validateConfigPayload(nextConfig);
      if (!validation.ok) {
        console.warn(`[Sensor] Invalid config payload: ${validation.message}`);
        return;
      }

      this.config = nextConfig;
      this.applyMode(this.config.mode, true);
      this.saveConfigToFile(this.config);

      this.thing.emitPropertyChange("config");
      this.thing.emitPropertyChange("mode");
      this.thing.emitPropertyChange("samplingIntervalMs");

      this.thing.emitEvent("configChanged", {
        mode: this.config.mode,
        parameters: this.config.parameters,
      });
    });

    await this.thing.expose();
    console.log(
      `${
        this.td.title
      } thing started! Go to: http://localhost:8080/${this.td.title?.toLowerCase()}`
    );

    // Connect after a short delay to ensure the Water Thing is ready
    this.scheduleConnectAndStartPolling(2000);
  }

  /**
   * Connect to the Water Digital Twin (polling mode)
   */
  private async connectToWaterDigitalTwin(): Promise<boolean> {
    try {
      console.log("[Sensor] 🔗 Connecting to Water Digital Twin...");

      // Fetch the Water Thing Description
      const waterTD = await this.runtime.requestThingDescription(
        "http://localhost:8080/water"
      );
      this.consumedWater = await this.runtime.consume(waterTD);

      console.log("[Sensor] ✅ Connected to Water Digital Twin (polling mode)");

      return true;
    } catch (error) {
      console.error("[Sensor] ❌ Failed to connect to Water Digital Twin:", error);
      return false;
    }
  }

  private scheduleConnectAndStartPolling(delayMs: number): void {
    setTimeout(async () => {
      const connected = await this.connectToWaterDigitalTwin();
      if (!connected) {
        console.log("[Sensor] Will retry connection in 5 seconds...");
        this.scheduleConnectAndStartPolling(5000);
        return;
      }

      // Start periodic sampling
      this.startSampling();

      // Initial read of all water properties
      await this.readInitialWaterState();
    }, delayMs);
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

      this.updateStatusesAndEmitEvents();
    } catch (error) {
      console.error("[Sensor] Failed to read initial water state:", error);
    }
  }

  /**
   * Check parameter values and emit alerts if necessary
   * Only emits the most critical alert to avoid concatenation issues
   */
  private updateStatusesAndEmitEvents(): void {
    this.updateParameterStatus("pH", this.pH);
    this.updateParameterStatus("temperature", this.temperature);
    this.updateParameterStatus("oxygenLevel", this.oxygenLevel);
  }

  private updateParameterStatus(parameter: "pH" | "temperature" | "oxygenLevel", value: number): void {
    const nextStatus = this.getParameterStatus(parameter, value);
    let previousStatus = "ok" as ParameterStatus;

    switch (parameter) {
      case "pH":
        previousStatus = this.pHStatus;
        this.pHStatus = nextStatus;
        break;
      case "temperature":
        previousStatus = this.temperatureStatus;
        this.temperatureStatus = nextStatus;
        break;
      case "oxygenLevel":
        previousStatus = this.oxygenLevelStatus;
        this.oxygenLevelStatus = nextStatus;
        break;
    }

    if (nextStatus !== previousStatus) {
      const message = `${parameter} status changed to ${nextStatus}: ${value.toFixed(2)}`;
      console.log(`[Sensor] ⚠️ ${message}`);

      const statusEvent: ParameterStatusChangedEvent = {
        parameter,
        status: nextStatus,
        value,
        timestamp: new Date().toISOString(),
      };

      const eventName =
        parameter === "pH"
          ? "pHStatusChanged"
          : parameter === "temperature"
          ? "temperatureStatusChanged"
          : "oxygenLevelStatusChanged";

      this.thing.emitEvent(eventName, statusEvent);

      const statusProperty =
        parameter === "pH"
          ? "pHStatus"
          : parameter === "temperature"
          ? "temperatureStatus"
          : "oxygenLevelStatus";

      this.thing.emitPropertyChange(statusProperty);
    }
  }

  /**
   * Get the status of a parameter based on its value
   */
  private getParameterStatus(
    param: string,
    value: number
  ): ParameterStatus {
    try {
      const paramConfig = this.config.parameters[param as keyof typeof this.config.parameters];
      
      if (!paramConfig?.optimal) return "ok";

      const optimal = paramConfig.optimal;
      const range = optimal.max - optimal.min;
      const margin = range * 0.15; // 15% beyond optimal range
      const criticalMin = optimal.min - margin;
      const criticalMax = optimal.max + margin;

      // Alert (critical) if outside critical range (15% beyond optimal)
      if (value < criticalMin || value > criticalMax) {
        return "alert";
      }
      // Warning if outside optimal range but within critical
      else if (value < optimal.min || value > optimal.max) {
        return "warning";
      }
      // OK if within optimal range
      return "ok";
    } catch (error) {
      console.error(`Error getting parameter status for ${param}:`, error);
      return "ok";
    }
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

        // Check and emit status changes
        this.updateStatusesAndEmitEvents();
      } catch (error) {
        console.error("[Sensor] ❌ Error during sampling:", error);
      }
    }, this.samplingInterval);
  }

  private applyMode(mode: "demo" | "production", logChange: boolean): void {
    const demoInterval = 3000;
    const productionInterval = 1800000;
    const nextInterval = mode === "demo" ? demoInterval : productionInterval;

    if (logChange) {
      console.log(`[Sensor] 🎛️ Mode set to ${mode} (sampling ${nextInterval}ms)`);
    }

    this.setSamplingInterval(nextInterval);
  }

  private loadConfigFromFile(): AppConfig {
    try {
      const configPath = path.join(process.cwd(), "config.json");
      const configContent = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(configContent) as AppConfig;
    } catch (error) {
      console.warn("[Sensor] ⚠️ Failed to load config.json, using defaults.");
      return {
        mode: "demo",
        description: "Fallback configuration",
        parameters: {
          pH: {
            unit: "pH",
            description: "Water pH Level",
            optimal: { min: 6.5, max: 7.5 },
          },
          temperature: {
            unit: "°C",
            description: "Water Temperature",
            optimal: { min: 24, max: 26 },
          },
          oxygenLevel: {
            unit: "mg/L",
            description: "Dissolved Oxygen Level",
            optimal: { min: 6, max: 8 },
          },
        },
        modes: {
          demo: { samplingIntervalMs: 3000 },
          production: { samplingIntervalMs: 1800000 },
        },
      };
    }
  }

  private saveConfigToFile(config: AppConfig): void {
    try {
      const configPath = path.join(process.cwd(), "config.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log("[Sensor] 📝 Configuration saved");
    } catch (error) {
      console.error("[Sensor] ❌ Failed to save config.json:", error);
    }
  }

  private async extractString(input: any): Promise<string> {
    if (input && typeof input.value === "function") {
      return String(await input.value());
    }
    return String(input);
  }

  private async extractObject<T>(input: any): Promise<T> {
    if (input && typeof input.value === "function") {
      return (await input.value()) as T;
    }
    return input as T;
  }

  private validateConfigPayload(config: AppConfig): { ok: boolean; message?: string } {
    if (config.mode !== "demo" && config.mode !== "production") {
      return { ok: false, message: "mode must be demo or production" };
    }

    const requiredParams = ["pH", "temperature", "oxygenLevel"] as const;

    for (const param of requiredParams) {
      const paramConfig = config.parameters[param];
      if (!paramConfig) {
        return { ok: false, message: `${param} is missing` };
      }

      const optimalMin = Number(paramConfig.optimal?.min);
      const optimalMax = Number(paramConfig.optimal?.max);
      const confMin = Number(paramConfig.configurable?.min);
      const confMax = Number(paramConfig.configurable?.max);

      if (
        !Number.isFinite(optimalMin) ||
        !Number.isFinite(optimalMax) ||
        !Number.isFinite(confMin) ||
        !Number.isFinite(confMax)
      ) {
        return { ok: false, message: `${param} has non-numeric bounds` };
      }

      if (confMin >= confMax) {
        return { ok: false, message: `${param} configurable min must be less than max` };
      }

      if (optimalMin >= optimalMax) {
        return { ok: false, message: `${param} optimal min must be less than max` };
      }

      if (optimalMin < confMin || optimalMax > confMax) {
        return { ok: false, message: `${param} optimal range must be within configurable range` };
      }
    }

    return { ok: true };
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
