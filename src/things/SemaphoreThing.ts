import WoT from "wot-typescript-definitions";
import { ThingBase } from "./ThingBase";

type SemaphoreColor = "red" | "yellow" | "green";

/**
 * SemaphoreThing - A simple traffic light semaphore.
 *
 * Exposes a `color` property and a `setColor` action.
 */
export class SemaphoreThing extends ThingBase {
  private color: SemaphoreColor = "red";

  constructor(runtime: typeof WoT, target: WoT.ThingDescription) {
    super(runtime, target);

    // Register property read handlers
    this.setPropertyReadHandlers([
      {
        key: "color",
        handler: async () => {
          console.log("> Read color:", this.color);
          return this.color;
        },
      },
    ]);

    // Register action handlers
    this.setActionHandlers([
      {
        key: "setColor",
        handler: async (data) => {
          const value = await data.value();
          this.color = value?.toString() as SemaphoreColor;
          console.log("< Set color:", this.color);
          this.emitPropertyChange("color");
          return "ok";
        },
      },
    ]);
  }
}
