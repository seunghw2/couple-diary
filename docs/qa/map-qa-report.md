# 지도(Map) 기능 QA 리포트

- 날짜: 2026-07-06
- 대상: 지도 탭(`(tabs)/map.tsx`, `KakaoMap.tsx`), 장소 상세(`place.tsx`), 작성 화면 장소 피커(`KakaoMapPicker.tsx`), 지도 관련 백엔드 API
- 방법: **병렬 서브에이전트 3** — (A) Expo Web + Playwright 브라우저 QA, (B) 백엔드 API curl 엣지케이스, (C) Kakao 지도 로직 코드 리뷰 — 리드가 취합·수정·검증
- 계정: dev `qaA`(couple 11), 장소 8곳(실제 장소 + `직접찍은핀`·`이름만장소` 엣지 포함)

## ⚠️ 핵심 제약
`react-native-webview`는 **Expo Web에서 미지원**("does not support this platform"). 즉 **실제 Kakao 지도(핀·탭·팬/줌·근처검색맵)는 웹에서 렌더/테스트 불가**. 그 부분은 (C) 코드 리뷰로 검증했고, 나머지(리스트·검색·상세·API)는 브라우저·curl로 실제 테스트함.

---

## ✅ 발견 → 수정한 버그 (이번 커밋에 반영)

| # | 심각도 | 위치 | 문제 | 수정 |
|---|---|---|---|---|
| 1 | **high** | `write/[date].tsx` `applyPickedPlaces` | 피커는 `initial`=현재 장소 전체로 시작하는데 확정 시 **add-only** 병합이라, 피커에서 뺀 장소가 실제로는 안 빠짐(좌표도) | 넘어온 바스켓을 **최종 상태로 통째 교체**(dedup) → 제거·좌표 정상 반영 |
| 2 | **high** | `KakaoMap.tsx`, `KakaoMapPicker.tsx`, `map.tsx` | 웹에서 WebView가 빨간 raw 에러 텍스트("...does not support...")를 그대로 노출(지도 탭 진입 즉시) | `Platform.OS==='web'` **테마 폴백** + 지도 탭은 웹에서 **기본 리스트**, 피커도 폴백 |
| 3 | **med** | `common/GlobalExceptionHandler.java` | 필수 쿼리파라미터 누락(`/api/places`, `/api/locations/detail`, `/api/photos/thumb`) 시 **500(S001)** — `MissingServletRequestParameterException` 핸들러 없음 | 핸들러 추가 → **400** (검증: 세 엔드포인트 모두 400) |
| 4 | **med** | `KakaoMapPicker.tsx` | 하단 카드 비배타: "이름+지도에서 찍기" 진입 후에도 검색 0건 카드가 남아 pinned 카드와 공존 | `startPickOnMap`에서 검색상태 초기화 + `zeroResults` 게이팅(`!pinned && !nearby && !active`) |
| 5 | low | `map.tsx` | 상세에서 뒤로 오면 선택 프리뷰 카드가 남아 지도/리스트 토글이 계속 가려짐 | 화면 포커스 시 `selected` 해제 |
| 6 | low | `map.tsx` | 검색으로 필터링해도 헤더 "함께 간 곳 8곳"이 안 변함 | 검색 중엔 "검색 결과 N곳"으로 표기 |
| 7 | low | `map.tsx` | 웹에서 검색/닉네임 입력에 브라우저 파란 포커스 링이 테마와 충돌 | web `outlineStyle:'none'` |
| 8 | low | `PhotoUploadController.serveOriginal` | 썸네일 불가(HEIC 등) 원본 폴백 시 Content-Type을 무조건 `image/jpeg`로 라벨 | `.heic/.heif` → `image/heic·heif` 매핑 |

---

## 🎨 남은 UX/UI 개선 제안 (미수정 · 권장)

1. **미해결 핀 무음 드롭** — `이름만장소`·`직접찍은핀`처럼 지오코딩·키워드 검색 모두 실패하는 장소는 지도에 핀이 안 찍히고 조용히 사라짐(리스트엔 있음 → 개수 불일치). "지도에 표시 못한 N곳" 안내나, 저장된 `locationPoints`(좌표)를 KakaoMap에 넘겨 재지오코딩 없이 바로 찍기 권장. (`KakaoMap.tsx`)
2. **근처검색 0건 흐름** — 지도 탭 시 핀은 찍히는데 후보 0건이면 담을 수단이 없음. 0건 카드에 "이 위치를 이름으로 담기" 바로가기(롱프레스 플로우) 추가. (`KakaoMapPicker.tsx`)
3. **리스트 방문횟수 배지** — 리스트 행에 방문 횟수 배지는 `>=2`일 때만 노출(현재 데이터는 전부 1회라 안 보임). "함께 간 날 N일"을 항상 작은 배지로 노출하면 한눈에 좋음.
4. **프리뷰 카드 `>`/`X` 근접** — 상세 이동 화살표와 닫기 X가 가까워 실기기에서 오탭 가능. 간격/터치 타겟 확대 권장.
5. **유령 별명** — `PUT /api/locations/nickname`이 커플의 실제 장소 존재 여부 확인 없이 임의 이름에 별명 저장 가능(무해·커플 스코프·100자 제한). 필요 시 장소 존재 검증.
6. **하단 카드 상태 단일화** — 피커 하단 카드(nearby/active/pinned/zeroResults/permDenied)를 단일 "sheet state"로 정리하면 배타 조건이 단순·안전.

---

## 🟢 검증된 정상 동작 (문제 없음)

- **리스트/검색**: 8곳 정상 표기, 부분일치 검색(`대림`→두 곳), 0건 안내, 공백 검색=전체, X 클리어, 검색어 토글 유지.
- **장소 상세**: 별명 추가/수정(기존값 프리필)/삭제(빈값), maxLength 30, 이모지·특수문자, 공백 트리밍, 취소, 키보드 제출 — 전부 정상. 일기 날짜 카드/스니펫/썸네일(+사진 없는 날 하트 폴백)/일기 이동/뒤로 — 정상. 콘솔·페이지 에러 0.
- **백엔드 견고성**: **경로 traversal 완전 방어**(`../`, `%2F`, 이중인코딩, 널바이트, 백슬래시 전부 400), size/w 클램핑, 커플 격리(coupleId는 클라이언트 미지정), 인증(locations/detail/nickname 401), Kakao 검색 실패는 빈 배열로 흡수.
- **지도 로직(코드 리뷰)**: `suppressDeselect`/`suppressClick` 타이밍 정상, 근처검색 `pending` 카운터 정확(1회만 post), dedup·거리정렬, 핀 앵커(0.5/0.5) 정상, 검색 debounce+seq 스테일 방지, Modal 상태 리셋, 중첩 Pressable(X vs 카드) 정상.

---

## 테스트 커버리지/한계
- **웹으로 불가**: 실제 지도 렌더·핀·핀탭·팬/줌·지도탭 근처검색 — 폰(Expo Go)에서 확인 필요. (코드 리뷰로 로직만 검증)
- **데이터 한계**: 저장 장소가 전부 1일치라 상세 **0-일기 빈 상태**·다중 일기 카드 스크롤은 미도달. 시드 권장.
- 참여 에이전트 3, 스크린샷 다수(`/tmp/qa_*.png`).
