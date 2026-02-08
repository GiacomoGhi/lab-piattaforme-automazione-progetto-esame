import WoT from "wot-typescript-definitions";
/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits parameterAlert events when values are out of range.
 *
 * This sensor polls the Water Digital Twin at regular intervals (default: 3 seconds).
 * PUB/SUB pattern is disabled to avoid continuous notifications.
 * Architecture: WaterQualitySensor (polls) → Water Digital Twin (provides data)
 */
export declare class WaterQualitySensorThing {
    private runtime;
    private td;
    private thing;
    private consumedWater;
    private pH;
    private temperature;
    private oxygenLevel;
    private samplingInterval;
    private samplingTimer;
    constructor(runtime: typeof WoT, td: WoT.ThingDescription, samplingIntervalMs?: number);
    /**
     * Start the thing and subscribe to Water Digital Twin
     */
    startAsync(): Promise<void>;
    /**
     * Subscribe to the Water Digital Twin to receive state updates
     */
    private subscribeToWaterDigitalTwin;
    /**
     * Read initial state from Water Digital Twin
     */
    private readInitialWaterState;
    /**
     * Check parameter values and emit alerts if necessary
     * Only emits the most critical alert to avoid concatenation issues
     */
    private checkAndEmitAlerts;
    /**
     * Get the status of a parameter based on its value
     */
    private getParameterStatus;
    /**
     * Get current parameter status for external use
     */
    getStatus(): {
        pH: "ok" | "warning" | "alert";
        temperature: "ok" | "warning" | "alert";
        oxygenLevel: "ok" | "warning" | "alert";
    };
    /**
     * Get current values for external use
     */
    getValues(): {
        pH: number;
        temperature: number;
        oxygenLevel: number;
    };
    /**
     * Set sampling interval (in milliseconds)
     * Valid range: 3000 (3 sec) to 1800000 (30 min)
     */
    setSamplingInterval(intervalMs: number): void;
    /**
     * Start periodic sampling of water parameters
     */
    private startSampling;
    /**
     * Stop periodic sampling
     */
    private stopSampling;
    /**
     * Stop the sensor
     */
    stop(): void;
}
