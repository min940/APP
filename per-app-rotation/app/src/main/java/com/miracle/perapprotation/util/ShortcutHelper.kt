package com.miracle.perapprotation.util

import android.content.Context
import android.content.Intent
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.core.graphics.drawable.toBitmap
import com.miracle.perapprotation.LaunchShortcutActivity
import com.miracle.perapprotation.R

/** Creates pinned home-screen shortcuts that launch a target app (rotation applied by the service). */
object ShortcutHelper {

    fun isSupported(context: Context): Boolean =
        ShortcutManagerCompat.isRequestPinShortcutSupported(context)

    /**
     * Asks the launcher to pin a shortcut that opens [app] (with the given [orientationLabel] in its
     * name, e.g. "가로"). Returns false if pinning is unsupported by the current launcher.
     */
    fun requestPin(context: Context, app: InstalledApp, orientationLabel: String): Boolean {
        if (!isSupported(context)) return false

        val launchIntent = Intent(context, LaunchShortcutActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra(LaunchShortcutActivity.EXTRA_PACKAGE, app.packageName)
        }

        val icon = runCatching {
            app.icon?.toBitmap(192, 192)?.let { IconCompat.createWithBitmap(it) }
        }.getOrNull() ?: IconCompat.createWithResource(context, R.mipmap.ic_launcher)

        val info = ShortcutInfoCompat.Builder(context, "launch_${app.packageName}_$orientationLabel")
            .setShortLabel("${app.label} $orientationLabel")
            .setLongLabel("${app.label} ($orientationLabel)")
            .setIcon(icon)
            .setIntent(launchIntent)
            .build()

        return ShortcutManagerCompat.requestPinShortcut(context, info, null)
    }
}
