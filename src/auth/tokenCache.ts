import * as SecureStore from "expo-secure-store";

/** Clerk session token cache backed by the device secure store. */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // non-fatal — sign-in still works for the session, just won't persist.
    }
  },
};
