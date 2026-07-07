# 10. 운영 백엔드 배포 (PaaS: Railway 권장 / Fly.io 대안)

로컬 맥북 터널을 벗어나 **항상 켜진 서버**로 옮기는 절차. MySQL을 쓰므로 원클릭 MySQL이 있는 **Railway를 권장**하고, Fly.io를 대안으로 정리한다.

준비물은 이미 리포에 있다:
- `backend/Dockerfile` — 어느 호스트든 공용(멀티스테이지, JRE 21)
- `backend/fly.toml` — Fly.io용
- `application.yml`의 **prod 프로파일** — DB를 환경변수(`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`)로 주입
- 포트는 `${PORT:8083}` — PaaS가 주입하는 PORT를 자동 사용

---

## 주입해야 하는 환경변수 (공통)

| 변수 | 값/설명 |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DB_URL` | `jdbc:mysql://<host>:<port>/<db>?serverTimezone=Asia/Seoul&characterEncoding=UTF-8&useSSL=true&allowPublicKeyRetrieval=true` |
| `DB_USERNAME` / `DB_PASSWORD` | DB 계정 |
| `JWT_SECRET` | 32바이트 이상 랜덤 문자열(`openssl rand -base64 48`) |
| `KAKAO_REST_KEY` | 카카오 REST 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 로그인 Client Secret(콘솔에서 "사용함"이면 필수) |
| `KAKAO_CALLBACK_URL` | `https://<새 도메인>/api/auth/kakao/callback` (호스팅 이전 시 필수) |
| `ADMIN_TOKEN` | 질문 배치 생성 엔드포인트 보호용 임의 토큰 |
| `UPLOAD_DIR` | `/data/uploads` (아래 볼륨과 함께) |
| `APP_APPLE_CLIENT_ID` | (선택) 기본값 `trade.hammerslog.today`. 번들ID 다르면 지정 |

> **업로드 사진은 반드시 영속 볼륨에.** 컨테이너 파일시스템은 재배포 때 지워진다. `/data`에 볼륨을 붙이고 `UPLOAD_DIR=/data/uploads`로 둔다. 안 그러면 배포할 때마다 사진이 사라진다.

---

## A. Railway (권장)

1. **프로젝트 생성**: Railway → New Project → **Deploy from GitHub repo** → `seunghw2/couple-diary` 선택.
2. **루트 디렉터리 지정**: 서비스 Settings → **Root Directory = `backend`** (Dockerfile 위치). Railway가 Dockerfile을 자동 인식해 빌드한다.
3. **MySQL 추가**: 프로젝트 안에서 New → Database → **MySQL**. `MYSQLHOST/MYSQLPORT/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD` 변수가 생긴다.
4. **백엔드 서비스 Variables**에 위 표를 입력. DB는 참조 문법으로 연결:
   - `DB_URL` = `jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?serverTimezone=Asia/Seoul&characterEncoding=UTF-8&useSSL=true&allowPublicKeyRetrieval=true`
   - `DB_USERNAME` = `${{MySQL.MYSQLUSER}}`
   - `DB_PASSWORD` = `${{MySQL.MYSQLPASSWORD}}`
5. **볼륨**: 백엔드 서비스 → Volume 추가, Mount Path `/data`. (`UPLOAD_DIR=/data/uploads`)
6. **도메인 발급**: 서비스 Settings → Networking → **Generate Domain** → `https://<something>.up.railway.app`.
7. 배포가 뜨면 `https://<도메인>/api/health` 가 200인지 확인.

첫 배포는 Dockerfile 빌드라 몇 분 걸린다. 로컬에 Docker 없어도 된다(Railway가 빌드).

---

## B. Fly.io (대안 — MySQL은 외부 관리형 필요)

Fly는 MySQL 매니지드가 없어 외부 DB가 필요하다(예: **Aiven 무료 MySQL**, PlanetScale, 또는 Railway MySQL만 따로 사용).

```bash
cd backend
fly launch --no-deploy            # app 이름 지정, fly.toml 이미 있음
fly volumes create today_data --size 1 --region nrt
fly secrets set \
  SPRING_PROFILES_ACTIVE=prod \
  DB_URL="jdbc:mysql://<host>:<port>/<db>?serverTimezone=Asia/Seoul&characterEncoding=UTF-8&useSSL=true&allowPublicKeyRetrieval=true" \
  DB_USERNAME="..." DB_PASSWORD="..." \
  JWT_SECRET="$(openssl rand -base64 48)" \
  KAKAO_REST_KEY="..." KAKAO_CLIENT_SECRET="..." \
  KAKAO_CALLBACK_URL="https://<app>.fly.dev/api/auth/kakao/callback" \
  ADMIN_TOKEN="..."
fly deploy
```
`fly.toml`엔 헬스체크(`/api/health`), 상시 1대 유지, `/data` 볼륨 마운트가 이미 들어있다.

---

## 배포 후 프론트/콘솔 연결

1. **프론트 API 주소**: `frontend/app.json`의 `extra.apiUrl` 과 `frontend/eas.json`의 production `EXPO_PUBLIC_API_URL` 을 새 도메인으로 교체.
2. **카카오 콘솔**: 카카오 로그인 → Redirect URI에 `https://<새 도메인>/api/auth/kakao/callback` 추가하고, 백엔드 `KAKAO_CALLBACK_URL`도 동일 값.
3. **CORS**(웹도 쓸 경우): `app.cors.allowed-origins` 에 웹 오리진 추가. 네이티브 앱만이면 불필요.
4. **DB 초기 데이터**: `ddl-auto=update`라 테이블은 자동 생성. 오늘의 질문 시드는 `ADMIN_TOKEN`으로 `/api/admin/**` 배치 호출(운영 플레이북 참고).

## 심사/출시용 체크
- 심사 기간에도 서버가 항상 떠 있어야 한다(min 1대 유지 설정 완료).
- HTTPS는 Railway/Fly 도메인이 기본 제공.
- 개인정보 처리방침 **공개 URL**은 별도 필요(docs/release/03을 정적 호스팅하거나 이 백엔드에 페이지로 서빙).
