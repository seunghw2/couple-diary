# 카카오 로그인 연동 매뉴얼 (인수인계용)

> **목적**: Expo(React Native) + Spring Boot 앱에 **카카오 실로그인**을 붙이는 전 과정.
> 투데이(couple-diary)에서 실제로 붙여 검증한 방식이며, **머슬 게임 등 다른 프로젝트에도 그대로 복붙 가능**하도록 프로젝트 무관하게 정리했다.
> 헷갈리는 콘솔 설정(특히 Redirect URI 위치)과 함정을 콕 집어 적었다.

---

## 0. 30초 요약

- **방식**: OAuth Authorization Code + **서버 콜백(server-callback) 패턴**.
- **왜**: 카카오는 `redirect_uri`로 **HTTPS만** 허용한다. Expo Go의 `exp://...`, 스탠드얼론의 `today://` 같은 커스텀 스킴은 **등록 자체가 거부**됨. 그래서 카카오는 항상 **백엔드 HTTPS 콜백**으로 보내고, 백엔드가 로그인 처리 후 **앱으로 302 리다이렉트**하며 우리 JWT를 붙여준다.
- **비밀 관리**: REST API 키로 하는 **토큰 교환은 전부 백엔드**가 한다. 프론트는 `client_id`(공개값)만 인가 URL에 노출.
- **결과**: 프론트는 카카오 창 한 번 → 우리 백엔드 JWT를 손에 쥔다. 이후는 기존 로그인과 100% 동일.

---

## 1. 전체 흐름 (그림)

```
[앱]                    [카카오]                 [우리 백엔드]              [앱]
 │                        │                         │                      │
 │ 1. WebBrowser로 인가창 열기                       │                      │
 │   authorize?client_id=REST키                     │                      │
 │            &redirect_uri=백엔드콜백(HTTPS)         │                      │
 │            &state=앱 returnUri  ─────────────────▶│                      │
 │                        │                          │                     │
 │                        │ 2. 사용자 동의            │                     │
 │                        │  code로 콜백 302 ────────▶│                     │
 │                        │                          │ 3. code→카카오토큰   │
 │                        │                          │    →유저정보→upsert  │
 │                        │                          │    →우리 JWT 발급    │
 │                        │                          │ 4. state(returnUri)  │
 │                        │                          │    ?token=JWT 로 302 ▶│
 │ 5. WebBrowser가 returnUri 감지 → result.url 에서 token 파싱 ◀────────────┤
 │ 6. 이 토큰으로 로그인 완료 (기존 로그인과 동일)                            │
```

**핵심 트릭**: `state` 파라미터에 앱의 복귀 주소(`returnUri`)를 실어 보낸다 → 백엔드가 로그인 끝내고 그 주소로 되돌려주면서 `?token=` 을 붙인다. OAuth의 `state`는 원래 CSRF 방어용이지만, 여기선 "어디로 돌아갈지"를 나르는 채널로 재활용한다.

---

## 2. 카카오 개발자 콘솔 설정 ⚠️ 가장 헷갈리는 부분

https://developers.kakao.com → 로그인 → **내 애플리케이션**.

### 2-1. 앱 생성 & 앱 키 4종
`앱 설정 > 앱 키`에 4개가 있다. 용도를 헷갈리지 말 것:

| 키 | 용도 | 노출 |
|---|---|---|
| **REST API 키** | **카카오 로그인**(인가·토큰 교환)의 `client_id` | 인가 URL에 노출됨(공개 가능) |
| JavaScript 키 | 카카오맵 JS SDK(지도) | 웹에 노출됨 |
| Native 앱 키 | 카카오 SDK 네이티브 로그인(우린 안 씀) | — |
| Admin 키 | 서버 관리 API | **절대 노출 금지** |

→ 로그인엔 **REST API 키**만 쓴다.

### 2-2. 카카오 로그인 활성화
`제품 설정 > 카카오 로그인` → **활성화 설정 ON**.
("성공적으로 반영되었습니다" 뜨면 됨.)

### 2-3. Redirect URI 등록 ⚠️⚠️ 여기가 제일 함정
직관과 다르게 **`카카오 로그인` 일반/고급 탭에 없다.** (거기 있는 "로그아웃 Redirect URI"랑 헷갈림)

