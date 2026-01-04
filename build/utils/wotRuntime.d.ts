export declare enum RuntimeType {
    Server = 0,
    Client = 1
}
export declare function createWoTRuntimeAsync(type: RuntimeType, port?: number): Promise<typeof WoT>;
export declare const getTDFromFile: (filePath: string) => WoT.ThingDescription;
export declare function requestAndConsumeTDAsync(wotRuntime: typeof WoT, endpoint: string): Promise<WoT.ConsumedThing>;
