# 앱별 회전 (Per-App Rotation)

폰 기본 화면은 **세로로 유지**하고, 사용자가 지정한 **특정 앱을 실행할 때만** 화면을
가로 / 세로 / 역가로로 자동 회전시키는 오프라인 유틸리티입니다. 대상 앱을 벗어나면
자동으로 기본 세로로 복귀합니다. 갤럭시 S24(One UI) 기준으로 설계되었습니다.

- 상단 상시 알림(포그라운드 서비스) **사용 안 함**
- 인터넷 권한 **없음** — 완전한 오프라인 앱
- 화면 내용은 읽지 않고 **최상단 앱의 패키지명만** 사용

## 동작 원리

안드로이드에는 "다른 앱의 방향을 강제하는 공식 API"가 없어, 검증된 우회 기법을 사용합니다.

1. **접근성 서비스** (`RotationAccessibilityService`)
   - `typeWindowStateChanged` 이벤트만 수신하여 최상단 앱의 패키지명을 얻습니다.
   - `canRetrieveWindowContent=false` — 화면 내용은 절대 읽지 않습니다.
2. **오버레이 회전 엔진** (`OverlayOrientationController`)
   - `TYPE_APPLICATION_OVERLAY` 로 **1×1px 투명·비포커스·비터치** 오버레이를 만듭니다.
   - `FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCHABLE` 로 터치·입력을 방해하지 않습니다.
   - `LayoutParams.screenOrientation` 을 규칙에 맞춰 지정하고 `updateViewLayout()` 으로 반영합니다.
3. **규칙 저장** (`RuleRepository`, Jetpack DataStore)
   - `패키지명 → 방향` 규칙을 영구 저장합니다.

```
대상 앱 실행  → 오버레이 ON  → 지정 방향으로 회전
대상 앱 아님  → 오버레이 OFF → 기본 세로 복귀
```

> 대상 앱이 아닐 때는 **반드시 오버레이를 끕니다.** 폰 기본 세로 유지 + 삼성폰에서
> 오버레이가 다른 앱의 권한 팝업을 가로막는 충돌을 방지하기 위한 필수 로직입니다.

## 기술 스택

| 항목 | 값 |
|---|---|
| 언어 / UI | Kotlin + Jetpack Compose + Material 3 |
| minSdk | 26 (Android 8.0) |
| target / compileSdk | 35 |
| applicationId | `com.miracle.perapprotation` |
| 저장소 | Jetpack DataStore (Preferences) |

## 권한

`AndroidManifest.xml` 에 선언된 권한:

- `SYSTEM_ALERT_WINDOW` — 회전용 투명 오버레이 표시
- `QUERY_ALL_PACKAGES` — 앱별 방향 지정을 위한 설치 앱 목록 조회(패키지명만 사용)
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` — One UI 절전으로 인한 서비스 종료 방지
- `WRITE_SETTINGS` — (선택) 강제 회전 모드에서 시스템 회전값 변경. 앱 안에서 권한 부여, PC/adb 불필요

> INTERNET / ACCESS_NETWORK_STATE 는 **선언하지 않습니다**.

## 화면 회전 위젯 (전체 화면 토글) ⭐

방향을 스스로 고정하는 앱(리모트 데스크톱 등)까지 확실히 회전시키려면 **화면 전체를
회전**시키는 방식이 가장 확실합니다. 이를 위해 홈 화면 위젯을 제공합니다.

- 홈 화면에 **"앱별 회전" 위젯**을 배치하고 누르면 화면 방향이 **가로 ↔ 세로로 토글**됩니다.
- 앱의 **회전 탭**에서 "켤 때 방향"(가로/역가로), "끌 때 방향"(세로/자동회전)을 설정합니다.
- 시스템 회전값(`Settings.System.USER_ROTATION`)을 직접 바꾸므로 `WRITE_SETTINGS`
  권한만 있으면 되고 **PC/adb 가 필요 없습니다.**
- 위젯 추가: 홈 화면 길게 누르기 → 위젯 → "앱별 회전" → 배치.

## 강제 회전 모드 (고집 센 앱용)

리모트 데스크톱처럼 **방향을 스스로 고정하는 앱**은 오버레이 명령을 무시합니다. 이런 앱을 위해
홈 화면의 **"강제 회전 모드"** 토글을 켜면, 대상 앱이 실행되는 동안 시스템 회전값
(`Settings.System.USER_ROTATION`)을 직접 바꿔 회전을 강제하고, 앱을 벗어나면 원래 자동 회전
설정으로 복원합니다.

- `WRITE_SETTINGS`(설정 수정 허용) 권한만 필요 — 홈 화면 버튼으로 부여, **PC 연결 불필요**
- 시스템 회전을 바꾸므로 대상 앱이 포그라운드일 때만 일시적으로 적용됩니다.
- 방향을 완전히 하드락한 일부 앱은 이 방식으로도 회전되지 않을 수 있습니다.

## 빌드 & 설치

Android Studio(Koala 이상 권장) 또는 CLI 로 빌드합니다.

```bash
# 디버그 빌드
./gradlew assembleDebug

