package com.miracle.perapprotation.service

import android.content.Context
import android.provider.Settings
import android.view.Surface
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation

/**
 * Stronger, opt-in rotation engine for apps that ignore the overlay (e.g. Chrome Remote Desktop,
 * which controls its own orientation).
 *
 * Instead of a competing overlay window, this writes the system rotation directly:
 *   - [Settings.System.ACCELEROMETER_ROTATION] = 0  (turn auto-rotate off so USER_ROTATION applies)
 *   - [Settings.System.USER_ROTATION] = desired rotation
 *
 * This only needs the WRITE_SETTINGS special permission (grantable in-app, no PC/adb).
 *
 * Because this changes the *system* rotation while the target app is foreground, we remember the
 * user's original auto-rotate value and restore it (plus return to portrait) when they leave the app.
 */
class ForcedRotationController(private val context: Context) {

    private var applied = false
    /** Auto-rotate value observed before we first forced rotation, restored on [restore]. */
    private var savedAccelerometerRotation: Int? = null
    /** Orientation currently forced, so repeated identical applies are cheap no-ops. */
    private var currentOrientation: Orientation? = null

    fun canWrite(): Boolean = Settings.System.canWrite(context)

    /** Forces the system into [orientation]. No-op for [Orientation.DEFAULT]. */
    fun apply(orientation: Orientation) {
        if (!orientation.requiresOverlay) {
            restore()
            return
        }
        if (!canWrite()) {
            LogRepository.warning("강제 회전: '설정 수정 허용' 권한이 없어 적용하지 못했습니다.")
            return
        }
        // Note: we intentionally re-write even if we think it is already applied. Writing the same
        // USER_ROTATION value causes no visible flicker, but it recovers from cases where the app
        // or system changed the rotation behind our back (e.g. an app that re-locks on (re)launch).
        val rotation = orientation.toSurfaceRotation() ?: return
        try {
            val resolver = context.contentResolver
            if (savedAccelerometerRotation == null) {
                savedAccelerometerRotation =
                    Settings.System.getInt(resolver, Settings.System.ACCELEROMETER_ROTATION, 1)
            }
            Settings.System.putInt(resolver, Settings.System.ACCELEROMETER_ROTATION, 0)
            Settings.System.putInt(resolver, Settings.System.USER_ROTATION, rotation)
            applied = true
            currentOrientation = orientation
        } catch (t: Throwable) {
            LogRepository.error("강제 회전 적용 실패: ${t.message}")
        }
    }

    /** Restores the user's original auto-rotate setting and returns to portrait. */
    fun restore() {
        if (!applied && savedAccelerometerRotation == null) return
        if (!canWrite()) {
            applied = false
            savedAccelerometerRotation = null
            return
        }
        try {
            val resolver = context.contentResolver
            // Return to portrait first so leaving the app lands on the phone's default.
            Settings.System.putInt(resolver, Settings.System.USER_ROTATION, Surface.ROTATION_0)
            val restoreTo = savedAccelerometerRotation ?: 1
            Settings.System.putInt(resolver, Settings.System.ACCELEROMETER_ROTATION, restoreTo)
        } catch (t: Throwable) {
            LogRepository.error("강제 회전 복원 실패: ${t.message}")
        } finally {
            applied = false
            savedAccelerometerRotation = null
            currentOrientation = null
        }
    }

    private fun Orientation.toSurfaceRotation(): Int? = when (this) {
        // Phone natural orientation is portrait, so ROTATION_90 == landscape.
        Orientation.PORTRAIT -> Surface.ROTATION_0
        Orientation.LANDSCAPE -> Surface.ROTATION_90
        Orientation.REVERSE_LANDSCAPE -> Surface.ROTATION_270
        Orientation.DEFAULT -> null
    }
}
