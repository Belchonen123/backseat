import { ConvexHttpClient } from "convex/browser";

const url = "https://effervescent-rabbit-158.convex.cloud";
const c = new ConvexHttpClient(url);

const hid = await c.mutation("households:create", { name: "Smoke Test Household" });
console.log("household:", hid);

const gid = await c.mutation("guardians:add", {
  householdId: hid,
  userId: "u_primary",
  name: "Primary Parent",
  phone: "+15551234567",
  role: "primary",
  isEscalationContact: false,
});
console.log("guardian:", gid);

await c.mutation("guardians:add", {
  householdId: hid,
  userId: "u_secondary",
  name: "Secondary Guardian",
  phone: "+15557654321",
  role: "secondary",
  isEscalationContact: true,
  fcmToken: "demo-token",
});

const tid = await c.mutation("trips:start", {
  householdId: hid,
  driverId: gid,
  startedAt: Date.now() - 600000,
});
await c.mutation("trips:end", {
  tripId: tid,
  endedAt: Date.now(),
  parkedLat: 37.4219,
  parkedLng: -122.0841,
});
await c.mutation("trips:resolve", {
  tripId: tid,
  outcome: "ack_reminder",
  ackById: gid,
  at: Date.now(),
});

const guardians = await c.query("guardians:listByHousehold", { householdId: hid });
const trips = await c.query("trips:listByHousehold", { householdId: hid });
const detail = await c.query("trips:get", { tripId: tid });
console.log("guardians:", guardians.length, guardians.map((g) => g.name));
console.log("trips:", trips.length, "parkedMapsUrl:", trips[0]?.parkedMapsUrl);
console.log("events:", detail.events.map((e) => e.type));
console.log("SMOKE OK");
