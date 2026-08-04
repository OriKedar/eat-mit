import '@testing-library/jest-dom/vitest'

// Node 22+ defines its own global `localStorage` behind an experimental
// flag, which shadows the working one jsdom sets up on its window — without
// this, `localStorage` reads as undefined under vitest's jsdom environment
// regardless of Node version. Point the global back at jsdom's real
// implementation so app code that reads bare `localStorage` behaves the
// same under test as it does in a browser.
if (typeof globalThis.jsdom !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => globalThis.jsdom.window.localStorage,
  })
}
