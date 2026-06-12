const listeners = new Set();

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function publish(event) {
    for (const listener of listeners) {
        listener(event);
    }
}

module.exports = { subscribe, publish };
