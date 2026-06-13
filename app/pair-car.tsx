import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { Card, GhostButton, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { api } from '@/convex/_api';
import { useActiveHousehold } from '@/state/household';
import {
  getBondedDevices,
  isNativeDetectionAvailable,
  type BondedDevice,
} from '../modules/backseat-detection';

/**
 * Pair My Car — registers a vehicle for the household.
 *
 * Two trip-end triggers, in order of confidence:
 *  - Bluetooth disconnect: if the user picks their car's paired audio device,
 *    we store its MAC and the native ACL receiver fires the instant they leave
 *    the car. Most reliable.
 *  - GPS + motion (default / fallback): used when no device is paired, or when
 *    running without the native build. Honest about which one is active.
 */
export default function PairCarScreen(): React.JSX.Element {
  const router = useRouter();
  const { householdId } = useActiveHousehold();
  const addVehicle = useMutation(api.vehicles.add);

  const [label, setLabel] = useState('My Car');
  const [saving, setSaving] = useState(false);

  const [devices, setDevices] = useState<BondedDevice[] | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selected, setSelected] = useState<BondedDevice | null>(null);
  const nativeAvailable = isNativeDetectionAvailable();

  const loadDevices = useCallback(async (): Promise<void> => {
    setLoadingDevices(true);
    try {
      // Android 12+ needs the BLUETOOTH_CONNECT runtime grant before we can read
      // the bonded-device list. Request it first; if denied, getBondedDevices
      // returns [] and we show the "pair / allow access" fallback note.
      if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
      }
      // Returns [] if the native module is absent or the permission is denied.
      setDevices(await getBondedDevices());
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const canSave = !saving && householdId != null && label.trim().length > 0;

  const handlePair = async (): Promise<void> => {
    if (!householdId || !canSave) return;
    setSaving(true);
    try {
      await addVehicle({
        householdId,
        label: label.trim(),
        // Only persist a Bluetooth target if one was actually chosen.
        ...(selected
          ? { btDeviceId: selected.id, btName: selected.name }
          : {}),
      });
      router.replace('/(tabs)/monitor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Pair your car</Text>
        <Text style={styles.body}>
          Give your vehicle a name so BackSeat can arm when you drive it.
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>VEHICLE NAME</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="My Car"
            placeholderTextColor={colors.outline}
            style={styles.input}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>CAR BLUETOOTH (OPTIONAL)</Text>
          <Text style={styles.help}>
            Pick your car's paired audio device for the fastest, most reliable
            trip-end. Skip it and BackSeat uses GPS + motion instead.
          </Text>

          {loadingDevices ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.help}>Looking for paired devices…</Text>
            </View>
          ) : !nativeAvailable ? (
            <Card background={colors.secondaryFixed} outlined={false}>
              <Text style={styles.note}>
                Bluetooth pairing needs the on-device build of BackSeat. In this
                build, trip-end is detected from GPS + motion. Your car will arm
                either way.
              </Text>
            </Card>
          ) : devices && devices.length > 0 ? (
            <View style={styles.deviceList}>
              <DeviceRow
                label="None — use GPS & motion"
                selected={selected == null}
                onPress={() => setSelected(null)}
              />
              {devices.map((d) => (
                <DeviceRow
                  key={d.id}
                  label={d.name}
                  sublabel={d.id}
                  selected={selected?.id === d.id}
                  onPress={() => setSelected(d)}
                />
              ))}
            </View>
          ) : (
            <Card background={colors.secondaryFixed} outlined={false}>
              <Text style={styles.note}>
                No paired Bluetooth devices found. Pair your phone with your car's
                stereo (and allow Bluetooth access), then tap Re-scan. Until then,
                trip-end uses GPS + motion.
              </Text>
            </Card>
          )}

          {nativeAvailable && !loadingDevices ? (
            <GhostButton
              color={colors.primary}
              label="Re-scan"
              onPress={() => void loadDevices()}
            />
          ) : null}
        </View>

        <PrimaryButton
          label={saving ? 'Pairing…' : 'Pair this car'}
          onPress={() => void handlePair()}
          disabled={!canSave}
          style={styles.cta}
        />
        <GhostButton
          color={colors.onSurfaceVariant}
          label="Cancel"
          onPress={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DeviceRow({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.deviceRow, selected && styles.deviceRowSelected]}
    >
      <View style={styles.deviceText}>
        <Text style={styles.deviceLabel}>{label}</Text>
        {sublabel ? <Text style={styles.deviceSub}>{sublabel}</Text> : null}
      </View>
      <Text style={[styles.radio, selected && styles.radioOn]}>
        {selected ? '●' : '○'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackMd },
  title: { ...type.headlineLg, color: colors.primary },
  body: { ...type.bodyMd, color: colors.onSurfaceVariant },
  field: { gap: spacing.base },
  fieldLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  help: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  input: {
    ...type.bodyLg,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.button,
    paddingHorizontal: spacing.gutter,
    minHeight: spacing.touchTargetMin,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter },
  deviceList: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gutter,
    paddingHorizontal: spacing.gutter,
    minHeight: spacing.touchTargetMin + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  deviceRowSelected: { backgroundColor: colors.secondaryFixed },
  deviceText: { flex: 1 },
  deviceLabel: { ...type.bodyLg, color: colors.onSurface },
  deviceSub: { ...type.bodyMd, fontSize: 12, color: colors.onSurfaceVariant },
  radio: { fontSize: 20, color: colors.outline },
  radioOn: { color: colors.primary },
  note: { ...type.bodyMd, color: colors.onSecondaryFixed, lineHeight: 22 },
  cta: { marginTop: spacing.base },
});
