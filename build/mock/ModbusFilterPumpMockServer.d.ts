/**
 * ModbusFilterPumpMockServer (Simulator)
 *
 * Simulates a Modbus TCP device representing a filter pump.
 * This is a simplified in-memory simulator that doesn't require a real Modbus server library.
 *
 * Simulates the following holding registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger cleaning)
 *
 * Note: For a real Modbus server, use libraries like 'node-modbus' or 'modbus-tcp-server'.
 * This is a mock for testing and demo purposes.
 */
interface ModbusRegisters {
    [key: number]: number;
}
declare class ModbusFilterPumpMockServer {
    private port;
    private registers;
    private simulationActive;
    private lastCleaningTime;
    private simulationIntervals;
    constructor(port?: number);
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
