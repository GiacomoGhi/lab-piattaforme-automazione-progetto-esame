"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const CounterThing_1 = require("./things/CounterThing");
const SemaphoreThing_1 = require("./things/SemaphoreThing");
const wotRuntime_1 = require("./utils/wotRuntime");
/*
*SIMPLE THINGS ARE SMART TOGETHER
Fundamental smartIOT pattern according to WOT:
Things are independent between eachother, the intelligence is in the "orchestration logic"
-> In this example we suppose the things are deployed on a remote server, and the orchestrator interacts with them remotely
*/
(function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("---# Counter - Semaphore orchestrator #---");
        // Create wot server
        const wotServer = yield (0, wotRuntime_1.createWoTRuntimeAsync)(wotRuntime_1.RuntimeType.Server);
        // Create counter
        const counter = new CounterThing_1.CounterThing(wotServer, (0, wotRuntime_1.getTDFromFile)("./models/counter.tm.json"));
        // Create semaphore
        const semaphore = new SemaphoreThing_1.SemaphoreThing(wotServer, (0, wotRuntime_1.getTDFromFile)("./models/semaphore.tm.json"));
        // Start things
        counter.startAsync();
        semaphore.startAsync();
        // Create wot client
        const wotClient = yield (0, wotRuntime_1.createWoTRuntimeAsync)(wotRuntime_1.RuntimeType.Client);
        // Consume and orchestrate them
        const counterThing = yield (0, wotRuntime_1.requestAndConsumeTDAsync)(wotClient, "http://localhost:8080/counter");
        const semaphoreThing = yield (0, wotRuntime_1.requestAndConsumeTDAsync)(wotClient, "http://localhost:8080/semaphore");
        //Theresolds
        const thresholds = {
            red: 0,
            yellow: 5,
            green: 10,
        };
        counterThing.observeProperty("count", (data) => __awaiter(this, void 0, void 0, function* () {
            const currCount = (yield data.value());
            let desiredColor = "red";
            if (currCount >= thresholds.green)
                desiredColor = "green";
            else if (currCount >= thresholds.yellow)
                desiredColor = "yellow";
            else
                desiredColor = "red";
            yield semaphoreThing.invokeAction("setColor", desiredColor);
            console.log(`count = ${currCount}, color -> ${desiredColor}`);
        }), (err) => {
            console.error("Error observing count:", err);
        });
    });
})();
