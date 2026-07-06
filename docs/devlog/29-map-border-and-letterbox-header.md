# 29. 지도 옅은 테두리 + 지난 편지함 위치 이동

목업 3안씩 제시 후 사용자 선택 반영.

## 1) 지도 옅은 테두리 (선택: B 연코럴 실선)
지도 영역에 **연코럴(coralSofter) 1.5px 테두리**. 앱 강조색 톤을 따라가 은은하게 도드라짐.
- 목업: `docs/planning/map-border-mockups/border-options.png` (A 뉴트럴 / B 연코럴 / C 그림자)

## 2) '지난 편지함' 위치 (선택: A 상단 헤더 버튼)
댓글이 많으면 하단 '지난 편지함'이 너무 아래로 묻히던 문제 →
- 오늘의 질문 **하단 링크 제거**, **헤더 우측 '🗂 편지함' 버튼**으로 이동. 댓글 수와 무관하게 항상 접근.
- 목업: `docs/planning/map-border-mockups/letterbox-position.png` (A 헤더 / B 답장 아래 / C 하단 고정)

**결과 — 헤더에 편지함 버튼**

![q](captures/29-question-header-archive.png)

## QA
- 질문 헤더 '편지함' 버튼 노출·하단 링크 제거(web) ✔, tsc 0
- 지도 테두리: body 컨테이너 적용(카카오 지도는 WebView라 폰에서 최종 확인)
