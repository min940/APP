package com.miracle.perapprotation.data

import android.content.Context

/**
 * Simple synchronous settings for the global rotation toggle / widget, backed by SharedPreferences
 * (synchronous access is convenient from the widget's broadcast receiver).
 *
 * - [onOrientation]: orientation applied when the toggle is ON (default landscape)
 * - [offOrientation]: orientation applied when the toggle is OFF (default portrait; DEFAULT = auto-rotate)
 * - [isOn]: current toggle state
 */
class RotationSettings(context: Context) {

    private val prefs =
        context.applicationContext.getSharedPreferences("rotation_toggle", Context.MODE_PRIVATE)

    var onOrientation: Orientation
        get() = Orientation.fromNameOrDefault(prefs.getString(KEY_ON, Orientation.LANDSCAPE.name))
        set(value) {
            prefs.edit().putString(KEY_ON, value.name).apply()
        }

    var offOrientation: Orientation
        get() = Orientation.fromNameOrDefault(prefs.getString(KEY_OFF, Orientation.PORTRAIT.name))
        set(value) {
            prefs.edit().putString(KEY_OFF, value.name).apply()
        }

    var isOn: Boolean
        get() = prefs.getBoolean(KEY_IS_ON, false)
        set(value) {
            prefs.edit().putBoolean(KEY_IS_ON, value).apply()
        }

    /**
     * Linked-app mode: when true, launching the target app turns Samsung's auto-rotate ON (so the
     * screen follows how you hold the phone) instead of locking a fixed landscape. Leaving the app
     * always returns to locked portrait.
     */
    var linkedUseAutoRotate: Boolean
        get() = prefs.getBoolean(KEY_LINKED_AUTO, false)
        set(value) {
            prefs.edit().putBoolean(KEY_LINKED_AUTO, value).apply()
        }

    /** The last tab the user was on, restored on next launch. */
    var lastTab: String?
        get() = prefs.getString(KEY_LAST_TAB, null)
        set(value) {
            prefs.edit().putString(KEY_LAST_TAB, value).apply()
        }

    private companion object {
        const val KEY_ON = "on_orientation"
        const val KEY_OFF = "off_orientation"
        const val KEY_IS_ON = "is_on"
        const val KEY_LAST_TAB = "last_tab"
        const val KEY_LINKED_AUTO = "linked_use_auto_rotate"
    }
}
