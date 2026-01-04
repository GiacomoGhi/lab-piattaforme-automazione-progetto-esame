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
exports.SemaphoreThing = void 0;
const ThingBase_1 = require("./ThingBase");
/**
 * SemaphoreThing - A simple traffic light semaphore.
 *
 * Exposes a `color` property and a `setColor` action.
 */
class SemaphoreThing extends ThingBase_1.ThingBase {
    constructor(runtime, target) {
        super(runtime, target);
        this.color = "red";
        // Register property read handlers
        this.setPropertyReadHandlers([
            {
                key: "color",
                handler: () => __awaiter(this, void 0, void 0, function* () {
                    console.log("> Read color:", this.color);
                    return this.color;
                }),
            },
        ]);
        // Register action handlers
        this.setActionHandlers([
            {
                key: "setColor",
                handler: (data) => __awaiter(this, void 0, void 0, function* () {
                    const value = yield data.value();
                    this.color = value === null || value === void 0 ? void 0 : value.toString();
                    console.log("< Set color:", this.color);
                    this.emitPropertyChange("color");
                    return "ok";
                }),
            },
        ]);
    }
}
exports.SemaphoreThing = SemaphoreThing;
