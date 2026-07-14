# 54. 사주 코드 리팩터링 (동작 불변)

## 요청
- 코드 리팩터링. 서브에이전트 4개 활용.

## 방법
- 4개 서브에이전트로 영역별 분석(백엔드 사주 / 프론트 화면 / 프론트 컴포넌트 / 죽은코드·타입) → 정확한 편집안 산출 → 순서대로 적용 + 매 단계 컴파일·tsc·스모크 검증. **동작·렌더 변화 0** 원칙.

## 반영
### 백엔드
- 공용 헬퍼 `SajuUtil`(ymd·pick·remap) 추출 → SajuCompatibility·SajuDailyFortune·SajuTemplates의 중복 제거(위임).
- 죽은 코드 삭제: SajuCompatibility의 미사용 `TOTAL_95/85/65/60`, `TIPS`(참조 0 확인).
- 검증: 컴파일 OK + 운영 스모크로 궁합(percent 80·TALK/STABILITY)·오늘운세(총67·66/62/68/89) **리팩터 전과 동일**.

### 프론트
- 공용화 4종 신설: `lib/sajuUi.ts`(coupleScoreColor/coupleScoreLabel/dailyScoreColor — couple 3구간·today 2구간 분리 유지), `components/ScreenHeader.tsx`(5개 화면 topBar 통일), `hooks/useFirstVisitIntro.ts`(me·partner·couple 로딩 게이트 통일), `theme/cardStyles.ts`(card/hero/진행바 프레임 공용).
- 소비 파일 8개 적용(index·me·partner·couple·today + PersonalSaju·OhaengBar + api.ts). 미사용 import 정리.
- 죽은 타입 필드 제거: api.ts의 `SajuPersonal.growth`, `SajuOhaeng.level/comment`, `SajuCoupleCategory.grade`(프론트 미참조, JSON엔 무해).
- 검증: `tsc --noEmit` 에러 0. 렌더 결과 동일(공용 스타일·색 함수가 기존 값과 동일).

## 하지 않은 것(오버엔지니어링 회피)
- 로딩/에러/빈상태 공용 래퍼(화면마다 성공 UI 달라 prop 폭발), `emphasize`/`sentences`/날짜유틸(단일 사용처), scoreColor 강제 단일화(로직 상이), 백엔드 DTO 필드 연쇄 제거(응답 계약 변경) — 모두 보류.