**정확한 위치**:
```
앱 설정 > 앱 키(플랫폼 키) > "REST API 키" 카드 > [수정] > "카카오 로그인 Redirect URI"
```
> 카카오가 UI를 개편해서 위치가 옮겨다닌다. 못 찾으면 `제품 설정 > 카카오 로그인` 화면을 위→아래로 훑고, 그래도 없으면 **REST API 키 상세/수정**을 열어라. `Ctrl/Cmd+F`로 "Redirect" 검색이 가장 빠름(단, 한글 IME면 검색 깨지니 영문 "Redirect"로).

여기에 **백엔드 콜백 절대주소**를 등록한다:
```
https://<백엔드도메인>/api/auth/kakao/callback
```
예) 투데이: `https://today-api.hammerslog.trade/api/auth/kakao/callback`

- 오타 주의(과거에 `callbck`로 한 글자 빠진 적 있음). 등록 후 **한 글자씩 확인**.
- 여러 개 등록 가능. 로컬 테스트용 HTTPS 터널 주소가 따로 있으면 그것도 추가.

### 2-4. 동의항목 (닉네임/이메일)
`제품 설정 > 카카오 로그인 > 동의항목`.
- **닉네임/프로필**은 카카오 **기본 제공 스코프**라 별도 설정 없이도 로그인은 된다. (최근 카카오가 프로필 스코프를 "추가 기능 신청" 뒤로 옮겨서 개별 토글이 안 보일 수 있음 — 없어도 로그인 정상.)
- **이메일**은 사업자 검수가 필요할 수 있고 사용자가 미동의할 수 있다 → 백엔드에서 **이메일 없을 때 폴백**(아래 3-3) 반드시 넣을 것.

### 2-5. Client Secret ⚠️⚠️ KOE010의 원인 (실제로 밟은 함정)
카카오는 **REST API 키 발급 시 Client Secret을 기본 "사용함"으로 켠다.** 켜져 있으면 **토큰 교환에 `client_secret`을 반드시 포함**해야 하고, 빠지면 `KOE010 invalid_client` (authorize는 되는데 토큰 교환만 실패)로 죽는다.

**정확한 위치** (예전 "카카오 로그인 > 보안"에서 이동됨):
```
앱 설정 > 앱 > 플랫폼 키 > "REST API 키"(클릭) > 아래로 스크롤 > "클라이언트 시크릿"
```
직접 URL: `https://developers.kakao.com/console/app/{APP_ID}/config/platform-key` → REST API 키 클릭.

- 여기 시크릿이 **둘**이다: **"카카오 로그인"** 과 **"비즈니스 인증"**. 로그인 토큰 교환엔 반드시 **"카카오 로그인" 시크릿**을 써야 한다. (비즈니스 인증 시크릿을 넣으면 값이 있어도 여전히 KOE010 — 실제로 이걸로 한 번 헤맴.)
- 코드 값은 OCR로 읽지 말고 **복사 버튼**으로 정확히. 32자.
- 대안: 이 화면에서 **활성화 토글을 OFF**로 내리면 client_secret 없이도 동작(보안은 약해짐). 켜두고 백엔드에서 보내는 쪽을 권장.

### 2-6. (지도도 쓸 경우) 플랫폼 > Web 도메인
로그인과 별개. 카카오맵 JS SDK를 쓰면 `앱 설정 > 플랫폼 > Web`에 **서비스 도메인**(웹 origin)을 등록해야 지도가 렌더된다.

---

## 3. 백엔드 구현 (Spring Boot)

패키지 예시는 `com.today` 기준. 파일 5개 + 설정 1개.

### 3-1. 설정 — `application.yml`
```yaml
app:
  kakao:
    rest-key: ${KAKAO_REST_KEY:여기에_REST_API_키}   # 환경변수 우선, 하드코딩 금지(폴백만)
    client-secret: ${KAKAO_CLIENT_SECRET:}          # Client Secret "사용함"이면 필수. 값은 커밋 금지
```
> REST 키·시크릿은 **코드에 직접 박지 말고** env로. yml의 `${ENV:default}`는 로컬 편의용 폴백일 뿐, 운영은 환경변수로 주입.
> 로컬에서 재기동마다 env 넣기 귀찮으면 **`application-local.yml`(gitignore)에 시크릿만** 넣어라 — Spring Boot가 profile=local일 때 실행 디렉터리에서 자동 로드하고, 커밋되지 않는다.

