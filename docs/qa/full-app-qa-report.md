# 투데이(couple-diary) 전체 앱 QA 리포트

- 일자: 2026-07-06
- 방식: 서브에이전트 3개 병렬(백엔드 API 엣지케이스 / 프론트 브라우저 QA / 프론트 코드 리뷰) + 리드 통합·즉시수정
- 환경: 백엔드 8083(MySQL `today`@3307), 프론트 Expo Web(today-web.hammerslog.trade), Playwright headless
- 테스트 계정: qaA(id26)–qaB(id27) 커플, 신규 qawrite1(id36)–qawrite2(id37) 커플

---

## 요약

| 심각도 | 발견 | 수정 |
|---|---|---|
| Critical | 1 | 1 (즉시) |
| High/Med | 5 | 5 (즉시) |
| Low/UX | 6 | 일부 반영, 나머지 백로그 |

인증 우회·데이터 격리(다른 커플 데이터 접근)·인증 가드·날짜 계산·테마 렌더링은 **모두 정상**으로 확인.

---

## Critical (즉시 수정 완료)

### C-1. 일기 저장 전면 실패 (별점 제거 후 백엔드 필수값 잔존)
- 증상: 프론트에서 별점 UI를 제거했는데 백엔드 `UpsertEntryRequest.rating`이 `@NotNull`이라, 별점 없는 모든 저장 요청이 400(`rating: 널이어서는 안됩니다`)으로 거부됨 → **일기 작성 자체가 불가**.
- 수정: `DiaryDtos.java` — `@NotNull` 제거, `@Min(1) @Max(5)`만 유지(있으면 검증, 없으면 통과).
- 검증: 별점 없는 POST → 200. qawrite1 실제 UI 작성 플로우(기분=happy) → 저장·`/entry/2026-07-06` 이동 성공.

---

## High / Medium (즉시 수정 완료)

### H-1. 이미지 썸네일 90/180 회전 + 상대방 이미지 미표시
- 원인: 썸네일 엔드포인트가 `ImageIO.read()`로 EXIF 방향 정보를 잃고, 일부 이미지는 디코드 실패로 500 → 빈칸.
- 수정: `Thumbnails.of(source.toFile())`(EXIF 자동 보정) + 실패 시 원본 반환(`serveOriginal`, heic/heif content-type fallback).

### H-2. 백엔드 500 → 400 정상화 (엣지케이스 입력)
- Content-Type 누락/미지원, 멀티파트 `file` 파트 누락/비-멀티파트 요청이 500을 내던 것을 `GlobalExceptionHandler`에 `HttpMediaTypeNotSupportedException`·`MissingServletRequestPartException`·`MultipartException`·`MissingServletRequestParameterException` 핸들러 추가로 400으로 매핑.

### H-3. PATCH /me 검증 부재
- 빈 닉네임/30자 초과/잘못된 색상 형식/미래 생일이 그대로 저장되던 문제.
- 수정: `UserService.updateMe`에 검증 추가 → 각각 400, 정상값 200 확인.

### M-1. 일기 상세 D-day가 모든 날짜에 '오늘값'으로 표시
- 원인: `couple.ddayCount`(오늘 기준)를 날짜와 무관하게 사용.
- 수정: `dDayOn(anniversaryDate, 그 날짜)` 헬퍼 추가 → 날짜별 계산. 검증: 7/1 일기 = **D+93**(오늘 D+98 아님).

### M-2. 내 정보 직접 진입 시 기념일/생일 필드 공란 → 덮어쓸 위험
- 원인: 스토어가 비동기 로드라 `/account` 직접 진입 시 필드가 빈 상태. 그대로 '저장' 시 기존 D-day/생일을 지울 수 있음.
- 수정: 스토어 값 도착 시 `useEffect`로 프리필(입력 중 값은 안 덮음).

---

## 인증 코드 리뷰 (즉시 수정 완료)

### A-1. 로그아웃 시 커플/알림 스토어 미초기화
- 계정 전환/로그아웃 후 이전 사용자의 커플·알림 상태가 잔존할 수 있음.
- 수정: `logout()`에서 `useCoupleStore.reset()`·`useNotifStore.reset()` 호출.

### A-2. bootstrap이 네트워크/5xx 오류에도 강제 로그아웃
- 일시적 연결 불안정에도 토큰을 지워 로그아웃되던 문제.
- 수정: **진짜 401일 때만** 토큰 삭제, 그 외엔 세션 유지. 동시 bootstrap 중복 호출도 in-flight dedup으로 me() 1회만.

---

## Low / UX 백로그 (미수정, 우선순위 낮음)

1. 댓글 등록 후 입력창 미비움 — 코드상 `setCommentText('')`로 비워짐(정상). 웹에서 관측된 잔존은 컨트롤드 인풋 타이밍 아티팩트로 추정, 실기기 재현 시 재검토.
2. 댓글 `@Size` 상한 미설정 — 과도한 길이 방어 추가 권장.
3. 미래 기념일 입력 가드 부재 — 생일처럼 미래 차단 검토.
4. 알림 카피 "오늘" 표현 일관성.
5. 웹 focus outline 노출(모바일 앱엔 영향 없음).
6. '수정하기' 버튼 disabled 상태 시각 피드백.

---

## 정상 확인 항목

- 인증 가드: 미로그인 딥링크 → 로그인으로 리다이렉트.
- 데이터 격리: 다른 커플의 entry/place/comment 접근 불가(403/404).
- 날짜 계산: 월 그리드(6주 고정), 요일, D-day, 상대시간.
- 테마/렌더링: 라이트·다크, 12개 기분 라인아이콘(Tabler), 지도 웹 폴백.

## 남은 데이터 정리 메모
- qaA 알림이 에이전트 B에 의해 전부 읽음 처리됨. 실제 사용엔 영향 없음.
