package com.miracle.perapprotation.ui

data class PermissionState(
    val accessibility: Boolean = false,
    val overlay: Boolean = false,
    val batteryExempt: Boolean = false
) {
    val allGranted: Boolean get() = accessibility && overlay && batteryExempt

    /** Battery exemption is recommended but not strictly required for rotation to work at all. */
    val coreReady: Boolean get() = accessibility && overlay
}
