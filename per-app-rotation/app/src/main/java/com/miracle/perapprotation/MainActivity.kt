package com.miracle.perapprotation

import android.content.ClipData
import android.content.ClipboardManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.miracle.perapprotation.session.SessionStarter
import com.miracle.perapprotation.session.StartResult
import com.miracle.perapprotation.ui.AppPickerScreen
import com.miracle.perapprotation.ui.HomeScreen
import com.miracle.perapprotation.ui.MainViewModel
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppRoot() {
    val vm: MainViewModel = viewModel()
    val context = LocalContext.current

    val readiness by vm.readiness.collectAsStateWithLifecycle()
    val targetPackage by vm.targetPackage.collectAsStateWithLifecycle()
    val targetLabel by vm.targetLabel.collectAsStateWithLifecycle()
    val apps by vm.apps.collectAsStateWithLifecycle()
    val isLoadingApps by vm.isLoadingApps.collectAsStateWithLifecycle()
    val autoRotateState by vm.autoRotateState.collectAsStateWithLifecycle()
    val sessionTarget by vm.sessionTarget.collectAsStateWithLifecycle()
    val logs by vm.logs.collectAsStateWithLifecycle()

    // Permissions and the live rotation state can change outside the app.
    LifecycleResumeEffect(Unit) {
        vm.refresh()
        onPauseOrDispose { }
    }

    var picking by rememberSaveable { mutableStateOf(false) }

    // Load the app list only when the picker is opened.
    LaunchedEffect(picking) {
        if (picking) vm.loadApps()
    }

    BackHandler(enabled = picking) { picking = false }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (picking) "앱 선택" else stringResource()) },
                navigationIcon = {
                    if (picking) {
                        IconButton(onClick = { picking = false }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                        }
                    }
                }
            )
        }
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) {
            if (picking) {
                AppPickerScreen(
                    apps = apps,
                    isLoading = isLoadingApps,
                    selectedPackage = targetPackage,
                    onSelect = { app ->
                        vm.setTarget(app)
                        picking = false
                    }
                )
            } else {
                HomeScreen(
                    readiness = readiness,
                    targetLabel = targetLabel,
                    autoRotateState = autoRotateState,
                    sessionActive = sessionTarget != null,
                    logs = logs,
                    onPickApp = { picking = true },
                    onGrantWriteSettings = { PermissionUtils.openWriteSettings(context) },
                    onGrantAccessibility = { PermissionUtils.openAccessibilitySettings(context) },
                    onBatteryExemption = {
                        PermissionUtils.requestIgnoreBatteryOptimizations(context)
                    },
                    onStart = {
                        when (SessionStarter.start(context)) {
                            StartResult.STARTED -> Unit
                            StartResult.NO_TARGET ->
                                toast(context, "실행할 앱을 먼저 등록하세요.")
                            StartResult.NO_PERMISSION ->
                                toast(context, "'설정 수정 허용' 권한이 필요합니다.")
                            StartResult.LAUNCH_FAILED ->
                                toast(context, "앱을 실행할 수 없습니다.")
                        }
                    },
                    onSaveLogs = vm::saveLogs,
                    onClearLogs = vm::clearLogs,
                    onCopyLog = { text ->
                        val clipboard = context.getSystemService(ClipboardManager::class.java)
                        clipboard?.setPrimaryClip(ClipData.newPlainText("log", text))
                        toast(context, "복사되었습니다")
                    }
                )
            }
        }
    }
}

@Composable
private fun stringResource(): String = LocalContext.current.getString(R.string.app_name)

private fun toast(context: android.content.Context, message: String) {
    Toast.makeText(context, message, Toast.LENGTH_LONG).show()
}
