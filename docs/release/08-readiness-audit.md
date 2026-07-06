# 08. 출시 준비도 감사 (Readiness Audit)

`frontend/app/`과 관련 코드를 훑어 도출한 출시 blocker/개선점 목록입니다. 우선순위:

- **P0** — 심사 blocker. 미해결이면 거절/제출 불가.
- **P1** — 강력 권장. 심사 통과는 되어도 품질/신뢰에 큰 영향.
- **P2** — 개선. 여유 있을 때.

각 항목에 담당 영역/파일과 할 일을 적었습니다.

---

## P0 — 심사 blocker

### P0-1. Sign in with Apple 부재 (4.8)
- **현황:** 로그인은 카카오 단독(`app/(auth)/login.tsx`). 그 외 실사용 로그인 없음(닉네임은 dev용).
- **문제:** 제3자 로그인만 제공 → 4.8 위반, 확정적 거절 사유.
- **할 일:** Apple 로그인 추가. 프론트=`expo-apple-authentication` + 로그인 버튼, app.json=`ios.usesAppleSignIn: true`, 백엔드=`identityToken` 서명 검증 후 우리 JWT 발급(현 `backend/.../auth/`의 카카오 패턴 재사용). 상세는 `07` 4.8.

### P0-2. 인앱 계정 삭제 UI 부재 (5.1.1(v))
- **현황:** 백엔드 `DELETE /api/me`는 구현됨(`backend/.../user/UserController.deleteAccount`). **프론트 UI·API 래퍼가 없음**.
- **문제:** 앱 안에서 계정을 지울 수 없음 → 5.1.1(v) 위반.
- **할 일:** `lib/api.ts` `authApi.deleteMe()` 추가 → `app/account.tsx`에 "회원 탈퇴" 진입점 + 2단계 확인 + 삭제 후 로그아웃/라우팅. Apple 로그인 도입 시 token revoke도 연동.

### P0-3. 개인정보 처리방침 URL 부재
- **현황:** 앱 내 개인정보/약관 화면 없음(감사 결과 "개인정보", "약관" 화면 미구현). 스토어 제출용 처리방침 URL도 없음.
- **문제:** App Store Connect 제출 필수 항목. 개인정보 라벨 신고와도 연결.
- **할 일:** (1) 개인정보 처리방침·이용약관 문서 작성 후 공개 URL 호스팅(정적 페이지 가능). (2) App Store Connect에 URL 입력. (3) 앱 내 설정에도 링크 노출(권장) — `app/(tabs)/settings.tsx`에 "약관·개인정보" 행 추가해 웹뷰/외부 브라우저로 연결.

### P0-4. 프로덕션 백엔드 부재 (터널 의존)
- **현황:** API가 임시 터널 `today-api.hammerslog.trade`(app.json extra.apiUrl). `eas.json` production env는 `api.example.com` placeholder.
- **문제:** 심사 중 24/7 가용성 미보장 → 로그인 불가 시 즉시 거절.
- **할 일:** 상시 HTTPS 프로덕션 서버로 이전 후 `eas.json`·app.json의 API URL 실주소로. 상세는 `09-production-backend.md`.

### P0-5. 권한 목적 문자열 실사용 대조 (5.1.1)
- **현황:** app.json에 사진/위치 문구는 있음. 대체로 양호하나 검증 필요.
- **문제:** 문구 있는데 미사용, 또는 사용하는데 문구 없으면(예: 카메라 촬영) 거절.
- **할 일:** 위치 권한 런타임 요청 코드 존재 확인, image-picker가 카메라를 쓰면 `NSCameraUsageDescription` 추가. 담당 영역: `app.json`, 이미지 관련 `lib/images.ts` / 지도 `app/(tabs)/map.tsx`·`app/place.tsx`.

### P0-6. 심사용 데모 계정 미준비
- **현황:** 로그인 필수 앱 + 커플 연결 필요 기능 다수.
- **문제:** 리뷰어가 로그인/커플 연결을 못 하면 기능 확인 불가 → 거절.
- **할 일:** 커플로 이미 연결되고 샘플 일기가 있는 데모 계정 준비, App Review Information에 자격증명·재현 절차 기재. dev 닉네임 로그인을 심사 우회로 쓸지 결정.

---

## P1 — 강력 권장

