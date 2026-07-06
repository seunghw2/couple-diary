# 09. 프로덕션 백엔드 / 인프라 요건

현재 백엔드는 임시 터널(`today-api.hammerslog.trade`, cloudflared 계열)로 노출되어 있습니다. 이는 개발/데모용이며 **App Store 심사·운영에는 부적합**합니다(24/7 가용성 미보장 → 로그인 불가 시 거절). 이 문서는 상시 프로덕션 백엔드로 옮기기 위한 요건과 옵션을 정리합니다.

---

## 1. 왜 실서버가 필요한가

- 앱은 로그인·일기·질문·알림 등 거의 모든 기능이 백엔드에 의존.
- 심사 리뷰어가 접속하는 순간 서버가 죽어 있으면 아무 기능도 못 보고 즉시 거절(2.1/5.6).
- 터널은 세션 재시작·PC 종료·네트워크 변동에 취약하고 고정 도메인·인증서를 안정적으로 보장하지 못함.

---

## 2. 프로덕션 요건 체크리스트

- **고정 도메인 + HTTPS**: 예 `api.today.app` 같은 소유 도메인 + 유효한 TLS 인증서(Let's Encrypt/관리형). 자가서명·터널 도메인 금지.
- **상시 가동(24/7)**: 자동 재시작/헬스체크. 단일 노트북 프로세스 금지.
- **데이터베이스**: 개발 MySQL(로컬 Homebrew 3307)에서 **관리형 프로덕션 DB**로 이전. 자동 백업·이중화 권장. 커넥션 정보는 환경변수로 주입.
- **환경변수/시크릿 분리**: 코드·리포지토리에 하드코딩 금지. 최소:
  - `DB_URL` / `DB_USER` / `DB_PASSWORD`
  - `JWT_SECRET` — **개발 시크릿 재사용 금지, 새 강한 랜덤값**(HS512). 유출 시 전 계정 토큰 위조 가능.
  - `KAKAO_REST_KEY` / `KAKAO_CLIENT_SECRET`(사용 시) / `KAKAO_REDIRECT_URI`
  - (Apple 로그인 도입 시) Apple `TEAM_ID` / `KEY_ID` / `.p8` 키 / `BUNDLE_ID` — token 검증·revoke용
- **CORS / 리다이렉트 도메인**: 카카오 로그인 콜백(`.../api/auth/kakao/callback`)이 프로덕션 도메인으로 바뀌므로 **카카오 개발자 콘솔의 Redirect URI·플랫폼 도메인**을 새 주소로 등록. CORS 허용 오리진도 프로덕션 기준으로.
- **모니터링/로깅**: 헬스체크 엔드포인트, 에러 로깅(로그 수집/알람). 최소한 서버 다운 감지.
- **파일/이미지 저장**: 일기 사진 업로드 저장소가 로컬 디스크면 재배포 시 유실 위험 → 객체 스토리지(S3 등) 또는 영속 볼륨 사용 검토(`backend/.../upload`).

---

## 3. 배포 옵션 간단 비교

| 옵션 | 장점 | 단점 | 적합도 |
|---|---|---|---|
| **관리형 PaaS** (Railway, Render, Fly.io) | 배포 쉬움, HTTPS·재시작·로그 기본 제공, 관리형 DB 애드온 | 트래픽 커지면 비용, 세밀한 제어 제한 | 소규모 출시에 가장 무난 |
| **클라우드 VM** (AWS EC2, GCP, Oracle Cloud 등) | 완전한 제어, 프리티어 활용 가능 | Nginx·TLS·systemd·백업 직접 구성, 운영 부담 | 직접 운영에 익숙하면 |
| **컨테이너/오케스트레이션** (ECS, Cloud Run, k8s) | 확장·무중단 배포 | 초기 설정 복잡, 오버스펙 | 초기 출시엔 과함 |

> 권장: 초기에는 **관리형 PaaS + 관리형 MySQL**로 빠르게 상시화하고, 트래픽이 늘면 VM/컨테이너로 확장. Spring Boot는 컨테이너(도커) 이미지로 만들면 대부분의 옵션에 그대로 올릴 수 있음.

---

## 4. 앱 config 연결 (EXPO_PUBLIC_API_URL)

프론트는 API 주소를 다음 우선순위로 읽습니다(`frontend/lib/config.ts`):

1. `EXPO_PUBLIC_API_URL` (환경변수) — **빌드 시 이걸로 주입하는 것을 권장**
2. `app.json` extra.apiUrl
3. 플랫폼별 로컬 기본값

프로덕션 빌드 연결 절차:

1. 프로덕션 서버 도메인 확정(예: `https://api.today.app`).
2. `frontend/eas.json` → `build.production.env.EXPO_PUBLIC_API_URL`을 그 주소로 교체(현재 `https://api.example.com` placeholder).
3. `frontend/app.json` → `extra.apiUrl`도 같은 프로덕션 주소로(폴백 일관성). 카카오 관련값(`kakaoRedirectUri`)도 프로덕션 콜백 도메인으로.
4. 카카오 콘솔의 Redirect URI를 3의 값과 **글자까지 동일**하게 등록(`config.ts` 주석 경고 참고 — redirect_uri는 인가·토큰 교환에서 완전히 일치해야 함).
5. `eas build -p ios --profile production`으로 빌드하면 env가 주입되어 실서버로 붙음.

---

## 5. 이전 체크리스트(요약)

- [ ] 프로덕션 도메인 + HTTPS 확보
- [ ] 관리형 DB 프로비저닝 + 스키마/데이터 이전
- [ ] 환경변수/시크릿 주입(새 JWT_SECRET 포함)
- [ ] 카카오 콘솔 Redirect URI·플랫폼 도메인 프로덕션 등록
- [ ] (Apple 로그인 도입 시) Apple 검증 키·설정
- [ ] 헬스체크·모니터링·자동 재시작
- [ ] 이미지 업로드 영속 저장소
- [ ] `eas.json`·`app.json`의 API/카카오 URL을 프로덕션으로 교체
- [ ] 실기기 TestFlight에서 프로덕션 서버로 전 기능 검증
