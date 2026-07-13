package com.miracle.perapprotation.widget

import android.content.Context
import android.provider.Settings
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RotationSettings

/**
 * Controls the WHOLE-SCREEN rotation via system settings (needs WRITE_SETTINGS only, no adb).
 *
 * - A concrete orientation locks the display: [Settings.System.ACCELEROMETER_ROTATION] = 0 and
 *   [Settings.System.USER_ROTATION] = the requested rotation.
 * - [Orientation.DEFAULT] means "auto-rotate": ACCELEROMETER_ROTATION = 1.
 */
object GlobalRotation {

    fun canWrite(context: Context): Boolean = Settings.System.canWrite(context)

    /** Applies [orientation] to the whole screen. Returns false if the permission is missing. */
    fun apply(context: Context, orientation: Orientation): Boolean {
        if (!canWrite(context)) {
            LogRepository.warning("전체 회전: '설정 수정 허용' 권한이 없습니다.")
            return false
        }
        val cr = context.contentResolver
        return try {
            val rotation = orientation.surfaceRotation
            if (rotation == null) {
                // DEFAULT → re-enable auto-rotate.
                Settings.System.putInt(cr, Settings.System.ACCELEROMETER_ROTATION, 1)
            } else {
                Settings.System.putInt(cr, Settings.System.ACCELEROMETER_ROTATION, 0)
                Settings.System.putInt(cr, Settings.System.USER_ROTATION, rotation)
            }
            LogRepository.success("전체 화면 → ${orientation.label}")
            true
        } catch (t: Throwable) {
            LogRepository.error("전체 회전 적용 실패: ${t.message}")
            false
        }
    }

    /**
     * Toggles between the configured ON and OFF orientations. Returns the new state (true = ON),
     * or null if the permission is missing.
     */
    fun toggle(context: Context): Boolean? {
        if (!canWrite(context)) return null
        val settings = RotationSettings(context)
        val next = !settings.isOn
        val orientation = if (next) settings.onOrientation else settings.offOrientation
        if (apply(context, orientation)) {
            settings.isOn = next
            return next
        }
        return settings.isOn
    }
}
