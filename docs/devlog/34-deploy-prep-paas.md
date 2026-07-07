# 34. 운영 배포 준비 (PaaS: Railway/Fly)

서버를 로컬 맥북 터널에서 항상 켜진 PaaS로 옮기기 위한 준비물을 리포에 넣었다. 실제 배포(계정 생성·환경변수 입력)는 사람이 하고, 코드/설정은 다 맞춰뒀다.

## 넣은 것
- **`backend/Dockerfile`** — 멀티스테이지(빌드=JDK21+maven wrapper, 실행=JRE21). Railway/Fly/모든 컨테이너 호스트 공용. 로컬에 Docker 없어도 호스트 빌더가 빌드.
- **`backend/fly.toml`** — Fly.io용(헬스체크 `/api/health`, 상시 1대 유지, `/data` 볼륨).
- **prod 프로파일**(application.yml) — DB를 환경변수(`DB_URL/DB_USERNAME/DB_PASSWORD`)로 주입, 운영 로그 레벨 INFO.
- 포트를 **`${PORT:8083}`** 로 — PaaS가 주입하는 PORT 자동 사용(로컬은 8083 유지).
- 카카오 콜백 URL을 코드 하드코딩 → **환경변수 `KAKAO_CALLBACK_URL`** 로 분리. 호스팅 옮겨도 코드 수정 불필요.
- **`docs/release/10-deploy-paas.md`** — Railway(권장)·Fly 단계별 가이드 + 주입할 환경변수 표 + 배포 후 프론트/카카오 연결 절차.

## 왜 Railway 권장인가
MySQL을 쓰는데 Railway는 **원클릭 MySQL**이 있어 가장 간단하다. Fly는 MySQL 매니지드가 없어 외부 DB(Aiven 무료 등)가 필요하다.

## 주의 (가이드에도 명시)
- **업로드 사진은 영속 볼륨(`/data`) 필수.** 컨테이너 파일시스템은 재배포 때 지워져서, 볼륨 없으면 배포마다 사진이 사라진다.
- 심사 기간에도 서버가 상시 떠 있어야 함(min 1대 유지 설정 완료).

## QA
- 백엔드 컴파일 0, **로컬 재부팅 정상(health 200, 에러 0)** — 포트·prod 프로파일 변경이 로컬을 깨지 않음.
- `mvnw package` 단일 jar 산출 확인(Dockerfile 와일드카드 호환).
