# 2026-11-09 테스트 배포 보완

먼저 [배포·운영 안내](OPERATIONS.md), [무료 조건](deploy/FREE_HOSTING.md), [검증 결과](VALIDATION.md)를 읽으세요. 아래는 기존 로컬 실행 안내입니다. 새 푸시/배포 구현과 충돌하는 이전 미구현 설명은 위 문서를 우선합니다.

# 니랑내

React + Spring Boot 3 / Java 17 / PostgreSQL 기반 로컬 텍스트 채팅입니다.

## 실행

Docker Desktop을 시작한 뒤 루트에서:

```sh
cp .env.example .env
docker compose up --build -d
```

접속: http://localhost:3000 (API http://localhost:8080).
DB는 localhost:15432, DB/사용자 doran입니다. 기본 비밀번호는 doran_local입니다.
DB_PASSWORD, DB_PORT를 .env에서 바꿀 수 있습니다. 데이터는 db 볼륨에 보존됩니다.
종료: `docker compose down`. 시작 직후 백엔드 초기화에 수 초가 필요할 수 있습니다.

## IntelliJ + Vite 개발

1. Java 17을 설치하고 IntelliJ에서 backend를 Gradle 프로젝트로 엽니다. Gradle JVM도 17로 지정합니다.
2. `docker compose up -d db`로 PostgreSQL만 시작합니다.
3. backend에서 `./gradlew bootRun` (Windows: `gradlew.bat bootRun`) 또는 kr.doran.App을 실행합니다.
4. frontend에서 `npm ci`, `npm run dev`를 실행합니다. http://localhost:5173 으로 접속합니다.
5. Vite는 /api 및 /ws를 8080으로 프록시합니다.

백엔드 환경 변수: DB_URL (기본 jdbc:postgresql://localhost:15432/doran), DB_USER (doran), DB_PASSWORD (doran_local).
Compose에서는 DB_URL을 내부 db:5432로 설정합니다.

## 검증

```sh
node tests/integration.mjs
cd frontend
npm run build
```

통합 스크립트는 실행 중인 Compose PostgreSQL/API를 사용하며 실행마다 별도 테스트 계정을 생성합니다.
가입/로그인, 양방향 동시 1:1 생성, 동일 키 재전송, 36건 커서 조회, 익명/비멤버 차단, 읽음 위치 단조 증가를 검사합니다.

독립 브라우저 또는 시크릿 창에서 A/B 계정을 가입합니다. 서로 정확한 아이디로 검색하고 친구를 추가한 후 대화를 시작하세요. 한글 전송, 다른 방을 보는 동안 배지 증가, 대화 진입 후 읽음 감소를 확인하세요. C도 추가하여 친구 두 명을 선택하면 그룹방을 만들 수 있습니다.
브라우저 개발자 도구에서 오프라인으로 전환한 뒤 다른 계정으로 35건 전송하고 온라인 복귀를 확인하세요. 실패한 메시지는 같은 키로 재시도됩니다.

## 구현 구조

Flyway가 스키마를 생성합니다. 1:1 고유 키, 메시지 키 및 방별 순번 제약은 DB에서 보장합니다. 메시지 저장 트랜잭션은 방 행을 잠그고 순번을 발급합니다. 읽음 위치는 GREATEST로만 갱신됩니다. MyBatis XML은 커서 이력 조회를 담당합니다.

REST가 저장을 담당하고 커밋 후 사용자 STOMP 큐에 방 변경 알림을 발행합니다. 클라이언트는 연결·이벤트·전면 동기화 시 REST 커서를 반복 조회하며 이력을 병합합니다. 세션 쿠키, REST/CONNECT CSRF, 동일 Origin 및 구독 경로 제한을 사용합니다.

단일 백엔드 인스턴스용입니다. 파일, 푸시, 통화, 멤버 변경, 메시지 수정/삭제는 지원 범위 밖입니다.
브라우저 자동화에 의한 모바일/PC 및 실제 WebSocket 재연결 검증은 아직 수행하지 않았습니다.

공개 도메인 배포: [HTTPS 배포 안내](deploy/README.md).

## 회원 기능 고도화 (1차)

가입 화면에 아이디 중복 확인과 비밀번호 확인이 추가되었습니다. 내 정보에서 닉네임과 비밀번호를 변경합니다.
비밀번호는 8자 이상이며 BCrypt 제약으로 UTF-8 72바이트 이하여야 합니다.
비밀번호 변경 후 저장된 모든 로그인 세션을 삭제합니다. 다시 로그인해야 합니다.
세션은 Flyway V2로 생성한 PostgreSQL 테이블에 저장하며 만료 기간은 7일입니다.
로그인/가입/비밀번호 변경은 경로·접속 IP별 1분 20회로 제한합니다. 같은 네트워크의 사용자는 제한을 공유할 수 있습니다.

검증: `node tests/integration.mjs`, `node tests/accounts.mjs`.
계정 테스트 마지막에 로그인 제한을 검사하므로 재실행 전에 1분을 기다리세요.
프론트 구조: main.tsx(부트스트랩), api.ts(통신), AuthPage.tsx(가입/로그인), ProfilePage.tsx(내 정보), ChatLayout.tsx(친구/대화 화면), useConversation.ts(대화 상태와 실시간 복구).
추가 분리 대상은 친구 화면과 대화 렌더링입니다. 브라우저 자동 회귀 테스트와 서버 재시작 후 세션 유지 실측은 아직 수행하지 않았습니다.
현재 열린 WebSocket은 비밀번호 변경 시 즉시 종료하는 처리가 별도로 필요합니다. REST는 삭제된 세션을 거부합니다.

## 연결 유지 보완

STOMP 서버/클라이언트는 10초 하트비트를 사용합니다. 브라우저는 Worker 타이머와 3배 수신 유예를 사용하고, 재연결 간격은 2초에서 최대 30초까지 증가합니다. 인증 만료는 로그인 화면으로 전환하고 재접속을 중단합니다. 인증 토큰 요청에는 10초 제한을 적용했습니다.

공개 주소 연결 유지 검증 (PowerShell):

```powershell
$env:TEST_BASE_URL='https://현재-테스트-주소'
node tests/connection-stability.mjs
```

이 검증은 45초 유휴 상태에서 하트비트 수신과 재연결 0회를 검사합니다. 임시 터널 만료, 서버 중단, OS의 앱 절전으로 발생하는 연결 종료까지 막을 수는 없습니다. 설치형 앱 배포에도 고정 HTTPS 백엔드가 필요합니다.

Android/iOS 기기 테스트 프로젝트: [mobile/README.md](mobile/README.md). 현재 플랫폼 생성과 동기화까지 확인했으며 설치 파일 빌드는 별도 SDK 환경이 필요합니다.

Oracle Cloud 무료 VM 배포: [설정 및 실행 절차](deploy/oracle/README.md).
