package com.miracle.perapprotation.service

import com.miracle.perapprotation.data.Orientation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Live status of the rotation engine, observed by the UI to render the in-app status area
 * ("감시중" / "[앱명] 가로 적용중" / "권한 필요"). This is process-local shared state; the
 * accessibility service and UI run in the same process.
 */
object ServiceState {

    private val _isServiceConnected = MutableStateFlow(false)
    val isServiceConnected: StateFlow<Boolean> = _isServiceConnected.asStateFlow()

    /** Package name of the app the active rotation is currently applied for, or null. */
    private val _activePackage = MutableStateFlow<String?>(null)
    val activePackage: StateFlow<String?> = _activePackage.asStateFlow()

    private val _activeOrientation = MutableStateFlow(Orientation.DEFAULT)
    val activeOrientation: StateFlow<Orientation> = _activeOrientation.asStateFlow()

    fun setConnected(connected: Boolean) {
        _isServiceConnected.value = connected
    }

    fun setActive(packageName: String?, orientation: Orientation) {
        _activePackage.value = packageName
        _activeOrientation.value = orientation
    }

    fun clearActive() {
        _activePackage.value = null
        _activeOrientation.value = Orientation.DEFAULT
    }
}
