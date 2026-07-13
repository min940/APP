# CLAUDE.md — per-app-rotation

프로젝트 전역 컨텍스트. 이 폴더 안에서만 작업합니다.

## 무엇을 만드는가
특정 앱만 가로(또는 세로/역가로)로 회전시키는 안드로이드 컨트롤러 앱.
폰 기본은 세로, 대상 앱 실행 시에만 회전, 벗어나면 세로 복귀. 상시 알림 없음, 오프라인.

## 확정 사양 (재질문 금지)
- Kotlin + Jetpack Compose + Material 3
- minSdk 26 / target·compileSdk 35
- applicationId `com.miracle.perapprotation`
- 포그라운드 앱 감지: AccessibilityService (`typeWindowStateChanged` 만, 내용 안 읽음)
- 회전 엔진: 1×1px `TYPE_APPLICATION_OVERLAY` + `LayoutParams.screenOrientation`
- 규칙 저장: Jetpack DataStore
- 상시 알림/포그라운드 서비스 사용 안 함
- INTERNET/ACCESS_NETWORK_STATE 권한 없음

## 아키텍처
```
data/
  Orientation.kt          방향 enum ↔ ActivityInfo.screenOrientation
  RuleRepository.kt       DataStore(패키지명→방향), 싱글턴
  LogRepository.kt        인앱 로그(StateFlow, 최대 1000줄, 파일 저장)
service/
  ServiceState.kt         서비스 라이브 상태(StateFlow) — UI 상태 표시용
  OverlayOrientationController.kt  오버레이 생성/방향 변경/제거
  RotationAccessibilityService.kt  포그라운드 감지 → 규칙 조회 → 오버레이 갱신
util/
  PermissionUtils.kt      접근성/오버레이/배터리 권한 확인·설정 인텐트
  AppInfoLoader.kt        설치된 launchable 앱 목록(IO)
  InstalledApp.kt
ui/
  MainViewModel.kt        AndroidViewModel, StateFlow 상태 호이스팅
  PermissionState.kt
  theme/                  Color/Type/Shape/Theme (라이트·다크·Dynamic Color)
  components/             SectionCard, PermissionStepCard, StatusBanner, AppRow, LogPanel
  screens/                Onboarding / Main / Log / BatteryExemption / Previews
MainActivity.kt           edgeToEdge + Scaffold + NavigationBar(홈/로그/절전)
```

## 절대 규칙
1. 모든 작업은 이 폴더 안에서만.
2. 회전은 접근성 + 오버레이 방식. 상시 알림 금지.
3. 인터넷 게이트 넣지 않음.
4. 대상 앱이 아니면 오버레이 OFF (세로 유지 + 팝업 충돌 방지).
5. 접근성은 `typeWindowStateChanged` 만, 내용 안 읽음(패키지명만).
6. 인앱 로그 필수, 민감정보 로깅 금지.
7. 삼성 절전 예외 안내 화면 필수.
8. 앱 강제 kill 금지 — 필요 시 `finishAffinity()`.

## 빌드
`./gradlew assembleDebug` → `adb install -r app/build/outputs/apk/debug/app-debug.apk`
(빌드에는 Android SDK 필요 — `local.properties` 의 `sdk.dir`.)
