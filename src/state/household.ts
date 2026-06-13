import { useEffect } from "react";
import { create } from "zustand";
import { useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { api } from "@/convex/_api";
import type { Doc, Id } from "@/convex/_api";

/**
 * The active household id. Set during onboarding (households.create) and
 * recovered on launch. Persisted to the device secure store so a full app
 * kill + relaunch keeps the user in their household instead of bouncing them
 * back to onboarding. The server (Convex, keyed on the Clerk identity) is the
 * source of truth via `households.forCurrentUser`; this local copy is a cache
 * that also works before/without the Clerk "convex" JWT template.
 */
const STORAGE_KEY = "backseat.householdId";

interface HouseholdStore {
  householdId: Id<"households"> | null;
  /** True once we've attempted to read the persisted id from secure store. */
  hydrated: boolean;
  /** Set (and persist) the active household id. Pass null to clear. */
  setHouseholdId: (id: Id<"households"> | null) => void;
  /** Internal: load the persisted id. Runs once at module load. */
  hydrate: () => Promise<void>;
}

export const useHouseholdStore = create<HouseholdStore>((set, get) => ({
  householdId: null,
  hydrated: false,
  setHouseholdId: (householdId) => {
    set({ householdId });
    if (householdId) {
      void SecureStore.setItemAsync(STORAGE_KEY, householdId).catch(() => {});
    } else {
      void SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
    }
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      set({ householdId: (stored as Id<"households"> | null) ?? null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

// Kick off hydration as soon as the module loads, before any screen renders.
void useHouseholdStore.getState().hydrate();

export interface ActiveHousehold {
  householdId: Id<"households"> | null;
  household: Doc<"households"> | null;
  guardian: Doc<"guardians"> | null;
  /** True while we still don't know whether the user has a household. */
  loading: boolean;
}

/**
 * The single source of truth for "which household am I in" across screens.
 * Combines the auth-keyed Convex query (cross-device, authoritative) with the
 * locally-persisted cache (instant, survives cold start even without the JWT
 * template). When the server returns a household, the cache is refreshed.
 */
export function useActiveHousehold(): ActiveHousehold {
  const cachedId = useHouseholdStore((s) => s.householdId);
  const hydrated = useHouseholdStore((s) => s.hydrated);
  const setHouseholdId = useHouseholdStore((s) => s.setHouseholdId);

  // undefined = still loading; null = unauthenticated / not onboarded.
  const me = useQuery(api.households.forCurrentUser);

  useEffect(() => {
    if (me && me.householdId !== cachedId) {
      setHouseholdId(me.householdId);
    }
  }, [me, cachedId, setHouseholdId]);

  const householdId = me?.householdId ?? cachedId;
  // Don't block on the server query if we already have a cached id to show.
  const loading = !hydrated || (me === undefined && cachedId == null);

  return {
    householdId,
    household: me?.household ?? null,
    guardian: me?.guardian ?? null,
    loading,
  };
}
