import WoT from "wot-typescript-definitions";
/**
 * WaterQualitySensorThing - Monitors aquarium water quality.
 *
 * Exposes pH, temperature, and oxygenLevel properties.
 * Emits parameterAlert events when values are out of range.
 */
export declare class WaterQualitySensorThing {
    private runtime;
    private td;
    private thing;
    private pH;
    private temperature;
    private oxygenLevel;
    private simulationInterval;
    constructor(runtime: typeof WoT, td: WoT.ThingDescription);
    /**
     * Start the thing and begin simulating sensor readings
     */
    startAsync(): Promise<void>;
    /**
     * Simulate sensor readings with realistic variations
     */
    private startSimulation;
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
