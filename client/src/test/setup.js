import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// This Node/jsdom combo doesn't expose a working Web Storage in the test
// environment (globalThis.localStorage resolves to undefined), so the app code
// and tests that call localStorage.* blow up. Install a minimal in-memory
// implementation for both the global and the jsdom window.
class MemoryStorage {
  #store = new Map();
  get length() {
    return this.#store.size;
  }
  key(index) {
    return [...this.#store.keys()][index] ?? null;
  }
  getItem(key) {
    return this.#store.has(String(key)) ? this.#store.get(String(key)) : null;
  }
  setItem(key, value) {
    this.#store.set(String(key), String(value));
  }
  removeItem(key) {
    this.#store.delete(String(key));
  }
  clear() {
    this.#store.clear();
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}

afterEach(cleanup);
