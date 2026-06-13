package com.backseat.detection

import java.lang.ref.WeakReference

/**
 * Bridges the manifest-declared ActivityTransitionReceiver (which Android
 * instantiates fresh per broadcast) to the live BackseatDetectionModule (which
 * owns the JS event sender). The module registers a weak reference to itself
 * while active; the receiver reads it to forward parsed transition results.
 *
 * A WeakReference avoids pinning the module (and its React context) in memory
 * if it is torn down without an explicit clear.
 */
object BackseatDetectionModuleHolder {
  private var ref: WeakReference<BackseatDetectionModule>? = null

  val current: BackseatDetectionModule?
    get() = ref?.get()

  fun set(module: BackseatDetectionModule) {
    ref = WeakReference(module)
  }

  fun clear(module: BackseatDetectionModule) {
    // Only clear if the current ref is this module (avoid clobbering a newer one).
    if (ref?.get() === module) ref = null
  }
}
