/**
 * SystemHealth (Build Brief §4 / non-negotiable #2). Continuously observe the
 * inputs the app needs to actually protect. When ANY required input is missing,
 * the UI must drive to Protection Paused and the "armed" state must be blocked.
 * Fail loud, never silent.
 *
 * The probe functions are injected so this is testable off-device; the real app
 * wires them to expo-location / native permission + radio checks.
 */
export type HealthKey =
  | "fineLocation"
  | "backgroundLocation"
  | "activityRecognition"
  | "bluetooth"
  | "notifications"
  | "fullScreenIntent"
  | "batteryExemption";

export interface HealthItem {
  key: HealthKey;
  label: string;
  required: boolean;
  ok: boolean;
}

export const HEALTH_LABELS: Record<HealthKey, string> = {
  fineLocation: "Precise location",
  backgroundLocation: "Background location",
  activityRecognition: "Physical activity",
  bluetooth: "Bluetooth",
  notifications: "Notifications",
  fullScreenIntent: "Full-screen alarm",
  batteryExemption: "No battery optimization",
};

export type HealthProbes = Record<HealthKey, () => Promise<boolean>>;

export interface HealthReport {
  items: HealthItem[];
  /** True only when every REQUIRED input is satisfied. */
  protected: boolean;
}

const REQUIRED: HealthKey[] = [
  "fineLocation",
  "backgroundLocation",
  "activityRecognition",
  "notifications",
  "fullScreenIntent",
  "batteryExemption",
];

export async function evaluateHealth(probes: HealthProbes): Promise<HealthReport> {
  const keys = Object.keys(HEALTH_LABELS) as HealthKey[];
  const items: HealthItem[] = [];
  for (const key of keys) {
    const ok = await probes[key]();
    items.push({
      key,
      label: HEALTH_LABELS[key],
      required: REQUIRED.includes(key),
      ok,
    });
  }
  const isProtected = items
    .filter((i) => i.required)
    .every((i) => i.ok);
  return { items, protected: isProtected };
}
