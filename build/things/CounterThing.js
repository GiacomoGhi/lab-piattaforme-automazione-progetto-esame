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
exports.CounterThing = void 0;
const ThingBase_1 = require("./ThingBase");
/**
 * CounterThing - A simple counter.
 *
 * Exposes a `counter` property and a `increment` action.
 */
class CounterThing extends ThingBase_1.ThingBase {
    constructor(runtime, target) {
        super(runtime, target);
        this.count = 0;
        // Register property read handlers
        this.setPropertyReadHandlers([
            {
                key: "count",
                handler: () => __awaiter(this, void 0, void 0, function* () {
                    console.log("> Read count:", this.count);
                    return this.count;
                }),
            },
        ]);
        // Register action handlers
        this.setActionHandlers([
            {
                key: "increment",
                handler: () => __awaiter(this, void 0, void 0, function* () {
                    this.count += 1;
                    return "ok";
                }),
            },
        ]);
    }
}
exports.CounterThing = CounterThing;
