import WoT from "wot-typescript-definitions";
/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits parameterAlert events when values are out of range.
 *
 * This sensor subscribes to the Water Digital Twin and reads its values.
 * Architecture: Water (Digital Twin) → publishes → WaterQualitySensor (subscribes)
 */
export declare class WaterQualitySensorThing {
    private runtime;
    private td;
    private thing;
    private consumedWater;
    private pH;
    private temperature;
    private oxygenLevel;
    constructor(runtime: typeof WoT, td: WoT.ThingDescription);
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
}