DB: `ddl-auto: update`면 아래 `kakaoId` 컬럼이 **재시작 시 자동 추가**된다(수동 마이그레이션 불필요).

### 3-2. `auth/KakaoClient.java` — 카카오와 직접 통신
`RestClient` 2개로 저수준 호출만 담당:
- `exchangeToken(code, redirectUri)` → `POST https://kauth.kakao.com/oauth/token` (form: grant_type=authorization_code, client_id, redirect_uri, code, **client_secret(있으면)**) → `access_token`
  - ⚠️ Client Secret이 콘솔에서 "사용함"이면 이 폼에 `client_secret`을 **반드시** 넣어야 한다(없으면 KOE010). 값이 비면 안 넣는 조건부로.
- `fetchUser(kakaoAccessToken)` → `GET https://kapi.kakao.com/v2/user/me` (Bearer) → `{ id, kakao_account.email, kakao_account.profile.nickname }`
- 반환 record `KakaoUser(kakaoId, nickname, email)`.
- 실패는 전부 `ErrorCode.KAKAO_AUTH_FAILED`로 감싼다.

### 3-3. `user/UserService.kakaoLogin()` — 로그인 처리(upsert)
```java
public AuthResponse kakaoLogin(KakaoLoginRequest req) {
    String kakaoAccessToken = kakaoClient.exchangeToken(req.code(), req.redirectUri());
    KakaoUser kakaoUser = kakaoClient.fetchUser(kakaoAccessToken);
    User user = userRepository.findByKakaoId(kakaoUser.kakaoId())
            .orElseGet(() -> createKakaoUser(kakaoUser));   // 없으면 신규 생성
    String token = jwtTokenProvider.createAccessToken(user.getId());  // dev-login과 동일한 JWT
    return new AuthResponse(token, UserSummary.of(user));
}
```
- **kakaoId로 식별**(이메일 아님). 이메일은 바뀌거나 미동의될 수 있으니 계정 키로 쓰면 안 됨.
- **이메일 폴백**: 미동의 시 `kakao_{id}@today.local` 같은 합성 이메일로 생성.
- JWT는 **기존 로그인과 똑같은** `JwtTokenProvider.createAccessToken(userId)`로 발급 → 이후 모든 인증이 그대로 동작.

### 3-4. `user/User.java` — 필드 추가
```java
@Column(name = "kakao_id")
private String kakaoId;
// 클래스 @Table 에:
@UniqueConstraint(name = "uk_user_kakao_id", columnNames = "kakao_id")
```
`UserRepository`: `Optional<User> findByKakaoId(String kakaoId);`

### 3-5. `auth/AuthController.java` — 엔드포인트 2개
```java
// (A) 직접 교환 경로 — 프론트가 code를 직접 넘길 때
@PostMapping("/kakao")
public AuthResponse kakaoLogin(@Valid @RequestBody KakaoLoginRequest req) {
    return userService.kakaoLogin(req);
}

// (B) 서버 콜백 경로 — 카카오가 이 URL로 code를 던진다 (★ 실제 쓰는 경로)
@GetMapping("/kakao/callback")
public ResponseEntity<?> kakaoCallback(@RequestParam String code,
                                       @RequestParam(required=false) String state) {
    String redirectUri = "https://<백엔드>/api/auth/kakao/callback"; // 콘솔 등록값과 완전 동일해야 함
    AuthResponse res = userService.kakaoLogin(new KakaoLoginRequest(code, redirectUri));
    if (state == null || state.isBlank())
        return ResponseEntity.ok(res);                    // 폴백: JSON 반환(디버그용)
    URI target = UriComponentsBuilder.fromUriString(state) // state = 앱 returnUri
            .queryParam("token", urlEncode(res.accessToken()))
            .build(true).toUri();
    return ResponseEntity.status(FOUND).location(target).build();  // 앱으로 302 + token
}
```
> `redirectUri`는 **토큰 교환 시에도** 콘솔 등록값과 **글자 하나까지 동일**해야 카카오가 교환을 승인한다. 그래서 상수로 고정.

