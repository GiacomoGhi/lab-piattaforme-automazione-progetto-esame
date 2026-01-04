import WoT from "wot-typescript-definitions";
import { ThingBase } from "./ThingBase";

/**
 * CounterThing - A simple counter.
 *
 * Exposes a `counter` property and a `increment` action.
 */
export class CounterThing extends ThingBase {
  private count: number = 0;

  constructor(runtime: typeof WoT, target: WoT.ThingDescription) {
    super(runtime, target);

    // Register property read handlers
    this.setPropertyReadHandlers([
      {
        key: "count",
        handler: async () => {
          console.log("> Read count:", this.count);
          return this.count;
        },
      },
    ]);

    // Register action handlers
    this.setActionHandlers([
      {
        key: "increment",
        handler: async () => {
          this.count += 1;
          return "ok";
        },
      },
    ]);
  }
}
