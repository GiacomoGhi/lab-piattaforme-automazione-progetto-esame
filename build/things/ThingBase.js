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
exports.ThingBase = void 0;
/**
 * Abstract base class for Things.
 *
 * Holds the common WoT runtime reference and the Thing Description used to
 * produce an `ExposedThing`. Also stores maps of property and action
 * handlers that subclasses can register before exposing the Thing.
 */
class ThingBase {
    /**
     * Create a new ThingBase.
     * @param runtime WoT runtime used to produce/consume Things
     * @param target Thing Description used to produce the ExposedThing
     */
    constructor(runtime, target) {
        /**
         * Registered property read handlers keyed by property name.
         * Each handler is an async function that returns the property's value.
         */
        this.propertyReadHandlers = new Map();
        /**
         * Registered action handlers keyed by action name.
         * Each handler is an async function executed when the action is invoked.
         */
        this.actionHandlers = new Map();
        /**
         * Register multiple property read handlers.
         *
         * Expects an array of objects with `key` and `handler` fields. If a handler
         * for the given key already exists, a message is logged and the handler is
         * overwritten.
         *
         * @param keyedHandlersArray Array of `{ key, handler }` entries
         */
        this.setPropertyReadHandlers = (keyedHandlersArray) => keyedHandlersArray.forEach(({ key, handler }) => {
            // Check for existing handlers
            if (this.propertyReadHandlers.has(key)) {
                console.log(`Property read handler for ${key} already set. Handler will be overwritten.`);
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
        this.setActionHandlers = (handlersArray) => handlersArray.forEach(({ key, handler }) => {
            // Check for existing handlers
            if (this.actionHandlers.has(key)) {
                console.log(`Action handler for ${key} already set. Handler will be overwritten.`);
            }
            // Set handler
            this.actionHandlers.set(key, handler);
        });
        /**
         * Emit a property change notification.
         * @param key The name of the property that changed
         */
        this.emitPropertyChange = (key) => this.thing.emitPropertyChange(key);
        this.runtime = runtime;
        this.target = target;
    }
    /**
     * Produce the `ExposedThing`, attach registered handlers and expose it.
     */
    startAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            // Setup
            this.thing = yield this.runtime.produce(this.target);
            // Set read handlers
            this.propertyReadHandlers.forEach((handler, key) => {
                this.thing.setPropertyReadHandler(key, handler);
            });
            // Set action handlers
            this.actionHandlers.forEach((handler, key) => {
                this.thing.setActionHandler(key, handler);
            });
            // Expose
            yield this.thing.expose();
            console.log(`${this.target.title} thing started! Go to: http://localhost:8080/${this.target.title.toLowerCase()}`);
        });
    }
}
exports.ThingBase = ThingBase;
