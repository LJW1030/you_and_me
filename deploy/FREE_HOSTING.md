# 무료 배포 비교
공식 문서 확인일: 2026-11-09. 실제 계정 생성·요금 화면 검증은 미실시.

| 항목 | Render Free + Neon Free (추천) | Oracle Always Free VM (기존 설정 보존) |
|---|---|---|
| Java | Docker Java 17. Render 0.1 CPU, RAM 512 MB. 작은 풀·힙 사용, 실제 여유 메모리 검증 필요 | VM에서 Docker 가능. 확보한 Always Free shape에 맞춰 용량 결정 |
| 실시간 | HTTPS/WSS 지원. 고정 연결 시간 제한 없음, 재배포/재시작 시 끊김 | 직접 프록시·TLS 운영. VM/프록시 설정에 좌우됨 |
| 슬립 | 인바운드 없는 15분 후 서버 슬립, 복귀 약 1분. Neon 5분 유휴 후 compute 정지 | 일반적인 요청 기반 슬립 없음. 유휴 VM 회수 위험 |
| 비용·기간 | 무료 크레딧과 별개 Free. 서버 월 750시간/워크스페이스, Hobby 송신 5 GB. 빌드 한도는 Billing 화면 확인 | Always Free와 30일/$300 체험 별개. Always Free 표시 자원만 대상 |
| 초과 | 카드 없으면 트래픽 초과 서비스 정지, 빌드 초과 새 빌드 중단. 카드 있으면 초과 과금 가능 | 유료 업그레이드 후 무료 한도 초과 과금 가능 |
| DB | Neon 영속 저장 1 GB/프로젝트, 계정 총 20 GB, 월 100 CU-hour·송신 5 GB/프로젝트. 6시간 복구 이력, 수동 스냅샷 1개 | PostgreSQL 직접 운영·백업. 볼륨 수명과 VM 삭제 설정 관리 필요 |
| 파일 | Render 로컬 파일은 슬립/재배포로 사라짐. 이 프로젝트는 파일 첨부를 지원하지 않음 | 영속 볼륨 가능, 직접 관리 |
| 카드 | Neon 불필요. Render 무결제수단 Free 운영 경로가 문서에 명시됨. 계정 검증에서 카드 요구 시 중단 | 신원 확인에 일반적으로 카드 필요, 임시 승인 가능 |
| 사용 목적 | 테스트/프로토타입. Render는 Free를 운영 서비스용으로 권장하지 않음. 상업 운영 전 약관 별도 확인 | 개인·스타트업·기업 사용 사례 명시. 일반 약관 적용 |
| 운영 | Render 로그·Manual Deploy·환경변수, 자동 HTTPS onrender.com 주소 | SSH·Docker 로그/배포·방화벽·인증서 직접 관리 |

Neon 한도 도달 시 compute 중단/쓰기 제한 등 항목별 제한이 적용됩니다. 저장 한도 초과를 자동 삭제로 가정하지 말고 Console 안내에 따라 백업 후 조정합니다. Free에 장기 백업·무중단 SLA가 있다고 가정하지 않습니다. Render의 외부 DB/FCM 통신도 송신량과 service-initiated traffic 제한을 사용합니다.

Render 자체 Free PostgreSQL은 생성 30일 후 만료되고 이후 14일 유예 뒤 삭제되므로 지속 테스트 DB로 선택하지 않았습니다. Oracle은 카드·자원 확보·유휴 회수와 직접 운영 부담 때문에 이번 기본 경로에서 제외했습니다. 기존 Oracle 문서의 자원 수치는 생성 시점 공식 Always Free 정책으로 다시 확인하세요.

무료 상태에서 항상 즉시 전달/알림은 보장할 수 없습니다. 송신자가 요청해야 서버가 깨어나며, 저장 전에는 FCM도 발송되지 않습니다. 서버가 재시작되거나 FCM 요청에 실패하면 푸시를 놓칠 수 있으나 DB 메시지는 앱 재접속 때 조회합니다. 서비스 유지용 가짜 요청은 만들지 않습니다. 실제 대화 화면의 30초 조회는 유실 이벤트 보정용이며 백그라운드에서는 중지합니다.

## 공식 근거
- https://render.com/docs/free
- https://render.com/docs/compute-plans
- https://render.com/docs/outbound-bandwidth
- https://render.com/docs/websocket
- https://render.com/docs/platform-features-by-plan
- https://render.com/docs/docker
- https://neon.com/pricing
- https://neon.com/docs/introduction/plans
- https://www.oracle.com/cloud/free/faq/
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans (FCM은 no-cost 제품. Spark 유지, Billing 연결 금지)
- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/cloud-messaging/send/admin-sdk
- https://firebase.blog/posts/2024/07/understand-fcm-delivery-rates/ (강제 중지/절전·전달 제한)
- https://capacitorjs.com/docs/apis/push-notifications
- https://capacitorjs.com/docs/apis/app
- https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-broker-relay.html (simple broker는 STOMP receipt 미지원)
