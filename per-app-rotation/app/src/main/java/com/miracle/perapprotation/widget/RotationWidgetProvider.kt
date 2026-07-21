package com.miracle.perapprotation.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.Toast
import com.miracle.perapprotation.MainActivity
import com.miracle.perapprotation.R
import com.miracle.perapprotation.data.RotationSettings

/**
 * Home-screen widget that toggles the whole-screen rotation on tap (e.g. portrait ↔ landscape).
 * The ON/OFF orientations are configured in the app's settings.
 */
class RotationWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { renderWidget(context, manager, it) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TOGGLE) {
            if (!GlobalRotation.canWrite(context)) {
                Toast.makeText(context, "먼저 앱에서 '설정 수정 허용'을 켜주세요.", Toast.LENGTH_LONG).show()
                context.startActivity(
                    Intent(context, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            } else {
                GlobalRotation.toggle(context)
            }
            renderAll(context)
        }
    }

    private fun renderAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(
            ComponentName(context, RotationWidgetProvider::class.java)
        )
        ids.forEach { renderWidget(context, manager, it) }
    }

    private fun renderWidget(context: Context, manager: AppWidgetManager, id: Int) {
        val settings = RotationSettings(context)
        val on = settings.isOn
        val orientation = if (on) settings.onOrientation else settings.offOrientation

        val views = RemoteViews(context.packageName, R.layout.widget_rotation)
        views.setTextViewText(R.id.widget_label, orientation.label)
        views.setImageViewResource(
            R.id.widget_icon,
            if (on) R.drawable.ic_widget_landscape else R.drawable.ic_widget_portrait
        )
        views.setOnClickPendingIntent(R.id.widget_root, togglePendingIntent(context))
        manager.updateAppWidget(id, views)
    }

    private fun togglePendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, RotationWidgetProvider::class.java).setAction(ACTION_TOGGLE)
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        const val ACTION_TOGGLE = "com.miracle.perapprotation.ACTION_TOGGLE_ROTATION"

        /** Refresh all placed widgets (e.g. after the user changes settings in the app). */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, RotationWidgetProvider::class.java)
            )
            if (ids.isEmpty()) return
            val intent = Intent(context, RotationWidgetProvider::class.java)
                .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            context.sendBroadcast(intent)
        }
    }
}
