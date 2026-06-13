import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { Card, StatusDot } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import type { TripOutcome } from '@/state/session';
import { api } from '@/convex/_api';
import { useHouseholdStore } from '@/state/household';

interface TripLogEntry {
  id: string;
  date: string;
  time: string;
  location: string;
  outcome: TripOutcome;
}

function formatRow(endedAt: number | undefined): { date: string; time: string } {
  if (!endedAt) return { date: '—', time: '' };
  const d = new Date(endedAt);
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

const OUTCOME_META: Record<
  TripOutcome,
  { label: string; color: string; onColor: string; glyph: string }
> = {
  ack_reminder: {
    label: 'Cleared on reminder',
    color: colors.primaryContainer,
    onColor: colors.onPrimaryContainer,
    glyph: '✓',
  },
  ack_alarm: {
    label: 'Cleared on alarm',
    color: colors.tertiaryContainer,
    onColor: colors.onTertiaryContainer,
    glyph: '!',
  },
  escalated: {
    label: 'Escalated to circle',
    color: colors.error,
    onColor: colors.onError,
    glyph: '⚠',
  },
};

export default function HistoryScreen(): React.JSX.Element {
  const householdId = useHouseholdStore((s) => s.householdId);
  // Live Convex query — skipped until a household is selected.
  const trips = useQuery(
    api.trips.listByHousehold,
    householdId ? { householdId } : 'skip',
  );

  const entries: TripLogEntry[] = (trips ?? [])
    .filter((t) => t.outcome)
    .map((t) => {
      const { date, time } = formatRow(t.endedAt);
      return {
        id: t._id,
        date,
        time,
        location: t.parkedMapsUrl ?? 'Parked location',
        outcome: t.outcome as TripOutcome,
      };
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BackSeat</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Trip History</Text>
        <Text style={styles.subtitle}>
          A log of every trip-end reminder and how it was resolved.
        </Text>

        {entries.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No trips recorded yet.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {entries.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripRow({ trip }: { trip: TripLogEntry }): React.JSX.Element {
  const meta = OUTCOME_META[trip.outcome];
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <StatusDot color={meta.color} size={12} halo />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{trip.location}</Text>
            <Text style={styles.rowMeta}>
              {trip.date} · {trip.time}
            </Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: meta.color }]}>
          <Text style={[styles.badgeText, { color: meta.onColor }]}>
            {meta.glyph} {meta.label}
          </Text>
        </View>
      </View>
    </Card>
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
  pageTitle: { ...type.headlineLgMobile, color: colors.primary },
  subtitle: {
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.base,
    marginBottom: spacing.stackMd,
  },
  list: { gap: spacing.stackSm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.gutter,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackSm,
    flexShrink: 1,
  },
  rowText: { flexShrink: 1 },
  rowTitle: { ...type.titleMd, color: colors.onSurface },
  rowMeta: { ...type.bodyMd, color: colors.onSurfaceVariant },
  badge: {
    paddingHorizontal: spacing.stackSm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  badgeText: { ...type.labelMd, fontSize: 12 },
  empty: { ...type.bodyMd, color: colors.onSurfaceVariant },
});
