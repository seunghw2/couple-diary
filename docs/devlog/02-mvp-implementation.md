# 02 · 1차 구현 (핵심 루프)

**날짜**: 2026-07-04
**목표**: 기반 골격 + 핵심 루프를 실제 코드로. 로그인→커플연결→사진캘린더→작성→상호공개→댓글.

## 한 일 (서브에이전트 백엔드/프론트 병렬)
- **백엔드** (`backend/`, Spring Boot 3.4.1·Java21·JPA·JWT·MySQL): User·Couple·DiaryDay·DiaryEntry·EntryAnswer·Photo·Comment·Question 엔티티 + REST API 전부. 개발용 로그인(이메일/닉네임→JWT), 기본 질문 8개 시드.
- **프론트** (`frontend/`, Expo·TS·expo-router·zustand): 로그인·커플연결·홈(사진캘린더)·상세·작성 화면, 워밍 코럴 테마, API 클라이언트.
- DB: MySQL `today`@3307 생성.

## 핵심 규칙 구현
- 먼저 쓴 사람이 그날 질문세트 확정 / status EMPTY·LOCKED·OPEN / OPEN 아니면 상대 글 잠금·댓글 차단 / 작성 3시간 뒤 수정.

## 검증
- 백엔드: 컴파일·부팅·핵심루프 **E2E 전부 통과**(dev-login→커플연결→A작성→B잠금→B작성→공개→댓글→월간그리드→무인증 401).
- 프론트: `tsc --noEmit` 0.

## 참고
- 포트 8080은 gymtracker가 점유 → 투데이 백엔드 **8083**으로.
- 커밋: `cf598eb`