---

## 4. 프론트 구현 (Expo)

의존성: `expo-web-browser`, `expo-linking`(둘 다 Expo Go 호환).

### 4-1. `lib/config.ts` — 키/URI 정의
```ts
// REST 키: 인가 URL의 client_id (공개값)
export const KAKAO_REST_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_KEY
  ?? Constants.expoConfig?.extra?.kakaoRestKey ?? '';

// 카카오 콘솔에 등록한 백엔드 콜백과 동일해야 함
export const KAKAO_REDIRECT_URI = `${API_URL}/api/auth/kakao/callback`;
```
`app.json`:
```json
{ "expo": { "extra": { "kakaoRestKey": "<REST API 키>" } } }
```

> ⚠️ **주의(투데이 현재값의 함정)**: `KAKAO_REDIRECT_URI`를 `API_URL`(실기기에선 LAN IP)로 조립하면 카카오 콘솔에 등록한 **고정 HTTPS 도메인과 달라져** 교환이 실패할 수 있다. **인가 URL의 `redirect_uri`는 항상 콘솔에 등록한 고정 HTTPS 값**(예: `https://today-api.hammerslog.trade/...`)으로 보내야 한다. 새 프로젝트에선 이 값을 **환경변수로 고정**해 두는 걸 권장.

### 4-2. `lib/kakaoAuth.ts` — 인가 플로우
```ts
export async function loginWithKakao(): Promise<string | null> {
  const returnUri = Linking.createURL('auth');   // exp://.../--/auth 또는 today://auth
  const authUrl =
    'https://kauth.kakao.com/oauth/authorize'
    + `?client_id=${encodeURIComponent(KAKAO_REST_KEY)}`
    + `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}`  // 고정 HTTPS 콜백
    + '&response_type=code'
    + `&state=${encodeURIComponent(returnUri)}`;   // 복귀 주소를 state로

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUri);
  if (result.type !== 'success' || !result.url) return null;      // 취소

  const { queryParams } = Linking.parse(result.url);
  if (queryParams?.error) throw new Error('카카오 로그인 실패');
  const token = queryParams?.token;
  if (typeof token !== 'string' || !token) throw new Error('로그인 응답 오류');
  return token;   // 우리 백엔드 JWT
}
```

### 4-3. store & 로그인 화면
- `store/useAuthStore.ts`: `kakaoLogin()` 액션 — `loginWithKakao()`로 토큰 받아 저장(기존 dev-login과 동일 저장 경로).
- `app/(auth)/login.tsx`: **"카카오로 시작하기"** 버튼(카카오 옐로 `#FEE500`, 검정 텍스트). 개발용 dev-login은 아래로 강등.

---

## 5. 새 프로젝트 이식 체크리스트

카카오 콘솔:
- [ ] 앱 생성 → **REST API 키** 확보
- [ ] 카카오 로그인 **활성화 ON**
- [ ] **Redirect URI** 등록: `https://<새백엔드>/api/auth/kakao/callback` (위치=REST API 키 카드 수정)
- [ ] **Client Secret** 확인: REST API 키 > 클라이언트 시크릿 "카카오 로그인"이 "사용함"이면 **코드 복사**(비즈니스 인증 것 아님!)
- [ ] (지도 쓰면) 플랫폼 > Web 도메인 등록 + JavaScript 키

백엔드:
- [ ] `KakaoClient` 복사 (그대로 재사용 가능)
- [ ] `User`에 `kakaoId` + unique 제약, `UserRepository.findByKakaoId`
- [ ] `UserService.kakaoLogin` (upsert + 기존 JWT 발급) — **이메일 폴백 잊지 말 것**
- [ ] `AuthController`: `/kakao`, `/kakao/callback` — 콜백의 `redirectUri` 상수를 **새 도메인**으로
- [ ] `application.yml` `app.kakao.rest-key`/`client-secret` = **새 값**(env 또는 application-local.yml 주입, 커밋 금지)
- [ ] `KakaoClient` 토큰 교환에 `client_secret` 조건부 포함
- [ ] `ErrorCode.KAKAO_AUTH_FAILED` 추가

