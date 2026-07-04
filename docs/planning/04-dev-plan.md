# 04 · 개발 계획 & API 계약 (1차: 기반 골격 + 핵심 루프)

## 스택 / 구조
- **모노레포** `couple-diary/`
  - `backend/` — Spring Boot 3.4.1 · Java 21 · JPA · MySQL · JWT(jjwt) · Lombok (짐트래커 컨벤션)
  - `frontend/` — Expo · React Native · TypeScript · expo-router · Zustand
- DB: MySQL `today` @ 127.0.0.1:3307 (root, no password) — dev
- 인증: **개발용 로그인**(이메일/닉네임 → JWT 발급). 카카오는 후속(키 발급 후).
- 디자인: 워밍 코럴&크림(#FF8E72 / #FFF6EF / #FFFDFA / 텍스트 #5A4038). 홈=사진 캘린더.

## 1차 범위
가입(dev-login) → 커플 연결(초대코드) → 프로필/기념일 → 사진 캘린더 홈 → 일기 작성(템플릿 & 자유 질문픽) → 상호 공개 → 댓글. (앨범/지도/회고/알림은 후속)

## 데이터 모델 (JPA)
- **User**(id, email unique, nickname, avatarColor, birthday?, inviteCode unique, createdAt)
- **Couple**(id, user1, user2, anniversaryDate?, createdAt)
- **DiaryDay**(id, couple, date, mode[TEMPLATE|QUESTION_PICK], templateType?, questionIds(json)) — 커플·날짜당 1개, **먼저 쓴 사람이 생성**(질문 세트 고정)
- **DiaryEntry**(id, day, author, rating?, mood?, locationName?, createdAt, editableAfter) — 유저·날짜당 1개
- **EntryAnswer**(id, entry, questionId?, promptKey?, text)
- **Photo**(id, entry, colorSeed) — 1차엔 실제 업로드 대신 colorSeed(그라데이션 시드)
- **Comment**(id, day, author, text, createdAt)
- **Question**(id, orderNo, text, type[NORMAL|INLINE_BLANK]) — 기본 8개 시드

**공개 규칙**: DiaryDay에 두 유저의 DiaryEntry가 모두 있으면 `open`, 아니면 상대 것 `locked`. 수정은 `editableAfter`(작성+3h) 이후.

## REST API (base http://localhost:8080, JWT Bearer)
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/dev-login` | {email, nickname} → {accessToken, user} |
| GET | `/api/me` | 내 정보(+커플 연결 여부) |
| PATCH | `/api/me` | {nickname?, avatarColor?, birthday?} |
| POST | `/api/couple/invite` | 내 초대코드 발급/조회 → {inviteCode} |
| POST | `/api/couple/connect` | {inviteCode} → 커플 생성 |
| GET | `/api/couple` | 커플 정보(두 유저, D-day, anniversaryDate) |
| PUT | `/api/couple/anniversary` | {anniversaryDate} |
| GET | `/api/questions` | 기본 질문 8개 |
| GET | `/api/entries?year=&month=` | 캘린더: [{date, status[empty/locked/open], photoCount, thumbSeed, mineWritten, partnerWritten}] |
| GET | `/api/entries/{date}` | 상세: mode, 질문세트, 내 엔트리, 상대 엔트리(open일 때만 공개/아니면 locked flag), 사진, 별점/기분/위치, 댓글 |
| POST | `/api/entries/{date}` | 작성/수정: {mode, templateType?, questionIds?, answers:[{questionId?,promptKey?,text}], photoSeeds:[], locationName?, rating?, mood?} |
| GET | `/api/entries/{date}/comments` | 댓글 목록 |
| POST | `/api/entries/{date}/comments` | {text} |

**작성 규칙**: 해당 날짜 DiaryDay 없으면 생성(내가 첫 작성자 → mode/questionIds 확정). 이미 있으면 그 mode/질문세트 따름(QUESTION_PICK이면 그 questionIds 범위 내 답만 허용).

## 실행
- 백엔드: `cd backend && ./mvnw spring-boot:run` (기본 profile=local, MySQL 3307/today)
- 프론트: `cd frontend && npx expo start --tunnel` (API base는 env/config)

## 진행 순서
1. 백엔드 스캐폴딩+엔티티+API, 프론트 스캐폴딩+핵심 화면 (서브에이전트 병렬)
2. 리드가 통합: 백엔드 부팅 확인, 프론트 타입체크, API 연동 점검
3. 커밋·푸시
