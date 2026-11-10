# 푸시 1.0.4 검증 결과 — 2026-11-10

## 성공
- React TypeScript 검사 및 Vite production build.
- Java 17 Gradle test bootJar. 총 8개 테스트, 실패 0개 (기존 3개 + PushServiceTest 5개).
- PostgreSQL WASM에서 V1–V4 마이그레이션 실행.
- 서버에서 추출한 실제 SQL로 작업 중복 방지, 발신자·비참여자 제외, 읽음·세션만료·토큰계정변경·방탈퇴 발송 제외 확인.
- 로그아웃 토큰 삭제 시 FK CASCADE로 작업 삭제 확인.
- 메시지와 발송 작업의 동일 트랜잭션 롤백 확인.
- 설정 검사: 누락 파일, 서비스 계정 비밀키, 잘못된 패키지 거부; 올바른 형태의 가짜 테스트 설정 허용.
- 실제 프로젝트의 Firebase 사전 검사: google-services.json 없음으로 예상대로 실패.
- Capacitor Android sync 완료. Render HTTPS origin 반영.

## 진행 중 발견하고 수정한 문제
- Mockito 매처의 JdbcTemplate.update 오버로드 모호성: 타입 지정으로 해결.
- 이 실행 환경의 JVM 동적 agent 연결 불가: Gradle 테스트 JVM에 Mockito agent 명시로 해결.

## 수행하지 못한 항목
- 새 APK 컴파일·서명·실기기 실행: Firebase Android 설정 파일 및 이 작업 환경의 Android SDK/기존 서명 키 연결이 필요.
- 실제 FCM 발송·백그라운드 수신·알림 선택 이동·업데이트 설치.
- Neon 실제 연결 및 Render 재시작/슬립 시나리오.
- GitHub push 및 Render 배포.
- iOS 네이티브 푸시 / 홈 화면 웹앱 Web Push.

FCM 모킹과 PostgreSQL WASM 검증은 실제 네트워크·Android OS·다중 서버 JDBC 트랜잭션을 대체하지 않는다.
