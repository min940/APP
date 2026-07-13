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

    fun start(packageName: String, landscape: Orientation, revert: Orientation) {
        watchedPackage = packageName
        landscapeOrientation = landscape
        revertOrientation = revert
        startedUptime = SystemClock.uptimeMillis()
        seen = false
    }

    fun markSeen() {
        seen = true
    }

    fun stop() {
        watchedPackage = null
        seen = false
    }
}
