package com.miracle.perapprotation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.data.RotationSettings
import com.miracle.perapprotation.ui.components.SectionCard
import com.miracle.perapprotation.widget.GlobalRotation
import com.miracle.perapprotation.widget.RotationWidgetProvider

@Composable
fun RotationToggleScreen(
    writeSettingsGranted: Boolean,
    onGrantWriteSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val settings = remember { RotationSettings(context) }

    var isOn by remember { mutableStateOf(settings.isOn) }
    var onOrientation by remember { mutableStateOf(settings.onOrientation) }
    var offOrientation by remember { mutableStateOf(settings.offOrientation) }

    val current = if (isOn) onOrientation else offOrientation
    val nextLabel = (if (isOn) offOrientation else onOrientation).displayLabel()

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "화면 회전 전환",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "화면 전체를 지정한 방향으로 전환합니다. 홈 화면 위젯을 누르거나 아래 버튼으로 전환하세요.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (!writeSettingsGranted) {
            SectionCard {
                Text(
                    text = "'설정 수정 허용' 권한이 필요합니다. (PC 연결 불필요)",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = onGrantWriteSettings, modifier = Modifier.fillMaxWidth()) {
                    Text("설정 수정 허용하기")
                }
            }
        }

        // Big toggle button
        Button(
            onClick = {
                GlobalRotation.toggle(context)?.let { isOn = it }
                RotationWidgetProvider.refresh(context)
            },
            enabled = writeSettingsGranted,
            modifier = Modifier
                .fillMaxWidth()
                .height(96.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isOn) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.secondary
            )
        ) {
            Icon(Icons.Filled.ScreenRotation, contentDescription = null)
            Spacer(Modifier.height(4.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "현재: ${current.displayLabel()}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "탭하면 → $nextLabel",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // ON orientation setting
        SectionCard {
            Text("켤 때 방향", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Orientation.LANDSCAPE, Orientation.REVERSE_LANDSCAPE).forEach { option ->
                    FilterChip(
                        selected = onOrientation == option,
                        onClick = {
                            onOrientation = option
                            settings.onOrientation = option
                            if (isOn) GlobalRotation.apply(context, option)
                            RotationWidgetProvider.refresh(context)
                        },
                        label = { Text(option.displayLabel()) }
                    )
                }
            }
        }

        // OFF orientation setting
        SectionCard {
            Text("끌 때 방향", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Orientation.PORTRAIT, Orientation.DEFAULT).forEach { option ->
                    FilterChip(
                        selected = offOrientation == option,
                        onClick = {
                            offOrientation = option
                            settings.offOrientation = option
                            if (!isOn) GlobalRotation.apply(context, option)
                            RotationWidgetProvider.refresh(context)
                        },
                        label = { Text(option.displayLabel()) }
                    )
                }
            }
        }

        // Widget how-to
        SectionCard {
            Text("홈 화면 위젯 추가 방법", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(
                text = "1) 홈 화면 빈 곳을 길게 누르기\n2) '위젯' 선택\n3) '앱별 회전' 위젯을 찾아 홈에 배치\n4) 그 위젯을 누를 때마다 화면이 전환됩니다.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/** "기본" means auto-rotate in this (global) context. */
private fun Orientation.displayLabel(): String =
    if (this == Orientation.DEFAULT) "자동회전" else label
