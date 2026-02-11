import WoT from "wot-typescript-definitions";
export declare class FilterPumpThing {
    private runtime;
    private proxyTD;
    private modbusTD;
    private thing;
    private consumedModbus;
    private state;
    private modbusPollInterval;
    constructor(runtime: typeof WoT, proxyTD: WoT.ThingDescription, modbusTD: WoT.ThingDescription);
    /**
     * Start the filter pump thing
     */
    start(): Promise<void>;
    /**
     * Simulate filter health degradation and status changes
     */
    private startModbusPolling;
    /**
     * Stop the thing
     */
    stop(): void;
    private connectToModbus;
    private readModbusNumber;
    private mapStatusFromRegister;
    private syncStateFromModbus;
}
