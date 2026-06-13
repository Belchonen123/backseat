import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton, GhostButton } from "@/components";
import { colors, spacing, type } from "@/theme/tokens";
import { detectionService } from "@/detection/runtime";
import { detectionLog, type LogEntry } from "@/detection/logger";
import type { FsmStateName } from "@/fsm/machine";
import {
  startTracking,
  stopTracking,
} from "@/detection/locationTask";

/**
 * Sprint 0 debug screen (Build Brief §8). NO styled product UI — a live state
 * readout + the structured detection log, plus simulator buttons so the whole
 * pipeline (arming -> trip-end -> reminder -> alarm -> escalation) can be
 * exercised before/independent of real GPS. On the road you watch this screen.
 */
const KIND_COLOR: Record<string, string> = {
  fsm: colors.secondary,
  detection: colors.primary,
  activity: colors.tertiary,
  bluetooth: colors.secondary,
  location: colors.onSurfaceVariant,
  effect: colors.primary,
  error: colors.error,
};

export default function DebugScreen(): React.JSX.Element {
  const [state, setState] = useState<FsmStateName>(detectionService.getState().name);
  const [entries, setEntries] = useState<readonly LogEntry[]>(detectionLog.entries());
  const [tracking, setTracking] = useState(false);
  const [t, setT] = useState(0); // simulated clock for the fake-drive buttons

  useEffect(() => {
    const offState = detectionService.subscribe((s) => setState(s.name));
    const offLog = detectionLog.subscribe((e) => setEntries([...e]));
    return () => {
      offState();
      offLog();
    };
  }, []);

  function simDrive() {
    // Two IN_VEHICLE fixes 95s apart -> DRIVE_CONFIRMED.
    detectionService.ingestLocation({ lat: 37.42, lng: -122.08, speedMps: 14, at: t });
    detectionService.ingestLocation({ lat: 37.43, lng: -122.08, speedMps: 14, at: t + 95_000 });
    setT(t + 96_000);
  }
  function simPark() {
    // Three sustained slow fixes -> activity ON_FOOT -> TRIP_ENDED -> REMINDER.
    for (let i = 1; i <= 3; i++) {
      detectionService.ingestLocation({
        lat: 37.43,
        lng: -122.08,
        speedMps: 0.3,
        at: t + i * 1000,
      });
    }
    setT(t + 4000);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Detection Debug</Text>
        <View style={[styles.statePill, { backgroundColor: stateColor(state) }]}>
          <Text style={styles.stateText}>{state}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <PrimaryButton label="Simulate drive (confirm)" onPress={simDrive} />
        <PrimaryButton label="Simulate park (trip-end)" color={colors.tertiaryContainer} onPress={simPark} />
        <View style={styles.row}>
          <View style={styles.half}>
            <GhostButton label="BT disconnect" onPress={() => detectionService.onBluetoothDisconnect(t)} />
          </View>
          <View style={styles.half}>
            <GhostButton label="Acknowledge" onPress={() => detectionService.acknowledge(t)} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <GhostButton
              label={tracking ? "Stop GPS" : "Start GPS"}
              color={colors.secondary}
              onPress={async () => {
                if (tracking) await stopTracking();
                else await startTracking();
                setTracking(!tracking);
              }}
            />
          </View>
          <View style={styles.half}>
            <GhostButton label="Reset" color={colors.error} onPress={() => detectionService.reset(t)} />
          </View>
        </View>
        <GhostButton label="Clear log" onPress={() => detectionLog.clear()} />
      </View>

      <ScrollView style={styles.log} contentContainerStyle={styles.logContent}>
        {[...entries].reverse().map((e) => (
          <View key={e.seq} style={styles.logRow}>
            <Text style={[styles.logKind, { color: KIND_COLOR[e.kind] ?? colors.onSurface }]}>
              {e.kind}
            </Text>
            <Text style={styles.logMsg}>
              {e.msg}
              {e.data ? `  ${JSON.stringify(e.data)}` : ""}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function stateColor(s: FsmStateName): string {
  switch (s) {
    case "DRIVING":
      return colors.secondaryContainer;
    case "REMINDER":
      return colors.tertiaryContainer;
    case "ALARM":
    case "NOTIFY_CONTACTS":
      return colors.error;
    case "ALL_CLEAR":
      return colors.primaryContainer;
    default:
      return colors.surfaceContainerHigh;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.stackSm,
  },
  title: { ...type.titleMd, color: colors.onSurface },
  statePill: { paddingHorizontal: spacing.gutter, paddingVertical: 6, borderRadius: 9999 },
  stateText: { ...type.labelMd, color: colors.onSurface },
  controls: { paddingHorizontal: spacing.marginMobile, gap: spacing.base },
  row: { flexDirection: "row", gap: spacing.base },
  half: { flex: 1 },
  log: {
    flex: 1,
    marginTop: spacing.stackSm,
    backgroundColor: "#0b1220",
  },
  logContent: { padding: spacing.gutter, gap: 4 },
  logRow: { flexDirection: "row", gap: spacing.base },
  logKind: { fontFamily: "Inter", fontSize: 11, fontWeight: "700", width: 64 },
  logMsg: { fontFamily: "Inter", fontSize: 11, color: "#cbd5e1", flex: 1 },
});
