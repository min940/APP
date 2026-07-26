package com.miracle.perapprotation.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RotationSettings
import com.miracle.perapprotation.data.RuleRepository
import com.miracle.perapprotation.widget.GlobalRotation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Detects the foreground app via [AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED] only, looks up the
 * saved rotation rule for that package, and drives [OverlayOrientationController] accordingly.
 *
 * Never reads window content — canRetrieveWindowContent is false and only the package name is used.
 */
class RotationAccessibilityService : AccessibilityService() {

    private lateinit var controller: OverlayOrientationController
    private lateinit var forcedController: ForcedRotationController
    private lateinit var ruleRepository: RuleRepository
    private lateinit var settings: RotationSettings

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Cached rule map, refreshed from DataStore. Read on the main thread only. */
    @Volatile
    private var rules: Map<String, Orientation> = emptyMap()

    /** Whether the stronger forced-system-rotation engine is enabled. */
    @Volatile
    private var forceRotation: Boolean = false

    private var lastPackage: String? = null

    /** Home launcher package, resolved at connect time (used to ignore phantom rotation events). */
    private var homePackage: String? = null

    /** Until this uptime (ms), skip forced-rotation restores caused by post-rotation window churn. */
    private var suppressRestoreUntilUptime = 0L

    /** Cache of packageName -> isLaunchable, to avoid repeated PackageManager queries. */
    private val launchableCache = HashMap<String, Boolean>()

    /** Re-assert job: some apps reset their orientation shortly after (re)launch. */
    private var reassertJob: Job? = null

    /** Until this uptime (ms), ignore non-watched apps in linked mode (launch/rotation churn). */
    private var watchSuppressUntil = 0L

    /** Delayed hand-over from the initial landscape lock to Samsung's auto-rotate. */
    private var autoRotateJob: Job? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        controller = OverlayOrientationController(this)
        forcedController = ForcedRotationController(this)
        ruleRepository = RuleRepository.get(this)
        settings = RotationSettings(this)
        homePackage = resolveHomePackage()

        // Keep the rule cache in sync with DataStore.
        scope.launch {
            ruleRepository.rulesFlow.collect { updated ->
                rules = updated
                // Re-evaluate the current foreground app against the new rules.
                lastPackage?.let { evaluate(it, force = true) }
            }
        }

        // Keep the force-rotation toggle in sync.
        scope.launch {
            ruleRepository.forceRotationFlow.collect { enabled ->
                forceRotation = enabled
                lastPackage?.let { evaluate(it, force = true) }
            }
        }

        ServiceState.setConnected(true)
        LogRepository.success("접근성 서비스 연결됨. 앱 감시를 시작합니다.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return
        // Ignore our own windows and system UI transients to reduce churn.
        if (packageName == this.packageName) return
        if (packageName == SYSTEM_UI_PACKAGE) return

        // Only real launchable apps count as a foreground change. Keyboards (honeyboard),
        // wallpapers, and other transient system windows fire window-state-changed too, but
        // should not be treated as "the user left the target app".
        if (!isLaunchable(packageName)) return

        // Linked-app (whole-screen) mode: keep the configured rotation while the target app is in
        // the foreground; revert to portrait as soon as it leaves.
        if (handleWatchedApp(packageName)) return

        // A target app came forward by ANY means (its own icon, recents, a notification — not just
        // our shortcut). Start whole-screen linked mode for it so the rotation / auto-rotate
        // hand-over happens exactly as it does from the shortcut.
        val rule = rules[packageName]
        if (rule != null && rule.requiresOverlay && forceRotation) {
            val useAuto = settings.linkedUseAutoRotate
            WatchState.start(packageName, rule, Orientation.PORTRAIT, useAuto)
            LogRepository.info(
                "$packageName 감지 → ${rule.label}${if (useAuto) " 후 자동회전" else " 고정"}"
            )
            lastPackage = packageName
            handleWatchedApp(packageName)
            return
        }

        // Phantom-event guard: right after forcing a rotation, the rotation itself makes
        // background windows (launcher, wallpaper) briefly report as foreground. While a forced
        // target is active and we are inside the grace window, ignore any non-target app WITHOUT
        // updating lastPackage — so a genuine app switch after the grace window still restores.
        val isTarget = rules[packageName]?.requiresOverlay == true
        if (!isTarget &&
            forceRotation &&
            ServiceState.activePackage.value != null &&
            SystemClock.uptimeMillis() < suppressRestoreUntilUptime
        ) {
            return
        }

        lastPackage = packageName
        evaluate(packageName, force = false)
    }

