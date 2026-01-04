/// <reference types="@thingweb/thing-model/node_modules/wot-typescript-definitions" />
import WoT from "wot-typescript-definitions";
import { ThingBase } from "./ThingBase";
/**
 * SemaphoreThing - A simple traffic light semaphore.
 *
 * Exposes a `color` property and a `setColor` action.
 */
export declare class SemaphoreThing extends ThingBase {
    private color;
    constructor(runtime: typeof WoT, target: WoT.ThingDescription);
}
