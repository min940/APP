package com.miracle.perapprotation.service

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation

/**
 * The rotation engine.
 *
 * Adds an invisible, non-focusable, non-touchable 1x1px [android.view.WindowManager] overlay of
 * type [WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY]. The window's
 * [WindowManager.LayoutParams.screenOrientation] is what actually forces the device orientation.
 *
 * When the target app is left, [apply] is called with [Orientation.DEFAULT] which REMOVES the
 * overlay — restoring the phone's default portrait behaviour and avoiding the Samsung issue where
 * a lingering overlay swallows other apps' permission dialogs.
 */
class OverlayOrientationController(private val context: Context) {

    private val windowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private var overlayView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var currentOrientation: Orientation = Orientation.DEFAULT

    /** Applies [orientation]. Safe to call repeatedly; no-ops when nothing changed. */
    fun apply(orientation: Orientation) {
        if (!Settings.canDrawOverlays(context)) {
            LogRepository.warning("오버레이 권한이 없어 회전을 적용하지 못했습니다.")
            return
        }
        if (orientation == currentOrientation && (orientation == Orientation.DEFAULT || overlayView != null)) {
            return
        }

        if (!orientation.requiresOverlay) {
            remove()
            currentOrientation = Orientation.DEFAULT
            return
        }

        try {
            if (overlayView == null) {
                addOverlay(orientation)
            } else {
                layoutParams?.let { params ->
                    params.screenOrientation = orientation.activityInfoValue
                    windowManager.updateViewLayout(overlayView, params)
                }
            }
            currentOrientation = orientation
        } catch (t: Throwable) {
            LogRepository.error("오버레이 적용 실패: ${t.message}")
            // Reset so a subsequent call can rebuild the overlay cleanly.
            safeRemove()
            currentOrientation = Orientation.DEFAULT
        }
    }

    private fun addOverlay(orientation: Orientation) {
        val params = WindowManager.LayoutParams(
            1,
            1,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = 0
            screenOrientation = orientation.activityInfoValue
        }
        val view = View(context)
        windowManager.addView(view, params)
        overlayView = view
        layoutParams = params
    }

    /** Removes the overlay so the device returns to its default orientation. */
    fun remove() {
        safeRemove()
        currentOrientation = Orientation.DEFAULT
    }

    private fun safeRemove() {
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: Throwable) {
                // Already detached; ignore.
            }
        }
        overlayView = null
        layoutParams = null
    }

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }
}
