import WoT from "wot-typescript-definitions";
import { WaterState } from "../types/WaterTypes";
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
export declare class WaterThing {
    private runtime;
    private td;
    private thing;
    private state;
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
}
