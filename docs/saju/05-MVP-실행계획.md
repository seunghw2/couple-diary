# 05 · MVP 실행계획 (종합)

앞 4개 분석을 합친 **바로 착수 가능한** 실행안. 원칙: **월드컵 구조 복제 + 결정론적 계산 + 고정 템플릿 + 서브 미니게임**.

## 1차 범위 (사용자 결정 반영 — 이름: **"우리 사주 궁합"**)
- ✅ 개인 사주: 일간 캐릭터 + 띠 + 오행 분포 막대 + 한줄 성격
- ✅ 커플 궁합: 궁합 % + 카테고리 4~5개 점수 + 따뜻한 코멘트 (좌우 2열 비교)
- ✅ 생시 **선택 입력**(12지시 + "모름")
- ✅ **오늘의 운세** 포함 (날짜+일간 시드로 매일 갱신되는 한 줄·행운색)
- ✅ **음력 생일 입력 지원** (양력 변환)
- ✅ **KASI 정확 절기 테이블** 처음부터 내장 (만세력 일치)

## 계산 정확도 (확정)
- **일주·시주**: `LocalDate.toEpochDay()` mod 60 → **데이터 0, 100% 정확**
- **월주·년주**: **KASI 정기법 절기 테이블(100년·12절 ≈1,200행) 내장** → 만세력 완전 일치 (처음부터)
- **음력→양력 변환**: KASI 음양력 데이터/라이브러리 필요(윤달 처리). 입력 UI에 양력/음력 토글
- **오늘의 운세**: 그날 일진(일주) lookup + `날짜+일간` 결정론적 시드 → 서버 순수 계산
- **십신·용신·진태양시·서머타임**: 생략. 야자시 경계는 규칙 하나로 고정(재현성 우선)

## 착수 전 데이터 준비 작업 (신규 결정으로 추가됨)
- **KASI 절기 테이블 확보**: 한국천문연구원 24절기 공공데이터에서 출생연도 범위(예 1930~2030) 12절 절입시각 → 정적 파일(JSON/CSV) 번들 또는 배포 시 1회 시딩. 출처 표기.
- **음양력 변환 데이터**: KASI 음양력 변환(윤달 포함) 데이터/라이브러리 확보·검증.

## 궁합 점수 (요약, 상세는 02 문서)
- feature: 일간 천간합/충, 오행 상생·상극·상보, 지지 삼합/육합/충, 띠·음양
- 5 카테고리(첫끌림·대화·애정·안정감·성장) 0~100 원점수 → 종합 **60~99% 리매핑**
- 무서운 살(煞)·형·파·해는 제거/순화("츤데레 포인트")
- 등급: 상 67+/중 34~66/하 0~33 → 등급별 고정 문구

## 데이터 모델
```
saju_profile (유저당 1행, upsert)
  user(unique), couple, birth_date, birth_time_slot(nullable "모름"),
  day_master(일간), element_dist("목2화1..."), zodiac(띠), pillars, created_at
```
- 궁합 결과는 **저장 없이 즉석 계산**(두 프로파일에서 결정론적)
- 삭제 cascade: `UserService` 계정삭제 훅에 `sajuProfileRepository.deleteByCouple_Id/deleteByUser_Id` 추가

## 신규/수정 파일 (월드컵 미러)

### 백엔드 신규 `com.today.saju/`
- `SajuController` — `GET /api/saju/me`, `GET /api/saju/couple`, `POST /api/saju/request-birthday`, `GET /api/saju/unseen`, `POST /api/saju/seen` (+후속 `GET /api/saju/daily`)
- `SajuService` — 커플 가드(`requireCouple`) + 프로파일 upsert/조회 + 궁합 계산 + 알림
- `SajuCalculator` — 60갑자/천간지지 상수 + 일간·오행·띠·궁합% 순수 계산 (월드컵 `WorldcupCatalog` 자리)
- `SajuTemplates`(or `SajuCatalog`) — 일간별·조합별 고정 문구 60~120개
- `SajuProfile` 엔티티 + `SajuProfileRepository`
- `SajuDtos` — PersonalSaju, CompatibilityView

### 백엔드 수정
- `NotificationType` — `SAJU_BIRTHDAY_REQUEST` (+후속 `SAJU_COMPATIBILITY_READY`)
- `NotificationService` — `SAJU_TYPES` + `countUnreadSaju` + `markSajuSeen` + `onSajuBirthdayRequested`
- `User` — (선택) `birthTime` nullable, 또는 `saju_profile`에만 저장
- `UserService.deleteAccount` — 사주 프로파일 삭제 한 줄

### 프론트 신규
- `app/saju/index.tsx`(허브·2카드·markSeen), `app/saju/me.tsx`(개인+생시 시트), `app/saju/couple.tsx`(궁합 2열)
- `components/OhaengBar.tsx`(오행 막대, 순수 View)
- `lib/api.ts`에 `sajuApi` + 타입

### 프론트 수정
- `app/(tabs)/settings.tsx` — 월드컵 행 아래 "우리 사주 궁합" 행 + 배지
- `app/notifications.tsx` + `app/_layout.tsx` — `SAJU_*` 딥링크/아이콘 분기
- (선택) `app/account.tsx` — 생시 필드

## 정책 필수(출시 전)
- 사주는 **서브 미니게임**으로만 노출(앱 소개·스크린샷 주 기능=다이어리) → Apple 4.3 회피
- 결과 화면 하단 **"재미로 보는 사주예요 😊"** 면책 고정
- 부정·단정 예언(건강/수명/사고) 문구 금지, 톤 긍정
- 개인정보처리방침에 **생년월일·생시 수집** 항목 추가(생시=선택)

## 착수 순서(권장)
1. **데이터 확보**: KASI 절기 테이블 + 음양력 변환 데이터 준비·검증
2. `SajuCalculator`(일주·오행·띠 + 절기 기반 월/년주 + 음력 변환) + 단위 검증(만세력 대조)
3. `SajuProfile` 엔티티 + `/api/saju/me` + 개인 결과 화면(오행 막대·일간 카드)
4. 궁합 점수 모델 + `/api/saju/couple` + 좌우 2열 화면
5. **오늘의 운세**(`/api/saju/daily`) — 일진 lookup + 시드
6. 설정 진입·배지·생일요청 알림·딥링크(월드컵 복제)
7. 문구 채우기(`SajuTemplates`) + 면책·정책·처리방침 업데이트

## 남은 기술 세부(구현 중 결정)
- 생시 저장: `User.birthTime` vs `saju_profile`에만
- 절기·음양력 데이터 소싱: KASI Open API 1회 시딩 vs 정적 파일 번들
- 궁합 카테고리 4개 vs 5개(02 문서 참고)
