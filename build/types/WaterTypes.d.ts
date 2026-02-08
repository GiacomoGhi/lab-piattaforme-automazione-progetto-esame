/**
 * Shared types for Water Digital Twin and related Things
 */
export interface WaterState {
    pH: number;
    temperature: number;
    oxygenLevel: number;
}
export interface WaterStateChangedEvent {
    parameter: "pH" | "temperature" | "oxygenLevel";
    oldValue: number;
    newValue: number;
    timestamp: string;
}
export interface WaterParameters {
    pH: number;
    temperature: number;
    oxygenLevel: number;
    timestamp: string;
}
export type ParameterStatus = "ok" | "warning" | "alert";
export interface ParameterStatusChangedEvent {
    parameter: "pH" | "temperature" | "oxygenLevel";
    status: ParameterStatus;
    value: number;
    timestamp: string;
}
