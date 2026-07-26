package com.miracle.perapprotation.rotation

import android.content.Context
import android.provider.Settings
import android.view.Surface
import com.miracle.perapprotation.data.LogRepository

/**
 * Controls Samsung's system auto-rotate — the same toggle as the quick-panel tile.
 *
 * Needs only the WRITE_SETTINGS special permission, granted inside the app (no PC/adb).
 * Verified working on Galaxy S24 in both directions.
 */
object AutoRotate {

    fun canWrite(context: Context): Boolean = Settings.System.canWrite(context)

    /** Reads the live auto-rotate state: 1 = on, 0 = off (locked), -1 = unreadable. */
    fun state(context: Context): Int = try {
        Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION)
    } catch (_: Throwable) {
        -1
    }

    /** Reads the locked rotation value (0 = portrait, 1 = landscape, 3 = reverse landscape). */
    fun userRotation(context: Context): Int = try {
        Settings.System.getInt(context.contentResolver, Settings.System.USER_ROTATION)
    } catch (_: Throwable) {
        -1
    }

    /** Turns auto-rotate ON so the screen follows how the phone is held. */
    fun enable(context: Context): Boolean = write(context) {
        Settings.System.putInt(
            context.contentResolver,
            Settings.System.ACCELEROMETER_ROTATION,
            1
        )
    }

    /** Turns auto-rotate OFF and locks the screen back to portrait. */
    fun disableToPortrait(context: Context): Boolean = write(context) {
        val cr = context.contentResolver
        Settings.System.putInt(cr, Settings.System.ACCELEROMETER_ROTATION, 0)
        Settings.System.putInt(cr, Settings.System.USER_ROTATION, Surface.ROTATION_0)
    }

    private inline fun write(context: Context, block: () -> Unit): Boolean {
        if (!canWrite(context)) {
            LogRepository.warning("'설정 수정 허용' 권한이 없어 회전을 바꾸지 못했습니다.")
            return false
        }
        return try {
            block()
            true
        } catch (t: Throwable) {
            LogRepository.error("회전 설정 변경 실패: ${t.message}")
            false
        }
    }
}
