package com.miracle.perapprotation.ui.screens

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.BatteryAlert
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.ui.components.SectionCard
import com.miracle.perapprotation.ui.components.StatusPill

@Composable
fun BatteryExemptionScreen(
    batteryExempt: Boolean,
    onRequestExemption: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Filled.BatteryAlert,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(28.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "삼성 절전 예외",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
            StatusPill(granted = batteryExempt)
        }

        Text(
            text = "One UI의 절전 정책이 접근성 서비스를 강제로 종료하면 회전 기능이 간헐적으로 멈출 수 있습니다. 아래 설정으로 이 앱을 절전 대상에서 제외하세요.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Automatic path
        SectionCard {
            Text(
                text = "자동 설정",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "표준 '배터리 최적화 제외' 팝업을 띄웁니다. '허용'을 누르면 완료됩니다.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(12.dp))
            Button(onClick = onRequestExemption, modifier = Modifier.fillMaxWidth()) {
                Text(if (batteryExempt) "다시 확인하기" else "배터리 최적화 제외 요청")
            }
        }

        // Manual path
        SectionCard {
            Text(
                text = "수동 설정 (기종에 따라 다를 수 있음)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(8.dp))
            ManualStep(
                "1) 절전 앱에서 제외",
                "설정 > 배터리 > 백그라운드 사용 제한 > 절전 앱 → 이 앱을 목록에서 제외"
            )
            ManualStep(
                "2) 백그라운드 사용 제한 해제",
                "설정 > 디바이스 케어 > 배터리 > 백그라운드 사용 제한 → '제한 없음'으로 설정"
            )
            ManualStep(
                "3) 자동 실행 허용 (선택)",
                "설정 > 애플리케이션 > 이 앱 > 배터리 → '제한 없음' 확인"
            )
            Spacer(Modifier.height(8.dp))
            // Screenshot placeholder area
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .padding(top = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "[스크린샷 자리]\n기종별 설정 화면 이미지를 여기에 추가하세요.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionCard {
            Text(
                text = "설정하지 않으면 회전 기능이 간헐적으로 멈출 수 있습니다.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

@Composable
private fun ManualStep(title: String, body: String) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(text = title, style = MaterialTheme.typography.titleSmall)
        Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
