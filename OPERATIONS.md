# 니랑내 테스트 배포·운영

## 구조와 현재 상태
React 19.1.1 / Vite 7.1.12 / TypeScript 5.9.3 → Spring Boot 3.5.7 / Java 17 / MyBatis 3.0.4 → PostgreSQL.
기존 docker compose DB는 PostgreSQL 17.6입니다. Flyway V1/V2는 보존하고 V3에 기기 토큰 테이블만 추가합니다.
Android는 Capacitor 8.6.0, SDK 36, min SDK 24(Android 7+), JDK 21로 빌드합니다. 임시 변경이 아니라 기존 패키지 `kr.nirangnae.chat`, 앱 이름 `니랑내`를 그대로 유지했습니다. 새 버전은 1.0.2/code 3.

루트 Dockerfile이 React를 빌드하여 Spring 정적 리소스에 넣습니다. 한 HTTPS origin에서 `/api`, `/ws`, React를 제공합니다. 앱은 기존 Capacitor `server.url` 방식으로 이 신뢰하는 HTTPS origin만 로딩합니다. 따라서 CORS 와일드카드나 cross-site 쿠키가 필요 없습니다. localhost 의존 URL은 개발 프록시/로컬 Compose에만 남습니다. 앱에 DB·FCM 비밀키를 넣지 않습니다.

로그인은 Spring Security + PostgreSQL 저장 세션, HttpOnly/SameSite=Lax 쿠키, cloud에서는 Secure, 최대 7일입니다. Android WebView 전용 쿠키 저장소를 쓰며 localStorage에 인증 토큰을 저장하지 않습니다. 앱 삭제/데이터 초기화 시 재로그인합니다. 세션 탈취 방지를 위해 원격 origin의 소스 변경 권한을 제한해야 합니다.

REST 저장 트랜잭션이 방 순번과 UUID 멱등성을 보장하고 커밋 후 STOMP 이벤트를 보냅니다. 클라이언트는 이벤트/복귀/전면 대화 동기화 때 DB를 커서 조회합니다. 전송 중=로컬 요청 진행, 저장된 seq=서버 저장 확인, 읽지 않은 인원=다른 멤버의 last_read 비교입니다. 푸시 수신을 읽음으로 취급하지 않습니다.

친구, 1:1·그룹방, 텍스트, 30개 커서 페이지, 실패 재전송을 유지합니다. 첨부파일/통화는 없으며 새로 추가하지 않았습니다. 실패 메시지는 메모리에만 있어 프로세스 종료·방 이동 후에는 로컬 초안/실패 목록이 사라집니다. 서버 저장 메시지는 남습니다. 단일 인스턴스용입니다.

## 로컬 실행
Java 17, Node 22 이상, Docker Desktop을 준비합니다.
```sh
cp .env.example .env
docker compose up --build -d
# http://localhost:3000
```
코드만 빌드:
```sh
cd frontend
npm ci
npm run build
cd ../backend
./gradlew test bootJar
```
Windows에서는 `gradlew.bat` 사용. 로컬 API 포트 8080, Vite 개발 포트 5173. Compose 테스트는 3000.

## 외부 배포 순서
1. Render와 Neon 계정을 본인이 연결합니다. Free 플랜, 카드 미등록으로 시작합니다. 유료/카드 요구가 나오면 생성하지 말고 조건을 확인합니다.
2. Neon에서 **새 테스트 프로젝트**를 만듭니다. 기존 DB를 이 코드에 바로 연결하지 않습니다. PostgreSQL 17을 선택하고 Direct connection의 호스트·DB·사용자를 확인합니다.
3. 변경 코드를 본인의 비공개 Git 저장소에 올립니다. 원본 ZIP의 `.git` 이력은 결과 ZIP에 포함하지 않습니다. 기존 저장소에 파일을 덮어 반영하고 diff를 검토한 다음 커밋합니다. `.env`, 서명키, 서비스 계정 JSON은 커밋 금지.
4. Render New Web Service에서 저장소 연결, Docker, 루트 Dockerfile, **Free instance**, health path `/healthz`를 지정합니다. 또는 `render.yaml` Blueprint를 사용합니다. 유료 DB/디스크 리소스는 정의하지 않았습니다.
5. `.env.cloud.example`의 항목을 Render Environment에 입력합니다. `DB_URL=jdbc:postgresql://호스트/DB이름?sslmode=require`, `DB_USER`, `DB_PASSWORD`, `SPRING_PROFILES_ACTIVE=cloud`. 비밀번호는 JDBC URL에 합치지 말고 별도 비밀값으로 입력합니다. `PUSH_ENABLED=false`로 먼저 시작합니다.
6. Deploy가 성공하면 발급된 `https://실제이름.onrender.com`으로 접속합니다. 이 문서의 예시 주소는 실제 배포 주소가 아닙니다. `/healthz`는 JVM 생존만 확인하고 DB를 깨우지 않습니다. DB 준비는 회원가입·로그인으로 별도 확인합니다.
7. 브라우저 A/B 계정을 만든 뒤 친구 추가·대화·새로고침을 확인하고, 아래 Android 빌드를 진행합니다.

