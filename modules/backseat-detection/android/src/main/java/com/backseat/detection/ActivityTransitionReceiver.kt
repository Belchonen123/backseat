package com.backseat.detection

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityTransitionResult

/**
 * Receives the PendingIntent broadcast that Google Activity Recognition fires
 * on each registered transition, parses the result, and forwards it to the
 * live BackseatDetectionModule instance so it can map + emit the JS event.
 *
 * Activity Recognition delivers via PendingIntent rather than a direct callback
 * so it survives the app being backgrounded. This receiver is declared in the
 * manifest by the config plugin (plugins/withBackseatDetection.js) because a
 * manifest-declared component is required for the PendingIntent to resolve.
 *
 * NOTE: while the JS context is alive the module instance is present, so we
 * route straight to it. If the process was killed and only restarted to deliver
 * this broadcast, BackseatDetectionModule.liveInstance is null and the event is
 * dropped — the JS detection loop would not be running to receive it anyway.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_PROCESS_TRANSITIONS) return
    if (!ActivityTransitionResult.hasResult(intent)) return

    val result = ActivityTransitionResult.extractResult(intent) ?: return
    BackseatDetectionModuleHolder.current?.handleTransitionResult(result)
  }

  companion object {
    // Kept in sync with the action set on the PendingIntent in the module.
    const val ACTION_PROCESS_TRANSITIONS =
      "com.backseat.detection.ACTION_PROCESS_TRANSITIONS"
  }
}
