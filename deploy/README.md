# 도메인 배포

Docker Compose가 설치된 공개 서버와 도메인을 준비합니다.
프로젝트를 서버에 복사하고 DNS A 레코드를 서버 공인 IPv4로 지정합니다.
AAAA 레코드는 서버 IPv6가 연결된 경우에만 설정합니다. 방화벽에서 TCP 80/443을 허용합니다.

.env.production.example을 .env.production으로 복사하고 DOMAIN과 DB_PASSWORD를 변경합니다.
DOMAIN에는 프로토콜이나 경로 없이 도메인만 입력합니다. 비밀번호는 긴 임의 값으로 지정합니다.

```sh
docker compose --env-file .env.production -f compose.prod.yaml up --build -d
docker compose --env-file .env.production -f compose.prod.yaml logs -f gateway backend
```

https://설정한도메인 으로 접속합니다. Caddy가 HTTPS 인증서를 발급/갱신하고 HTTP를 HTTPS로 전환합니다.
REST와 WebSocket은 동일 도메인을 사용합니다. DB와 백엔드 포트는 공개하지 않습니다.
서로 다른 기기에서 두 계정을 가입하고 친구를 추가하여 대화하세요. 개발자 도구에서 /ws의 101 응답을 확인합니다.

compose.prod.yaml은 로컬 compose.yaml과 합치지 않고 단독으로 사용합니다.
데이터와 인증서는 볼륨에 보존됩니다. down -v는 데이터를 삭제하므로 사용하지 마세요.
로컬 DB 데이터는 새 서버로 자동 복사되지 않습니다. 백엔드 재시작 시 다시 로그인해야 합니다.
실제 도메인 연결과 인증서 발급은 대상 서버에서 검증해야 합니다.
