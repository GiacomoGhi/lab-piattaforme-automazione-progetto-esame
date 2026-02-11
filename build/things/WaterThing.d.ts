import WoT from "wot-typescript-definitions";
/**
 * WaterThing - Digital Twin representing the aquarium water state.
 *
 * This Thing acts as the source of truth for water parameters.
 * It exposes pH, temperature, and oxygenLevel as read/write properties.
 * Other Things (like WaterQualitySensor) read from this Thing's properties.
 *
 * Architecture:
 * - WaterThing (Digital Twin) ← publishes state via properties
 * - WaterQualitySensor ← polls and reads from WaterThing
 * - FilterPump ← can affect water state (future: via ModbusMockServer)
 */
export declare class WaterThing {
    private runtime;
    private td;
    private thing;
    private state;
    private currentTestCycle;
    private acceleratedParameterIndex;
    private degradationInterval;
    private cycleRotationInterval;
    private simulationActive;
    private cycleDurationMs;
    private correctionInterval;
    private consumedPump;
    private pumpReachable;
    private pumpRetryDelayMs;
    private pumpNextRetryAt;
    private consumedSensor;
    private optimalTargets;
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
     * Start degradation simulation (runs continuously)
     */
    private startDegradationSimulation;
    /**
     * Stop degradation simulation (used on shutdown)
     */
    private stopDegradationSimulation;
    /**
     * Connect to the WaterQualitySensor to obtain optimal targets via WoT.
     * Subscribes to configChanged events to keep targets in sync.
     */
    private scheduleConnectToSensor;
    private connectToSensor;
    /**
     * Read the config property from the consumed Sensor and extract optimal targets.
     */
    private refreshOptimalTargets;
    private scheduleConnectToPump;
    private connectToPump;
    private canAttemptPumpRead;
    private startCorrectionLoop;
    private applyWaterCorrections;
    /**
     * Stop everything on shutdown
     */
    stop(): void;
}
