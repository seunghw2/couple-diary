# 06. App Store 출시 런북 (iOS)

앱 '투데이'(love today) iOS 출시를 위한 단계별 절차서입니다. Expo SDK54 관리형 워크플로이므로 **로컬 Mac에 Xcode 없이 EAS 클라우드 빌드로 진행**할 수 있습니다. macOS가 없어도 EAS가 원격에서 iOS 빌드를 대신 해 줍니다.

> 전제: 이 문서의 명령은 모두 `frontend/` 디렉터리에서 실행합니다.
> 계정 삭제 · Sign in with Apple · 프로덕션 백엔드 등 **심사 blocker는 `08-readiness-audit.md`를 먼저 해결**한 뒤 이 런북을 진행하세요.

---

## 0. 전체 흐름 한눈에

```
Apple Developer 가입 → App Store Connect 앱 생성 → 아이콘/스크린샷/메타 준비
   → eas.json 실값 채우기 → eas build (ios/production)
   → eas submit (또는 Transporter) → TestFlight 내부 테스트
   → 심사 제출 → (거절 시 대응) → 출시
```

각 단계 끝에 **체크포인트**를 두었습니다. 통과하지 못하면 다음 단계로 넘어가지 마세요.

---

## 1. 사전 준비

### 1.1 Apple Developer Program 가입

- https://developer.apple.com/programs/ 에서 가입 ($99/년, 개인 또는 조직).
- 결제 후 승인까지 보통 24~48시간. **여유를 두고 먼저 시작하세요.**
- 개인이 아니라 사업자 명의로 낼 계획이면 D-U-N-S 번호가 필요해 며칠 더 걸립니다.

**체크포인트:** developer.apple.com에 로그인해 "Membership" 상태가 Active로 보이면 통과.

### 1.2 App Store Connect 앱 생성

- https://appstoreconnect.apple.com → My Apps → `+` → New App.
- 입력값:
  - Platform: iOS
  - Name: `투데이` (스토어 노출명, 나중에 변경 가능하나 중복 불가)
  - Primary Language: Korean
  - **Bundle ID: `trade.hammerslog.today`** — `frontend/app.json`의 `ios.bundleIdentifier`와 **글자까지 정확히 일치**해야 합니다. (Bundle ID 목록에 없으면 먼저 Certificates, Identifiers & Profiles에서 등록하거나, 아래 1.4 `eas credentials`가 자동 생성하도록 둡니다.)
  - SKU: 아무 고유 문자열 (예: `today-couple-diary-001`)
- 생성 후 URL/화면에서 보이는 **App Store Connect App ID(숫자, 예: 6xxxxxxxxx)**를 메모 → `eas.json`의 `ascAppId`에 넣습니다.

**체크포인트:** App Store Connect에 앱이 "준비 중(Prepare for Submission)" 상태로 나타나면 통과.

### 1.3 아이콘 · 스크린샷 · 메타데이터 준비

- **앱 아이콘**: `frontend/assets/icon.png` 사용(1024x1024, 투명/알파 없음). EAS가 빌드 시 여러 사이즈를 자동 생성합니다.
- **스크린샷(필수)**: 최소 6.7" iPhone(1290x2796) 세트 1개는 반드시 필요. 6.5"도 준비하면 안전. 시뮬레이터에서 실제 화면 캡처 → 스토어 규격에 맞게. 홈/일기 작성/오늘의 질문/지도 등 핵심 화면 4~6장.
- **메타데이터**: 앱 이름, 부제(선택), 프로모션 텍스트, 설명, 키워드, 지원 URL, **개인정보 처리방침 URL(필수)**, 카테고리(Lifestyle 또는 Social Networking), 연령 등급.
- **개인정보 라벨(App Privacy)**: 수집 항목을 정확히 신고. 이 앱은 최소 다음을 수집: 이메일/닉네임(카카오 계정), 사진(일기 첨부), 위치(장소 기록), 사용자 콘텐츠(일기 본문). `09-production-backend.md`와 실제 코드 기준으로 채웁니다.

**체크포인트:** 위 항목을 App Store Connect의 앱 정보 화면에 모두 입력하고, placeholder/lorem 텍스트가 없는지 확인하면 통과.

---

## 2. EAS 빌드 설정

### 2.1 EAS CLI 설치 및 로그인

```bash
npm install -g eas-cli        # 또는 npx eas-cli 사용
eas login                     # Expo 계정으로 로그인
eas whoami                    # 로그인 확인
```

### 2.2 프로젝트 구성

`frontend/eas.json`은 이미 존재하지만 `submit.production.ios`에 **placeholder 값**이 들어 있습니다. 실값으로 교체가 필요합니다.

```bash
eas build:configure          # 프로젝트를 EAS에 연결(projectId 생성/확인)
```

- `eas.json`의 `build.production.env.EXPO_PUBLIC_API_URL`을 **프로덕션 백엔드 실주소**로 바꿉니다. (현재 `https://api.example.com` placeholder — `09-production-backend.md` 참고. 프로덕션 서버가 뜨기 전에는 빌드해도 앱이 API에 못 붙습니다.)
- `eas.json`의 `submit.production.ios`를 실값으로 교체:
  - `appleId`: Apple 로그인 이메일
  - `ascAppId`: 1.2에서 메모한 App Store Connect App ID(숫자)
  - `appleTeamId`: developer.apple.com → Membership의 Team ID

### 2.3 iOS 인증서/프로파일 — EAS 자동 관리

Expo 관리형에서는 인증서와 프로비저닝 프로파일을 **EAS가 자동 생성·갱신**하도록 두는 것이 가장 간단합니다.

```bash
eas credentials            # 상태 확인/관리(선택)
```

