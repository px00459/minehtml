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
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
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
        }
    }
}

export { EventBus };
