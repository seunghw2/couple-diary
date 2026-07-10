# 45. 출시 전 QA — Part 1(인증·커플·계정) P0 수정

서브에이전트 4개(로직·보안 / UI·문구 / 커플·계정삭제 정합성 / 통합·출시요건)로 Part 1을 감사하고, 코드로 고칠 수 있는 P0/보안 P1을 먼저 처리했다.

## 수정 (보안·출시 블로커)
- **dev-login 백도어 차단**: 닉네임 무인증 로그인을 별도 `DevAuthController(@Profile("!prod"))`로 분리 → 프로덕션 프로파일에선 엔드포인트 미등록(404). 프론트 로그인의 '닉네임으로 시작(개발용)' 블록도 `__DEV__` 가드로 프로덕션 빌드에서 숨김.
- **카카오 콜백 오픈리다이렉트 방어**: 콜백의 `state`(returnUri)를 허용 스킴(exp/exps/today)·hammerslog.trade 도메인만 통과시키고, 그 외(예: evil.com)면 400으로 거부 → 액세스 토큰 유출 차단.
- **JWT 시크릿 prod fail-fast**: 운영 프로파일에서 기본/빈 시크릿이면 부팅 실패(토큰 위조 방지). 로컬/테스트는 영향 없음.
- **초대코드 정규화**: 서버 `connect`에서 `trim().toUpperCase()` → 붙여넣기/키보드로 소문자·공백 섞여도 연결됨.
- **브랜드명 통일**: 로그인·홈 로고 'love today' → '투데이'(스토어명과 일치).

## QA (E2E)
- dev-login 로컬 200(정상)·prod 미등록, 카카오 evil state→400 / 앱 state→302, 초대코드 소문자+공백→연결 200. 백엔드 컴파일·부팅 0에러, 프론트 tsc 0.

## 보류(도메인/Apple 작업에서 처리될 P0)
- eas.json production API URL 자리표시자(example.com), submit appleId/ascAppId/appleTeamId 자리표시자 → 도메인·Apple 식별자 확정 시 채움.

## 남은 P1/P2(후속 배치)
접근성 라벨 전무, 계정 저장 토스트 미사용·온보딩 탈출구, Apple nonce/token revoke, JWT TTL 30일, 기념일 서버검증·D-day 타임존·닉네임 제어문자, /files 공개GET, CORS dev origin 등.
