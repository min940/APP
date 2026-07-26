package com.miracle.perapprotation.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.miracle.perapprotation.data.AppSettings
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.rotation.AutoRotate
import com.miracle.perapprotation.service.SessionState
import com.miracle.perapprotation.util.AppInfoLoader
import com.miracle.perapprotation.util.InstalledApp
import com.miracle.perapprotation.util.PermissionUtils
import com.miracle.perapprotation.widget.StartWidgetProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State of the two required permissions (plus the recommended battery exemption). */
data class Readiness(
    val writeSettings: Boolean = false,
    val accessibility: Boolean = false,
    val batteryExempt: Boolean = false
) {
    val ready: Boolean get() = writeSettings && accessibility
}

class MainViewModel(app: Application) : AndroidViewModel(app) {

    private val settings = AppSettings(app)

    private val _readiness = MutableStateFlow(Readiness())
    val readiness: StateFlow<Readiness> = _readiness.asStateFlow()

    private val _targetPackage = MutableStateFlow(settings.targetPackage)
    val targetPackage: StateFlow<String?> = _targetPackage.asStateFlow()

    private val _targetLabel = MutableStateFlow(settings.targetLabel)
    val targetLabel: StateFlow<String?> = _targetLabel.asStateFlow()

    private val _apps = MutableStateFlow<List<InstalledApp>>(emptyList())
    val apps: StateFlow<List<InstalledApp>> = _apps.asStateFlow()

    private val _isLoadingApps = MutableStateFlow(false)
    val isLoadingApps: StateFlow<Boolean> = _isLoadingApps.asStateFlow()

    /** Live auto-rotate state: 1 = on, 0 = locked, -1 = unreadable. */
    private val _autoRotateState = MutableStateFlow(-1)
    val autoRotateState: StateFlow<Int> = _autoRotateState.asStateFlow()

    val sessionTarget: StateFlow<String?> = SessionState.target
    val serviceConnected: StateFlow<Boolean> = SessionState.serviceConnected
    val logs = LogRepository.entries

    init {
        refresh()
    }

    /** Re-reads permissions and the live rotation state; called whenever the screen resumes. */
    fun refresh() {
        val ctx = getApplication<Application>()
        _readiness.value = Readiness(
            writeSettings = PermissionUtils.canWriteSettings(ctx),
            accessibility = PermissionUtils.isAccessibilityEnabled(ctx),
            batteryExempt = PermissionUtils.isIgnoringBatteryOptimizations(ctx)
        )
        _autoRotateState.value = AutoRotate.state(ctx)
        _targetPackage.value = settings.targetPackage
        _targetLabel.value = settings.targetLabel
    }

    fun loadApps() {
        if (_isLoadingApps.value) return
        _isLoadingApps.value = true
        viewModelScope.launch {
            try {
                _apps.value = AppInfoLoader.loadLaunchableApps(getApplication())
            } catch (t: Throwable) {
                LogRepository.error("앱 목록 로딩 실패: ${t.message}")
            } finally {
                _isLoadingApps.value = false
            }
        }
    }

    fun setTarget(app: InstalledApp) {
        settings.setTarget(app.packageName, app.label)
        _targetPackage.value = app.packageName
        _targetLabel.value = app.label
        StartWidgetProvider.refresh(getApplication())
        LogRepository.success("실행할 앱 등록: ${app.label}")
    }

    fun clearLogs() = LogRepository.clear()

    fun saveLogs() {
        LogRepository.saveToFile(getApplication())?.let {
            LogRepository.success("로그 저장됨: ${it.name}")
        }
    }
}
