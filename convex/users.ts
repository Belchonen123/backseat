import { query } from "./_generated/server";

/** The authenticated caller's Clerk identity, or null if signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      userId: identity.subject,
      name: identity.name ?? null,
      email: identity.email ?? null,
    };
  },
});
