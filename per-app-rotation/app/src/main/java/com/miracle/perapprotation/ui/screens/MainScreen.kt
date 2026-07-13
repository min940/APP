package com.miracle.perapprotation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.ui.PermissionState
import androidx.compose.material3.Button
import androidx.compose.ui.text.font.FontWeight
import com.miracle.perapprotation.ui.components.AppRow
import com.miracle.perapprotation.ui.components.EmptyState
import com.miracle.perapprotation.ui.components.SectionCard
import com.miracle.perapprotation.ui.components.StatusBanner
import com.miracle.perapprotation.util.InstalledApp

@Composable
fun MainScreen(
    permissions: PermissionState,
    serviceConnected: Boolean,
    activePackage: String?,
    activeOrientation: Orientation,
    apps: List<InstalledApp>,
    rules: Map<String, Orientation>,
    isLoading: Boolean,
    searchQuery: String,
    showSystemApps: Boolean,
    forceRotation: Boolean,
    onSearchChange: (String) -> Unit,
    onToggleSystemApps: (Boolean) -> Unit,
    onToggleForceRotation: (Boolean) -> Unit,
    onGrantWriteSettings: () -> Unit,
    onOrientationSelected: (InstalledApp, Orientation) -> Unit,
    onAddShortcut: (InstalledApp) -> Unit,
    modifier: Modifier = Modifier
) {
    val activeLabel = activePackage?.let { pkg ->
        apps.firstOrNull { it.packageName == pkg }?.label ?: pkg
    }

    val filtered = remember(apps, searchQuery, showSystemApps) {
        apps.asSequence()
            .filter { showSystemApps || !it.isSystemApp }
            .filter { it.label.contains(searchQuery, ignoreCase = true) ||
                it.packageName.contains(searchQuery, ignoreCase = true) }
            .toList()
    }

    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(12.dp))
        StatusArea(
            permissions = permissions,
            serviceConnected = serviceConnected,
            activeLabel = activeLabel,
            activeOrientation = activeOrientation
        )

        Spacer(Modifier.height(12.dp))
        ForceRotationCard(
            enabled = forceRotation,
            writeSettingsGranted = permissions.writeSettings,
            onToggle = onToggleForceRotation,
            onGrant = onGrantWriteSettings
        )

        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            placeholder = { Text("앱 이름 검색") }
        )

        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "시스템 앱 표시",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            Switch(checked = showSystemApps, onCheckedChange = onToggleSystemApps)
        }
        HorizontalDivider()

        when {
            isLoading -> Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("앱 목록을 불러오는 중...", style = MaterialTheme.typography.bodyMedium)
            }

            filtered.isEmpty() -> EmptyState("표시할 앱이 없습니다.")

            else -> LazyColumn(Modifier.fillMaxSize()) {
                items(filtered, key = { it.packageName }) { app ->
                    AppRow(
                        app = app,
                        current = rules[app.packageName] ?: Orientation.DEFAULT,
                        onOrientationSelected = { onOrientationSelected(app, it) },
                        onAddShortcut = { onAddShortcut(app) }
                    )
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                    )
                }
            }
        }
    }
}

@Composable
private fun ForceRotationCard(
    enabled: Boolean,
    writeSettingsGranted: Boolean,
    onToggle: (Boolean) -> Unit,
    onGrant: () -> Unit
) {
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = "강제 회전 모드",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "리모트 데스크톱처럼 방향을 고정하는 앱을 시스템 회전으로 강제합니다.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(checked = enabled, onCheckedChange = onToggle)
        }
        if (enabled && !writeSettingsGranted) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = "'설정 수정 허용' 권한이 필요합니다. (PC 연결 불필요)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(Modifier.height(8.dp))
            Button(onClick = onGrant, modifier = Modifier.fillMaxWidth()) {
                Text("설정 수정 허용하기")
            }
        }
    }
}

@Composable
private fun StatusArea(
    permissions: PermissionState,
    serviceConnected: Boolean,
    activeLabel: String?,
    activeOrientation: Orientation
) {
    val (title, subtitle, container, content) = when {
        !permissions.coreReady -> StatusStyle(
            "권한 필요",
            "접근성/오버레이 권한을 허용해야 회전이 동작합니다.",
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.onErrorContainer
        )
        !serviceConnected -> StatusStyle(
            "대기 중",
            "접근성 서비스가 연결되면 감시를 시작합니다.",
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer
        )
        activeLabel != null -> StatusStyle(
            "$activeLabel ${activeOrientation.label} 적용중",
            "대상 앱을 벗어나면 자동으로 세로로 복귀합니다.",
            MaterialTheme.colorScheme.primaryContainer,
            MaterialTheme.colorScheme.onPrimaryContainer
        )
        else -> StatusStyle(
            "감시중",
            "지정한 앱을 실행하면 자동으로 회전됩니다.",
            MaterialTheme.colorScheme.tertiaryContainer,
            MaterialTheme.colorScheme.onTertiaryContainer
        )
    }
    StatusBanner(
        title = title,
        subtitle = subtitle,
        containerColor = container,
        contentColor = content
    )
}

private data class StatusStyle(
    val title: String,
    val subtitle: String,
    val container: androidx.compose.ui.graphics.Color,
    val content: androidx.compose.ui.graphics.Color
)