프론트:
- [ ] `expo-web-browser`, `expo-linking` 설치
- [ ] `lib/kakaoAuth.ts` 복사, `config`의 REST 키/Redirect URI를 **새 값**으로
- [ ] `app.json extra.kakaoRestKey`
- [ ] 로그인 버튼 + store 액션

---

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| **KOE006** (Redirect URI mismatch) | 인가 URL의 `redirect_uri`가 콘솔 등록값과 **한 글자라도** 다름. 프로토콜(http/https)·끝 슬래시·오타(`callbck`) 확인. 인가 URL의 값 = 콘솔 값 = 토큰 교환 시 값 **셋 다 동일**해야 함. |
| **KOE010** (Bad client credentials, authorize는 되는데 토큰 교환만 실패) | Client Secret "사용함"인데 토큰 요청에 `client_secret` 누락/틀림. 콘솔 REST API 키 > 클라이언트 시크릿 **"카카오 로그인"** 코드를 백엔드 토큰 폼에 넣어라(비즈니스 인증 코드 아님). 2-5 참고. |
| **KOE101 / invalid client** | `client_id`(REST 키) 오타 또는 로그인 비활성 상태. |
| 로그인은 되는데 **이메일 null** | 사용자 미동의/미검수. 백엔드 폴백(`kakao_{id}@…`)으로 계정 생성 — kakaoId를 키로 쓰면 문제없음. |
| 앱으로 **안 돌아옴**(콜백에서 멈춤) | `state`에 `returnUri`가 안 실렸거나, 백엔드가 302를 안 함. 콜백 로그 확인. `state` 없으면 JSON 폴백이 뜸(=state 전달 실패 신호). |
| 콘솔에서 **Redirect URI 칸 못 찾음** | 카카오 로그인 일반/고급이 아니라 **앱 키 > REST API 키 카드 > 수정**. 2-3 참고. |
| 한글 `Cmd+F` 검색 깨짐(콘솔 조작 시) | IME를 영문(ABC)로. 검색어도 영문("Redirect")으로. |
| 실기기에서 교환 실패 | `redirect_uri`가 LAN IP로 조립돼 콘솔 값과 다름 → 고정 HTTPS로 강제(4-1 주의 참고). |

---

## 부록 A. 앱 없이 백엔드만 테스트

콜백이 살아있는지 브라우저로 확인:
```
https://<백엔드>/api/auth/kakao/callback?code=testcode&state=https%3A%2F%2Fexample.com
```
- **302로 example.com?error=... 리다이렉트** → 엔드포인트 배포됨(가짜 code라 교환은 실패하지만 경로는 정상).
- 인가 페이지 자체 검증: 아래 URL을 브라우저로 열어 **카카오 동의 화면**이 뜨면(KOE006 없이) Redirect URI 등록 정상.
```
https://kauth.kakao.com/oauth/authorize?client_id=<REST키>&redirect_uri=<URL인코딩된 콜백>&response_type=code&state=<아무 URL>
```

---

## 부록 B. 맥(사용자 컴퓨터) 직접 조작으로 콘솔 확인·검증 — GUI 자동화

> 카카오 콘솔은 **로그인이 걸린 웹 GUI**라 API로 못 만진다. 그래서 이 연동에서 콘솔 설정 위치 확인·
> Client Secret 읽기·authorize 페이지 KOE006 검증 등은 **에이전트가 사용자 맥 화면을 직접 캡처/클릭**해서 했다.
> 다른 앱에서도 같은 방식으로 콘솔을 눈으로 확인하며 진행할 수 있도록, 실제로 쓴 명령·좌표 규칙·함정을 남긴다.
> (권한: 사용자 맥에 로그인된 브라우저에 카카오 계정이 이미 로그인돼 있어야 함. macOS **화면 기록** 권한 필요.)

### B-0. 준비 도구 (전부 macOS 기본 + cliclick 하나)
| 도구 | 용도 | 설치 |
|---|---|---|
| `screencapture` | 화면 캡처(`/usr/sbin/screencapture`) | 기본 |
| `cliclick` | 좌표 클릭/타이핑(`/opt/homebrew/bin/cliclick`) | `brew install cliclick` |
| `osascript` | 창 활성화·앞으로 가져오기(AppleScript) | 기본 |
| `open` | URL을 기본 브라우저로 열기 | 기본 |

