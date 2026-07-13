package com.miracle.perapprotation.data

import android.content.pm.ActivityInfo

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

    companion object {
        fun fromNameOrDefault(name: String?): Orientation =
            entries.firstOrNull { it.name == name } ?: DEFAULT
    }
}
