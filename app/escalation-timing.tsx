import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GhostButton, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import {
  TIMING_BOUNDS,
  clampTiming,
  useSettingsStore,
} from '@/state/settings';

/**
 * Escalation timing editor. Lets the caregiver tune the two safety-of-life
 * grace periods within hard bounds:
 *   - REMINDER -> ALARM   (how long the gentle reminder waits before the alarm)
 *   - ALARM    -> NOTIFY  (how long the alarm sounds before paging the circle)
 *
 * Values persist to the device secure store and are read live by the detection
 * runtime at each timer start, so a change takes effect on the NEXT trip. The
 * change does NOT alter an alarm already in progress (mute != resolve).
 */
const STEP_SECONDS = 15;

export default function EscalationTimingScreen(): React.JSX.Element {
  const router = useRouter();
  const storedReminder = useSettingsStore((s) => s.reminderToAlarmSeconds);
  const storedAlarm = useSettingsStore((s) => s.alarmToNotifySeconds);
  const setSetting = useSettingsStore((s) => s.set);

  const [reminder, setReminder] = useState(storedReminder);
  const [alarm, setAlarm] = useState(storedAlarm);

  const dirty = reminder !== storedReminder || alarm !== storedAlarm;
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = (): void => {
    setSetting('reminderToAlarmSeconds', clampTiming('reminderToAlarmSeconds', reminder));
    setSetting('alarmToNotifySeconds', clampTiming('alarmToNotifySeconds', alarm));
    setSavedAt(Date.now());
  };

  const reset = (): void => {
    // Restore to the currently-saved values (not the tuned defaults).
    setReminder(storedReminder);
    setAlarm(storedAlarm);
    setSavedAt(null);
  };

  const totalMin = Math.round((reminder + alarm) / 60);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Escalation timing</Text>
        <Text style={styles.intro}>
          How long BackSeat waits at each step after a trip ends. Shorter is more
          aggressive; longer gives you more time before your Safety Circle is paged.
        </Text>

        <Stepper
          label="Reminder → Alarm"
          help="Gentle reminder shows first. If you don't tap it, the loud alarm starts after this long."
          seconds={reminder}
          bounds={TIMING_BOUNDS.reminderToAlarmSeconds}
          onChange={(v) => {
            setReminder(v);
            setSavedAt(null);
          }}
        />

        <Stepper
          label="Alarm → Notify circle"
          help="The loud alarm sounds for this long. If still unacknowledged, your Safety Circle is paged."
          seconds={alarm}
          bounds={TIMING_BOUNDS.alarmToNotifySeconds}
          onChange={(v) => {
            setAlarm(v);
            setSavedAt(null);
          }}
        />

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL TIME TO ESCALATION</Text>
          <Text style={styles.totalValue}>
            {formatSeconds(reminder + alarm)} (~{totalMin} min)
          </Text>
          <Text style={styles.totalNote}>
            Measured from the moment a trip ends to when your circle is contacted.
          </Text>
        </View>

        <PrimaryButton
          label={saving(savedAt, dirty)}
          onPress={save}
          disabled={!dirty}
          style={styles.save}
        />
        {dirty ? (
          <GhostButton color={colors.onSurfaceVariant} label="Reset" onPress={reset} />
        ) : null}

        <Text style={styles.footnote}>
          New timing applies to your next trip. It never shortens an alarm already
          in progress — BackSeat is a reminder aid, not a life-safety device.
        </Text>

        <GhostButton color={colors.onSurfaceVariant} label="Back" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function saving(savedAt: number | null, dirty: boolean): string {
  if (dirty) return 'Save timing';
  return savedAt ? 'Saved ✓' : 'Up to date';
}

function formatSeconds(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function Stepper({
  label,
  help,
  seconds,
  bounds,
  onChange,
}: {
  label: string;
  help: string;
  seconds: number;
  bounds: { min: number; max: number };
  onChange: (next: number) => void;
}): React.JSX.Element {
  const dec = (): void => onChange(Math.max(bounds.min, seconds - STEP_SECONDS));
  const inc = (): void => onChange(Math.min(bounds.max, seconds + STEP_SECONDS));
  const atMin = seconds <= bounds.min;
  const atMax = seconds >= bounds.max;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <View style={styles.stepper}>
        <StepBtn glyph="−" onPress={dec} disabled={atMin} />
        <View style={styles.valueBox}>
          <Text style={styles.value}>{formatSeconds(seconds)}</Text>
        </View>
        <StepBtn glyph="+" onPress={inc} disabled={atMax} />
      </View>
      <Text style={styles.help}>{help}</Text>
      <Text style={styles.range}>
        Allowed {formatSeconds(bounds.min)}–{formatSeconds(bounds.max)}
      </Text>
    </View>
  );
}

function StepBtn({
  glyph,
  onPress,
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <Text
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
    >
      {glyph}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackMd },
  title: { ...type.headlineLg, color: colors.primary },
  intro: { ...type.bodyMd, color: colors.onSurfaceVariant },
  field: { gap: spacing.base },
  fieldLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter },
  stepBtn: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    borderRadius: radius.button,
    backgroundColor: colors.primaryContainer,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
    lineHeight: spacing.touchTargetMin,
    fontSize: 28,
    fontWeight: '700',
    overflow: 'hidden',
  },
  stepBtnDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    color: colors.outline,
  },
  valueBox: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...type.titleMd, color: colors.onSurface },
  help: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  range: { ...type.labelMd, fontSize: 12, color: colors.outline },
  totalCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.card,
    padding: spacing.stackMd,
    gap: spacing.base,
  },
  totalLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  totalValue: { ...type.headlineLgMobile, color: colors.onSurface },
  totalNote: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  save: { marginTop: spacing.base },
  footnote: {
    ...type.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.gutter,
  },
});
