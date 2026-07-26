package com.miracle.perapprotation.service

import android.os.SystemClock
import com.miracle.perapprotation.data.Orientation

/**
 * Shared state for the "linked app" mode: a home-screen shortcut rotates the whole screen and
 * launches a target app; the accessibility service then reverts the rotation as soon as that app
 * leaves the foreground.
 *
 * Process-local (service + activities share one process).
 */
object WatchState {

    @Volatile
    var watchedPackage: String? = null
        private set

    @Volatile
    var landscapeOrientation: Orientation = Orientation.LANDSCAPE
        private set

    @Volatile
    var revertOrientation: Orientation = Orientation.PORTRAIT
        private set

    /** Uptime when watching started, used to ignore the launch/rotation churn at the very start. */
    @Volatile
    var startedUptime: Long = 0L
        private set

    /** True once the watched app has actually been seen in the foreground at least once. */
    @Volatile
    var seen: Boolean = false
        private set

    /**
     * When true, the screen is first locked to [landscapeOrientation] (so the app opens in
     * landscape right away) and then auto-rotate is switched on a few seconds later, so the screen
     * follows how the phone is held for the rest of the session.
     */
    @Volatile
    var useAutoRotate: Boolean = false
        private set

    /** True once auto-rotate has been handed over, so it is only switched on once. */
    @Volatile
    var autoRotateHandedOver: Boolean = false

    fun start(
        packageName: String,
        landscape: Orientation,
        revert: Orientation,
        useAutoRotate: Boolean
    ) {
        watchedPackage = packageName
        landscapeOrientation = landscape
        revertOrientation = revert
        this.useAutoRotate = useAutoRotate
        autoRotateHandedOver = false
        startedUptime = SystemClock.uptimeMillis()
        seen = false
    }

    fun markSeen() {
        seen = true
    }

    fun stop() {
        watchedPackage = null
        seen = false
        autoRotateHandedOver = false
    }
}
