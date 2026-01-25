export interface ParameterRange {
    unit: string;
    description: string;
    configurable: {
        min: number;
        max: number;
    };
    optimal: {
        min: number;
        max: number;
    };
}
export interface AppConfig {
    mode: "demo" | "production";
    parameters: Record<string, ParameterRange>;
    modes: {
        demo: {
            samplingIntervalMs: number;
            degradationIntervalMs: number;
            filterDegradationIntervalMs: number;
        };
        production: {
            samplingIntervalMs: number;
            degradationIntervalMs: number;
            filterDegradationIntervalMs: number;
        };
    };
}
export declare function loadConfig(): AppConfig;
export declare function invalidateCache(): void;
export declare function getParameterRange(paramName: string): ParameterRange;
export declare function getAllParameterNames(): string[];
export declare function getMode(): "demo" | "production";
export declare function setMode(mode: "demo" | "production"): void;
export declare function getOptimalRanges(): Record<string, {
    min: number;
    max: number;
}>;