### B-1. 콘솔 페이지 열기 → 캡처 → 눈으로 확인
```bash
# 1) 원하는 콘솔 화면을 브라우저로 연다 (예: 플랫폼 키 = Client Secret/Redirect URI 위치)
open "https://developers.kakao.com/console/app/{APP_ID}/config/platform-key"

# 2) 브라우저 창을 앞으로
osascript -e 'tell application "Google Chrome" to activate'

# 3) 전체 화면 캡처(마우스 커서 제외 -x)
screencapture -x /tmp/kakao.png
```
그다음 캡처 파일을 **Read 툴로 열어 눈으로** Redirect URI 칸/Client Secret 위치를 찾는다.
`open`은 로그인 세션이 살아있는 실제 브라우저를 쓰므로 카카오 콘솔이 그대로 열린다.

### B-2. 좌표 클릭·입력 (필드 수정이 필요할 때)
캡처 이미지는 **논리 좌표(points)** 로 클릭해야 한다. Retina라 이미지 픽셀 ≠ 클릭 좌표.
```
# 캡처가 2000px 폭으로 표시됐을 때의 환산:
#   클릭 좌표(points) = 표시픽셀 × 0.72
#   원본 픽셀        = 표시픽셀 × 1.44
cliclick c:640,300      # (points) 지점 클릭
cliclick t:"https://today-api.hammerslog.trade/api/auth/kakao/callback"   # 포커스된 칸에 타이핑
```
> 좌표는 캡처를 다시 떠 확인하며 조정. 클릭 전후로 `screencapture`로 반영 여부를 확인한다.

### B-3. Client Secret 값 읽기 — OCR 금지, 복사 버튼
Client Secret(32자)은 캡처 이미지에서 **눈/OCR로 읽으면 O↔0, l↔1 오독**으로 KOE010 난다.
- 콘솔의 **복사 버튼**을 클릭(cliclick) → 클립보드로 가져온 뒤 사용:
```bash
pbpaste   # 방금 복사한 시크릿 확인 후 application-local.yml 등에 반영
```
- 시크릿이 **둘("카카오 로그인" / "비즈니스 인증")** 이므로, 복사하는 버튼이 **"카카오 로그인" 쪽**인지 캡처로 확인하고 누를 것(2-5 함정).

### B-4. authorize 페이지 KOE006 검증 (사람 눈으로 최종 확인)
```bash
open "https://kauth.kakao.com/oauth/authorize?client_id=<REST키>&redirect_uri=<URL인코딩 콜백>&response_type=code&state=https%3A%2F%2Fexample.com"
osascript -e 'tell application "Google Chrome" to activate'
screencapture -x /tmp/authorize.png
```
캡처를 열어 **카카오 동의(로그인) 화면**이면 Redirect URI 등록 정상, **"KOE006"** 문구가 보이면 콘솔 등록값과 불일치(2-3).

### B-5. 함정 (실제로 밟은 것)
- **Chrome AppleScript로 JS 실행 불가**: `execute javascript`는 Chrome에서 기본 비활성(보안). localStorage 토큰 주입·DOM 값 읽기가 안 됨 → **캡처로 눈으로** 확인하거나, 콘솔 조작은 클릭/타이핑으로만.
- **한글 IME면 `cliclick t:`·`Cmd+F` 검색이 깨짐**: 입력 전 입력원을 **영문(ABC)** 으로. 콘솔에서 필드 찾을 땐 영문 "Redirect"로 검색.
- **캡처가 지저분(가로 전체 화면)**: 앱/카드 영역만 크롭 — `screencapture -x -R x,y,w,h`(points). 창 포커스가 튀면 바탕화면만 찍히니, 캡처 직전 `osascript ... activate`로 대상 창을 확실히 앞으로.
- **좌표가 어긋남**: 디스플레이 배율·창 위치가 바뀌면 좌표도 바뀐다. **하드코딩 말고 매번 캡처로 재확인**.

> 요약: 콘솔 쪽은 "**열기(open) → 활성화(osascript) → 캡처(screencapture) → 눈으로 확인 → 필요 시 클릭/타이핑(cliclick)**" 루프.
> 값은 반드시 **복사 버튼→pbpaste**, 검증은 **authorize 캡처로 사람 눈** 확인이 가장 확실하다.
