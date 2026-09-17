/**
 * Minimal publish/subscribe event bus.
 *
 * Game systems (combat, objectives, UI) communicate through named events,
 * so the revision engine never depends on rendering code and can be
 * unit tested on its own.
 */
export class EventBus {
  #listeners = new Map();

  /**
   * Register a handler for an event.
   * @param {string} eventName
   * @param {(payload: unknown) => void} handler
   * @returns {() => void} call this to unsubscribe
   */
  on(eventName, handler) {
    if (typeof handler !== "function") {
      throw new TypeError(`Handler for "${eventName}" must be a function`);
    }
    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }
    this.#listeners.get(eventName).add(handler);
    return () => this.#listeners.get(eventName)?.delete(handler);
  }

  /**
   * Send an event to every registered handler.
   * A failing handler is logged but does not stop the others (robust code, spec 2.10.1).
   * @param {string} eventName
   * @param {unknown} [payload]
   */
  emit(eventName, payload) {
    const handlers = this.#listeners.get(eventName);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Listener for "${eventName}" failed:`, error);
      }
    }
  }
}
