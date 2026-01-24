import * as fs from "fs";
import * as path from "path";

export interface ParameterRange {
  unit: string;
  description: string;
  configurable: { min: number; max: number };
  optimal: { min: number; max: number };
}

export interface AppConfig {
  mode: "demo" | "production";
  parameters: Record<string, ParameterRange>;
  modes: {
    demo: { samplingIntervalMs: number; degradationIntervalMs: number; filterDegradationIntervalMs: number };
    production: { samplingIntervalMs: number; degradationIntervalMs: number; filterDegradationIntervalMs: number };
  };
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  // Always reload from file to pick up API updates
  const configPath = path.join(process.cwd(), "config.json");
  const configContent = fs.readFileSync(configPath, "utf-8");
  cachedConfig = JSON.parse(configContent) as AppConfig;
  return cachedConfig;
}

export function invalidateCache(): void {
  cachedConfig = null;
}

export function getParameterRange(paramName: string): ParameterRange {
  const config = loadConfig();
  const range = config.parameters[paramName];
  if (!range) {
    throw new Error(`Parameter ${paramName} not found in configuration`);
  }
  return range;
}

export function getAllParameterNames(): string[] {
  const config = loadConfig();
  return Object.keys(config.parameters);
}

export function getMode(): "demo" | "production" {
  return loadConfig().mode;
}

export function setMode(mode: "demo" | "production"): void {
  const config = loadConfig();
  config.mode = mode;
  // Note: This updates the cached config but doesn't persist to file
  // For persistence, add file write logic if needed
}

export function getOptimalRanges(): Record<string, { min: number; max: number }> {
  const config = loadConfig();
  const ranges: Record<string, { min: number; max: number }> = {};
  for (const [key, param] of Object.entries(config.parameters)) {
    ranges[key] = param.optimal;
  }
  return ranges;
}
