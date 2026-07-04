# 03 · 프론트↔백엔드 계약 정합 (통합 버그)

**날짜**: 2026-07-04
**목표**: 각자 통과했지만 실제로 붙으면 안 되던 계약 불일치 수정.

## 발견 (유휴 점검 중)
프론트가 **추측한 응답 형태**가 백엔드 실제 DTO와 광범위하게 불일치 → 각자 검사(tsc·E2E)는 통과해도 앱을 붙이면 화면이 안 뜸.
- `me()`: `User` 가정 ↔ 실제 `{user, coupled, partner}`
- `couple`: `{connected,me,partner}` ↔ 실제 `{user1,user2,ddayCount}`
- 상세: `mine/partner` ↔ 실제 `myEntry/partnerEntry`, `photoSeeds` ↔ `photos[].colorSeed`
- 댓글: `userId/nickname` ↔ `authorId/authorNickname`

## 한 일
백엔드(검증된 쪽)를 기준으로 프론트 타입·화면 접근을 전부 정합(7개 파일). UI/디자인 불변, 필드명·구조만.

## 검증
- `tsc --noEmit` 0 + **백엔드 띄워 실제 응답에 새 필드 존재 대조**(me·couple·myEntry/partnerEntry·photos·authorId 전부 확인).
- 커밋: `eef1ee6`

## 교훈
독립 검사만으론 통합 버그를 못 잡는다 → 프론트↔백 실제 응답 대조를 항상.
