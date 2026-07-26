package com.miracle.perapprotation.service

import android.os.SystemClock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * A "session" runs from the moment the widget/shortcut turns auto-rotate on and launches the target
 * app, until that app leaves the foreground (or the screen turns off).
 *
 * Process-local shared state: the trampoline activity, the accessibility service and the UI all run
 * in the same process.
 */
object SessionState {

    /** Package being watched while a session is active, or null when idle. */
    private val _target = MutableStateFlow<String?>(null)
    val target: StateFlow<String?> = _target.asStateFlow()

    val isActive: Boolean get() = _target.value != null

    private val _serviceConnected = MutableStateFlow(false)
    val serviceConnected: StateFlow<Boolean> = _serviceConnected.asStateFlow()

    /** Uptime the session began, used to ignore launch churn before the app first appears. */
    @Volatile
    var startedUptime: Long = 0L
        private set

    /** True once the target app has actually been seen in the foreground. */
    @Volatile
    var seen: Boolean = false

    fun start(packageName: String) {
        _target.value = packageName
        startedUptime = SystemClock.uptimeMillis()
        seen = false
    }

    fun stop() {
        _target.value = null
        seen = false
    }

    fun setServiceConnected(connected: Boolean) {
        _serviceConnected.value = connected
    }
}
