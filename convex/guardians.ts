import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const role = v.union(v.literal("primary"), v.literal("secondary"));

export const listByHousehold = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    return await ctx.db
      .query("guardians")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
  },
});

export const add = mutation({
  args: {
    householdId: v.id("households"),
    userId: v.string(),
    name: v.string(),
    phone: v.string(),
    role,
    isEscalationContact: v.boolean(),
    fcmToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("guardians", args);
  },
});

export const update = mutation({
  args: {
    guardianId: v.id("guardians"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(role),
    isEscalationContact: v.optional(v.boolean()),
  },
  handler: async (ctx, { guardianId, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(guardianId, clean);
  },
});

export const remove = mutation({
  args: { guardianId: v.id("guardians") },
  handler: async (ctx, { guardianId }) => {
    await ctx.db.delete(guardianId);
  },
});

/** Store/refresh a guardian's FCM token for push escalation. */
export const setFcmToken = mutation({
  args: { guardianId: v.id("guardians"), fcmToken: v.string() },
  handler: async (ctx, { guardianId, fcmToken }) => {
    await ctx.db.patch(guardianId, { fcmToken });
  },
});