- 다음 단계의 `eas build`를 처음 돌리면 "Generate a new Apple Distribution Certificate?" 등을 물어봅니다 → **Yes**로 두면 EAS가 알아서 만들고 저장합니다.
- 이때 Apple 계정 2단계 인증(앱 암호 또는 로그인)이 필요할 수 있습니다.

**체크포인트:** `eas.json`에 placeholder(`YOUR_...`, `api.example.com`)가 하나도 남지 않았으면 통과.

---

## 3. 프로덕션 빌드

```bash
eas build -p ios --profile production
```

- 클라우드에서 빌드가 돌아가며(보통 10~25분), 완료되면 `.ipa` 산출물 링크가 나옵니다.
- `production` 프로파일은 `autoIncrement: true`라 빌드 번호가 자동 증가합니다(app.json의 `buildNumber`와 별개로 관리).
- 첫 빌드에서 인증서 생성 프롬프트가 나오면 2.3대로 Yes.

**체크포인트:** 빌드 상태가 `finished`이고 `.ipa` 다운로드 링크가 생기면 통과. 실패 시 로그의 에러(대개 인증서/번들ID/네이티브 설정)를 먼저 해결.

---

## 4. 제출 (App Store Connect 업로드)

### 방법 A — EAS Submit (권장, CLI 완결)

```bash
eas submit -p ios --profile production
```

- 방금 만든 빌드 또는 특정 빌드를 골라 App Store Connect로 업로드합니다.
- App Store Connect API Key를 물으면 EAS가 안내하는 대로 생성/등록(자동 관리 가능).

### 방법 B — Transporter 앱 (대안)

- Mac App Store에서 **Transporter** 설치 → EAS 빌드에서 받은 `.ipa` 드래그 → Deliver.
- CLI 제출이 막히거나 수동 확인을 원할 때 사용.

**체크포인트:** App Store Connect → 앱 → TestFlight 탭에 방금 빌드가 "처리 중(Processing)" → 잠시 뒤 "테스트 준비 완료"로 뜨면 통과. (처리에 5~30분 소요, 완료 시 이메일 옴.)

---

## 5. TestFlight 내부 테스트

- App Store Connect → TestFlight → Internal Testing → 테스터 그룹에 본인/파트너 추가(최대 100명, 심사 불필요).
- **수출 규정(Export Compliance)**: 처음 빌드 업로드 시 암호화 사용 여부를 묻습니다. app.json에 `ITSAppUsesNonExemptEncryption: false`가 이미 선언되어 있어 대개 자동 통과됩니다(HTTPS만 사용).
- TestFlight로 실기기에서 다음을 반드시 확인:
  - 카카오 로그인 → 커플 연결 → 일기 작성/조회
  - 사진 첨부, 위치/지도, 오늘의 질문, 알림
  - **계정 삭제 동작**(구현 후)
  - **프로덕션 백엔드**에 정상 연결(터널 아님)

**체크포인트:** 실기기 TestFlight 빌드에서 핵심 플로우가 크래시 없이 끝까지 되면 통과.

---

## 6. 심사 제출

- App Store Connect → 앱 → 해당 버전 → "심사를 위해 추가(Add for Review)" → 빌드 선택 → 제출.
- 필수 입력:
  - **App Review Information**: 로그인 필요 앱이므로 **데모 계정**(로그인 가능한 카카오 계정 또는 dev 우회 수단)과 접속 방법을 리뷰 노트에 기재. 리뷰어가 로그인 못 하면 즉시 거절됩니다.
  - **Notes**: 커플 연결이 필요한 기능은 초대 코드 입력법 등 재현 절차를 적어 주면 통과율이 올라갑니다.
  - 연령 등급, 저작권, 연락처.
- 제출 후 상태: Waiting for Review → In Review → (승인 시) Pending Developer Release 또는 자동 출시.

**체크포인트:** 상태가 "심사 대기 중(Waiting for Review)"으로 넘어가면 제출 완료. 심사는 보통 24~48시간.

---

## 7. 거절 대응

- 거절되면 App Store Connect의 **Resolution Center**에 사유(가이드라인 번호)와 함께 메시지가 옵니다.
- `07-review-gotchas.md`에서 해당 번호를 찾아 조치 → 코드/메타 수정 → 필요 시 새 빌드(2~4 반복) → Resolution Center에서 회신하거나 재제출.
- 사실 오해로 인한 거절이면 정중히 반박(회신)만으로 풀리는 경우도 많습니다. 근거를 명확히 제시하세요.

---

## 8. 출시 후

- 자동 출시로 뒀다면 승인 즉시 스토어 노출(반영에 수 시간).
- 크래시/리뷰 모니터링(App Store Connect의 Analytics, Crashes).
- 업데이트 시: `app.json`의 `version`(마케팅 버전) 올리고 `2~6` 반복. `buildNumber`는 EAS `autoIncrement`가 처리.

---

## 부록: 이 앱 고유 주의점

- **카카오 로그인 → 4.8 Sign in with Apple 필요**: 현재 로그인이 카카오뿐이라 그대로 제출하면 4.8로 거절됩니다. `07`·`08` 참고해 반드시 먼저 해결.
- **개발용 닉네임 로그인 제거**: `app/(auth)/login.tsx`의 "닉네임으로 시작 (개발용)"은 프로덕션 빌드에서 노출되면 안 됩니다(4.2/미완성 기능 인상). 심사용 데모 경로로만 쓰거나 프로덕션에서 숨기세요.
- **터널 백엔드 금지**: `hammerslog.trade` 임시 터널은 심사 중 24/7 가용성을 보장하지 못합니다. 프로덕션 서버 필수(`09`).
