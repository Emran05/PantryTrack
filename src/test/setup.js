// Vitest setup — node environment with just enough browser surface for the
// pure-logic libs (localStorage/sessionStorage, window event no-ops). Full DOM
// isn't needed: components aren't unit-tested here, only src/lib logic.

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(String(k), String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

// preferences.js dispatches a sync event on window; give it a harmless target.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (typeof globalThis.window.dispatchEvent !== 'function') {
  globalThis.window.dispatchEvent = () => true;
  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
}
