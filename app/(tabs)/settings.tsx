import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { api } from '@/convex/_api';
import { useActiveHousehold } from '@/state/household';
import { useSettingsStore } from '@/state/settings';

interface NavRow {
  key: string;
  label: string;
  value?: string;
  glyph: string;
  onPress: () => void;
  /** Renders greyed + non-tappable with a "Soon" badge. */
  disabled?: boolean;
}

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { signOut } = useAuth();
  const { householdId } = useActiveHousehold();

  const loudReminder = useSettingsStore((s) => s.loudReminder);
  const shareLocation = useSettingsStore((s) => s.shareLocationOnEscalation);
  const reminderToAlarm = useSettingsStore((s) => s.reminderToAlarmSeconds);
  const alarmToNotify = useSettingsStore((s) => s.alarmToNotifySeconds);
  const setSetting = useSettingsStore((s) => s.set);

  const guardians = useQuery(
    api.guardians.listByHousehold,
    householdId ? { householdId } : 'skip',
  );
  const secondaryCount = guardians?.filter((g) => g.role === 'secondary').length ?? 0;
  const circleValue =
    guardians === undefined
      ? '…'
      : `${secondaryCount} ${secondaryCount === 1 ? 'secondary' : 'secondaries'}`;

  const escalationValue = `${reminderToAlarm}s → ${Math.round(
    (reminderToAlarm + alarmToNotify) / 60,
  )} min`;

  const alarmRows: NavRow[] = [
    {
      key: 'sound',
      label: 'Alarm sound',
      value: 'Default',
      glyph: '🔊',
      onPress: () => router.push('/alarm-sound'),
    },
    {
      key: 'escalation',
      label: 'Escalation timing',
      value: escalationValue,
      glyph: '⏱',
      onPress: () => router.push('/escalation-timing'),
    },
  ];

  const householdRows: NavRow[] = [
    {
      key: 'circle',
      label: 'Safety Circle',
      value: circleValue,
      glyph: '👥',
      onPress: () => router.push('/safety-circle'),
    },
    {
      key: 'health',
      label: 'System health',
      value: 'Check permissions',
      glyph: '🩺',
      onPress: () => router.push('/protection-paused'),
    },
  ];

  const accountRows: NavRow[] = [
    {
      key: 'profile',
      label: 'Profile',
      glyph: '👤',
      onPress: () => router.push('/profile'),
    },
    {
      key: 'testdrive',
      label: 'Run a test drive',
      glyph: '🚗',
      onPress: () => router.push('/test-drive'),
    },
    {
      key: 'debug',
      label: 'Detection debug',
      value: 'Dev',
      glyph: '🛠',
      onPress: () => router.push('/debug'),
    },
    {
      key: 'about',
      label: 'About & disclaimers',
      glyph: 'ℹ️',
      onPress: () => router.push('/about'),
    },
  ];

  const confirmSignOut = (): void => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BackSeat</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Settings</Text>

        <SectionLabel>Alarm</SectionLabel>
        <View style={styles.group}>
          <ToggleRow
            glyph="📣"
            label="Audible reminder chime"
            value={loudReminder}
            onChange={(v) => setSetting('loudReminder', v)}
          />
          {alarmRows.map((r) => (
            <NavRowItem key={r.key} row={r} />
          ))}
        </View>

        <SectionLabel>Household</SectionLabel>
        <View style={styles.group}>
          <ToggleRow
            glyph="📍"
            label="Share parked location on escalation"
            value={shareLocation}
            onChange={(v) => setSetting('shareLocationOnEscalation', v)}
          />
          {householdRows.map((r) => (
            <NavRowItem key={r.key} row={r} />
          ))}
        </View>

        <SectionLabel>Account</SectionLabel>
        <View style={styles.group}>
          {accountRows.map((r) => (
            <NavRowItem key={r.key} row={r} />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          BackSeat is a reminder aid triggered by trip-end. It does not detect
          children and is not a medical or life-safety device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <Text style={styles.sectionLabel}>{String(children).toUpperCase()}</Text>;
}

function NavRowItem({ row }: { row: NavRow }): React.JSX.Element {
  if (row.disabled) {
    return (
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.row, styles.rowDisabled]}
      >
        <Text style={[styles.rowGlyph, styles.dim]}>{row.glyph}</Text>
        <Text style={[styles.rowLabel, styles.dim]}>{row.label}</Text>
        <View style={styles.rowTrailing}>
          {row.value ? <Text style={[styles.rowValue, styles.dim]}>{row.value}</Text> : null}
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>SOON</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={row.onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.rowGlyph}>{row.glyph}</Text>
      <Text style={styles.rowLabel}>{row.label}</Text>
      <View style={styles.rowTrailing}>
        {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

function ToggleRow({
  glyph,
  label,
  value,
  onChange,
}: {
  glyph: string;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowGlyph}>{glyph}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.outlineVariant }}
        thumbColor={colors.surfaceContainerLowest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    height: spacing.touchTargetMin,
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
    backgroundColor: colors.primaryContainer,
  },
  headerTitle: { ...type.headlineLgMobile, color: colors.onPrimaryContainer },
  scroll: { padding: spacing.marginMobile, paddingBottom: spacing.stackLg },
  pageTitle: {
    ...type.headlineLgMobile,
    color: colors.primary,
    marginBottom: spacing.stackMd,
  },
  sectionLabel: {
    ...type.labelMd,
    color: colors.outline,
    letterSpacing: 1.5,
    marginTop: spacing.stackMd,
    marginBottom: spacing.stackSm,
  },
  group: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackSm,
    paddingHorizontal: spacing.gutter,
    minHeight: spacing.touchTargetMin + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  rowPressed: { backgroundColor: colors.surfaceContainerHigh },
  rowDisabled: { opacity: 1 },
  dim: { opacity: 0.45 },
  rowGlyph: { fontSize: 20, width: 28, textAlign: 'center' },
  rowLabel: { ...type.bodyLg, color: colors.onSurface, flex: 1 },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  rowValue: { ...type.bodyMd, color: colors.onSurfaceVariant },
  chevron: { fontSize: 24, color: colors.outline },
  soonBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 2,
  },
  soonText: { ...type.labelMd, fontSize: 10, color: colors.onSurfaceVariant, letterSpacing: 1 },
  signOut: {
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.stackMd,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  signOutText: { ...type.titleMd, color: colors.error },
  disclaimer: {
    ...type.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.stackLg,
    paddingHorizontal: spacing.gutter,
  },
});
