package com.miracle.perapprotation.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.data.LogEntry

/** The app's single screen: register one app, check readiness, start a session. */
@Composable
fun HomeScreen(
    readiness: Readiness,
    targetLabel: String?,
    autoRotateState: Int,
    sessionActive: Boolean,
    logs: List<LogEntry>,
    onPickApp: () -> Unit,
    onGrantWriteSettings: () -> Unit,
    onGrantAccessibility: () -> Unit,
    onBatteryExemption: () -> Unit,
    onStart: () -> Unit,
    onSaveLogs: () -> Unit,
    onClearLogs: () -> Unit,
    onCopyLog: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusBanner(sessionActive = sessionActive, autoRotateState = autoRotateState)

        // 1. The single registered app
        Section(title = "실행할 앱") {
            Text(
                text = targetLabel ?: "아직 등록되지 않았습니다",
                style = MaterialTheme.typography.titleMedium,
                color = if (targetLabel != null) MaterialTheme.colorScheme.onSurface
                else MaterialTheme.colorScheme.error
            )
            Spacer(Modifier.height(10.dp))
            OutlinedButton(onClick = onPickApp, modifier = Modifier.fillMaxWidth()) {
                Text(if (targetLabel == null) "앱 등록하기" else "앱 변경")
            }
        }

        // 2. Readiness
        Section(title = "준비 상태") {
            ReadyRow(
                label = "설정 수정 허용",
                granted = readiness.writeSettings,
                onFix = onGrantWriteSettings
            )
            Spacer(Modifier.height(6.dp))
            ReadyRow(
                label = "접근성 서비스",
                granted = readiness.accessibility,
                onFix = onGrantAccessibility
            )
            Spacer(Modifier.height(6.dp))
            ReadyRow(
                label = "배터리 절전 예외 (권장)",
                granted = readiness.batteryExempt,
                onFix = onBatteryExemption
            )
        }

        // 3. Start now
        Button(
            onClick = onStart,
            enabled = readiness.ready && targetLabel != null,
            modifier = Modifier.fillMaxWidth().height(60.dp)
        ) {
            Icon(Icons.Filled.PlayArrow, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("지금 실행", style = MaterialTheme.typography.titleMedium)
        }

        // 4. Two ways to launch from the home screen
        Section(title = "홈 화면에서 실행하기") {
            Text(
                text = "① 실행 아이콘 (폴더·바로가기 모음에 넣기 좋음)\n" +
                    "앱 서랍에 '자동회전 실행' 아이콘이 따로 있습니다. 일반 앱 아이콘이라 폴더에 넣거나 " +
                    "바로가기 모음 앱에서 선택할 수 있고, 누르면 화면 없이 바로 실행됩니다.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = "② 위젯\n홈 화면 빈 곳을 길게 누르기 → 위젯 → '자동회전 런처' 배치. " +
                    "등록한 앱 아이콘과 실행 상태가 함께 표시됩니다.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // 5. Log — tap any line to copy it, or copy the whole log at once.
        Section(title = "기록") {
            if (logs.isEmpty()) {
                Text(
                    text = "아직 기록이 없습니다.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Text(
                    text = "줄을 누르면 복사됩니다.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(4.dp))
                logs.takeLast(20).reversed().forEach { entry ->
                    val line = "[${entry.timeStamp}] ${entry.message}"
                    Text(
                        text = line,
                        style = MaterialTheme.typography.labelSmall,
                        color = logColor(entry),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onCopyLog(line) }
                            .padding(vertical = 3.dp)
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(
                    onClick = {
                        onCopyLog(
                            logs.joinToString("\n") { "[${it.timeStamp}] ${it.message}" }
                        )
                    },
                    modifier = Modifier.weight(1f)
                ) { Text("전체 복사") }
                TextButton(onClick = onSaveLogs, modifier = Modifier.weight(1f)) { Text("저장") }
                TextButton(onClick = onClearLogs, modifier = Modifier.weight(1f)) { Text("지우기") }
            }
        }
    }
}

@Composable
private fun logColor(entry: LogEntry) = when (entry.level) {
    com.miracle.perapprotation.data.LogLevel.SUCCESS -> MaterialTheme.colorScheme.primary
    com.miracle.perapprotation.data.LogLevel.WARNING -> MaterialTheme.colorScheme.tertiary
    com.miracle.perapprotation.data.LogLevel.ERROR -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurface
}

@Composable
private fun StatusBanner(sessionActive: Boolean, autoRotateState: Int) {
    val (title, subtitle, container, content) = when {
        sessionActive -> Quad(
            "실행 중 — 자동 회전 켜짐",
            "앱을 벗어나면 자동으로 세로로 돌아갑니다.",
            MaterialTheme.colorScheme.primaryContainer,
            MaterialTheme.colorScheme.onPrimaryContainer
        )
        autoRotateState == 1 -> Quad(
            "자동 회전 켜짐",
            "현재 화면이 폰 방향을 따라갑니다.",
            MaterialTheme.colorScheme.tertiaryContainer,
            MaterialTheme.colorScheme.onTertiaryContainer
        )
        else -> Quad(
            "대기 중 — 세로 고정",
            "위젯이나 '지금 실행'을 누르면 시작합니다.",
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer
        )
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = container)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = content
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = content.copy(alpha = 0.9f)
            )
        }
    }
}

private data class Quad(
    val title: String,
    val subtitle: String,
    val container: androidx.compose.ui.graphics.Color,
    val content: androidx.compose.ui.graphics.Color
)

@Composable
private fun Section(
    title: String,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun ReadyRow(label: String, granted: Boolean, onFix: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (granted) Icons.Filled.CheckCircle else Icons.Filled.Warning,
            contentDescription = null,
            tint = if (granted) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.error,
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
        if (!granted) {
            TextButton(onClick = onFix) { Text("설정") }
        }
    }
}

/** Simple centered placeholder used while the app list loads. */
@Composable
fun LoadingBox(message: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(message, style = MaterialTheme.typography.bodyMedium)
    }
}
