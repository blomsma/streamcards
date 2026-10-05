// Shared server storage. EventSource automatically reconnects after a connection loss.
export const database = {};
let offset = 0;
let writes = Promise.resolve();
const subscriptions = new Map();
export const serverNow = () => Date.now() + offset;
export function ref(_database, path) {
    if (path !== 'users/event/timerState') throw new Error('Deze installatie gebruikt timerId=event.');
    return path;
}
export function set(reference, value) {
    ref(database, reference);
    const body = JSON.stringify(value);
    const request = writes.catch(() => {}).then(async () => {
        const response = await fetch('/api/timer', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local-event' }, body });
        if (!response.ok) throw new Error((await response.json()).message || 'Opslaan mislukt.');
    });
    writes = request;
    return request;
}
export function onValue(reference, callback, onError = () => {}) {
    ref(database, reference);
    const stream = new EventSource('/api/events');
    const subscription = { reference, callback, stream };
    subscriptions.set(callback, subscription);
    stream.onmessage = event => {
        const { state, serverTime } = JSON.parse(event.data);
        offset = serverTime - Date.now();
        callback({ val: () => state });
    };
    stream.onerror = () => onError(new Error('Verbinding met de NUC verbroken.'));
    return () => off(reference, 'value', callback);
}
export function off(reference, _type, callback) {
    const subscription = subscriptions.get(callback);
    if (subscription?.reference === reference) {
        subscription.stream.close();
        subscriptions.delete(callback);
    }
}