    private fun evaluate(packageName: String, force: Boolean) {
        val orientation = rules[packageName] ?: Orientation.DEFAULT
        try {
            if (orientation.requiresOverlay) {
                // Re-applying is idempotent; only log when the active target/orientation changes.
                val changed = ServiceState.activePackage.value != packageName ||
                    ServiceState.activeOrientation.value != orientation
                controller.apply(orientation)
                // Stronger engine for apps that ignore the overlay (opt-in).
                if (forceRotation) {
                    forcedController.apply(orientation)
                    // Forcing a system rotation makes background windows (launcher, wallpaper)
                    // briefly fire window-state-changed. Suppress restores for a grace window so
                    // that phantom churn does not immediately revert the rotation.
                    suppressRestoreUntilUptime = SystemClock.uptimeMillis() + FORCED_GRACE_MS
                    // Re-assert a few times: some apps reset their orientation shortly after launch.
                    scheduleReassert(packageName, orientation)
                }
                ServiceState.setActive(packageName, orientation)
                if (changed) {
                    LogRepository.info("$packageName → ${orientation.label} 적용${if (forceRotation) " (강제)" else ""}")
                }
            } else {
                // Not a target app: ALWAYS remove the overlay so the phone stays portrait
                // and other apps' permission dialogs are not blocked.
                val wasActive = ServiceState.activePackage.value != null
                reassertJob?.cancel()
                controller.remove()
                forcedController.restore()
                if (wasActive || force) {
                    LogRepository.info("$packageName → 기본(세로) 복귀")
                }
                ServiceState.clearActive()
            }
        } catch (t: Throwable) {
            LogRepository.error("회전 적용 중 오류: ${t.message}")
        }
    }

