# 06 · Expo SDK 57→54 다운그레이드 (Expo Go 호환)

**날짜**: 2026-07-05
**목표**: Expo Go 앱에서 네이티브로 실행.

## 문제
Expo Go에서 열면 **"Project is incompatible with this version of Expo Go"**. 원인: `create-expo-app@latest`가 **SDK 57**(너무 최신)로 스캐폴딩 → 최신 Expo Go도 미지원. (연결 자체는 성공 = 터널/프록시는 정상이었음)

## 조치
같은 맥의 **overload/gymtracker가 SDK 54로 Expo Go 작동** → 동일 버전으로 다운그레이드.
- expo ~57→~54.0.35, react 19.2.3→19.1.0, react-native 0.86→0.81.5, expo-router ~57→~6.0.24, expo-image-picker ~57→~17.0.8 등 전 패키지 SDK54 정렬.
- `newArchEnabled: false`, plugins에서 expo-status-bar 제거.
- **기능/QA수정/사진업로드 코드는 무변경** (라우팅·ImagePicker API가 v6/v7 공통 시그니처).

## 검증
- `tsc --noEmit` 0, `expo config` sdkVersion 54.0.0, `expo export -p web` 성공.
- 고정 웹 URL로 **5화면(로그인·홈·상세·작성·설정) E2E 전부 200**, pageerror 0. QA 수정 시각 확인(상세 질문문장·수정/삭제 버튼, 캘린더 스티커 정위치).
- Metro 매니페스트 `exposdk:54.0.0` + 번들 URL 포트 클린.
- 커밋: `4de6267`

## 화면 (실제 캡처 · SDK54 E2E)
| 작성 | 설정 |
|---|---|
| ![](captures/app-04-write.png) | ![](captures/app-05-settings.png) |

## Expo Go 주소
- 투데이: `exp://today-expo.hammerslog.trade` (named 터널, sudo 재시작 후 활성)
- 참고 — gymtracker: `exp://expo.hammerslog.trade` / muscle game: `exp://…exp.direct`(ngrok)
