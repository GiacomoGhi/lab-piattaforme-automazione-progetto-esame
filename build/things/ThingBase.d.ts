/**
 * Abstract base class for Things.
 *
 * Holds the common WoT runtime reference and the Thing Description used to
 * produce an `ExposedThing`. Also stores maps of property and action
 * handlers that subclasses can register before exposing the Thing.
 */
export declare abstract class ThingBase {
    /**
     * Reference to the WoT runtime used to produce/consume Things.
     */
    private runtime;
    /**
     * The Thing Description (TD) / model used when producing the ExposedThing.
     */
    private target;
    /**
     * Registered property read handlers keyed by property name.
     * Each handler is an async function that returns the property's value.
     */
    private readonly propertyReadHandlers;
    /**
     * Registered action handlers keyed by action name.
     * Each handler is an async function executed when the action is invoked.
     */
    private readonly actionHandlers;
    /**
     * The produced `ExposedThing` instance (initialized by `exposeThing`).
     */
    private thing;
    /**
     * Create a new ThingBase.
     * @param runtime WoT runtime used to produce/consume Things
     * @param target Thing Description used to produce the ExposedThing
     */
    constructor(runtime: typeof WoT, target: WoT.ThingDescription);
    /**
     * Produce the `ExposedThing`, attach registered handlers and expose it.
     */
    startAsync(): Promise<void>;
    /**
     * Register multiple property read handlers.
     *
     * Expects an array of objects with `key` and `handler` fields. If a handler
     * for the given key already exists, a message is logged and the handler is
     * overwritten.
     *
     * @param keyedHandlersArray Array of `{ key, handler }` entries
     */
    protected setPropertyReadHandlers: (keyedHandlersArray: Array<{
        key: string;
        handler: WoT.PropertyReadHandler;
    }>) => void;
    /**
     * Register multiple action handlers.
     *
     * Expects an array of objects with `key` and `handler` fields. Existing
     * handlers for the same key will be logged and then overwritten.
     *
     * @param handlersArray Array of `{ key, handler }` entries
     */
    protected setActionHandlers: (handlersArray: Array<{
        key: string;
        handler: WoT.ActionHandler;
    }>) => void;
    /**
     * Emit a property change notification.
     * @param key The name of the property that changed
     */
    protected emitPropertyChange: (key: string) => void;
}