    override fun onInterrupt() {
        // No-op: we don't provide spoken/haptic feedback.
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        cleanup()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun cleanup() {
        if (::controller.isInitialized) controller.remove()
        if (::forcedController.isInitialized) forcedController.restore()
        ServiceState.setConnected(false)
        ServiceState.clearActive()
        scope.cancel()
        LogRepository.warning("접근성 서비스가 종료되었습니다.")
    }

    private fun resolveHomePackage(): String? = try {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        packageManager.resolveActivity(intent, 0)?.activityInfo?.packageName
    } catch (_: Throwable) {
        null
    }

    /**
     * Linked-app mode handler. Returns true if the event was handled (caller should stop).
     *
     * While a target app (set by [WatchState] from the launch shortcut) is in the foreground, the
     * whole screen is kept in landscape. As soon as another real app comes forward, the screen is
     * reverted to portrait and watching stops. Launch/rotation churn right after starting is
     * ignored via a short grace window.
     */
    private fun handleWatchedApp(packageName: String): Boolean {
        val watched = WatchState.watchedPackage ?: return false
        val now = SystemClock.uptimeMillis()

        // Linked mode owns the screen orientation: stop any per-app forced-rotation re-assert loop
        // and drop its saved state so the two engines cannot fight each other.
        reassertJob?.cancel()
        forcedController.forget()

        if (packageName == watched) {
            if (WatchState.useAutoRotate) {
                // Open in landscape first, then hand the screen over to Samsung's auto-rotate so it
                // follows how the phone is held for the rest of the session.
                if (!WatchState.autoRotateHandedOver) {
                    GlobalRotation.apply(this, WatchState.landscapeOrientation)
                    scheduleAutoRotateHandover(watched)
                }
            } else {
                // Keep the screen locked in landscape (recover if the app reset it).
                GlobalRotation.apply(this, WatchState.landscapeOrientation)
            }
            WatchState.markSeen()
            // Only a short window to absorb the phantom churn caused by re-applying the rotation.
            watchSuppressUntil = now + WATCH_POST_APPLY_MS
            lastPackage = packageName
            return true
        }

        // A different app is foreground. Ignore only the initial launch churn (before the app has
        // been seen) and the brief post-apply phantom churn — otherwise revert immediately.
        val withinStartGrace = !WatchState.seen && (now - WatchState.startedUptime < WATCH_START_GRACE_MS)
        if (withinStartGrace || now < watchSuppressUntil) {
            return true
        }

        // The watched app left the foreground → revert to portrait immediately and stop watching.
        autoRotateJob?.cancel()
        GlobalRotation.apply(this, WatchState.revertOrientation)
        LogRepository.info(
            "$watched 이탈 → ${WatchState.revertOrientation.label} 복귀(자동회전 끔)"
        )
        WatchState.stop()
        lastPackage = packageName
        return true
    }

    /**
     * After the linked app has settled in landscape, turns Samsung's auto-rotate ON so the screen
     * follows the phone from then on. Skipped if the user already left the app.
     */
    private fun scheduleAutoRotateHandover(watched: String) {
        if (WatchState.autoRotateHandedOver) return
        WatchState.autoRotateHandedOver = true
        autoRotateJob?.cancel()
        autoRotateJob = scope.launch {
            delay(AUTO_ROTATE_HANDOVER_MS)
            if (WatchState.watchedPackage != watched) return@launch
            // Turning auto-rotate on makes the screen snap to however the phone is held, which
            // fires window-state-changed for background windows. Suppress restores across that
            // churn, otherwise we would immediately revert and auto-rotate would look "stuck off".
            watchSuppressUntil = SystemClock.uptimeMillis() + AUTO_ROTATE_SETTLE_MS
            GlobalRotation.apply(this@RotationAccessibilityService, Orientation.DEFAULT)
            LogRepository.success("$watched → 자동회전 켬")
        }
    }

    /**
     * Re-applies the forced rotation a few times shortly after a target app comes to the foreground.
     * Apps like Chrome Remote Desktop may reset their orientation on (re)launch; re-writing the same
     * USER_ROTATION value recovers from that without any visible flicker.
     */
    private fun scheduleReassert(packageName: String, orientation: Orientation) {
        reassertJob?.cancel()
        reassertJob = scope.launch {
            repeat(REASSERT_COUNT) {
                delay(REASSERT_INTERVAL_MS)
                if (!forceRotation || ServiceState.activePackage.value != packageName) return@launch
                forcedController.apply(orientation)
            }
        }
    }

    /** True for real launchable apps (and the home launcher). Cached per package. */
    private fun isLaunchable(pkg: String): Boolean {
        if (pkg == homePackage) return true
        return launchableCache.getOrPut(pkg) {
            try {
                packageManager.getLaunchIntentForPackage(pkg) != null
            } catch (_: Throwable) {
                false
            }
        }
    }

    companion object {
        private const val SYSTEM_UI_PACKAGE = "com.android.systemui"
        private const val FORCED_GRACE_MS = 3000L
        private const val REASSERT_COUNT = 4
        private const val REASSERT_INTERVAL_MS = 500L
        private const val WATCH_START_GRACE_MS = 1500L
        private const val WATCH_POST_APPLY_MS = 800L
        private const val AUTO_ROTATE_HANDOVER_MS = 3000L
        private const val AUTO_ROTATE_SETTLE_MS = 2500L
    }
}
