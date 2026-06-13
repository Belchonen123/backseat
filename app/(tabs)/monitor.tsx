import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { Card, PrimaryButton, StatusDot } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import {
  SessionState,
  useSession,
  type PairedCar,
} from '@/state/session';
import { api } from '@/convex/_api';
import { useActiveHousehold } from '@/state/household';

/**
 * Monitor screen — two states in one file:
 *  - Idle / first-run: no car paired yet (teal anchor, CTA to pair + test drive).
 *  - Driving / armed: active monitoring (blue) with car + trigger details.
 *
 * Presentational only. Reads the FSM store (stubbed) and falls back to local
 * defaults so it type-checks and renders standalone.
 */
export default function MonitorScreen(): React.JSX.Element {
  const router = useRouter();

  // Guarded store access — optional chaining keeps this safe if the teammate's
  // real store shape differs at runtime.
  const state = useSession((s) => s?.state) ?? SessionState.Idle;
  const storeCar: PairedCar | null = useSession((s) => s?.car) ?? null;

  // "Is a car configured / who's my circle" facts come from Convex.
  const { householdId } = useActiveHousehold();
  const vehicles = useQuery(
    api.vehicles.listByHousehold,
    householdId ? { householdId } : 'skip',
  );
  const guardians = useQuery(
    api.guardians.listByHousehold,
    householdId ? { householdId } : 'skip',
  );

  const hasCar = (vehicles?.length ?? 0) > 0;
  const firstVehicle = vehicles && vehicles.length > 0 ? vehicles[0] : null;
  // Prefer the live FSM/session escalation state when a drive is in progress;
  // otherwise show armed only when a car is actually configured.
  const sessionArmed = state === SessionState.Monitoring;
  const armed = hasCar && (sessionArmed || vehicles !== undefined);

  // Feed the armed view from Convex vehicle facts, falling back to the store.
  const car: PairedCar | null = firstVehicle
    ? {
        id: firstVehicle._id,
        name: firstVehicle.label,
        trigger: firstVehicle.btName ? 'Bluetooth Disconnect' : 'GPS & motion',
      }
    : storeCar;

  const circleCount = guardians?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        {armed ? (
          <ArmedView
            car={car}
            circleCount={circleCount}
            onManualPark={() => router.push('/reminder')}
            onSafetyCircle={() => router.push('/safety-circle')}
            onTestDrive={() => router.push('/test-drive')}
          />
        ) : (
          <IdleView
            onPairAndArm={() => router.push('/pair-car')}
            onSafetyCircle={() => router.push('/safety-circle')}
            onTestDrive={() => router.push('/test-drive')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AppHeader(): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={styles.headerGlyph}>🛡️</Text>
      <Text style={styles.headerTitle}>BackSeat</Text>
    </View>
  );
}

function ArmedView({
  car,
  circleCount,
  onManualPark,
  onSafetyCircle,
  onTestDrive,
}: {
  car: PairedCar | null;
  circleCount: number;
  onManualPark: () => void;
  onSafetyCircle: () => void;
  onTestDrive: () => void;
}): React.JSX.Element {
  const carName = car?.name ?? 'Your Vehicle';
  const trigger = car?.trigger ?? 'Bluetooth Disconnect';

  return (
    <View style={styles.centeredBlock}>
      {/* Status core — critical status occupies the top region. */}
      <View style={styles.pulseCore}>
        <StatusDot color={colors.secondary} size={20} />
        <Text style={styles.activeLabel}>ACTIVE</Text>
      </View>
      <Text style={[styles.statusHeadline, { color: colors.secondary }]}>
        Monitoring Drive
      </Text>
      <Text style={styles.statusBody}>
        BackSeat is keeping watch while you are on the road.
      </Text>

      <View style={styles.detailStack}>
        <Card background={colors.surfaceContainerLowest}>
          <DetailRow label="Car" value={carName} />
        </Card>
        <Card background={colors.surfaceContainerLowest}>
          <DetailRow label="Trip-end trigger" value={trigger} />
        </Card>
        <Card background={colors.surfaceContainerLowest}>
          <DetailRow
            label="Safety circle"
            value={`${circleCount} ${circleCount === 1 ? 'contact' : 'contacts'}`}
          />
        </Card>
      </View>

      <PrimaryButton
        label="Manual Park"
        color={colors.secondary}
        textColor={colors.onSecondary}
        onPress={onManualPark}
        accessibilityHint="Ends the trip now and starts the back-seat reminder"
        style={styles.actionBtn}
      />
      <View style={styles.linkRow}>
        <PrimaryButton
          label="Safety Circle"
          color={colors.surfaceContainerHigh}
          textColor={colors.onSurface}
          onPress={onSafetyCircle}
          style={styles.linkBtn}
        />
        <PrimaryButton
          label="Test Drive"
          color={colors.surfaceContainerHigh}
          textColor={colors.onSurface}
          onPress={onTestDrive}
          style={styles.linkBtn}
        />
      </View>
      <Text style={styles.disclaimer}>
        BackSeat detects when a trip ends — it is a reminder aid. It does not
        detect children, and cannot help if a child climbs into a parked car
        alone.
      </Text>
    </View>
  );
}

function IdleView({
  onPairAndArm,
  onSafetyCircle,
  onTestDrive,
}: {
  onPairAndArm: () => void;
  onSafetyCircle: () => void;
  onTestDrive: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.centeredBlock}>
      <View style={[styles.pulseCore, { backgroundColor: colors.primaryContainer }]}>
        <Text style={styles.coreGlyph}>🚗</Text>
        <Text style={[styles.activeLabel, { color: colors.onPrimaryContainer }]}>
          READY
        </Text>
      </View>
      <Text style={[styles.statusHeadline, { color: colors.primary }]}>
        No Car Paired Yet
      </Text>
      <Text style={styles.statusBody}>
        Pair your vehicle so BackSeat can remind you to check the back seat when
        a trip ends.
      </Text>

      <View style={styles.detailStack}>
        <PrimaryButton
          label="Pair My Car"
          onPress={onPairAndArm}
          accessibilityHint="Begins pairing your vehicle"
        />
        <PrimaryButton
          label="Run a Test Drive"
          color={colors.surfaceContainerHigh}
          textColor={colors.onSurface}
          onPress={onTestDrive}
        />
        <PrimaryButton
          label="Safety Circle"
          color={colors.surfaceContainerHigh}
          textColor={colors.onSurface}
          onPress={onSafetyCircle}
        />
      </View>

      <Text style={styles.disclaimer}>
        BackSeat is a reminder aid that triggers when a trip ends. It does not
        detect children and does not guarantee safety.
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View>
      <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: spacing.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
    backgroundColor: colors.primaryContainer,
  },
  headerGlyph: {
    fontSize: 20,
  },
  headerTitle: {
    ...type.headlineLgMobile,
    color: colors.onPrimaryContainer,
  },
  scroll: {
    padding: spacing.marginMobile,
    paddingBottom: spacing.stackLg,
    flexGrow: 1,
  },
  centeredBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.stackMd,
  },
  pulseCore: {
    width: 176,
    height: 176,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  coreGlyph: {
    fontSize: 48,
  },
  activeLabel: {
    ...type.labelMd,
    color: colors.onSecondaryContainer,
    letterSpacing: 3,
  },
  statusHeadline: {
    ...type.headlineLg,
    textAlign: 'center',
  },
  statusBody: {
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 300,
  },
  detailStack: {
    width: '100%',
    gap: spacing.gutter,
  },
  actionBtn: {
    marginTop: spacing.base,
  },
  linkRow: {
    flexDirection: 'row',
    gap: spacing.gutter,
    width: '100%',
  },
  linkBtn: {
    flex: 1,
  },
  detailLabel: {
    ...type.labelMd,
    color: colors.onSurfaceVariant,
  },
  detailValue: {
    ...type.titleMd,
    color: colors.onSurface,
    marginTop: 2,
  },
  disclaimer: {
    ...type.labelMd,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.gutter,
  },
});
