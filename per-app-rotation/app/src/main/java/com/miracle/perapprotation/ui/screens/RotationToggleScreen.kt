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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
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
import com.miracle.perapprotation.util.PermissionUtils
import com.miracle.perapprotation.widget.GlobalRotation
import com.miracle.perapprotation.widget.RotationWidgetProvider

private const val REMOTE_DESKTOP_PACKAGE = "com.google.chromeremotedesktop"

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
    var linkedAuto by remember { mutableStateOf(settings.linkedUseAutoRotate) }

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

        // Linked-app (shortcut) behaviour
        SectionCard {
            Text(
                "앱 연동 바로가기 동작",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "홈 화면 바로가기로 앱을 열 때의 동작입니다. 앱을 벗어나면 항상 세로로 고정 복귀합니다.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text("자동 회전 사용", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = if (linkedAuto)
                            "앱 실행 중에는 자동 회전이 켜져 폰을 돌리는 대로 따라갑니다."
                        else
                            "앱 실행 중 지정한 방향(${onOrientation.displayLabel()})으로 고정합니다.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = linkedAuto,
                    onCheckedChange = {
                        linkedAuto = it
                        settings.linkedUseAutoRotate = it
                    }
                )
            }
        }

        // Fullscreen helper (Android does not allow forcing another app into immersive mode).
        SectionCard {
            Text(
                "전체화면으로 쓰기",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "안드로이드는 다른 앱을 강제로 전체화면으로 바꿀 수 없어, 아래 두 곳에서 설정해야 합니다.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = "① 원격 데스크톱 앱 안에서\n화면 위쪽 가운데의 ∨(아래 화살표)를 눌러 도구막대를 열고, 옵션에서 '전체 화면'을 켜세요. 화면에 맞추려면 '화면 크기 조절'도 함께 사용하세요.",
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = "② 삼성 전체 화면 앱 설정\n설정 > 디스플레이 > 전체 화면 앱 → '원격 데스크톱'을 켜면 상단 바 영역까지 사용합니다.",
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { PermissionUtils.openDisplaySettings(context) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("디스플레이 설정 열기")
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = { PermissionUtils.openAppInfo(context, REMOTE_DESKTOP_PACKAGE) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("원격 데스크톱 앱 정보 열기")
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = "좌우 검은 여백은 PC 화면 비율(16:9)과 폰 화면 비율이 달라 생깁니다. 원격 데스크톱의 '화면에 맞추기'로 줄일 수 있습니다.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
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
