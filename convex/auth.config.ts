/**
 * Convex auth: trust JWTs minted by this app's Clerk instance. Requires a Clerk
 * JWT template named "convex" (aud claim = "convex"). Issuer domain comes from
 * the Clerk publishable key (apt-kiwi-45.clerk.accounts.dev).
 */
export default {
  providers: [
    {
      domain:
        process.env.CLERK_JWT_ISSUER_DOMAIN ??
        "https://apt-kiwi-45.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
