package com.miracle.perapprotation.util

import android.graphics.drawable.Drawable

/** A launchable app the user can assign a rotation rule to. */
data class InstalledApp(
    val packageName: String,
    val label: String,
    val icon: Drawable?,
    val isSystemApp: Boolean
)
