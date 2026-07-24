# love today (couple-diary) — 인수인계 (2026-07-24 기준)

## 현재 상태
- **모든 코드 커밋·푸시됨**(작업트리 클린, 미푸시 없음). origin=`seunghw2/couple-diary`, main.
- 백엔드 실행 중(launchd `com.lovetoday.backend`, port 8083, 터널 `lovetoday.terrylovesapp.uk`).
- 최근 devlog: `docs/devlog/67~70`.

## 최근 완료 작업(이 흐름에서)
1. **일기 작성 위저드 개편** — 기분 24개(좋아/차분/힘들어 카테고리), 이야기 리스트 아코디언, 사진 단계.
2. **달력** — 사진 있는 날은 썸네일(원형), 사진 개수 배지 제거, 상세의 "스티커 획득" 섹션 제거.
3. **오늘의 편지(pending)** — 한 명이라도 답하면 편지를 버리지 않고 봉인 대기, 오늘 편지 위 배너로 상대가 답장 → 즉시 열림. (`GET today`에 `pendingLetters`, `POST /pending/{date}/answer`)
4. **로컬 iOS 빌드** — EAS 클라우드 한도 소진 대비 `eas build --local`+`eas submit` 셋업(fmt 패치 plugin 등). → [[couple-diary-local-ios-build]] 메모리.
5. **작성 흐름 개선(devlog 70)** — 기록방식 선택 페이지 제거(질문 골라 쓰기 기본), 이야기 3칸 트레이+편지지 입력, 사진 폴라로이드+여러 장 선택.

## 진행 방법(ops)
- **작업 위치**: `~/Claude Code/couple-diary` (frontend/ + backend/). 프론트=Expo SDK54, 백=Spring `com.today`.
- **백엔드 재배포**: `cd backend && ./mvnw -q -DskipTests package` → `launchctl unload/load ~/Library/LaunchAgents/com.lovetoday.backend.plist` (kill은 KeepAlive가 되살림).
- **웹 검증(Expo Web + Playwright)**: 웹 8081. 토큰키 `today_access_token`를 localStorage에 주입(테스트 계정 user 26 = couple 11, JWT는 .env `JWT_SECRET` HS512로 발급, `type:access` 클레임), Chromium `--disable-web-security`로 CORS 우회. 백엔드 localhost:8083 직결 또는 터널.
- **폰**: Metro 8088(네이티브). 리로드하면 최신 반영.

## 미구현/보류 (다음 세션 후보)
- **추억(회고) 탭** — 설계 확정, 구현 보류. → [[couple-diary-memory-tab]].
- **앱스토어 출시 잔여** — 호스팅·처리방침 URL·데모계정·.p8 키 등 콘솔/사람 작업. → [[couple-diary-appstore-release]].
- **위저드 v2 목업 — 미채택안**(원하면 바로 구현 가능. 목업 이미지 = `docs/planning/wizard-v2-mockups/`):
  - **달력 홈**(현재 유지): A Living Widget(Locket/Cake 사진앨범형) · **B Two Hearts**(Between/TimeTree 2색점+오늘 교환카드 좌우) · C Calm Ritual(Amie/Structured 주간스트립).
  - **기분**(현재 유지): **A 감정밸리**(How We Feel/마음상태 3밴드+강도 슬라이더) · B 무드팔레트(Daylio/Pixels 컬러타일+실시간요약) · C 무드다이얼(Finch 카드캐러셀+강도링). ※핵심 개선점=강도 조절 도입.
  - **이야기**: A 카드덱(Paired/Gottman) · **B 리스트+편지지=채택·구현됨** · C 무드+채팅(Hinge).
  - **사진**: A 필름롤(Dispo/1SE) · **B 폴라로이드=채택·구현됨** · C 콜라주(Google Photos/BeReal, 사진0장도 무드그라데이션 카드).
  - (모드 선택 화면은 제거됨 → 관련 목업 무의미.)

## 주의(함정)
- 커밋/푸시는 반드시 `couple-diary` 레포 안에서(홈에 stray 레포 없음 확인).
- 백엔드 `detail()`은 빈 날에도 200 반환(404 아님) → "첫 작성자" 분기는 else 처리해야 함(mode-select 제거 때 이 함정 있었음).
