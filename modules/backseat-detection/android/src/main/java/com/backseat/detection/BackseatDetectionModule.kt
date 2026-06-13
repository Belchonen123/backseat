package com.backseat.detection

import android.Manifest
import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.pm.PackageManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * BackseatDetection — the two native trip-end primitives for the BackSeat
 * safety-of-life app, exposed to JS via expo-modules-core.
 *
 *   1. Google Activity Recognition Transition API: the canonical
 *      IN_VEHICLE -> ON_FOOT / STILL signal. Emits `onActivityTransition`.
 *   2. Bluetooth ACL disconnect: the fast, high-confidence trip-end fired when
 *      the phone drops the car's audio link. Emits `onBluetoothDisconnect`.
 *
 * Both feed the existing JS DetectionService (ingestActivity / onBluetoothDisconnect).
 *
 * UNVERIFIED: this code cannot run in Expo Go or on the emulator. It must be
 * built with `expo prebuild` and validated on a physical phone across real
 * drives (Build Brief Sprint 0 gate). Do not claim it works until then.
 */
class BackseatDetectionModule : Module() {

  // Holds the PendingIntent we registered with the AR client so we can both
  // route results back to JS and unregister cleanly on stop. Null when stopped.
  private var activityPendingIntent: PendingIntent? = null

  // The dynamically-registered ACL-disconnect receiver. Null when not monitoring.
  private var bluetoothReceiver: BroadcastReceiver? = null

  // Optional MAC address filter; when set, only this device's disconnect emits.
  private var bluetoothDeviceFilter: String? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BackseatDetection")

    // JS event names. The TS wrapper subscribes to these.
    Events("onActivityTransition", "onBluetoothDisconnect")

    // --- Activity Recognition --------------------------------------------

    AsyncFunction("startActivityUpdates") {
      startActivityUpdates()
    }

    AsyncFunction("stopActivityUpdates") {
      stopActivityUpdates()
    }

    // --- Bluetooth ACL ----------------------------------------------------

    Function("startBluetoothMonitor") { deviceId: String? ->
      startBluetoothMonitor(deviceId)
    }

    Function("stopBluetoothMonitor") {
      stopBluetoothMonitor()
    }

    AsyncFunction("getBondedDevices") {
      getBondedDevices()
    }

    // Register this live instance so the manifest-declared
    // ActivityTransitionReceiver can forward parsed AR results to it.
    OnCreate {
      BackseatDetectionModuleHolder.set(this@BackseatDetectionModule)
    }

