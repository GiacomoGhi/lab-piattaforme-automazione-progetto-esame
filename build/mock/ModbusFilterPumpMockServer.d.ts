/**
 * ModbusFilterPumpMockServer (Simulator)
 *
 * Simulates a Modbus TCP device representing a filter pump.
 * Uses a real Modbus TCP server (modbus-serial) with an in-memory register map.
 *
 * Simulates the following holding registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger cleaning)
 *
 * Note: This is still a mock for testing and demo purposes.
 */
interface ModbusRegisters {
    [key: number]: number;
}
declare class ModbusFilterPumpMockServer {
    private port;
    private waterEndpoint;
    private server;
    private registers;
    private simulationActive;
    private lastCleaningTime;
    private simulationIntervals;
    private waterCorrectionInterval;
    private waterReachable;
    private waterRetryDelayMs;
    private waterNextRetryAt;
    constructor(port?: number, waterEndpoint?: string);
    /**
     * Start the mock Modbus simulator
     */
    start(): Promise<void>;
    /**
     * Handle register changes
     */
    private onRegisterChange;
    /**
     * Execute cleaning cycle
     */
    private executeCleaning;
    /**
     * Simulate gradual health degradation
     */
    private startSimulation;
    /**
     * Apply water correction based on pump speed
     */
    private startWaterCorrectionLoop;
    private readWaterState;
    private canAttemptWaterRead;
    private onWaterReadSuccess;
    private onWaterReadFailure;
    private applyWaterCorrections;
    private writeWaterProperty;
    private loadOptimalTargetsFromConfig;
    /**
     * Get human-readable status name
     */
    private getStatusName;
    /**
     * Read a register value (simulates Modbus read)
     */
    readRegister(address: number): number;
    /**
     * Write to a register (simulates Modbus write)
     */
    writeRegister(address: number, value: number): void;
    private getModbusVector;
    /**
     * Stop the server
     */
    stop(): void;
    /**
     * Get current register values
     */
    getRegisters(): ModbusRegisters;
    /**
     * Set register value
     */
    setRegister(address: number, value: number): void;
}
declare const modbusServer: ModbusFilterPumpMockServer;
export default modbusServer;