# 기기에 설치 (USB 디버깅 활성화 필요)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

릴리스(서명) 빌드는 `local.properties.sample` 을 참고해 `local.properties` 에
keystore 정보를 채운 뒤:

```bash
./gradlew assembleRelease
# 결과: app/build/outputs/apk/release/app-release.apk
```

> `local.properties`, keystore(`*.jks`) 는 `.gitignore` 로 커밋에서 제외됩니다.
> 본인·가족용이면 서명된 APK 를 기기에 직접 사이드로드하면 되며 Play 스토어 등록은 불필요합니다.

## 최초 설정 (앱 실행 후)

1. **접근성 서비스 켜기** — 설정 > 접근성 > 설치된 서비스 > "앱별 회전 감지" 활성화
2. **다른 앱 위에 표시** 권한 허용
3. **배터리 절전 예외** — 자동 팝업 허용 + (필요 시) 수동 절전앱 제외
4. 메인 화면에서 앱마다 방향(기본/가로/세로/역가로) 지정

## 화면 구성

- **온보딩**: 3단계 권한을 카드형으로 안내(✅/⚠️ 실시간 표시)
- **메인(홈)**: 인앱 상태 표시 + 설치 앱 목록 + 앱별 방향 드롭다운 + 검색/시스템앱 토글
- **로그**: 인앱 로그 패널(타임스탬프·레벨 색상), 파일 저장/지우기
- **절전**: 삼성 One UI 절전 예외 자동/수동 안내

## 로그 저장 위치

`context.filesDir/logs/YYYYMMDD_HHMMSS.log` (내부 저장소, 저장소 권한 불필요)

```bash
adb shell run-as com.miracle.perapprotation ls files/logs
```

## 알려진 한계

- 방향을 강하게 잠근 일부 앱(특정 게임·카메라 등)은 회전되지 않을 수 있습니다.
  실기기 테스트 후 미지원 앱을 아래에 정리하세요.
- **절전 예외를 설정하지 않으면** One UI 가 접근성 서비스를 재워 회전이 간헐적으로
  멈출 수 있습니다.

### 회전 안 되는 앱 (실기기 확인 결과)

방향을 스스로 강제하는 앱은 오버레이 명령이 무시됩니다. 로그에는 `→ 가로 적용` 이
정상적으로 찍히지만(앱은 명령을 보냄) 화면은 돌지 않습니다.

- **Chrome 리모트 데스크톱** (`com.google.chromeremotedesktop`) — 원격 PC 화면 비율에
  맞춰 앱이 방향을 직접 제어하므로 회전되지 않음. (갤럭시 S24 / One UI 확인)

정상 회전 확인된 앱 예시: 갤러리, 카카오톡.
