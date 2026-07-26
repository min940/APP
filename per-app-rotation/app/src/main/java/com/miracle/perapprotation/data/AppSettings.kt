package com.miracle.perapprotation.data

import android.content.Context

/**
 * The app's entire configuration: which single app a session launches.
 * SharedPreferences so the widget's broadcast receiver can read it synchronously.
 */
class AppSettings(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("auto_rotate_launcher", Context.MODE_PRIVATE)

    /** Package name of the one registered app, or null when nothing is chosen yet. */
    var targetPackage: String?
        get() = prefs.getString(KEY_PACKAGE, null)
        set(value) {
            prefs.edit().putString(KEY_PACKAGE, value).apply()
        }

    /** Human-readable label of the registered app, kept for display. */
    var targetLabel: String?
        get() = prefs.getString(KEY_LABEL, null)
        set(value) {
            prefs.edit().putString(KEY_LABEL, value).apply()
        }

    fun setTarget(packageName: String, label: String) {
        prefs.edit()
            .putString(KEY_PACKAGE, packageName)
            .putString(KEY_LABEL, label)
            .apply()
    }

    private companion object {
        const val KEY_PACKAGE = "target_package"
        const val KEY_LABEL = "target_label"
    }
}
