import WoT from "wot-typescript-definitions";
type ParameterType = "pH" | "temperature" | "oxygenLevel";
interface ControlledTestState {
    enabled: boolean;
    currentParameter: ParameterType;
    pumpCompensationActive: boolean;
}
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
    private controlledTest;
    constructor(runtime: typeof WoT, td: WoT.ThingDescription);
    /**
     * Start the thing and begin simulating sensor readings
     *
     * NOTE: Sensor update interval is 3 seconds for TESTING purposes only.
     * In production environments, this would typically be 30-60 seconds or longer
     * depending on the actual sensor hardware capabilities and requirements.
     */
    startAsync(): Promise<void>;
    /**
     * Simulate sensor readings with realistic variations.
     *
     * RANDOM MODE (default): Readings vary randomly around baseline.
     * CONTROLLED TEST MODE (TEST_MODE=controlled): Sequential parameter degradation to ALERT level,
     *   then pump compensation to recover. Cycle repeats for each parameter (pH → Temp → O2).
     *
     * Interval: 3000ms (3 seconds) for testing.
     */
    private startSimulation;
    /**
     * CONTROLLED TEST MODE: Sequential parameter degradation
     *
     * Primary parameter (in test): Degrades by -0.2 to -0.7 per cycle (random)
     * Other parameters: Degrade by -0.2 per cycle (fixed, minor alteration)
     *
     * Pump compensation (when active): +1.5 per cycle for each metric towards optimal value
     * Optimal values: pH=7.0, Temperature=25.0, Oxygen=7.0
     */
    private startControlledTest;
    /**
     * RANDOM TEST MODE: Standard random variations
     */
    private startRandomSimulation;
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
     * Set pump compensation state (for controlled test mode)
     * When active, parameters will recover at +0.6 per 3-second cycle
     */
    setPumpCompensation(active: boolean): void;
    /**
     * Get controlled test state
     */
    getControlledTestState(): ControlledTestState;
}
export {};
