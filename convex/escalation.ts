import { action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * sendEscalation (Build Brief §5): on NOTIFY_CONTACTS, push the parked maps
 * link to every secondary escalation guardian's device, then log contacts_paged.
 * FCM-first (free, default). Twilio SMS is an optional paid branch, deferred.
 */
export const sendEscalation = action({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }): Promise<{ pushed: number }> => {
    const ctxData = await ctx.runQuery(internal.escalation.escalationContext, {
      tripId,
    });
    if (!ctxData.trip) return { pushed: 0 };

    const mapsUrl =
      ctxData.trip.parkedMapsUrl ?? "https://maps.google.com/";
    const body = `No acknowledgement after parking. Check the back seat. Parked: ${mapsUrl}`;

    let pushed = 0;
    for (const g of ctxData.contacts) {
      if (!g.fcmToken) continue;
      const ok = await sendFcmPush(g.fcmToken, "BackSeat — Check the back seat", body, {
        tripId,
        mapsUrl,
      });
      if (ok) pushed += 1;
    }

    await ctx.runMutation(internal.escalation.markPaged, { tripId });
    return { pushed };
  },
});

export const escalationContext = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return { trip: null, contacts: [] };
    const guardians = await ctx.db
      .query("guardians")
      .withIndex("by_household", (q) => q.eq("householdId", trip.householdId))
      .collect();
    const contacts = guardians.filter(
      (g) => g.isEscalationContact && g.role === "secondary",
    );
    return { trip, contacts };
  },
});

export const markPaged = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    await ctx.db.patch(tripId, { outcome: "escalated" });
    await ctx.db.insert("events", {
      tripId,
      type: "contacts_paged",
      at: Date.now(),
    });
  },
});

/** FCM HTTP v1 via legacy server key (set FCM_SERVER_KEY as a Convex env var). */
async function sendFcmPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) {
    console.warn("[escalation] FCM_SERVER_KEY not set; skipping push", { title });
    return false;
  }
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        priority: "high",
        notification: { title, body, android_channel_id: "high_stakes_alarm" },
        data,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[escalation] FCM push failed", err);
    return false;
  }
}
