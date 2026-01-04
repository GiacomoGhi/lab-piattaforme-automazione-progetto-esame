/**
 * Abstract base class for Things.
 *
 * Holds the common WoT runtime reference and the Thing Description used to
 * produce an `ExposedThing`. Also stores maps of property and action
 * handlers that subclasses can register before exposing the Thing.
 */
export abstract class ThingBase {
  /**
   * Reference to the WoT runtime used to produce/consume Things.
   */
  private runtime: typeof WoT;

  /**
   * The Thing Description (TD) / model used when producing the ExposedThing.
   */
  private target: WoT.ThingDescription;

  /**
   * Registered property read handlers keyed by property name.
   * Each handler is an async function that returns the property's value.
   */
  private readonly propertyReadHandlers: Map<string, WoT.PropertyReadHandler> =
    new Map();

  /**
   * Registered action handlers keyed by action name.
   * Each handler is an async function executed when the action is invoked.
   */
  private readonly actionHandlers: Map<string, WoT.ActionHandler> = new Map();

  /**
   * The produced `ExposedThing` instance (initialized by `exposeThing`).
   */
  private thing!: WoT.ExposedThing;

  /**
   * Create a new ThingBase.
   * @param runtime WoT runtime used to produce/consume Things
   * @param target Thing Description used to produce the ExposedThing
   */
  constructor(runtime: typeof WoT, target: WoT.ThingDescription) {
    this.runtime = runtime;
    this.target = target;
  }

  /**
   * Produce the `ExposedThing`, attach registered handlers and expose it.
   */
  public async startAsync(): Promise<void> {
    // Setup
    this.thing = await this.runtime.produce(this.target);

    // Set read handlers
    this.propertyReadHandlers.forEach((handler, key) => {
      this.thing.setPropertyReadHandler(key, handler);
    });

    // Set action handlers
    this.actionHandlers.forEach((handler, key) => {
      this.thing.setActionHandler(key, handler);
    });

    // Expose
    await this.thing.expose();
    console.log(
      `${
        this.target.title
      } thing started! Go to: http://localhost:8080/${this.target.title.toLowerCase()}`
    );
  }

  /**
   * Register multiple property read handlers.
   *
   * Expects an array of objects with `key` and `handler` fields. If a handler
   * for the given key already exists, a message is logged and the handler is
   * overwritten.
   *
   * @param keyedHandlersArray Array of `{ key, handler }` entries
   */
  protected setPropertyReadHandlers = (
    keyedHandlersArray: Array<{ key: string; handler: WoT.PropertyReadHandler }>
  ): void =>
    keyedHandlersArray.forEach(({ key, handler }) => {
      // Check for existing handlers
      if (this.propertyReadHandlers.has(key)) {
        console.log(
          `Property read handler for ${key} already set. Handler will be overwritten.`
        );
      }

      // Set handler
      this.propertyReadHandlers.set(key, handler);
    });

  /**
   * Register multiple action handlers.
   *
   * Expects an array of objects with `key` and `handler` fields. Existing
   * handlers for the same key will be logged and then overwritten.
   *
   * @param handlersArray Array of `{ key, handler }` entries
   */
  protected setActionHandlers = (
    handlersArray: Array<{ key: string; handler: WoT.ActionHandler }>
  ): void =>
    handlersArray.forEach(({ key, handler }) => {
      // Check for existing handlers
      if (this.actionHandlers.has(key)) {
        console.log(
          `Action handler for ${key} already set. Handler will be overwritten.`
        );
      }

      // Set handler
      this.actionHandlers.set(key, handler);
    });

  /**
   * Emit a property change notification.
   * @param key The name of the property that changed
   */
  protected emitPropertyChange = (key: string): void =>
    this.thing.emitPropertyChange(key);
}
