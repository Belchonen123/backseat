import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db.insert("households", { name });
  },
});

export const get = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, { householdId }) => {
    return await ctx.db.get(householdId);
  },
});

/**
 * Recover the signed-in user's household from the server, keyed on their Clerk
 * identity — so a cold start (which drops in-memory state) can restore which
 * household is theirs. Returns null when unauthenticated or not yet onboarded.
 * Requires the Clerk "convex" JWT template; if that isn't configured,
 * getUserIdentity() is null and callers fall back to the locally-cached id.
 */
export const forCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const guardian = await ctx.db
      .query("guardians")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    if (!guardian) return null;
    const household = await ctx.db.get(guardian.householdId);
    if (!household) return null;
    return { householdId: guardian.householdId, household, guardian };
  },
});
