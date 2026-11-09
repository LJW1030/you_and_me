# 검증 결과 (2026-11-09)

## 자동 검증 통과
- React TypeScript 검사 및 Vite production build.
- Java 17 Gradle test + bootJar. JUnit 3건: JSON 요청 크기 제한, 요청 본문 보존, burst 제한·헬스 경로 예외.
- 실제 임시 PostgreSQL 18.6에 Flyway V1/V2/V3 적용 성공. (기본 Compose/권장 배포 PostgreSQL 17과 버전 차이 있음.)
- 가입/로그인, 1:1 동시 생성, 동일 clientMessageId 재전송 중복 저장 방지.
- 36건 커서 페이지 조회, 비회원 401·비참여자 403, 읽음 위치 단조 증가.
- 아이디/비밀번호 검증, 프로필 변경, 비밀번호 변경 후 세션 폐기, 인증 시도 제한.
- 실제 Java 프로세스 재시작 후 기존 쿠키 로그인과 저장 메시지 유지.
- Playwright Chromium 데스크톱/360px 모바일 독립 컨텍스트: 가입·친구·메시지, 중복 없음, 새로고침 복원, 가로 넘침 없음.
- 브라우저 오프라인 후 35건 누락 동기화, 서버 저장 후 응답 유실 시 중복 방지.
- 비밀번호 변경 시 열린 WebSocket 종료와 REST 세션 무효화.
- 전송 응답을 지연시킨 상태에서 다른 방으로 SPA 이동: 이전 방 메시지가 새 방에 섞이지 않음.
- 공개 웹 shell/health 경로와 보호된 room/push API 상태 코드.
- Capacitor Android sync, App/Push Notifications 플러그인 연결.

## 검증 범위의 한계
브라우저 모바일 화면 테스트는 실제 Android WebView 테스트가 아닙니다. 모든 통합 검증은 같은 로컬 실행 환경이며 인터넷의 서로 다른 네트워크를 사용하지 않았습니다. 외부 DB와 Render의 512 MB 메모리 한도·TLS 프록시·슬립 복귀는 검증하지 않았습니다. Docker 실행 환경이 없어 루트 Docker 이미지 자체 빌드는 미실시이며 Node/Gradle 빌드와 Spring 정적 페이지 제공을 각각 검증했습니다.

FCM 전송 코드와 클라이언트 등록/갱신/로그아웃 처리 코드는 추가했으나 Firebase 프로젝트 설정·기기 토큰이 없어 실제 수신은 미검증입니다. 푸시 큐는 메모리 방식이고 전송 재시도 보장을 하지 않습니다. 7일 경과 만료, 기기 강제 중지/절전, APK 덮어 설치, 백업 복원 실측은 DEVICE_TESTS.md에서 확인해야 합니다.

## 외부 서비스 상태
- 실제 인터넷 접속 주소: 없음. 외부 배포 미실시.
- Render/Neon/Firebase 계정 연결 확인 안 됨. 자원 생성/유료 업그레이드 없음.
- 기존 Android ID `kr.nirangnae.chat`은 보존했으며 외부 Firebase 등록은 미실시.
- 기존 설치본의 서명키가 제공되지 않아 동일 서명 업데이트를 검증할 수 없음.

## 재현
실행 중인 로컬 Compose 서비스 또는 별도 테스트 배포를 대상으로:
```sh
node tests/cloud-contract.mjs
node tests/integration.mjs
node tests/accounts.mjs
node tests/browser-regression.mjs
node tests/room-switch.mjs
```
`accounts.mjs`는 마지막에 인증 요청 제한을 검사하므로 같은 서버에서 다음 테스트를 연속 실행할 때 1분 창 종료를 기다리거나 테스트 서버만 재시작하세요. 검증용 새 계정/메시지를 생성하므로 운영 데이터에 무작정 실행하지 않습니다. API 테스트는 TEST_BASE_URL 지정 가능하며, 기존 browser-regression은 localhost:3000을 사용합니다. persistence.mjs는 capture() 후 서버 재시작, 반환된 검증 함수 실행으로 사용합니다. 브라우저 테스트 전 frontend에서 npm ci, npx playwright install chromium을 실행합니다.

원시 결과는 verification/ 폴더에 있습니다. 최초 Gradle 직접 다운로드는 네트워크 경로 문제로 실패했으나 프록시/인증서·JDK 환경을 구성한 뒤 백엔드 빌드에 성공했습니다. 이 환경 전용 프록시 설정은 프로젝트에 넣지 않았습니다.

## Android 생성물
JDK 21 + Android SDK 36으로 `:app:assembleDebug` 산출물이 생성되었습니다. APK 서명 v2 검증, 패키지/버전/권한 추출을 통과했습니다. `artifacts/nirangnae-1.0.2-install-check.apk`는 **서버 미연결 설치 확인용**입니다. 설치·실행 검증 완료 또는 채팅 가능 APK로 간주하지 않습니다. 권한은 인터넷, 알림, 네트워크 상태, FCM 수신, wake lock 및 내부 수신자용 서명 권한이며 연락처·위치·저장소 권한은 없습니다. 최초 기본 JRE에는 컴파일러가 없어 실패했으나 별도 JDK 21로 해결했습니다.