    OnDestroy {
      // Defensive teardown so a JS reload never leaks a receiver or AR client.
      runCatching { stopActivityUpdates() }
      runCatching { stopBluetoothMonitor() }
      BackseatDetectionModuleHolder.clear(this@BackseatDetectionModule)
    }
  }

  // -----------------------------------------------------------------------
  // Activity Recognition
  // -----------------------------------------------------------------------

  private fun startActivityUpdates() {
    val transitions = buildList {
      // We register both ENTER and EXIT for the three activities we care about.
      for (type in listOf(
        DetectedActivity.IN_VEHICLE,
        DetectedActivity.ON_FOOT,
        DetectedActivity.WALKING,
        DetectedActivity.RUNNING,
        DetectedActivity.STILL,
      )) {
        add(
          ActivityTransition.Builder()
            .setActivityType(type)
            .setActivityTransitionType(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
            .build()
        )
      }
    }

    val request = ActivityTransitionRequest(transitions)
    val pendingIntent = buildActivityPendingIntent()
    activityPendingIntent = pendingIntent

    // Caller must have already been granted ACTIVITY_RECOGNITION (declared in
    // app.json). If not, this task fails and JS surfaces it via the rejection.
    ActivityRecognition.getClient(context)
      .requestActivityTransitionUpdates(request, pendingIntent)
  }

  private fun stopActivityUpdates() {
    val pendingIntent = activityPendingIntent ?: return
    ActivityRecognition.getClient(context)
      .removeActivityTransitionUpdates(pendingIntent)
    pendingIntent.cancel()
    activityPendingIntent = null
  }

  private fun buildActivityPendingIntent(): PendingIntent {
    val intent = Intent(context, ActivityTransitionReceiver::class.java).apply {
      action = ActivityTransitionReceiver.ACTION_PROCESS_TRANSITIONS
    }
    // MUTABLE is required for AR to populate the result extra. Combined with an
    // explicit component (the receiver class), this is safe.
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    return PendingIntent.getBroadcast(context, AR_REQUEST_CODE, intent, flags)
  }

  /**
   * Called by ActivityTransitionReceiver (same process) with a freshly parsed
   * result. Maps Google AR activity codes to BackSeat's three-state vocabulary
   * and emits one `onActivityTransition` per relevant ENTER event.
   *
   * Mapping is intentionally honest:
   *   IN_VEHICLE        -> IN_VEHICLE
   *   ON_FOOT/WALKING/RUNNING -> ON_FOOT
   *   STILL             -> STILL
   *   anything else     -> ignored
   */
  fun handleTransitionResult(result: ActivityTransitionResult) {
    for (event in result.transitionEvents) {
      // We only registered ENTER transitions, but guard anyway.
      if (event.transitionType != ActivityTransition.ACTIVITY_TRANSITION_ENTER) continue

      val mapped = when (event.activityType) {
        DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
        DetectedActivity.ON_FOOT,
        DetectedActivity.WALKING,
        DetectedActivity.RUNNING -> "ON_FOOT"
        DetectedActivity.STILL -> "STILL"
        else -> null
      } ?: continue

      sendEvent(
        "onActivityTransition",
        mapOf(
          "activity" to mapped,
          "at" to System.currentTimeMillis(),
        )
      )
    }
  }

  // -----------------------------------------------------------------------
  // Bluetooth ACL disconnect
  // -----------------------------------------------------------------------

  private fun startBluetoothMonitor(deviceId: String?) {
    // Replace any existing registration (idempotent start).
    stopBluetoothMonitor()
    bluetoothDeviceFilter = deviceId

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != BluetoothDevice.ACTION_ACL_DISCONNECTED) return

        @Suppress("DEPRECATION")
        val device: BluetoothDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        } else {
          intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        }

        // Reading device.address requires BLUETOOTH_CONNECT (declared in app.json).
        val address = runCatching { device?.address }.getOrNull() ?: return

        // If a specific car was registered, ignore every other device.
        val filter = bluetoothDeviceFilter
        if (filter != null && !filter.equals(address, ignoreCase = true)) return

        sendEvent(
          "onBluetoothDisconnect",
          mapOf(
            "address" to address,
            "at" to System.currentTimeMillis(),
          )
        )
      }
    }

    val filter = IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED)
    context.registerReceiver(receiver, filter)
    bluetoothReceiver = receiver
  }

  private fun stopBluetoothMonitor() {
    val receiver = bluetoothReceiver ?: return
    runCatching { context.unregisterReceiver(receiver) }
    bluetoothReceiver = null
    bluetoothDeviceFilter = null
  }

  // -----------------------------------------------------------------------
  // Bonded (paired) device enumeration
  // -----------------------------------------------------------------------

  /**
   * Enumerate the phone's already-paired (bonded) Bluetooth devices so the app
   * can let the user pick which one is their car.
   *
   * Android 12+ (API 31) requires the BLUETOOTH_CONNECT runtime permission to
   * read `bondedDevices` and any device name/address. If that grant is missing,
   * or the adapter is null/off, we REJECT with a clear code rather than crash —
   * the JS wrapper catches the rejection and falls back to an empty list.
   */
  private fun getBondedDevices(): List<Map<String, String>> {
    // BLUETOOTH_CONNECT is only enforced from Android 12 (S). On older devices
    // the legacy BLUETOOTH permission is install-time and bondedDevices is free.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val granted = context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) ==
        PackageManager.PERMISSION_GRANTED
      if (!granted) {
        throw CodedException(
          "ERR_BLUETOOTH_PERMISSION",
          "BLUETOOTH_CONNECT permission not granted; cannot read bonded devices.",
          null
        )
      }
    }

    val adapter: BluetoothAdapter? = run {
      val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    }

    if (adapter == null) {
      throw CodedException(
        "ERR_BLUETOOTH_UNAVAILABLE",
        "No Bluetooth adapter on this device.",
        null
      )
    }
    if (!adapter.isEnabled) {
      throw CodedException(
        "ERR_BLUETOOTH_OFF",
        "Bluetooth is turned off; cannot read bonded devices.",
        null
      )
    }

    return try {
      adapter.bondedDevices.orEmpty().map { device ->
        mapOf(
          "id" to device.address,
          "name" to (device.name?.takeIf { it.isNotBlank() } ?: "Unknown device"),
        )
      }
    } catch (e: SecurityException) {
      // Defensive: the OS can still throw even after a checkSelfPermission pass
      // (e.g. permission revoked between the check and the read).
      throw CodedException(
        "ERR_BLUETOOTH_PERMISSION",
        "SecurityException reading bonded devices: ${e.message}",
        e
      )
    }
  }

  companion object {
    private const val AR_REQUEST_CODE = 5417 // arbitrary stable request code
  }
}
