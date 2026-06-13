import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Data model — Build Brief §5. */
export default defineSchema({
  households: defineTable({
    name: v.string(),
  }),

  guardians: defineTable({
    householdId: v.id("households"),
    userId: v.string(),
    name: v.string(),
    phone: v.string(),
    role: v.union(v.literal("primary"), v.literal("secondary")),
    isEscalationContact: v.boolean(),
    fcmToken: v.optional(v.string()),
  })
    .index("by_household", ["householdId"])
    .index("by_user", ["userId"]),

  vehicles: defineTable({
    householdId: v.id("households"),
    label: v.string(),
    // Optional until the native Bluetooth ACL module lands; trip-end is
    // detected from GPS + motion in the meantime.
    btDeviceId: v.optional(v.string()),
    btName: v.optional(v.string()),
  }).index("by_household", ["householdId"]),

  trips: defineTable({
    householdId: v.id("households"),
    driverId: v.id("guardians"),
    vehicleId: v.optional(v.id("vehicles")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    parkedLat: v.optional(v.number()),
    parkedLng: v.optional(v.number()),
    parkedMapsUrl: v.optional(v.string()),
    outcome: v.optional(
      v.union(
        v.literal("ack_reminder"),
        v.literal("ack_alarm"),
        v.literal("escalated"),
      ),
    ),
    ackById: v.optional(v.id("guardians")),
  }).index("by_household", ["householdId"]),

  events: defineTable({
    tripId: v.id("trips"),
    type: v.union(
      v.literal("armed"),
      v.literal("trip_end"),
      v.literal("reminder_fired"),
      v.literal("alarm_fired"),
      v.literal("contacts_paged"),
      v.literal("all_clear"),
    ),
    at: v.number(),
  }).index("by_trip", ["tripId"]),
});
