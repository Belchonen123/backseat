import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, type } from '@/theme/tokens';
import { useBluetoothMonitor } from '@/detection/bluetoothMonitor';

/**
 * Bottom tab navigation: Monitor · History · Settings.
 * Uses simple text glyphs for icons to stay dependency-free.
 */
export default function TabsLayout(): React.JSX.Element {
  // Arm the native Bluetooth ACL-disconnect monitor for the paired car (if any),
  // for the whole time the user is inside the app shell.
  useBluetoothMonitor();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSecondaryContainer,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
        },
        tabBarLabelStyle: {
          fontSize: type.labelMd.fontSize,
          fontWeight: type.labelMd.fontWeight,
        },
      }}
    >
      <Tabs.Screen
        name="monitor"
        options={{
          title: 'Monitor',
          tabBarIcon: ({ color }) => <TabGlyph glyph="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabGlyph glyph="≡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabGlyph glyph="⚙" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({
  glyph,
  color,
}: {
  glyph: string;
  color: string;
}): React.JSX.Element {
  return <Text style={{ color, fontSize: 22 }}>{glyph}</Text>;
}
