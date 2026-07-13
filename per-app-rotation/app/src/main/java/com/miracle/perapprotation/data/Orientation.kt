package com.miracle.perapprotation.data

import android.content.pm.ActivityInfo
import android.view.Surface

/**
 * The orientation a given app should be forced into while it is in the foreground.
 *
 * [DEFAULT] means "do nothing" — the rotation overlay is removed so the phone keeps
 * its own default (portrait) behaviour. This is important both for the "phone default is
 * portrait" requirement and to avoid the Samsung bug where a lingering overlay blocks
 * other apps' permission dialogs.
 */
enum class Orientation(
    /** Value pushed into the overlay's [android.view.WindowManager.LayoutParams.screenOrientation]. */
    val activityInfoValue: Int,
    /** Short Korean label shown in the UI. */
    val label: String
) {
    DEFAULT(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, "기본"),
    LANDSCAPE(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE, "가로"),
    PORTRAIT(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, "세로"),
    REVERSE_LANDSCAPE(ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE, "역가로");

    /** True when this rule requires the overlay to be active. */
    val requiresOverlay: Boolean
        get() = this != DEFAULT

    /**
     * The [Surface] rotation used for the global rotation engine (phone natural orientation is
     * portrait, so ROTATION_90 == landscape). Null for [DEFAULT] (means "let the system decide").
     */
    val surfaceRotation: Int?
        get() = when (this) {
            PORTRAIT -> Surface.ROTATION_0
            LANDSCAPE -> Surface.ROTATION_90
            REVERSE_LANDSCAPE -> Surface.ROTATION_270
            DEFAULT -> null
        }

    companion object {
        fun fromNameOrDefault(name: String?): Orientation =
            entries.firstOrNull { it.name == name } ?: DEFAULT
    }
}
