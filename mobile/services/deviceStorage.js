// Keep existing browser data and storage keys unchanged.
export default {
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
};
