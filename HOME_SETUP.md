# 집에서 작업 이어가기

이 저장소는 소스와 마이그레이션을 보관합니다. 실제 DB 데이터, 로그인 세션, .env, 서명 키, node_modules, 빌드 산출물은 Git에 넣지 않습니다.

## 처음 받기

```sh
git clone <저장소-URL> nirangnae
cd nirangnae
cp .env.example .env
docker compose up --build -d
```

Windows PowerShell은 `Copy-Item .env.example .env`를 사용합니다. 접속은 http://localhost:3000 입니다. Docker Desktop과 Git을 먼저 설치합니다.
새 PC의 DB는 빈 상태로 생성됩니다. 기존 대화가 필요하면 별도로 PostgreSQL 백업/복원을 해야 합니다. DB 백업을 공개 저장소에 올리지 마세요.

## 개발

frontend: `npm ci`, `npm run dev` (Node 22 이상)
backend: Java 17, `gradlew.bat bootRun` (DB만 `docker compose up -d db`로 시작)
mobile: `npm ci`, 최신 HTTPS 주소를 MOBILE_TEST_URL로 지정하고 `npm run sync:test`.
Android/iOS 상세 절차는 mobile/README.md를 참고합니다.

작업 시작 전 `git pull --ff-only`, 작업 후 `git add <변경파일>`, `git commit -m "변경 내용"`, `git push`를 실행합니다.
서명 키는 별도 안전한 저장소로 옮겨 동일 키를 유지해야 앱 업데이트 설치가 가능합니다.

## 최초 원격 연결

원격 서비스에서 빈 비공개 저장소를 생성한 후 프로젝트 루트에서:

```sh
git remote add origin <저장소-URL>
git push -u origin main
```

원격 주소와 사용자 인증은 사용자의 실제 계정을 사용해야 합니다. 토큰을 소스나 채팅에 붙여넣지 않습니다.
