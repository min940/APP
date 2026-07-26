package com.miracle.perapprotation.session

import android.content.Context
import android.content.Intent
import com.miracle.perapprotation.data.AppSettings
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.rotation.AutoRotate
import com.miracle.perapprotation.service.SessionState

/** Result of trying to start a session, so callers can show the right message. */
enum class StartResult { STARTED, NO_TARGET, NO_PERMISSION, LAUNCH_FAILED }

/**
 * Starts a session: turn auto-rotate on, remember what to watch, then launch the registered app.
 * The accessibility service ends the session when that app leaves the foreground.
 */
object SessionStarter {

    fun start(context: Context): StartResult {
        val settings = AppSettings(context)
        val pkg = settings.targetPackage
        if (pkg.isNullOrEmpty()) return StartResult.NO_TARGET
        if (!AutoRotate.canWrite(context)) return StartResult.NO_PERMISSION

        val launch = context.packageManager.getLaunchIntentForPackage(pkg)
            ?: return StartResult.LAUNCH_FAILED

        // 1) Auto-rotate on, 2) start watching, 3) launch — in that order, so the app already
        // opens with rotation enabled.
        AutoRotate.enable(context)
        SessionState.start(pkg)

        return try {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(launch)
            LogRepository.success("${settings.targetLabel ?: pkg} 실행 → 자동회전 켬")
            StartResult.STARTED
        } catch (t: Throwable) {
            SessionState.stop()
            AutoRotate.disableToPortrait(context)
            LogRepository.error("앱 실행 실패: ${t.message}")
            StartResult.LAUNCH_FAILED
        }
    }
}
