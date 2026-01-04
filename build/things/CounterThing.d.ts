/// <reference types="@thingweb/thing-model/node_modules/wot-typescript-definitions" />
import WoT from "wot-typescript-definitions";
import { ThingBase } from "./ThingBase";
/**
 * CounterThing - A simple counter.
 *
 * Exposes a `counter` property and a `increment` action.
 */
export declare class CounterThing extends ThingBase {
    private count;
    constructor(runtime: typeof WoT, target: WoT.ThingDescription);
}
