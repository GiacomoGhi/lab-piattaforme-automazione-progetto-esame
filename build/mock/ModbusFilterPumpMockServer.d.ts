declare class ModbusFilterPumpMockServer {
    private port;
    private server;
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
    private readRegister;
    private writeRegister;
    private getModbusVector;
    /**
     * Stop the server
     */
    stop(): void;
}
declare const modbusServer: ModbusFilterPumpMockServer;
export default modbusServer;
