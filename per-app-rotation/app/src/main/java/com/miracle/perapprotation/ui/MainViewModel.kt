package com.miracle.perapprotation.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.miracle.perapprotation.data.LogRepository
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RuleRepository
import com.miracle.perapprotation.service.ServiceState
import com.miracle.perapprotation.util.AppInfoLoader
import com.miracle.perapprotation.util.InstalledApp
import com.miracle.perapprotation.util.PermissionUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MainViewModel(app: Application) : AndroidViewModel(app) {

    private val ruleRepository = RuleRepository.get(app)

    // --- Permissions ---
    private val _permissions = MutableStateFlow(PermissionState())
    val permissions: StateFlow<PermissionState> = _permissions.asStateFlow()

    // --- Installed apps ---
    private val _apps = MutableStateFlow<List<InstalledApp>>(emptyList())
    val apps: StateFlow<List<InstalledApp>> = _apps.asStateFlow()

    private val _isLoadingApps = MutableStateFlow(false)
    val isLoadingApps: StateFlow<Boolean> = _isLoadingApps.asStateFlow()

    // --- UI filters ---
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _showSystemApps = MutableStateFlow(false)
    val showSystemApps: StateFlow<Boolean> = _showSystemApps.asStateFlow()

    // --- Rules (persisted) ---
    val rules: StateFlow<Map<String, Orientation>> =
        ruleRepository.rulesFlow.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyMap()
        )

    // --- Forced-rotation engine toggle (persisted) ---
    val forceRotation: StateFlow<Boolean> =
        ruleRepository.forceRotationFlow.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = false
        )

    // --- Live service status ---
    val serviceConnected: StateFlow<Boolean> = ServiceState.isServiceConnected
    val activePackage: StateFlow<String?> = ServiceState.activePackage
    val activeOrientation: StateFlow<Orientation> = ServiceState.activeOrientation

    // --- Logs ---
    val logs = LogRepository.entries

    init {
        refreshPermissions()
        loadApps()
    }

    fun refreshPermissions() {
        val ctx = getApplication<Application>()
        _permissions.value = PermissionState(
            accessibility = PermissionUtils.isAccessibilityEnabled(ctx),
            overlay = PermissionUtils.canDrawOverlays(ctx),
            batteryExempt = PermissionUtils.isIgnoringBatteryOptimizations(ctx),
            writeSettings = PermissionUtils.canWriteSettings(ctx)
        )
    }

    fun setForceRotation(enabled: Boolean) {
        viewModelScope.launch {
            ruleRepository.setForceRotation(enabled)
            LogRepository.info(if (enabled) "강제 회전 모드 켜짐" else "강제 회전 모드 꺼짐")
        }
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

    fun onSearchChange(query: String) {
        _searchQuery.value = query
    }

    fun onToggleSystemApps(show: Boolean) {
        _showSystemApps.value = show
    }

    fun setOrientation(appLabel: String, packageName: String, orientation: Orientation) {
        viewModelScope.launch {
            try {
                ruleRepository.setRule(packageName, orientation)
                LogRepository.success("$appLabel(${packageName}) → ${orientation.label} 저장됨")
            } catch (t: Throwable) {
                LogRepository.error("규칙 저장 실패: ${t.message}")
            }
        }
    }

    fun saveLogsToFile() {
        val file = LogRepository.saveToFile(getApplication())
        if (file != null) {
            LogRepository.success("로그 저장됨: ${file.name}")
        }
    }

    fun clearLogs() {
        LogRepository.clear()
        LogRepository.info("로그를 지웠습니다.")
    }
}
