import WoT from "wot-typescript-definitions";
import type { WaterThing } from "./WaterThing";
/**
 * FilterPumpThing - Modbus Proxy for aquarium filter pump.
 *
 * This Thing acts as an HTTP proxy to a Modbus device.
 * It exposes pumpSpeed and filterStatus properties via HTTP,
 * while communicating with the actual pump via Modbus protocol.
 *
 * Modbus Registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger)
 */
interface PumpState {
    pumpSpeed: number;
    filterStatus: "idle" | "running" | "cleaning" | "error";
    filterHealth: number;
    lastCleaningTime: string;
}
export declare class FilterPumpThing {
    private runtime;
    private proxyTD;
    private modbusTD;
    private thing;
    private modbusClient;
    private waterThing;
    private state;
    private simulationInterval;
    private healthDegradationInterval;
    private waterCorrectionInterval;
    constructor(runtime: typeof WoT, proxyTD: WoT.ThingDescription, modbusTD: WoT.ThingDescription, waterThing?: WaterThing);
    /**
     * Start the filter pump thing
     */
    start(): Promise<void>;
    /**
     * Simulate filter health degradation and status changes
     */
    private startSimulation;
    /**
     * Stop the thing
     */
    stop(): void;
    /**
     * Start water correction (pump running)
     * Updates water parameters to move towards optimal values
     */
    private startWaterCorrection;
    /**
     * Stop water correction
     */
    private stopWaterCorrection;
    /**
     * Set pump speed programmatically
     */
    private setPumpSpeed;
    /**
     * Get current state for external use
     */
    getState(): PumpState;
}
export {};