Flyway는 기동 시 적용합니다. 기존 DB의 V1/V2 SQL은 수정하지 마세요. 마이그레이션 오류가 나면 로그와 schema history를 확인하고 임의로 repair/clean하지 않습니다.

## APK 빌드와 서명
기존 패키지 ID로 Firebase에 새 앱을 등록하기 전 본인이 이 ID를 계속 쓸지 확정하세요. 코드상의 기존 ID는 유지했으나 외부 등록은 하지 않았습니다.
Android Studio와 JDK 21, Android SDK Platform 36/Build Tools 36을 설치합니다.
```powershell
cd mobile
npm ci
$env:MOBILE_TEST_URL='https://실제로-발급된-서버주소.onrender.com'
npm run sync:test -- android
cd android
.\gradlew.bat :app:assembleDebug
```
결과: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
이것은 로컬 debug 키로 서명되므로 기존 release APK 위 업데이트는 되지 않을 수 있습니다. 기존 배포본과 동일 서명키를 사용하는 것이 원칙입니다. `apksigner verify --print-certs 기존.apk`로 인증서 지문을 비교하세요.

공유용 release는 Android Studio **Generate Signed Bundle / APK → APK**에서 기존 keystore를 프로젝트 외부 경로로 지정합니다. 기존 `mobile/scripts/build-release.sh`는 Docker 전용이며, 키가 없으면 새 키를 만들므로 기존 설치본 업데이트에는 그대로 실행하지 마세요. 먼저 기존 키·alias와 스크립트의 signing 경로를 맞춰야 합니다. 새 키로 바꾸면 동일 패키지 업데이트가 불가능하며 앱 삭제 시 로컬 인증정보가 사라집니다.

테스터에게 APK 전달 후 설치합니다. Play Protect 경고나 실행 실패가 있으면 APK 서명 지문, 패키지·버전, 출처, `adb logcat`의 앱 충돌을 확인합니다. 기기 보호 기능을 끄는 것을 기본 해결법으로 삼지 않습니다. 이전 APK의 경고 원인은 이번 소스 분석만으로 확정할 수 없습니다.

이 앱은 테스트용 원격 웹 로딩 방식입니다. 첫 실행이 오프라인이면 채팅 UI 로딩도 불가능합니다. `offline.html`에서 재시도할 수 있으며 서버 기동을 기다려야 합니다. 스토어용 로컬 번들 전환은 API 인증·origin 구조까지 별도 설계가 필요합니다. PWA는 브라우저 설치이고 APK는 Android 앱/네이티브 FCM 기능을 갖습니다. 이번에는 기존 Capacitor APK를 유지합니다.

## Firebase 푸시 설정
1. 본인 Firebase 프로젝트를 Spark(무료)로 생성/선택합니다. Cloud Billing 연결이나 Blaze 전환은 하지 않습니다.
2. 확정한 Android 패키지 ID로 앱 등록. `google-services.json`을 `mobile/android/app/`에 로컬 저장합니다. 이 파일은 클라이언트 설정이며 서버 서비스 계정 비밀키와 다릅니다.
3. Firebase 프로젝트 설정 → 서비스 계정에서 서버 SDK 자격 증명을 발급받아 Render **Secret Files**에 `firebase-service-account.json`으로 저장합니다. JSON 비밀키를 채팅·Git·APK에 넣지 않습니다.
4. Render 환경변수 `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json`, `PUSH_ENABLED=true`로 재배포. 잘못된 자격 증명은 서버 기동 실패로 드러납니다.
5. Android를 다시 sync/build 후 설치합니다. 로그인 → 내 정보 → 메시지 알림 켜기. Android 13 이상 알림 권한 승인. `messages` 채널을 생성합니다.
6. 로그인한 기기의 등록/갱신 토큰은 현재 서버 세션과 연결됩니다. 로그아웃은 해당 세션 토큰을 삭제하고, 비밀번호 변경은 사용자 전체 토큰·세션을 폐기합니다. 만료 세션의 토큰은 발송 조회에서 제외됩니다. 로그아웃 네트워크 실패는 화면에 표시하고 성공 처리하지 않습니다.
7. 잠금 화면에는 닉네임/본문을 보내지 않습니다. 알림 클릭 시 room ID를 검증한 경로로 이동하며 실제 메시지는 서버의 참여 권한 검사를 거쳐 조회합니다.

