# Oracle Cloud 무료 VM 배포

서버 생성과 원격 실행은 계정/SSH 연결 후 진행합니다. 이 문서는 서버가 생성되었다는 뜻이 아닙니다.

## 1. OCI 콘솔에서 서버 생성

홈 리전에서 Compute → Instances → Create instance:

- 이름: nirangnae-test
- 이미지: Ubuntu 24.04 ARM64, 무료 대상 이미지
- Shape: VM.Standard.A1.Flex, 1 OCPU / RAM 6 GB (기존 사용량까지 계정 무료 한도 내인지 확인)
- 부트 볼륨: 기본 50 GB, 추가 볼륨·백업 정책·유료 이미지 선택하지 않음
- 네트워크: Internet Gateway에 연결된 public subnet, 공인 IPv4 할당
- SSH 키: 생성된 개인키는 PC에 보관. 키 내용은 Git/채팅에 올리지 않음
- 콘솔의 무료 적용 여부와 전체 사용량 확인 후 생성. 자원 부족 시 유료 shape로 전환하지 않고 대기.

2026-11-09 공식 문서 기준 A1 무료 총량은 2 OCPU / 12 GB 상당, 볼륨은 계정 전체 200 GB입니다. 생성 시 콘솔의 실제 한도/무료 표시가 우선입니다. 장기 유휴 VM은 회수될 수 있으므로 DB 백업을 별도 보관하세요.
https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## 2. 방화벽

OCI VCN Security List 또는 NSG에 stateful TCP 인바운드 규칙:
- 22: 관리 PC 공인 IP/32만 허용
- 80, 443: 0.0.0.0/0 허용
- 5432, 8080, 3000: 외부 공개하지 않음

VM의 OS 방화벽도 확인합니다. 기본 규칙을 flush하거나 SSH를 닫지 마세요. 이미지에 따라 Docker FORWARD/DOCKER-USER 체인 규칙 확인이 필요합니다. 외부 접속 실패 시 로그와 실제 규칙을 확인한 뒤 필요한 80/443만 허용합니다.

## 3. 접속과 코드 받기

```powershell
ssh -i C:\키파일경로\oracle.key ubuntu@공인IP
```

서버에서:

```sh
git clone https://github.com/LJW1030/you_and_me.git
cd you_and_me
sudo bash deploy/oracle/install-docker.sh
```

## 4. 도메인 구매 없는 테스트 HTTPS

공인 IP가 203.0.113.10이라고 가정하면 `nirangnae.203.0.113.10.sslip.io`처럼 IP를 포함한 무료 DNS 이름을 사용할 수 있습니다. 이 IP는 문서 예시이므로 실제 VM 공인 IP로 바꿉니다.
sslip.io는 서버나 터널이 아니라 DNS이며, 트래픽은 OCI VM에 직접 도착합니다. 제3자 무료 DNS 서비스의 장애·인증서 발급 제한은 있을 수 있습니다. 공인 IP 변경 시 주소도 변경됩니다.
https://sslip.io

```sh
sudo bash deploy/oracle/deploy.sh nirangnae.실제공인IP.sslip.io
```

스크립트가 DB 비밀번호를 임의 생성하고 권한을 제한한 .env.production에 보관합니다. 기존 파일은 덮어쓰지 않습니다. Caddy가 인증서를 발급합니다. 최초 검증은 /api/csrf 응답까지이며 두 기기 채팅은 이후 확인해야 합니다.

## 5. 업데이트·백업

```sh
git pull --ff-only
sudo bash deploy/oracle/deploy.sh 동일한도메인
sudo docker compose --env-file .env.production -f compose.prod.yaml logs --tail 100 gateway backend
```

새 서버 DB는 비어 있습니다. 기존 PC 데이터는 자동 복사되지 않습니다. DB 볼륨이나 .env.production을 삭제하지 마세요. 백업 예시:

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml exec -T db pg_dump -U doran -d doran -Fc > "$HOME/doran-backup.dump"
chmod 600 "$HOME/doran-backup.dump"
```

DB 백업은 별도 안전한 저장소에 보관하고 Git에는 넣지 않습니다. APK 주소 변경은 서버 HTTPS·가입·두 사용자 WebSocket 검증 완료 후 진행합니다. 서버 이전만으로 단말 보안 경고가 해소된다고 보장하지 않습니다.
