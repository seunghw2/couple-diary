# 05 · App Store 에셋 요구사항 및 체크리스트

> 투데이(love today)의 App Store 제출에 필요한 이미지 에셋 규격과 준비 방법. 현행 Apple 요구사항 기준.

---

## 1. 앱 아이콘 (App Icon)

### 요구사항
- **크기**: 1024 x 1024 px (정확히)
- **포맷**: PNG 또는 JPEG
- **알파 채널(투명도) 없음** — 반드시 불투명. 투명 배경이 있으면 심사에서 거부된다.
- **정사각형**, 둥근 모서리를 직접 넣지 말 것 — 모서리 라운딩은 Apple이 자동 처리한다.
- 색상 프로파일: sRGB 또는 P3 권장.

### 현재 상태 확인 방법
```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha "/Users/shstl/Claude Code/couple-diary/frontend/assets/icon.png"
```
> 확인 결과(2026-07 기준): `icon.png` 는 **1024 x 1024** 로 크기 요건 충족.
> 반드시 추가 확인할 것: **알파 채널 유무**. 위 명령의 `hasAlpha: yes` 로 나오면 알파를 제거해야 한다.

### 알파 채널 제거(필요 시)
알파가 있으면 흰/크림 배경 위에 평탄화하여 불투명 PNG로 만든다. 예:
```bash
# ImageMagick이 있는 경우 (앱 배경톤 #FBF3EE 로 평탄화)
magick "assets/icon.png" -background "#FBF3EE" -alpha remove -alpha off "assets/icon-store.png"
```
> App Store 아이콘은 Expo가 빌드 시 자동 생성/포함하지만, 원본에 알파가 있으면 그대로 실려 거부될 수 있으므로 원본을 불투명으로 유지하는 것이 안전하다.

---

## 2. iPhone 스크린샷 (필수)

### 현행 요구 규격
Apple은 특정 디스플레이 크기의 스크린샷을 요구한다. 현재는 아래 두 크기가 핵심이며, **6.9인치(또는 6.7인치)는 사실상 필수**, 6.5인치는 함께 준비하면 구형 대응이 된다.

| 디스플레이 | 해당 기기(예) | 세로(portrait) 픽셀 | 필요 여부 |
|---|---|---|---|
| **6.9" (또는 6.7")** | iPhone 16 Pro Max / 15 Pro Max | 1290 x 2796 (6.7") 또는 1320 x 2868 (6.9") | **필수** |
| **6.5"** | iPhone 11 Pro Max / XS Max | 1242 x 2688 | 권장(구형 대응) |

> 참고: 최신 App Store Connect는 6.9"(또는 6.7") 세트 하나를 올리면 더 작은 기기에는 자동 축소 적용을 허용하는 방향으로 단순화되었다. 하지만 표시 품질을 위해 6.9"/6.7"과 6.5" 두 세트를 준비하는 것을 권장한다. iPad를 지원 대상으로 둔다면(app.json의 `supportsTablet: true`) **iPad 12.9" 스크린샷(2048 x 2732)도 별도로 요구**될 수 있으니 확인할 것.

### 개수
- 각 크기별 **최소 1장, 최대 10장.**
- 실무 권장: **3~5장** (핵심 화면: ① 홈/달력 · ② 오늘의 질문 편지 · ③ 지도 · ④ 일기 작성/열림 · ⑤ 기념일/D-day).

### 캡처 방법
**A. iOS 시뮬레이터 (권장 — 정확한 픽셀 크기 보장)**
```bash
# 원하는 기기로 앱 실행 후
xcrun simctl io booted screenshot ~/Desktop/today-screen-1.png
```
- 시뮬레이터에서 "iPhone 16 Pro Max"(6.9") 등 정확한 모델을 부팅해 캡처하면 요구 해상도가 자동으로 맞는다.
- Expo 앱을 시뮬레이터에서 실행: `npx expo start` 후 `i` 키.
- 주의(메모리 참고): 자동화 셸 환경에서는 `simctl` 이 세션 격리로 멈출 수 있음 → 실제 맥 데스크톱 세션에서 수행.

**B. 실기기 (아이폰)**
- 아이폰에서 앱 실행 → 전원+볼륨업 동시 눌러 스크린샷 → 크기가 해당 모델 해상도와 일치하는지 확인.
- 6.9"/6.7" 요구 규격을 맞추려면 해당 크기의 실기기가 필요.

**C. 캡처 후 크기 확인**
```bash
sips -g pixelWidth -g pixelHeight ~/Desktop/today-screen-1.png
```
> 요구 픽셀과 정확히 일치해야 업로드가 통과된다. 상태바가 지저분하면(배터리·시계) 정리된 상태로 캡처하거나 프레임 목업 도구 사용.

---

## 3. 스플래시 화면 (Splash Screen)

- Expo `expo-splash-screen` 플러그인으로 처리 중.
- 현재 설정(app.json): `splash-icon.png`, `imageWidth: 200`, `resizeMode: contain`, 배경 `#FBF3EE`.
- App Store 별도 스플래시 업로드 요구는 없음(런치스크린은 빌드에 포함됨). `splash-icon.png` 가 저해상도라면 표시 품질을 위해 충분한 해상도(권장 1024px 이상 정사각)로 준비할 것.

---

## 4. 앱 미리보기 영상 (App Preview, 선택)

- 필수 아님. 준비 시 15~30초, 각 디스플레이 크기에 맞는 해상도 필요.
- 초기 출시에는 생략 가능.

---

## 5. 준비 체크리스트

- [ ] 앱 아이콘 1024x1024, **알파 없음** 확인 (`sips ... hasAlpha`)
- [ ] iPhone 6.9"(또는 6.7") 스크린샷 3~5장 (필수)
- [ ] iPhone 6.5" 스크린샷 3~5장 (권장)
- [ ] iPad 지원 시(supportsTablet=true) iPad 12.9" 스크린샷 — **지원 안 하면 app.json에서 supportsTablet=false 로 두어 iPad 요구 제거 검토**
- [ ] 스플래시 이미지 충분한 해상도 확인
- [ ] 스크린샷 내 텍스트/화면에 실제와 다른 허위 기능 없음(심사 요건)
- [ ] 스크린샷의 상태바/개인정보(실명·연락처 등) 노출 없음

> 팁: iPad를 실제로 지원할 계획이 없다면 `app.json` 의 `ios.supportsTablet` 를 `false` 로 바꿔 iPad 스크린샷 요구 자체를 없애는 편이 출시가 빠르다. (코드/설정 변경이므로 이 문서에서는 제안만 하고 직접 수정하지 않음.)
