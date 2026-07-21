package com.miracle.perapprotation

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.BatteryAlert
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RotationSettings
import com.miracle.perapprotation.ui.MainViewModel
import com.miracle.perapprotation.ui.screens.BatteryExemptionScreen
import com.miracle.perapprotation.ui.screens.LogScreen
import com.miracle.perapprotation.ui.screens.MainScreen
import com.miracle.perapprotation.ui.screens.OnboardingScreen
import com.miracle.perapprotation.ui.screens.RotationToggleScreen
import com.miracle.perapprotation.ui.theme.PerAppRotationTheme
import com.miracle.perapprotation.util.PermissionUtils
import com.miracle.perapprotation.util.ShortcutHelper

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PerAppRotationTheme {
                AppRoot()
            }
        }
    }
}

private enum class Tab { ROTATE, HOME, LOG, BATTERY }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppRoot() {
    val vm: MainViewModel = viewModel()
    val context = LocalContext.current

    val permissions by vm.permissions.collectAsStateWithLifecycle()
    val apps by vm.apps.collectAsStateWithLifecycle()
    val rules by vm.rules.collectAsStateWithLifecycle()
    val isLoading by vm.isLoadingApps.collectAsStateWithLifecycle()
    val searchQuery by vm.searchQuery.collectAsStateWithLifecycle()
    val showSystemApps by vm.showSystemApps.collectAsStateWithLifecycle()
    val serviceConnected by vm.serviceConnected.collectAsStateWithLifecycle()
    val activePackage by vm.activePackage.collectAsStateWithLifecycle()
    val activeOrientation by vm.activeOrientation.collectAsStateWithLifecycle()
    val forceRotation by vm.forceRotation.collectAsStateWithLifecycle()
    val logs by vm.logs.collectAsStateWithLifecycle()
    val onboardingDone by vm.onboardingDone.collectAsStateWithLifecycle()

    // Refresh permission state whenever we return to the app.
    androidx.lifecycle.compose.LifecycleResumeEffect(Unit) {
        vm.refreshPermissions()
        onPauseOrDispose { }
    }

    // Onboarding is shown only until the user completes it once (persisted in DataStore).
    var onboardingDismissed by rememberSaveable { mutableStateOf(false) }

    // Restore the last-used tab from persistent settings, and save it whenever it changes.
    val rotationSettings = remember { RotationSettings(context) }
    var selectedTab by rememberSaveable {
        mutableStateOf(
            runCatching { Tab.valueOf(rotationSettings.lastTab ?: Tab.ROTATE.name) }
                .getOrDefault(Tab.ROTATE)
        )
    }
    androidx.compose.runtime.LaunchedEffect(selectedTab) {
        rotationSettings.lastTab = selectedTab.name
    }

    if (!onboardingDone && !onboardingDismissed) {
        Scaffold(
            topBar = { AppBar() }
        ) { inner ->
            OnboardingScreen(
                permissions = permissions,
                onOpenAccessibility = { PermissionUtils.openAccessibilitySettings(context) },
                onOpenOverlay = { PermissionUtils.openOverlaySettings(context) },
                onOpenBattery = {
                    vm.setOnboardingDone()
                    onboardingDismissed = true
                    selectedTab = Tab.BATTERY
                },
                onFinish = {
                    vm.setOnboardingDone()
                    onboardingDismissed = true
                },
                modifier = Modifier.padding(inner)
            )
        }
        return
    }

    Scaffold(
        topBar = { AppBar() },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == Tab.ROTATE,
                    onClick = { selectedTab = Tab.ROTATE },
                    icon = { Icon(Icons.Filled.ScreenRotation, contentDescription = null) },
                    label = { Text("회전") }
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.HOME,
                    onClick = { selectedTab = Tab.HOME },
                    icon = { Icon(Icons.Filled.Apps, contentDescription = null) },
                    label = { Text("앱별") }
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.LOG,
                    onClick = { selectedTab = Tab.LOG },
                    icon = { Icon(Icons.AutoMirrored.Filled.ListAlt, contentDescription = null) },
                    label = { Text("로그") }
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.BATTERY,
                    onClick = { selectedTab = Tab.BATTERY },
                    icon = { Icon(Icons.Filled.BatteryAlert, contentDescription = null) },
                    label = { Text("절전") }
                )
            }
        }
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) {
            when (selectedTab) {
                Tab.ROTATE -> RotationToggleScreen(
                    writeSettingsGranted = permissions.writeSettings,
                    onGrantWriteSettings = { PermissionUtils.openWriteSettings(context) }
                )

                Tab.HOME -> MainScreen(
                    permissions = permissions,
                    serviceConnected = serviceConnected,
                    activePackage = activePackage,
                    activeOrientation = activeOrientation,
                    apps = apps,
                    rules = rules,
                    isLoading = isLoading,
                    searchQuery = searchQuery,
                    showSystemApps = showSystemApps,
                    forceRotation = forceRotation,
                    onSearchChange = vm::onSearchChange,
                    onToggleSystemApps = vm::onToggleSystemApps,
                    onToggleForceRotation = vm::setForceRotation,
                    onGrantWriteSettings = { PermissionUtils.openWriteSettings(context) },
                    onOrientationSelected = { app, orientation ->
                        vm.setOrientation(app.label, app.packageName, orientation)
                    },
                    onAddShortcut = { app ->
                        val orientation = rules[app.packageName] ?: Orientation.DEFAULT
                        val ok = ShortcutHelper.requestPin(context, app, orientation.label)
                        Toast.makeText(
                            context,
                            if (ok) "'${app.label} ${orientation.label}' 바로가기를 홈 화면에 추가합니다."
                            else "현재 런처가 바로가기 추가를 지원하지 않습니다.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                )

                Tab.LOG -> LogScreen(
                    logs = logs,
                    onSave = vm::saveLogsToFile,
                    onClear = vm::clearLogs
                )

                Tab.BATTERY -> BatteryExemptionScreen(
                    batteryExempt = permissions.batteryExempt,
                    onRequestExemption = {
                        PermissionUtils.requestIgnoreBatteryOptimizations(context)
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppBar() {
    TopAppBar(
        title = {
            Text(
                text = "${stringRes()} v${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.titleLarge
            )
        }
    )
}

@Composable
private fun stringRes(): String =
    LocalContext.current.getString(R.string.app_name)
