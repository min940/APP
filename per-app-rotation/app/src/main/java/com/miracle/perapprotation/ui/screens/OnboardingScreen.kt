package com.miracle.perapprotation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.ui.PermissionState
import com.miracle.perapprotation.ui.components.PermissionStepCard
import com.miracle.perapprotation.ui.components.SectionCard

@Composable
fun OnboardingScreen(
    permissions: PermissionState,
    onOpenAccessibility: () -> Unit,
    onOpenOverlay: () -> Unit,
    onOpenBattery: () -> Unit,
    onFinish: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "권한 설정",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "특정 앱만 가로로 회전시키려면 아래 3가지 권한이 필요합니다. 화면 내용은 읽지 않고 최상단 앱의 이름만 사용합니다.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        PermissionStepCard(
            step = 1,
            title = "접근성 서비스",
            description = "실행 중인 앱을 감지하려면 접근성 서비스를 켜야 합니다. '설치된 서비스'에서 '앱별 회전 감지'를 활성화하세요.",
            granted = permissions.accessibility,
            actionLabel = "접근성 설정 열기",
            onAction = onOpenAccessibility
        )

        PermissionStepCard(
            step = 2,
            title = "다른 앱 위에 표시",
            description = "회전을 적용하는 투명 오버레이를 띄우기 위해 필요합니다. 화면을 가리거나 터치를 방해하지 않습니다.",
            granted = permissions.overlay,
            actionLabel = "오버레이 권한 열기",
            onAction = onOpenOverlay
        )

        PermissionStepCard(
            step = 3,
            title = "배터리 절전 예외",
            description = "삼성 One UI가 서비스를 강제 종료하지 않도록 배터리 최적화에서 제외합니다. 설정하지 않으면 회전이 간헐적으로 멈출 수 있습니다.",
            granted = permissions.batteryExempt,
            actionLabel = "절전 예외 안내 보기",
            onAction = onOpenBattery
        )

        SectionCard {
            Text(
                text = if (permissions.allGranted) "모든 권한이 설정되었습니다. 시작할 수 있어요!" else "3가지가 모두 허용되면 자동으로 준비 완료 상태가 됩니다.",
                style = MaterialTheme.typography.bodyMedium,
                color = if (permissions.allGranted) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(Modifier.height(4.dp))
        Button(
            onClick = onFinish,
            enabled = permissions.coreReady,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (permissions.allGranted) "설정 완료" else "계속하기")
        }
        TextButton(onClick = onFinish, modifier = Modifier.fillMaxWidth()) {
            Text("나중에 설정하고 앱 목록 보기")
        }
    }
}
