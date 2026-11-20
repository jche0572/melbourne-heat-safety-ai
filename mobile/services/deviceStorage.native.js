import Storage from "expo-sqlite/kv-store";

// The existing services are synchronous; SQLite persists their data across reloads.
export default {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
};
