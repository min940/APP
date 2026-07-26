package com.miracle.perapprotation.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.widget.RemoteViews
import androidx.core.graphics.drawable.toBitmap
import com.miracle.perapprotation.R
import com.miracle.perapprotation.StartSessionActivity
import com.miracle.perapprotation.data.AppSettings
import com.miracle.perapprotation.service.SessionState

/**
 * One-tap home-screen widget: starts a session (auto-rotate on + launch the registered app).
 * The tile shows the registered app's name so it is obvious what it will open.
 */
class StartWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { render(context, manager, it) }
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int) {
        val settings = AppSettings(context)
        val label = settings.targetLabel ?: "앱 등록 필요"
        val pkg = settings.targetPackage

        val views = RemoteViews(context.packageName, R.layout.widget_start)
        views.setTextViewText(R.id.widget_label, label)

        // Show the registered app's own icon so the tile is recognisable at a glance.
        val icon = pkg?.let { loadAppIcon(context, it) }
        if (icon != null) {
            views.setImageViewBitmap(R.id.widget_app_icon, icon)
        } else {
            views.setImageViewResource(R.id.widget_app_icon, R.drawable.ic_widget_rotate)
        }

        // Badge turns green while a session is running (auto-rotate on).
        views.setInt(
            R.id.widget_badge,
            "setColorFilter",
            if (SessionState.isActive) SESSION_ACTIVE_COLOR else IDLE_COLOR
        )

        val intent = Intent(context, StartSessionActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pending = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pending)
        manager.updateAppWidget(id, views)
    }

    /** Loads the target app's launcher icon as a bitmap RemoteViews can display. */
    private fun loadAppIcon(context: Context, pkg: String): Bitmap? = try {
        context.packageManager.getApplicationIcon(pkg).toBitmap(ICON_PX, ICON_PX)
    } catch (_: Throwable) {
        null
    }

    companion object {
        private const val ICON_PX = 144
        private const val SESSION_ACTIVE_COLOR = 0xFF7BE495.toInt()
        private const val IDLE_COLOR = 0x66FFFFFF

        /** Refreshes every placed widget, e.g. after the registered app changes. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, StartWidgetProvider::class.java)
            )
            if (ids.isEmpty()) return
            context.sendBroadcast(
                Intent(context, StartWidgetProvider::class.java)
                    .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            )
        }
    }
}
