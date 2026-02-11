import WoT from "wot-typescript-definitions";

/**
 * FilterPumpThing - Modbus Proxy for aquarium filter pump.
 *
 * This Thing acts as an HTTP proxy to a Modbus device.
 * It exposes pumpSpeed and filterStatus properties via HTTP,
 * while communicating with the actual pump via Modbus protocol.
 *
 * Modbus Registers:
 * - Register 0: pumpSpeed (0-100)
 * - Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
 * - Register 2: filterHealth (0-100)
 * - Register 3: cleaningCommand (write 1 to trigger)
 */

interface PumpState {
  pumpSpeed: number;
  filterStatus: "idle" | "running" | "cleaning" | "error";
  filterHealth: number;
  lastCleaningTime: string;
}

export class FilterPumpThing {
  private runtime: typeof WoT;
  private proxyTD: WoT.ThingDescription;
  private modbusTD: WoT.ThingDescription;
  private thing!: WoT.ExposedThing;
  private consumedModbus: WoT.ConsumedThing | null = null;

  private state: PumpState = {
    pumpSpeed: 0,
    filterStatus: "idle",
    filterHealth: 100,
    lastCleaningTime: new Date().toISOString(),
  };

  private modbusPollInterval: NodeJS.Timeout | null = null;

  constructor(
    runtime: typeof WoT,
    proxyTD: WoT.ThingDescription,
    modbusTD: WoT.ThingDescription,
  ) {
    this.runtime = runtime;
    this.proxyTD = proxyTD;
    this.modbusTD = modbusTD;
  }

  /**
   * Start the filter pump thing
   */
  public async start(): Promise<void> {
    // Create the HTTP proxy thing
    this.thing = await this.runtime.produce(this.proxyTD);

    await this.connectToModbus();

    // Set up property read handlers
    this.thing.setPropertyReadHandler("pumpSpeed", async () => {
      await this.syncStateFromModbus();
      console.log(`> Read pumpSpeed: ${this.state.pumpSpeed}%`);
      return this.state.pumpSpeed;
    });

    this.thing.setPropertyReadHandler("filterStatus", async () => {
      await this.syncStateFromModbus();
      console.log(`> Read filterStatus: ${this.state.filterStatus}`);
      return this.state.filterStatus;
    });

    this.thing.setPropertyReadHandler("filterHealth", async () => {
      await this.syncStateFromModbus();
      const roundedHealth = Math.round(this.state.filterHealth);
      console.log(`> Read filterHealth: ${roundedHealth}%`);
      return roundedHealth;
    });

    this.thing.setPropertyReadHandler("lastCleaningTime", async () => {
      console.log(`> Read lastCleaningTime: ${this.state.lastCleaningTime}`);
      return this.state.lastCleaningTime;
    });

    // Set up action handlers
    this.thing.setActionHandler("setPumpSpeed", async (params: any) => {
      // Extract the actual value from InteractionOutput if needed
      let speedValue: number;
      if (params && typeof params.value === "function") {
        speedValue = await params.value();
      } else {
        speedValue = params;
      }
      const newSpeed = Math.max(0, Math.min(100, Number(speedValue)));
      
      this.state.pumpSpeed = newSpeed;

      if (newSpeed === 0) {
        this.state.filterStatus = "idle";
      } else if (this.state.filterStatus !== "cleaning") {
        this.state.filterStatus = "running";
      }

      try {
        if (this.consumedModbus) {
          await this.consumedModbus.invokeAction("writePumpSpeed", newSpeed);
          await this.syncStateFromModbus();
        }
      } catch (error) {
        console.error("[FilterPump] Modbus write failed:", error);
        return {
          success: false,
          newSpeed: newSpeed,
          message: "Modbus write failed",
        };
      }

      console.log(`⚙️ Pump speed set to ${newSpeed}%`);

      // Emit property change
      this.thing.emitPropertyChange("pumpSpeed");
      this.thing.emitPropertyChange("filterStatus");

      return {
        success: true,
        newSpeed: newSpeed,
        message: `Pump speed set to ${newSpeed}%`,
      };
    });

    this.thing.setActionHandler("cleaningCycle", async () => {
      console.log(`🧹 Starting cleaning cycle...`);

      try {
        if (this.consumedModbus) {
          await this.consumedModbus.invokeAction("triggerCleaning", 1);
          await this.syncStateFromModbus();
        }
      } catch (error) {
        console.error("[FilterPump] Modbus cleaning failed:", error);
        return {
          success: false,
          status: "error",
          message: "Modbus cleaning failed",
        };
      }

      this.state.lastCleaningTime = new Date().toISOString();
      this.thing.emitPropertyChange("lastCleaningTime");

      return {
        success: true,
        status: "completed",
        message: `Cleaning cycle completed. Filter health: ${this.state.filterHealth}%`,
      };
    });

    // Expose the thing
    await this.thing.expose();
    const title = this.proxyTD.title || "FilterPump";
    console.log(
      `${title} thing started! Go to: http://localhost:8080/${title.toLowerCase()}`,
    );

    // Start Modbus polling to emit property changes
    this.startModbusPolling();
  }

  /**
   * Simulate filter health degradation and status changes
   */
  private startModbusPolling(): void {
    if (this.modbusPollInterval) {
      clearInterval(this.modbusPollInterval);
    }

    this.modbusPollInterval = setInterval(async () => {
      const previousState = { ...this.state };
      await this.syncStateFromModbus();

      if (this.state.pumpSpeed !== previousState.pumpSpeed) {
        this.thing.emitPropertyChange("pumpSpeed");
      }
      if (this.state.filterStatus !== previousState.filterStatus) {
        this.thing.emitPropertyChange("filterStatus");
      }
      if (this.state.filterHealth !== previousState.filterHealth) {
        this.thing.emitPropertyChange("filterHealth");
      }
    }, 3000);
  }

  /**
   * Stop the thing
   */
  public stop(): void {
    if (this.modbusPollInterval) {
      clearInterval(this.modbusPollInterval);
    }
  }

  private async connectToModbus(): Promise<void> {
    this.consumedModbus = await this.runtime.consume(this.modbusTD);
  }

  private async readModbusNumber(property: string): Promise<number> {
    if (!this.consumedModbus) return 0;
    const prop = await this.consumedModbus.readProperty(property);
    const raw = await prop.value();
    if (typeof raw === "number") return raw;
    if (Buffer.isBuffer(raw)) return raw.readUInt16BE(0);
    return Number(raw);
  }

  private mapStatusFromRegister(value: number): PumpState["filterStatus"] {
    switch (value) {
      case 0:
        return "idle";
      case 1:
        return "running";
      case 2:
        return "cleaning";
      case 3:
        return "error";
      default:
        return "error";
    }
  }

  private async syncStateFromModbus(): Promise<void> {
    if (!this.consumedModbus) return;

    const pumpSpeed = await this.readModbusNumber("pumpSpeed");
    const filterStatus = await this.readModbusNumber("filterStatus");
    const filterHealth = await this.readModbusNumber("filterHealth");

    this.state.pumpSpeed = pumpSpeed;
    this.state.filterStatus = this.mapStatusFromRegister(filterStatus);
    this.state.filterHealth = filterHealth;
  }
}
