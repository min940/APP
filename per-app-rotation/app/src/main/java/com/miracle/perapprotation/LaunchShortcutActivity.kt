package com.miracle.perapprotation

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import com.miracle.perapprotation.data.LogRepository

/**
 * Invisible "trampoline" launched by a pinned home-screen shortcut. It simply brings the target
 * app to the foreground; the running [com.miracle.perapprotation.service.RotationAccessibilityService]
 * then detects it and applies (and keeps re-asserting) the configured rotation.
 *
 * No UI — it finishes immediately.
 */
class LaunchShortcutActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pkg = intent?.getStringExtra(EXTRA_PACKAGE)
        if (!pkg.isNullOrEmpty()) {
            val launch = packageManager.getLaunchIntentForPackage(pkg)
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try {
                    startActivity(launch)
                    LogRepository.info("바로가기로 실행: $pkg")
                } catch (t: Throwable) {
                    LogRepository.error("바로가기 실행 실패: ${t.message}")
                }
            } else {
                Toast.makeText(this, "앱을 실행할 수 없습니다.", Toast.LENGTH_SHORT).show()
            }
        }
        finish()
    }

    companion object {
        const val EXTRA_PACKAGE = "extra_target_package"
    }
}
