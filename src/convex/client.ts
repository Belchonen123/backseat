import { ConvexReactClient } from "convex/react";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) {
  // Fail loud — without a backend, escalation can't reach a second guardian.
  console.warn("[convex] EXPO_PUBLIC_CONVEX_URL is not set");
}

export const convex = new ConvexReactClient(
  url ?? "https://effervescent-rabbit-158.convex.cloud",
  { unsavedChangesWarning: false },
);
