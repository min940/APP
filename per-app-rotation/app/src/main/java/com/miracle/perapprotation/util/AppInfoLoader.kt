package com.miracle.perapprotation.util

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Loads the list of launchable installed apps (off the main thread). */
object AppInfoLoader {

    suspend fun loadLaunchableApps(context: Context): List<InstalledApp> =
        withContext(Dispatchers.IO) {
            val pm = context.packageManager
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

            val resolved = pm.queryIntentActivities(launcherIntent, 0)
            val seen = HashSet<String>()
            val myPackage = context.packageName

            resolved.mapNotNull { info ->
                val appInfo = info.activityInfo.applicationInfo
                val pkg = appInfo.packageName
                if (pkg == myPackage) return@mapNotNull null
                if (!seen.add(pkg)) return@mapNotNull null

                val isSystem = (appInfo.flags and
                    (ApplicationInfo.FLAG_SYSTEM or ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0

                InstalledApp(
                    packageName = pkg,
                    label = runCatching { pm.getApplicationLabel(appInfo).toString() }
                        .getOrDefault(pkg),
                    icon = runCatching { pm.getApplicationIcon(appInfo) }.getOrNull(),
                    isSystemApp = isSystem
                )
            }.sortedBy { it.label.lowercase() }
        }
}
