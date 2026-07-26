package com.miracle.perapprotation.service

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.rotation.AutoRotate
import com.miracle.perapprotation.widget.StartWidgetProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Detects when the registered app leaves the foreground and ends the session: auto-rotate off,
 * screen back to locked portrait.
 *
 * Only [AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED] is observed and only the package name is
 * used — window content is never read (canRetrieveWindowContent = false).
 */
class ExitWatchService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Pending "the app seems to be gone" job, cancelled if the target comes back. */
    private var exitJob: Job? = null

    /** Cache of packageName -> isLaunchable, so transient system windows are cheap to reject. */
    private val launchableCache = HashMap<String, Boolean>()

    /**
     * Home launcher packages — the only foreground apps that end a session. Collected from every
     * CATEGORY_HOME activity, so alternative launchers and the resolver are all covered.
     */
    private var homePackages: Set<String> = emptySet()

    /** Last package reported as an in-app switch, so it is only logged once. */
    private var lastIgnored: String? = null

    /** Turning the screen off also ends the session. */
    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF && SessionState.isActive) {
                endSession("화면 꺼짐")
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        homePackages = resolveHomePackages()
        registerReceiver(screenOffReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
        SessionState.setServiceConnected(true)
        LogRepository.success("종료 감지 준비됨 (홈: ${homePackages.joinToString().ifEmpty { "확인 실패" }})")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val target = SessionState.target.value ?: return

        val packageName = event.packageName?.toString() ?: return
        if (packageName == this.packageName) return
        if (packageName == SYSTEM_UI_PACKAGE) return
        // Keyboards, wallpapers and other transient windows are not app switches.
        if (!isLaunchable(packageName)) return

        if (packageName == target) {
            // The app is (still) in front: cancel any pending exit.
            SessionState.seen = true
            exitJob?.cancel()
            exitJob = null
            lastIgnored = null
            return
        }

        // Ignore the launch churn before the target ever appeared — turning auto-rotate on makes
        // background windows briefly report as foreground.
        if (!SessionState.seen &&
            SystemClock.uptimeMillis() - SessionState.startedUptime < START_GRACE_MS
        ) {
            return
        }

        // Only going HOME (or the screen turning off) ends a session. Apps opened from inside the
        // target — Chrome custom tabs for sign-in, file pickers, the camera — are part of the flow,
        // not an exit. Switching apps via recents passes through the launcher, so that still ends it.
        // If home packages could not be resolved, fall back to treating any app switch as an exit
        // so a session can never get stuck with auto-rotate left on.
        val isHome = if (homePackages.isEmpty()) true else packageName in homePackages
        if (!isHome) {
            if (lastIgnored != packageName) {
                lastIgnored = packageName
                LogRepository.info("$packageName 은 앱 내 전환으로 보고 유지")
            }
            return
        }

        scheduleExit(packageName)
    }

    /**
     * Debounced exit: wait briefly before ending the session, so a window that merely flashes past
     * (or the churn from rotating) does not end it. If the target returns, [exitJob] is cancelled.
     */
    private fun scheduleExit(byPackage: String) {
        if (exitJob?.isActive == true) return
        exitJob = scope.launch {
            delay(EXIT_DEBOUNCE_MS)
            if (!SessionState.isActive) return@launch
            endSession("$byPackage 로 전환")
        }
    }

    private fun endSession(reason: String) {
        exitJob?.cancel()
        exitJob = null
        val target = SessionState.target.value
        SessionState.stop()
        lastIgnored = null
        AutoRotate.disableToPortrait(this)
        StartWidgetProvider.refresh(this)
        LogRepository.info("$target 종료($reason) → 자동회전 끔 · 세로 복귀")
    }

    private fun resolveHomePackages(): Set<String> = try {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        packageManager.queryIntentActivities(intent, 0)
            .mapNotNull { it.activityInfo?.packageName }
            .toSet()
    } catch (_: Throwable) {
        emptySet()
    }

    /**
     * True for real apps AND for the home launcher. Launchers usually have no LAUNCHER-category
     * activity of their own, so they must be allowed explicitly — otherwise pressing Home is
     * filtered out and a session never ends.
     */
    private fun isLaunchable(pkg: String): Boolean {
        if (pkg in homePackages) return true
        return launchableCache.getOrPut(pkg) {
            try {
                packageManager.getLaunchIntentForPackage(pkg) != null
            } catch (_: Throwable) {
                false
            }
        }
    }

    override fun onInterrupt() {
        // No spoken/haptic feedback is provided.
    }

    override fun onUnbind(intent: Intent?): Boolean {
        cleanup()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun cleanup() {
        runCatching { unregisterReceiver(screenOffReceiver) }
        // Never leave the phone stuck in auto-rotate if the service dies mid-session.
        if (SessionState.isActive) {
            SessionState.stop()
            AutoRotate.disableToPortrait(this)
        }
        SessionState.setServiceConnected(false)
        scope.cancel()
        LogRepository.warning("종료 감지 서비스가 중지되었습니다.")
    }

    private companion object {
        const val SYSTEM_UI_PACKAGE = "com.android.systemui"
        const val START_GRACE_MS = 2000L
        const val EXIT_DEBOUNCE_MS = 600L
    }
}
