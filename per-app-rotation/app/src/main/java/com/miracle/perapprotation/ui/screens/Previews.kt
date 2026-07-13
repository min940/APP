package com.miracle.perapprotation.ui.screens

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.miracle.perapprotation.data.LogEntry
import com.miracle.perapprotation.data.LogLevel
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.ui.PermissionState
import com.miracle.perapprotation.ui.theme.PerAppRotationTheme
import com.miracle.perapprotation.util.InstalledApp

// Realistic sample data mirroring a typical device's launchable apps.
private val sampleApps = listOf(
    InstalledApp("com.google.android.youtube", "YouTube", null, false),
    InstalledApp("com.netflix.mediaclient", "Netflix", null, false),
    InstalledApp("com.instagram.android", "Instagram", null, false),
    InstalledApp("com.kakao.talk", "카카오톡", null, false),
    InstalledApp("com.google.android.apps.maps", "지도", null, false),
    InstalledApp("com.android.chrome", "Chrome", null, false)
)

private val sampleRules = mapOf(
    "com.google.android.youtube" to Orientation.LANDSCAPE,
    "com.netflix.mediaclient" to Orientation.REVERSE_LANDSCAPE
)

@Preview(name = "메인 - 감시중", showBackground = true)
@Composable
private fun MainScreenPreview() {
    PerAppRotationTheme {
        Surface(Modifier.fillMaxSize()) {
            MainScreen(
                permissions = PermissionState(accessibility = true, overlay = true, batteryExempt = true),
                serviceConnected = true,
                activePackage = null,
                activeOrientation = Orientation.DEFAULT,
                apps = sampleApps,
                rules = sampleRules,
                isLoading = false,
                searchQuery = "",
                showSystemApps = false,
                onSearchChange = {},
                onToggleSystemApps = {},
                onOrientationSelected = { _, _ -> }
            )
        }
    }
}

@Preview(name = "메인 - 가로 적용중", showBackground = true)
@Composable
private fun MainScreenActivePreview() {
    PerAppRotationTheme {
        Surface(Modifier.fillMaxSize()) {
            MainScreen(
                permissions = PermissionState(accessibility = true, overlay = true, batteryExempt = false),
                serviceConnected = true,
                activePackage = "com.google.android.youtube",
                activeOrientation = Orientation.LANDSCAPE,
                apps = sampleApps,
                rules = sampleRules,
                isLoading = false,
                searchQuery = "",
                showSystemApps = false,
                onSearchChange = {},
                onToggleSystemApps = {},
                onOrientationSelected = { _, _ -> }
            )
        }
    }
}

@Preview(name = "온보딩", showBackground = true)
@Composable
private fun OnboardingPreview() {
    PerAppRotationTheme {
        Surface(Modifier.fillMaxSize()) {
            OnboardingScreen(
                permissions = PermissionState(accessibility = true, overlay = false, batteryExempt = false),
                onOpenAccessibility = {},
                onOpenOverlay = {},
                onOpenBattery = {},
                onFinish = {}
            )
        }
    }
}

@Preview(name = "로그 패널", showBackground = true)
@Composable
private fun LogScreenPreview() {
    val now = 0L
    val sampleLogs = listOf(
        LogEntry(now, LogLevel.SUCCESS, "접근성 서비스 연결됨. 앱 감시를 시작합니다."),
        LogEntry(now, LogLevel.INFO, "com.google.android.youtube → 가로 적용"),
        LogEntry(now, LogLevel.INFO, "com.android.chrome → 기본(세로) 복귀"),
        LogEntry(now, LogLevel.WARNING, "오버레이 권한이 없어 회전을 적용하지 못했습니다."),
        LogEntry(now, LogLevel.ERROR, "회전 적용 중 오류: example")
    )
    PerAppRotationTheme {
        Surface(Modifier.fillMaxSize()) {
            LogScreen(logs = sampleLogs, onSave = {}, onClear = {})
        }
    }
}

@Preview(name = "절전 예외 안내", showBackground = true)
@Composable
private fun BatteryScreenPreview() {
    PerAppRotationTheme {
        Surface(Modifier.fillMaxSize()) {
            BatteryExemptionScreen(batteryExempt = false, onRequestExemption = {})
        }
    }
}
