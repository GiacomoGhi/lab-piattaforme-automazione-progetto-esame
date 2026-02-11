import WoT from "wot-typescript-definitions";
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
export declare class WaterQualitySensorThing {
    private runtime;
    private td;
    private thing;
    private consumedWater;
    private pH;
    private temperature;
    private oxygenLevel;
    private pHStatus;
    private temperatureStatus;
    private oxygenLevelStatus;
    private samplingInterval;
    private samplingTimer;
    private config;
    constructor(runtime: typeof WoT, td: WoT.ThingDescription, samplingIntervalMs?: number);
    /**
     * Start the thing and connect to Water Digital Twin
     */
    startAsync(): Promise<void>;
    /**
     * Connect to the Water Digital Twin (polling mode)
     */
    private connectToWaterDigitalTwin;
    private scheduleConnectAndStartPolling;
    /**
     * Read initial state from Water Digital Twin
     */
    private readInitialWaterState;
    /**
     * Check parameter values and emit alerts if necessary
     * Only emits the most critical alert to avoid concatenation issues
     */
    private updateStatusesAndEmitEvents;
    private updateParameterStatus;
    /**
     * Get the status of a parameter based on its value
     */
    private getParameterStatus;
    /**
     * Set sampling interval (in milliseconds)
     * Valid range: 3000 (3 sec) to 1800000 (30 min)
     */
    setSamplingInterval(intervalMs: number): void;
    /**
     * Start periodic sampling of water parameters
     */
    private startSampling;
    private applyMode;
    private loadConfigFromFile;
    private saveConfigToFile;
    private extractString;
    private extractObject;
    private validateConfigPayload;
    /**
     * Stop periodic sampling
     */
    private stopSampling;
    /**
     * Stop the sensor
     */
    stop(): void;
}
