// Device storage adapter: localStorage with an in-memory fallback (private mode, blocked storage, quota).
// With the fallback the survey still works, with an ID for this session only (edge case in the spec).

const defaultProvider = () => globalThis.localStorage;

/**
 * @param {() => Storage|undefined} provider returns the Web Storage to use (injected for tests).
 * @returns {{ get(key): string|null, set(key, value): void, persistent: boolean }}
 */
export function createStorage(provider = defaultProvider) {
  const memory = new Map();
  let ls = null;
  try {
    ls = provider() ?? null;
  } catch {
    ls = null;
  }

  const api = {
    persistent: ls !== null,
    get(key) {
      if (ls) {
        try {
          return ls.getItem(key);
        } catch {
          ls = null;
          api.persistent = false;
        }
      }
      return memory.has(key) ? memory.get(key) : null;
    },
    set(key, value) {
      memory.set(key, String(value));
      if (!ls) return;
      try {
        ls.setItem(key, String(value));
      } catch {
        ls = null;
        api.persistent = false;
      }
    },
  };
  return api;
}
