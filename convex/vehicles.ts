import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByHousehold = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    return await ctx.db
      .query("vehicles")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect();
  },
});

export const add = mutation({
  args: {
    householdId: v.id("households"),
    label: v.string(),
    btDeviceId: v.optional(v.string()),
    btName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vehicles", args);
  },
});

export const remove = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    await ctx.db.delete(vehicleId);
  },
});