### P1-1. 개발용 닉네임 로그인 노출
- **현황:** `app/(auth)/login.tsx`에 "닉네임으로 시작 (개발용)" 입력이 프로덕션 UI에 그대로 보임(`devLogin`).
- **문제:** 미완성/테스트 기능 인상(4.2 감점), 보안상 임의 계정 생성 경로.
- **할 일:** 프로덕션 빌드에서 숨김(예: `__DEV__` 또는 env 플래그) 또는 데모 전용으로 제한.

### P1-2. 네트워크 오프라인/서버 다운 대응
- **현황:** try/catch·`ApiException`·401 전역 처리 등 에러 핸들링은 견고. 다만 완전 오프라인/서버 무응답 시 UX 확인 필요.
- **할 일:** 주요 화면(홈 캘린더 `app/(tabs)/index.tsx`, 질문 `app/(tabs)/question.tsx`, 알림 `app/notifications.tsx`)에서 네트워크 실패 시 재시도 버튼/안내 문구가 뜨는지 점검·보강.

### P1-3. 개인정보 라벨(App Privacy) 정확 신고
- **현황:** 이메일/닉네임·일기 콘텐츠·사진·위치·생일 수집. 스토어 라벨 미작성.
- **할 일:** 실제 수집 항목 기준으로 App Privacy 정확히 작성(P0-3 처리방침과 일치).

### P1-4. 앱 아이콘/스플래시 규격 확인
- **현황:** `assets/icon.png`, `expo-splash-screen`(splash-icon.png, bg `#FBF3EE`) 설정됨.
- **할 일:** 아이콘 1024x1024·알파 없음 확인, 스플래시가 iPhone 노치/다양한 화면비에서 잘리지 않는지 실기기 확인.

### P1-5. 원격 푸시 알림 부재
- **현황:** `expo-notifications` 미사용. 인앱 폴링 방식(`store/useNotifStore.ts`, `notificationApi`)만 존재 → 앱을 열어야 알림 확인.
- **문제:** 심사 blocker는 아님. 다만 커플 앱 특성상 상대의 일기/포크 알림이 실시간이 아니면 체감 품질 저하.
- **할 일:** 출시 후속으로 EAS 빌드 기반 `expo-notifications` 원격 푸시 도입 검토. (Expo Go 제약이 원인이므로 프로덕션 빌드에선 가능.) 출시 자체를 막지는 않음.

---

## P2 — 개선

### P2-1. 최소 iOS 버전 명시
- **현황:** app.json에 `ios.deploymentTarget` 미지정(Expo/RN 기본값 사용).
- **할 일:** 필요 시 config plugin으로 최소 버전 고정. RN 0.81/SDK54 기본값이면 대개 iOS 15.1+.

### P2-2. 접근성(Accessibility)
- **현황:** 버튼/아이콘에 명시적 `accessibilityLabel`이 충분한지 미확인.
- **할 일:** 아이콘 전용 버튼(예: 상단바 back, 색상 스와치)에 라벨 부여, 색 대비·동적 폰트 대응 점검.

### P2-3. 로딩 상태 세밀화
- **현황:** 캐시 우선 + `ActivityIndicator` 패턴이 잘 적용됨(홈/질문/알림/엔트리/지도/커플연결).
- **할 일:** 특별한 blocker 없음. 스켈레톤 등은 여유 시.

### P2-4. 크래시 리스크 점검
- **현황:** 지도(WebView + Kakao JS SDK), 이미지 조작(`expo-image-manipulator`), 날짜 파싱 등 외부 입력 경로 존재.
- **할 일:** 잘못된 좌표/깨진 이미지/미래 날짜 등 경계값에서 크래시 없는지 확인. TestFlight 실기기 회귀 테스트.

---

## 우선순위 요약

| 우선 | 항목 | 담당 영역 |
|---|---|---|
| P0 | Apple 로그인(4.8) | login.tsx, app.json, backend/auth |
| P0 | 계정 삭제 UI(5.1.1v) | account.tsx, lib/api.ts (백엔드 완비) |
| P0 | 개인정보 처리방침 URL | 외부 호스팅, ASC, settings.tsx |
| P0 | 프로덕션 백엔드 | 인프라(09 문서) |
| P0 | 권한 문자열 실사용 대조 | app.json, images/map |
| P0 | 심사용 데모 계정 | 운영/ASC 리뷰노트 |
| P1 | dev 로그인 숨김 | login.tsx |
| P1 | 오프라인 대응 보강 | 주요 탭 화면 |
| P1 | 개인정보 라벨 | App Store Connect |
| P1 | 아이콘/스플래시 확인 | assets |
| P1 | 원격 푸시(후속) | expo-notifications |
