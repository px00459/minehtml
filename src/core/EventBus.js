/**
 * EventBus - Simple pub/sub system for decoupled communication
 * between SceneSubjects
 */
class EventBus {
    static instance = null;
    
    constructor() {
        if (EventBus.instance) {
            return EventBus.instance;
        }
        this.listeners = {};
        // Track listener subscriptions for cleanup: Map<callback, Set<eventNames>>
        this.listenerRegistry = new WeakMap();
        EventBus.instance = this;
    }
    
    static getInstance() {
        if (!EventBus.instance) {
            new EventBus();
        }
        return EventBus.instance;
    }
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        
        // Track this subscription for cleanup
        if (!this.listenerRegistry.has(callback)) {
            this.listenerRegistry.set(callback, new Set());
        }
        this.listenerRegistry.get(callback).add(event);
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        
        // Remove from registry
        if (this.listenerRegistry.has(callback)) {
            const events = this.listenerRegistry.get(callback);
            events.delete(event);
            if (events.size === 0) {
                this.listenerRegistry.delete(callback);
            }
        }
    }
    
    /**
     * Remove all listeners for a specific callback
     * @param {function} callback - Callback function to remove completely
     */
    removeAllListeners(callback) {
        if (!this.listenerRegistry.has(callback)) return;
        
        const events = this.listenerRegistry.get(callback);
        for (const event of events) {
            this.off(event, callback);
        }
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (!this.listeners[event]) return;
        
        // Clone listeners array to prevent issues during iteration
        const callbacks = [...this.listeners[event]];
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for "${event}":`, error);
            }
        });
    }
    
    /**
     * Clear all listeners for an event (or all events)
     * @param {string} [event] - Optional event name to clear
     */
    clear(event) {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
            this.listenerRegistry = new WeakMap();
        }
    }
}

export { EventBus };
