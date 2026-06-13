/**
 * Expo config plugin for the BackseatDetection native module.
 *
 * Google Activity Recognition delivers transition results via a PendingIntent
 * broadcast. For that PendingIntent to resolve after the app is backgrounded,
 * its target BroadcastReceiver (ActivityTransitionReceiver) MUST be declared in
 * AndroidManifest.xml — an inner/dynamically-registered receiver is not enough.
 * This plugin injects that <receiver> entry on `expo prebuild`.
 *
 * The Bluetooth ACL receiver is registered dynamically at runtime by the module
 * (only while a drive is active), so it needs NO manifest entry here.
 *
 * Permissions (ACTIVITY_RECOGNITION, BLUETOOTH_CONNECT) are already declared in
 * app.json, so this plugin does not touch them.
 *
 * To enable, add this to the app.json "plugins" array (documented, not applied):
 *
 *     "plugins": [ ..., "./plugins/withBackseatDetection" ]
 *
 * UNVERIFIED: requires `expo prebuild -p android` + a device build to take
 * effect; cannot be exercised in Expo Go or on the emulator.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const RECEIVER_NAME = "com.backseat.detection.ActivityTransitionReceiver";
const ACTION_PROCESS_TRANSITIONS =
  "com.backseat.detection.ACTION_PROCESS_TRANSITIONS";

const withBackseatDetection = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;

    application.receiver = application.receiver || [];

    const already = application.receiver.some(
      (r) => r?.$?.["android:name"] === RECEIVER_NAME
    );
    if (already) return cfg;

    application.receiver.push({
      $: {
        "android:name": RECEIVER_NAME,
        // Not exported: only our own PendingIntent (and the OS delivering it)
        // targets this receiver. Activity Recognition uses an explicit-component
        // PendingIntent, so exported=false is correct and safer.
        "android:exported": "false",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": ACTION_PROCESS_TRANSITIONS } }],
        },
      ],
    });

    return cfg;
  });
};

module.exports = withBackseatDetection;
