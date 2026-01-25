"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.invalidateCache = invalidateCache;
exports.getParameterRange = getParameterRange;
exports.getAllParameterNames = getAllParameterNames;
exports.getMode = getMode;
exports.setMode = setMode;
exports.getOptimalRanges = getOptimalRanges;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let cachedConfig = null;
function loadConfig() {
    // Always reload from file to pick up API updates
    const configPath = path.join(process.cwd(), "config.json");
    const configContent = fs.readFileSync(configPath, "utf-8");
    cachedConfig = JSON.parse(configContent);
    return cachedConfig;
}
function invalidateCache() {
    cachedConfig = null;
}
function getParameterRange(paramName) {
    const config = loadConfig();
    const range = config.parameters[paramName];
    if (!range) {
        throw new Error(`Parameter ${paramName} not found in configuration`);
    }
    return range;
}
function getAllParameterNames() {
    const config = loadConfig();
    return Object.keys(config.parameters);
}
function getMode() {
    return loadConfig().mode;
}
function setMode(mode) {
    const config = loadConfig();
    config.mode = mode;
    // Note: This updates the cached config but doesn't persist to file
    // For persistence, add file write logic if needed
}
function getOptimalRanges() {
    const config = loadConfig();
    const ranges = {};
    for (const [key, param] of Object.entries(config.parameters)) {
        ranges[key] = param.optimal;
    }
    return ranges;
}
