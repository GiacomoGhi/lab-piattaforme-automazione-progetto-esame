import WoT from "wot-typescript-definitions";
import { WaterState } from "../types/WaterTypes";
export declare class WaterThing {
    private runtime;
    private td;
    private thing;
    private state;
    private degradationConfig;
    private degradationInterval;
    private cycleRotationInterval;
    private simulationActive;
    private cycleDurationMs;
    constructor(runtime: typeof WoT, td: WoT.ThingDescription);
    /**
     * Start the Water Digital Twin
     */
    start(): Promise<void>;
    /**
     * Extract value from InteractionOutput or raw value
     */
    private extractValue;
    /**
     * Update a water property and emit change event
     */
    private updateProperty;
    /**
     * Get current state (for external use)
     */
    getState(): WaterState;
    /**
     * Programmatically update state (for use by other components like mock server)
     */
    setState(updates: Partial<WaterState>): Promise<void>;
    /**
     * Start degradation simulation (runs continuously)
     */
    private startDegradationSimulation;
    /**
     * Stop degradation simulation (used on shutdown)
     */
    private stopDegradationSimulation;
    /**
     * Check if all parameters are within optimal range
     */
    allParametersOptimal(): boolean;
    /**
     * Stop everything on shutdown
     */
    stop(): void;
}
