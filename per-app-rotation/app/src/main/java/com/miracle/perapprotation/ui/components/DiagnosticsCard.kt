package com.miracle.perapprotation.ui.components

import android.content.Context
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.service.ServiceState
import com.miracle.perapprotation.service.WatchState
import com.miracle.perapprotation.util.PermissionUtils
import com.miracle.perapprotation.widget.GlobalRotation

/**
 * Live diagnostics: shows the exact system values the rotation engine depends on, so a
 * misconfiguration (missing permission, auto-rotate stuck) can be spotted at a glance.
 */
@Composable
fun DiagnosticsCard(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    // Bumping this recomposes and re-reads the live system values.
    var refreshTick by remember { mutableIntStateOf(0) }

    val accessibility = remember(refreshTick) { PermissionUtils.isAccessibilityEnabled(context) }
    val writeSettings = remember(refreshTick) { PermissionUtils.canWriteSettings(context) }
    val serviceConnected = remember(refreshTick) { ServiceState.isServiceConnected.value }
    val autoRotate = remember(refreshTick) { readInt(context, Settings.System.ACCELEROMETER_ROTATION) }
    val userRotation = remember(refreshTick) { readInt(context, Settings.System.USER_ROTATION) }
    val watched = remember(refreshTick) { WatchState.watchedPackage }

    SectionCard(modifier = modifier) {
        Text("진단", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))

        DiagRow("접근성 서비스", if (accessibility) "켜짐" else "꺼짐 ⚠️", accessibility)
        DiagRow("서비스 연결", if (serviceConnected) "연결됨" else "끊김 ⚠️", serviceConnected)
        DiagRow("설정 수정 허용", if (writeSettings) "허용됨" else "필요함 ⚠️", writeSettings)
        DiagRow(
            "자동회전(시스템)",
            when (autoRotate) {
                1 -> "켜짐"
                0 -> "꺼짐(고정)"
                else -> "읽기 실패"
            },
            autoRotate >= 0
        )
        DiagRow(
            "화면 방향값",
            when (userRotation) {
                0 -> "세로 (0)"
                1 -> "가로 (90)"
                2 -> "역세로 (180)"
                3 -> "역가로 (270)"
                else -> "읽기 실패"
            },
            userRotation >= 0
        )
        DiagRow("연동 감시 중", watched ?: "없음", watched != null)

        Spacer(Modifier.height(10.dp))
        // Direct test of the auto-rotate mechanism, independent of the app-linking flow.
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = {
                    GlobalRotation.apply(context, Orientation.DEFAULT)
                    refreshTick++
                },
                modifier = Modifier.weight(1f)
            ) { Text("자동회전 켜기") }
            OutlinedButton(
                onClick = {
                    GlobalRotation.apply(context, Orientation.PORTRAIT)
                    refreshTick++
                },
                modifier = Modifier.weight(1f)
            ) { Text("세로 고정") }
        }

        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(onClick = { refreshTick++ }, modifier = Modifier.weight(1f)) {
                Text("새로고침")
            }
            if (!writeSettings) {
                OutlinedButton(
                    onClick = { PermissionUtils.openWriteSettings(context) },
                    modifier = Modifier.weight(1f)
                ) { Text("권한 열기") }
            } else if (!accessibility) {
                OutlinedButton(
                    onClick = { PermissionUtils.openAccessibilitySettings(context) },
                    modifier = Modifier.weight(1f)
                ) { Text("접근성 열기") }
            }
        }
    }
}

@Composable
private fun DiagRow(label: String, value: String, ok: Boolean) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace),
            color = if (ok) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error
        )
    }
}

private fun readInt(context: Context, key: String): Int = try {
    Settings.System.getInt(context.contentResolver, key)
} catch (_: Throwable) {
    -1
}
