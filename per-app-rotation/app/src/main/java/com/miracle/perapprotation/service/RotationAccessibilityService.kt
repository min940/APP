package com.miracle.perapprotation.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RuleRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
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

    override fun onServiceConnected() {
        super.onServiceConnected()
        controller = OverlayOrientationController(this)
        forcedController = ForcedRotationController(this)
        ruleRepository = RuleRepository.get(this)
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

        if (packageName == lastPackage) return

        // Only real launchable apps count as a foreground change. Keyboards (honeyboard),
        // wallpapers, and other transient system windows fire window-state-changed too, but
        // should not be treated as "the user left the target app".
        if (!isLaunchable(packageName)) return

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
                controller.apply(orientation)
                // Stronger engine for apps that ignore the overlay (opt-in).
                if (forceRotation) {
                    forcedController.apply(orientation)
                    // Forcing a system rotation makes background windows (launcher, wallpaper)
                    // briefly fire window-state-changed. Suppress restores for a grace window so
                    // that phantom churn does not immediately revert the rotation.
                    suppressRestoreUntilUptime = SystemClock.uptimeMillis() + FORCED_GRACE_MS
                }
                ServiceState.setActive(packageName, orientation)
                LogRepository.info("$packageName → ${orientation.label} 적용${if (forceRotation) " (강제)" else ""}")
            } else {
                // Not a target app: ALWAYS remove the overlay so the phone stays portrait
                // and other apps' permission dialogs are not blocked.
                controller.remove()
                forcedController.restore()
                if (ServiceState.activePackage.value != null || force) {
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
    }
}
