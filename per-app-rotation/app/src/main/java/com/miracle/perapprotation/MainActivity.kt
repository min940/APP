package com.miracle.perapprotation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryAlert
import androidx.compose.material.icons.filled.Home
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.miracle.perapprotation.ui.MainViewModel
import com.miracle.perapprotation.ui.screens.BatteryExemptionScreen
import com.miracle.perapprotation.ui.screens.LogScreen
import com.miracle.perapprotation.ui.screens.MainScreen
import com.miracle.perapprotation.ui.screens.OnboardingScreen
import com.miracle.perapprotation.ui.theme.PerAppRotationTheme
import com.miracle.perapprotation.util.PermissionUtils

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

private enum class Tab { HOME, LOG, BATTERY }

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
    var selectedTab by rememberSaveable { mutableStateOf(Tab.HOME) }

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
                    selected = selectedTab == Tab.HOME,
                    onClick = { selectedTab = Tab.HOME },
                    icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                    label = { Text("홈") }
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
