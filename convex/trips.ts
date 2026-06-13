import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const mapsUrl = (lat: number, lng: number) =>
  `https://maps.google.com/?q=${lat},${lng}`;

/** Called when the FSM arms a confirmed drive. Logs an `armed` event. */
export const start = mutation({
  args: {
    householdId: v.id("households"),
    driverId: v.id("guardians"),
    vehicleId: v.optional(v.id("vehicles")),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const tripId = await ctx.db.insert("trips", args);
    await ctx.db.insert("events", { tripId, type: "armed", at: args.startedAt });
    return tripId;
  },
});

/** Trip-end: capture parked location, build maps link, log trip_end. */
export const end = mutation({
  args: {
    tripId: v.id("trips"),
    endedAt: v.number(),
    parkedLat: v.number(),
    parkedLng: v.number(),
  },
  handler: async (ctx, { tripId, endedAt, parkedLat, parkedLng }) => {
    await ctx.db.patch(tripId, {
      endedAt,
      parkedLat,
      parkedLng,
      parkedMapsUrl: mapsUrl(parkedLat, parkedLng),
    });
    await ctx.db.insert("events", { tripId, type: "trip_end", at: endedAt });
  },
});

/** Resolve a trip with an outcome + acking guardian. */
export const resolve = mutation({
  args: {
    tripId: v.id("trips"),
    outcome: v.union(
      v.literal("ack_reminder"),
      v.literal("ack_alarm"),
      v.literal("escalated"),
    ),
    ackById: v.optional(v.id("guardians")),
    at: v.number(),
  },
  handler: async (ctx, { tripId, outcome, ackById, at }) => {
    await ctx.db.patch(tripId, { outcome, ackById });
    if (outcome !== "escalated") {
      await ctx.db.insert("events", { tripId, type: "all_clear", at });
    }
  },
});

export const logEvent = mutation({
  args: {
    tripId: v.id("trips"),
    type: v.union(
      v.literal("reminder_fired"),
      v.literal("alarm_fired"),
    ),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", args);
  },
});

export const listByHousehold = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    return await ctx.db
      .query("trips")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .order("desc")
      .take(100);
  },
});

export const get = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    const events = await ctx.db
      .query("events")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    return { trip, events };
  },
});
