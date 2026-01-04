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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAndConsumeTDAsync = exports.getTDFromFile = exports.createWoTRuntimeAsync = exports.RuntimeType = void 0;
const fs = __importStar(require("fs"));
const binding_http_1 = require("@node-wot/binding-http");
const core_1 = __importDefault(require("@node-wot/core"));
var RuntimeType;
(function (RuntimeType) {
    RuntimeType[RuntimeType["Server"] = 0] = "Server";
    RuntimeType[RuntimeType["Client"] = 1] = "Client";
})(RuntimeType || (exports.RuntimeType = RuntimeType = {}));
function createWoTRuntimeAsync(type_1) {
    return __awaiter(this, arguments, void 0, function* (type, port = 8080) {
        const remoteServient = new core_1.default();
        switch (type) {
            case RuntimeType.Server:
                remoteServient.addServer(new binding_http_1.HttpServer({ port: port }));
                break;
            default:
                remoteServient.addClientFactory(new binding_http_1.HttpClientFactory(null));
        }
        return yield remoteServient.start();
    });
}
exports.createWoTRuntimeAsync = createWoTRuntimeAsync;
const getTDFromFile = (filePath) => JSON.parse(fs.readFileSync(filePath).toString());
exports.getTDFromFile = getTDFromFile;
function requestAndConsumeTDAsync(wotRuntime, endpoint) {
    return __awaiter(this, void 0, void 0, function* () {
        const consumedTD = yield wotRuntime.requestThingDescription(endpoint);
        return yield wotRuntime.consume(consumedTD);
    });
}
exports.requestAndConsumeTDAsync = requestAndConsumeTDAsync;
