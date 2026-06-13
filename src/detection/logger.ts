/**
 * Structured detection logger (Build Brief §9: "you will live in these logs
 * during road tests"). In-memory ring buffer + console mirror + subscribe, so
 * the debug screen can render every state change, activity transition, BT event,
 * and location fix in real time.
 */
export type LogKind =
  | "fsm"
  | "detection"
  | "activity"
  | "bluetooth"
  | "location"
  | "effect"
  | "error";

export interface LogEntry {
  seq: number;
  at: number;
  kind: LogKind;
  msg: string;
  data?: unknown;
}

export class DetectionLogger {
  private buffer: LogEntry[] = [];
  private seq = 0;
  private listeners = new Set<(entries: LogEntry[]) => void>();

  constructor(private readonly capacity = 500) {}

  log(kind: LogKind, msg: string, data?: unknown, at: number = Date.now()): void {
    const entry: LogEntry = { seq: this.seq++, at, kind, msg, data };
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }
    // Mirror to console for adb logcat / Metro during road tests.
    // eslint-disable-next-line no-console
    console.log(`[${kind}] ${msg}`, data ?? "");
    for (const l of this.listeners) l(this.buffer);
  }

  entries(): readonly LogEntry[] {
    return this.buffer;
  }

  subscribe(fn: (entries: LogEntry[]) => void): () => void {
    this.listeners.add(fn);
    fn(this.buffer);
    return () => {
      this.listeners.delete(fn);
    };
  }

  clear(): void {
    this.buffer = [];
    for (const l of this.listeners) l(this.buffer);
  }
}

/** App-wide singleton used by the detection service and debug screen. */
export const detectionLog = new DetectionLogger();
