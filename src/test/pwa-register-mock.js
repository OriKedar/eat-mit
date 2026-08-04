// Stand-in for the `virtual:pwa-register/react` module vite-plugin-pwa
// injects at build time — it doesn't exist under Vitest, so tests alias to
// this instead (see vitest.config.js). Individual tests override the
// returned needRefresh/updateServiceWorker via vi.mock when they need to.
export function useRegisterSW() {
  return { needRefresh: [false, () => {}], updateServiceWorker: () => {} }
}
