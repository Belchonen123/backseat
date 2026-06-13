# Convex backend — BackSeat

Live dev deployment: `dev:effervescent-rabbit-158`
URL: https://effervescent-rabbit-158.convex.cloud

Deploy / push functions:

```
$env:CONVEX_DEPLOY_KEY = "<dev deploy key>"
npx convex dev --once        # push schema + functions to the dev deployment
```

Env vars to set in the Convex dashboard (Settings → Environment Variables):
- `FCM_SERVER_KEY` — Firebase Cloud Messaging legacy server key (escalation push).
