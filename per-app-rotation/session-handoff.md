# Session Handoff — per-app-rotation

## 현재 상태
초기 버전 전체 구현 완료. Kotlin + Compose + Material 3, minSdk 26, applicationId
`com.miracle.perapprotation`.

### 구현 완료
- Gradle 프로젝트 골격 (버전 카탈로그 `gradle/libs.versions.toml`, AGP 8.7.3 / Kotlin 2.0.21 / Compose BOM 2024.12)
- 접근성 서비스 `RotationAccessibilityService` (`typeWindowStateChanged` 만, 내용 안 읽음)
- 오버레이 회전 엔진 `OverlayOrientationController` (1×1px, NOT_FOCUSABLE|NOT_TOUCHABLE, screenOrientation)
- 규칙 저장 `RuleRepository` (DataStore, 패키지명→방향)
- 인앱 로그 `LogRepository` (StateFlow, 최대 1000줄, filesDir/logs 저장)
- 라이브 상태 `ServiceState` → UI 상태 표시("감시중"/"[앱] 가로 적용중"/"권한 필요")
- UI: 온보딩(3단계 권한) / 메인(앱목록+방향 드롭다운+검색+시스템앱 토글) / 로그 / 삼성 절전 예외
- 라이트·다크 테마 + Android 12+ Dynamic Color, @Preview 5종

## ⚠️ 아직 하지 못한 것 (환경 제약)
이 개발 환경에는 **Android SDK 가 없어** 다음을 실행하지 못했습니다:
- `./gradlew assembleDebug` 빌드
- `adb install` 및 실기기/에뮬레이터 LAUNCH-1 ~ LAUNCH-10 점검
- 실제 회전 동작(PoC) 검증

## 다음 사람이 할 일 (실기기/AS 환경에서)
1. Android Studio 로 `per-app-rotation` 열기 → SDK 35 설치 → Gradle Sync
2. `./gradlew assembleDebug` 로 빌드 확인, Lint 치명 오류 점검
3. 실기기(갤럭시 S24) 설치 후:
   - 접근성/오버레이/절전 예외 3단계 권한 부여
   - YouTube 등 대상 앱에 "가로" 지정 → 실행 시 회전, 벗어나면 세로 복귀 확인 (PoC)
   - 로그 패널·상태 표시·로그 저장(`run-as ... ls files/logs`) 확인
4. 회전 안 되는 앱을 발견하면 `README.md` "회전 안 되는 앱" 목록에 정리

## 참고
- Gradle 배포 URL 검증이 사내 프록시에서 차단될 수 있음. 필요 시
  `gradle-wrapper.properties` 의 `validateDistributionUrl=false` 로 조정.
