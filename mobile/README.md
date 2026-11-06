# 니랑내 모바일 (Android / iOS)

Capacitor 8.6.0 기반의 **기기 테스트용 프로젝트**입니다. 프로젝트 생성 및 동기화는 확인했지만 APK/IPA 빌드와 실기기 실행은 아직 수행하지 않았습니다.

## 현재 방식

기존 세션 쿠키·CSRF·동일 Origin WebSocket 흐름을 보존하기 위해 기기 테스트에서는 HTTPS 서버 화면을 앱 WebView에서 엽니다. `MOBILE_TEST_URL`은 경로 없는 HTTPS Origin만 허용합니다. 현재 임시 주소는 소스에 고정하지 않습니다. 주소가 바뀌면 동기화와 재빌드가 필요합니다. PC/Docker/터널을 종료하면 앱도 서버에 연결할 수 없습니다.

이 설정은 스토어 출시용이 아닙니다. Capacitor의 server.url은 개발/라이브 리로드용입니다. 출시 전에 React 정적 파일을 앱에 포함하고, 고정 HTTPS API와 네이티브 세션/CSRF 및 WebSocket 인증 흐름을 별도로 검증해야 합니다. 앱 아이콘도 현재 Capacitor 기본 아이콘이므로 출시 전 자체 아이콘을 적용해야 합니다.

## 준비

```powershell
cd mobile
npm ci
$env:MOBILE_TEST_URL='https://현재-테스트-주소'
npm run sync:test
```

Node 22 이상이 필요합니다. 앱 이름은 index.html의 현재 이름과 같은 `니랑내`, 임시 앱 ID는 `kr.nirangnae.chat`입니다. 스토어 등록 전 소유자 계정과 최종 ID를 확정해야 합니다.

## Android APK

Android Studio와 Android SDK 36, 호환 JDK(21)를 준비합니다. 백엔드 Java 17 설정은 변경하지 않습니다.

```powershell
npm run open:android
```

Android Studio에서 Gradle 동기화를 완료한 뒤 연결한 Android 기기에서 Run으로 실행합니다. APK는 Build 메뉴의 APK 생성 기능 또는 아래 명령으로 생성합니다.

```powershell
cd android
.\gradlew.bat assembleDebug
```

결과: `android/app/build/outputs/apk/debug/app-debug.apk`.
개인 테스트용 debug APK이며 휴대폰으로 복사해 설치할 수 있습니다. 배포 출처 앱의 설치 허용이 필요할 수 있습니다. Google Play 제출은 별도 릴리스 서명 및 AAB, 계정, 스토어 요건 검토가 필요합니다.

## iPhone / TestFlight

macOS와 Xcode 26 이상이 필요합니다. 프로젝트를 Mac으로 복사한 뒤:

```sh
cd mobile
npm ci
export MOBILE_TEST_URL=https://현재-테스트-주소
npm run sync:test -- ios
npm run open:ios
```

Xcode에서 Signing & Capabilities의 Team을 지정하고 Bundle Identifier를 확인한 뒤 연결한 iPhone을 대상으로 Run합니다. 테스트 배포는 Apple Developer Program 계정과 서명, App Store Connect 앱 등록, Archive 및 TestFlight 업로드가 필요합니다. 현재 원격 로딩 테스트 설정을 그대로 스토어 출시 설정으로 사용하지 않습니다.

## 다음 출시 작업

1. 고정 HTTPS 서버 마련 및 모바일 API/세션 설계 확정.
2. 웹 자산 번들링, 앱 복귀 시 복구, Android 뒤로 가기, 안전 영역과 키보드 실기기 검증.
3. 자체 아이콘, 스플래시, 계정/데이터 삭제 흐름, 개인정보 안내.
4. Android 서명 APK/AAB와 iOS Archive를 빌드하고 내부 배포.
5. 실제 기기 검증 후 스토어 제출. 스토어 승인 여부는 별도 심사 결과에 따릅니다.

## Docker로 테스트 APK 생성 (Windows)

Android Studio 없이 Docker Desktop과 Node로 생성할 수 있습니다.

```powershell
./mobile/scripts/build-apk.ps1 -TestUrl https://현재-테스트-주소
```

결과는 artifacts/nirangnae-test.apk입니다. 현재 주소가 앱에 포함되므로 터널 주소가 변경되면 새 APK가 필요합니다.
서명 키는 nirangnae-android-signing Docker 볼륨에 저장됩니다. 이 볼륨은 다른 PC로 자동 이동하지 않습니다. 동일 앱 업데이트를 유지하려면 키를 안전하게 백업/복원하세요. 키가 달라지면 기존 앱 삭제가 필요하며 기기 로그인 정보가 사라질 수 있습니다.

## 릴리스 서명 / 보안 경고 확인

1.0.1부터 release APK는 디버그 및 WebView 디버깅·로그를 비활성화하고 HTTP 평문 통신과 앱 백업을 금지합니다. 패키지 ID는 그대로 유지합니다. 인터넷 권한만 앱 코드에서 선언합니다.

```powershell
$env:MOBILE_TEST_URL='https://현재-테스트-주소'
npm.cmd --prefix mobile run sync:test -- android
docker run --rm -v "${PWD}:/workspace" -v nirangnae-android-gradle:/root/.gradle -v nirangnae-release-signing:/signing nirangnae-android-builder bash /workspace/mobile/scripts/build-release.sh
```

결과: artifacts/nirangnae-1.0.1.apk. 배포용 키와 비밀번호는 nirangnae-release-signing 볼륨에만 저장됩니다. 키와 비밀번호를 함께 안전하게 백업해야 하며 Git에 넣지 않습니다.
기존 디버그 APK와 서명이 달라 바로 덮어쓰는 업데이트는 불가능합니다. 기존 앱을 삭제하면 기기 내 로그인 정보는 사라지지만 서버 계정과 대화는 유지됩니다.

릴리스 서명 검증은 Google Play Protect의 악성/유해 판정을 통과했다는 뜻이 아닙니다. 유해 앱 경고가 계속되면 설치나 실행을 강행하지 않고 경고 문구·발생 단계·검사 제품을 확인해야 합니다. 오탐 의심 시 Google 공식 개발자 안내에 따라 재검토를 요청합니다. 보안 검사 비활성화, 패키지 ID 변경을 통한 탐지 회피는 해결 방법으로 사용하지 않습니다.
공식 안내: https://developers.google.com/android/play-protect/warning-dev-guidance
현재 원격 웹 로딩/임시 주소는 여전히 기기 테스트용이며 정식 스토어 출시 준비가 완료된 것은 아닙니다.