전면: STOMP와 REST 동기화. 후면: FCM notification+data. 강제 중지, 절전, 네트워크 단절에서는 지연·누락될 수 있습니다. 이 구현의 푸시 작업은 크기 제한된 메모리 큐로 최선 노력 전송이며, 프로세스 중단/큐 초과/FCM 실패 때 영속 재시도하지 않습니다. 메시지 저장은 성공해도 알림은 누락될 수 있습니다. 로그아웃 직전 이미 FCM으로 넘긴 알림은 취소할 수 없어 한 번 더 표시될 수 있습니다. 푸시까지 재시도 보장이 필요하면 DB outbox를 다음 단계로 추가해야 합니다.

## 재배포·로그·비용
프론트/백 변경 모두 Git push 후 Render 배포 또는 Manual Deploy → Deploy latest commit. 원격 웹 방식이므로 UI 변경만으로 APK 재빌드는 필요 없지만 네이티브 플러그인·권한·서버 URL·패키지 설정 변경은 APK versionCode를 올려 재빌드합니다.
Render Logs에서 기동·Flyway·푸시 오류 코드 확인, Metrics에서 512 MB 메모리 한계 확인, Billing → Monthly Included Usage에서 시간/송신/빌드량 확인. Neon Console에서 compute CU-hour, 저장 공간, 송신량을 확인합니다. 비밀 토큰/비밀번호/메시지 본문을 로그로 출력하지 않습니다.

## DB 백업·복원
매일 또는 대량 테스트 전 로컬의 PostgreSQL 클라이언트(pg_dump/pg_restore, 서버와 같은 major 권장)로 백업합니다. `.pgpass` 또는 사용자 전용 PGPASSFILE에 자격 증명을 보관하고 Unix 권한 600을 설정합니다. 백업 파일은 개인정보이므로 암호화 보관하며 저장소에 올리지 않습니다.
```sh
# libpq용 주소는 jdbc: 접두사가 없습니다. 비밀번호를 커맨드라인에 넣지 않습니다.
pg_dump --dbname="host=NEON_HOST dbname=neondb user=NEON_USER sslmode=require" --format=custom --no-owner --no-acl --file=nirangnae.dump
pg_restore --list nirangnae.dump
# 별도로 생성한 비어 있는 복원용 DB로만 복원. 기존 DB를 덮어쓰지 않습니다.
pg_restore --dbname="host=RESTORE_HOST dbname=restoredb user=RESTORE_USER sslmode=require" --no-owner --no-acl --exit-on-error nirangnae.dump
```
복원 DB에서 로그인·메시지 수를 검증한 후 전환 여부를 결정합니다. 세션·기기 토큰도 백업에 포함되므로 복원본 공개 전 무효화가 필요한지 별도 결정하세요. `--clean`, 볼륨 삭제, 기존 DB 삭제는 사전 확인 없이는 실행하지 않습니다.

## 중단·정리
우선 백업 검증 → Render 서비스 Suspend/자동 배포 해제 → 필요 시 서비스 삭제. Neon DB와 Firebase 프로젝트는 별도 리소스라 남습니다. 삭제는 데이터 소실을 확인한 뒤 본인이 수행합니다. 로컬 `docker compose down`은 볼륨 유지, `down -v`는 데이터 삭제이므로 기본 안내에서 사용하지 않습니다. Firebase 서버 키는 테스트 종료 시 폐기합니다.

## 유료 전환을 검토할 기준
1분 이상의 복귀 지연을 허용할 수 없거나, JVM 메모리 초과, 월 compute/송신/저장 한도 근접, 알림 재시도·장기 백업·가용성 보장이 필요하면 무료 목표와 충돌합니다. 자동으로 업그레이드하지 말고 실제 사용량과 가격을 확인한 뒤 결정합니다. 상세 공식 근거는 `deploy/FREE_HOSTING.md`, 검증 현황은 `VALIDATION.md`, 기기 체크는 `DEVICE_TESTS.md`를 확인하세요.
