/**
 * Config plugin for the Notifee high-stakes alarm on Android 14+.
 *
 * Notifee has no official Expo config plugin and its native edits were
 * previously hand-applied to android/. That makes a clean prebuild (and every
 * EAS build) silently drop them, which crashes the alarm
 * (MissingForegroundServiceTypeException on targetSdk 34). This plugin
 * reproduces ALL of those edits so any clean build is correct:
 *
 *  1. The `app.notifee:core` local Maven repo (the native lib ships inside the
 *     npm package; no central artifact exists), or `app.notifee:core` won't
 *     resolve at gradle time.
 *  2. A typed foreground service for Notifee's ForegroundService — `specialUse`,
 *     because there is no dedicated "alarm" FGS type. Requires the `tools`
 *     namespace + a tools:replace to override Notifee's untyped declaration.
 *  3. The `ic_notification` monochrome small-icon drawable referenced by
 *     src/alerts/index.ts.
 *
 * The FOREGROUND_SERVICE_SPECIAL_USE + USE_FULL_SCREEN_INTENT permissions are
 * already declared in app.json android.permissions, so they are not added here.
 *
 * NB: the specialUse subtype must be justified in the Play Console (child-safety
 * alarm). This plugin's native output is UNVERIFIED until a real device build.
 */
const {
  withProjectBuildGradle,
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NOTIFEE_SERVICE = "app.notifee.core.ForegroundService";
const FGS_SUBTYPE =
  "Sounds the back-seat safety alarm until the caregiver acknowledges it";

const IC_NOTIFICATION_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,22c1.1,0 2,-0.9 2,-2h-4c0,1.1 0.9,2 2,2zM18,16v-5c0,-3.07 -1.64,-5.64 -4.5,-6.32L13.5,4c0,-0.83 -0.67,-1.5 -1.5,-1.5s-1.5,0.67 -1.5,1.5v0.68C7.63,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z" />
</vector>
`;

// 1. Notifee local Maven repo in allprojects.repositories.
const withNotifeeMavenRepo = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (cfg.modResults.contents.includes("@notifee/react-native/package.json")) {
      return cfg;
    }
    const repoBlock = [
      "        maven {",
      "            // Notifee ships its native app.notifee:core library as a local",
      "            // Maven repo inside the npm package (no central artifact exists).",
      "            url(new File(['node', '--print', \"require.resolve('@notifee/react-native/package.json')\"].execute(null, rootDir).text.trim(), '../android/libs'))",
      "        }",
    ].join("\n");
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (match) => `${match}\n${repoBlock}`
    );
    return cfg;
  });

// 2. Typed foreground service + tools namespace.
const withNotifeeForegroundService = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const application = manifest.application?.[0];
    if (!application) return cfg;
    application.service = application.service || [];

    // Idempotent: drop any prior copy then add the canonical one.
    application.service = application.service.filter(
      (s) => s?.$?.["android:name"] !== NOTIFEE_SERVICE
    );
    application.service.push({
      $: {
        "android:name": NOTIFEE_SERVICE,
        "android:foregroundServiceType": "specialUse",
        "tools:replace": "android:foregroundServiceType",
      },
      property: [
        {
          $: {
            "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
            "android:value": FGS_SUBTYPE,
          },
        },
      ],
    });
    return cfg;
  });

// 3. Write the ic_notification small-icon drawable.
const withNotificationIcon = (config) =>
  withDangerousMod(config, [
    "android",
    (cfg) => {
      const drawableDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable"
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, "ic_notification.xml"),
        IC_NOTIFICATION_XML
      );
      return cfg;
    },
  ]);

const withNotifeeAlarm = (config) => {
  config = withNotifeeMavenRepo(config);
  config = withNotifeeForegroundService(config);
  config = withNotificationIcon(config);
  return config;
};

module.exports = withNotifeeAlarm;
