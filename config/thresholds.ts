/**
 * All tunable detection + escalation numbers live here (Build Brief §3).
 * Nothing in the FSM or handlers should hard-code these inline — tune on the road.
 */
export const thresholds = {
  /** Sustained IN_VEHICLE time before a drive is "confirmed" (arming rule). */
  DRIVE_CONFIRM_SECONDS: 90,
  /** ...or distance travelled, whichever comes first. */
  DRIVE_CONFIRM_METERS: 800,
  /** REMINDER -> ALARM if no single-tap ack. */
  REMINDER_TO_ALARM_SECONDS: 45,
  /** ALARM -> NOTIFY_CONTACTS if no hold-to-confirm ack (~3 min total from trip end). */
  ALARM_TO_NOTIFY_SECONDS: 135,
} as const;

export type Thresholds = typeof thresholds;
