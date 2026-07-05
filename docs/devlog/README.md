# 개발 로그 (devlog)

투데이(커플 교환일기) 개발 진행 로그. 요청·작업 단위로 넘버링해서 기록한다.

| # | 날짜 | 내용 |
|---|------|------|
| [01](01-planning-mockups.md) | 2026-07-04 | 기획·목업 스토리보드 (색/구조 방향 결정) |
| [02](02-mvp-implementation.md) | 2026-07-04 | 1차 구현 — Spring Boot + Expo 핵심 루프 |
| [03](03-integration-fix.md) | 2026-07-04 | 프론트↔백엔드 API 계약 정합(통합 버그) |
| [04](04-remote-tunnel.md) | 2026-07-04~05 | 원격 실행 — Cloudflare 터널 고정 URL |
| [05](05-qa-photo-upload.md) | 2026-07-05 | QA(서브에이전트) + 버그 수정 + 실제 사진 업로드 |
| [06](06-sdk54-expo-go.md) | 2026-07-05 | Expo SDK 57→54 다운그레이드(Expo Go 호환) |
| [07](07-login-branding-emoji.md) | 2026-07-05 | 로그인 닉네임만 + love today + 이모지 정리 |
| [08](08-vector-icons.md) | 2026-07-05 | UI 전면 벡터 아이콘화(기본 이모지 제거) |
| [09](09-notifications-ux-batch.md) | 2026-07-05 | 인앱 알림 + 캐싱/새로고침 + 다수 UX개선·버그수정 |
| [10](10-date-anniv-colors-map.md) | 2026-07-05 | 날짜변경·기념일보기·로그인TTL·색상테마·키패드 + 지도목업 |
| [11](11-map-kakao.md) | 2026-07-05 | 지도 구현 — Kakao 키 발급·도메인 등록·카카오맵 활성화 + 렌더 검증 |
| [12](12-themed-popup-datepicker.md) | 2026-07-05 | 앱 톤 커스텀 팝업 + 캘린더 날짜 피커(생일·기념일·날짜변경) |

## 현재 앱 화면 (SDK54, 실제 동작 캡처)
| 로그인 | 홈(캘린더) | 상세(상호공개) |
|---|---|---|
| ![](captures/app-01-login.png) | ![](captures/app-02-home.png) | ![](captures/app-03-detail.png) |

| 작성(모드선택) | 설정 |
|---|---|
| ![](captures/app-04-write.png) | ![](captures/app-05-settings.png) |

## 운영 메모 (현재)
- 백엔드 `https://today-api.hammerslog.trade`(→8083), 웹 `https://today-web.hammerslog.trade`(→8087), Expo Go `exp://today-expo.hammerslog.trade`(→Metro 8088). MySQL `today`@3307.
- cloudflared named 터널은 root 데몬 → config 변경 시 `sudo launchctl kickstart -k system/com.cloudflare.cloudflared` 필요.
