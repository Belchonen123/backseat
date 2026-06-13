import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Card, GhostButton, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import {
  evaluateHealth,
  type HealthItem,
  type HealthKey,
} from '@/health/systemHealth';
import { deviceProbes, requestLocationPermissions } from '@/detection/permissions';
import { requestNotificationPermission, openBatterySettings } from '@/alerts';

/**
 * Protection Paused / system health. Reads REAL device permission/radio state
 * via evaluateHealth(deviceProbes) — not a hardcoded list — and re-checks every
 * time the screen regains focus (e.g. after the user returns from OS settings).
 * Each "Fix" performs a real action: an in-app permission prompt where the OS
 * allows it, otherwise it deep-links to the relevant settings screen. Fail loud:
 * monitoring stays blocked until every required input is satisfied.
 */
interface ItemMeta {
  detail: string;
  glyph: string;
}

const META: Record<HealthKey, ItemMeta> = {
  fineLocation: { detail: 'Records where a trip ended.', glyph: '📍' },
  backgroundLocation: {
    detail: 'Lets BackSeat detect trip-end while in your pocket.',
    glyph: '🛰️',
  },
  activityRecognition: {
    detail: 'Distinguishes driving from walking.',
    glyph: '🚶',
  },
  bluetooth: { detail: 'Detects when you disconnect from the car.', glyph: '🔵' },
  notifications: { detail: 'Delivers the reminder and alarm.', glyph: '🔔' },
  fullScreenIntent: {
    detail: 'Shows the alarm over the lock screen.',
    glyph: '🖥️',
  },
  batteryExemption: {
    detail: 'Stops the OS killing background monitoring.',
    glyph: '🔋',
  },
};

export default function ProtectionPausedScreen(): React.JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<HealthItem[] | null>(null);
  const [busy, setBusy] = useState<HealthKey | null>(null);

  const recheck = useCallback(async (): Promise<void> => {
    const report = await evaluateHealth(deviceProbes);
    setItems(report.items);
  }, []);

  // Re-evaluate on every focus so returning from OS settings refreshes state.
  useFocusEffect(
    useCallback(() => {
      void recheck();
    }, [recheck]),
  );

  const required = items?.filter((i) => i.required) ?? [];
  const optional = items?.filter((i) => !i.required) ?? [];
  const allOk = items != null && required.every((i) => i.ok);

  const fix = async (key: HealthKey): Promise<void> => {
    setBusy(key);
    try {
      switch (key) {
        case 'fineLocation':
        case 'backgroundLocation':
          await requestLocationPermissions();
          break;
        case 'notifications':
          await requestNotificationPermission();
          break;
        case 'batteryExemption':
          await openBatterySettings();
          break;
        default:
          // No in-app prompt available (activity / Bluetooth / full-screen
          // intent) — send the user to the app's OS settings to toggle it.
          await Linking.openSettings();
          break;
      }
      await recheck();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.banner}>
          <Text style={styles.bannerGlyph}>{allOk ? '🛡️' : '⚠️'}</Text>
          <Text style={styles.bannerTitle}>
            {items == null
              ? 'Checking…'
              : allOk
                ? 'Protection Ready'
                : 'Protection Paused'}
          </Text>
          <Text style={styles.bannerBody}>
            {items == null
              ? 'Reading your device permissions…'
              : allOk
                ? 'All required permissions are granted. You can resume monitoring.'
                : 'Your safety net is inactive because of missing system permissions.'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>REQUIRED</Text>
        <View style={styles.list}>
          {required.map((r) => (
            <HealthRow
              key={r.key}
              item={r}
              busy={busy === r.key}
              onFix={() => void fix(r.key)}
            />
          ))}
        </View>

        {optional.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>OPTIONAL</Text>
            <View style={styles.list}>
              {optional.map((r) => (
                <HealthRow
                  key={r.key}
                  item={r}
                  busy={busy === r.key}
                  onFix={() => void fix(r.key)}
                />
              ))}
            </View>
          </>
        ) : null}

        <PrimaryButton
          label="Resume Protection"
          disabled={!allOk}
          onPress={() => router.back()}
          style={styles.resume}
        />
        <GhostButton
          color={colors.onSurfaceVariant}
          label="Re-check"
          onPress={() => void recheck()}
        />
        <Text style={styles.footnote}>
          Resolve every required item to re-enable monitoring. BackSeat is a
          reminder aid and cannot protect a child while paused.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthRow({
  item,
  busy,
  onFix,
}: {
  item: HealthItem;
  busy: boolean;
  onFix: () => void;
}): React.JSX.Element {
  const meta = META[item.key];
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.iconBox}>
            <Text style={styles.iconGlyph}>{meta.glyph}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{item.label}</Text>
            <Text style={styles.rowDetail}>{meta.detail}</Text>
          </View>
        </View>
        {item.ok ? (
          <View style={styles.okPill}>
            <Text style={styles.okText}>OK</Text>
          </View>
        ) : (
          <GhostButton
            label={busy ? '…' : 'Fix'}
            color={colors.primary}
            onPress={onFix}
            disabled={busy}
            style={styles.fixBtn}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackMd },
  banner: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.stackMd,
    alignItems: 'center',
    gap: spacing.base,
  },
  bannerGlyph: { fontSize: 40 },
  bannerTitle: { ...type.headlineLgMobile, color: colors.onSurface },
  bannerBody: {
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 300,
  },
  sectionLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  list: { gap: spacing.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.gutter,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gutter,
    flexShrink: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 22 },
  rowText: { flexShrink: 1 },
  rowTitle: { ...type.titleMd, color: colors.onSurface },
  rowDetail: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  fixBtn: { width: 96 },
  okPill: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
  },
  okText: { ...type.labelMd, color: colors.onPrimaryContainer },
  resume: { marginTop: spacing.base },
  footnote: {
    ...type.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.gutter,
  },
});
