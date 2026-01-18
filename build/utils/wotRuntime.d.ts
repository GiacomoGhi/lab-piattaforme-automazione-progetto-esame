export declare enum RuntimeType {
    HttpServer = 0,
    HttpClient = 1,
    ModbusClient = 2
}
export declare function createWoTRuntimeAsync(type: RuntimeType, port?: number): Promise<typeof WoT>;
export declare const getTDFromFile: (filePath: string) => WoT.ThingDescription;
export declare function requestAndConsumeTDAsync(wotRuntime: typeof WoT, endpoint: string): Promise<WoT.ConsumedThing>;
