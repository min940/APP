package com.miracle.perapprotation.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.miracle.perapprotation.R
import com.miracle.perapprotation.StartSessionActivity
import com.miracle.perapprotation.data.AppSettings

/**
 * One-tap home-screen widget: starts a session (auto-rotate on + launch the registered app).
 * The tile shows the registered app's name so it is obvious what it will open.
 */
class StartWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { render(context, manager, it) }
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int) {
        val label = AppSettings(context).targetLabel ?: "앱 등록 필요"

        val views = RemoteViews(context.packageName, R.layout.widget_start)
        views.setTextViewText(R.id.widget_label, label)

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

    companion object {
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
