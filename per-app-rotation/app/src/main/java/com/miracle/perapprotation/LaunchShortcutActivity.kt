package com.miracle.perapprotation

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RotationSettings
import com.miracle.perapprotation.data.RuleRepository
import com.miracle.perapprotation.service.WatchState
import com.miracle.perapprotation.widget.GlobalRotation
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

/**
 * Invisible "trampoline" launched by a pinned home-screen shortcut. It:
 *   1) rotates the whole screen to the target's orientation (landscape),
 *   2) registers the target with [WatchState] so the accessibility service reverts the rotation
 *      to portrait as soon as the app leaves the foreground,
 *   3) launches the target app.
 *
 * No UI — it finishes immediately.
 */
class LaunchShortcutActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pkg = intent?.getStringExtra(EXTRA_PACKAGE)
        if (!pkg.isNullOrEmpty()) {
            launchLinked(pkg)
        }
        finish()
    }

    private fun launchLinked(pkg: String) {
        val settings = RotationSettings(this)
        // Landscape = the app's own rule if set, else the global "on" orientation.
        val ruleOrientation = runCatching {
            runBlocking { RuleRepository.get(this@LaunchShortcutActivity).rulesFlow.first()[pkg] }
        }.getOrNull()
        val landscape = ruleOrientation?.takeIf { it.requiresOverlay } ?: settings.onOrientation
        // Linked mode always returns to locked portrait on exit (per the requested behaviour),
        // so leaving the app can't land on auto-rotate reverse-landscape.
        val revert = Orientation.PORTRAIT

        // Rotate the whole screen now for an immediate effect (service keeps it in sync).
        if (GlobalRotation.canWrite(this)) {
            GlobalRotation.apply(this, landscape)
        } else {
            Toast.makeText(this, "앱에서 '설정 수정 허용'을 먼저 켜주세요.", Toast.LENGTH_LONG).show()
        }

        // Ask the accessibility service to revert to portrait when the app leaves the foreground.
        WatchState.start(pkg, landscape, revert)

        val launch = packageManager.getLaunchIntentForPackage(pkg)
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                startActivity(launch)
                LogRepository.info("연동 실행: $pkg → ${landscape.label}")
            } catch (t: Throwable) {
                LogRepository.error("바로가기 실행 실패: ${t.message}")
                WatchState.stop()
            }
        } else {
            Toast.makeText(this, "앱을 실행할 수 없습니다.", Toast.LENGTH_SHORT).show()
            WatchState.stop()
        }
    }

    companion object {
        const val EXTRA_PACKAGE = "extra_target_package"
    }
}
