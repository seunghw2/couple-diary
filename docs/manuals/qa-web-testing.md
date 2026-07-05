# QA · 웹으로 앱 직접 테스트하는 법 (매뉴얼)

> **목적**: 실기기 없이 **Expo Web 빌드**로 투데이 앱을 브라우저에서 띄워 화면/흐름을 검증하고, **개발 테스트 계정 + 더미 데이터**로 채운 상태를 만드는 방법. muscle game 등에서 쓰던 Expo Web QA 방식과 동일하되 이 앱에 맞춰 정리.

---

## 1. 실행 URL / 포트 (현재 운영)
- 백엔드 API: `https://today-api.hammerslog.trade` (→ 로컬 8083)
- 웹앱: `https://today-web.hammerslog.trade` (→ 로컬 8087, `serve -s dist`)
- Metro(Expo Go): `exp://today-expo.hammerslog.trade` (→ 8088)
- DB: MySQL `today` @ `127.0.0.1:3307` (root / 비밀번호 없음)

> **카카오 지도는 등록 도메인에서만 렌더된다.** WebView가 Kakao JS SDK를 로드할 때 Referer 도메인을 대조하므로, **반드시 `today-web.hammerslog.trade`로 접속**해야 지도가 뜬다(`localhost`나 다른 포트로 열면 지도 영역이 빈다).

## 2. 최신 코드로 웹 빌드 갱신
프론트 변경 후 웹에 반영하려면 dist를 다시 export (그러면 `serve -s dist`가 자동으로 새 파일 서빙):
```bash
cd ~/Claude\ Code/couple-diary/frontend
npx expo export --platform web --output-dir dist
```
> 서브에이전트가 프론트 파일을 수정 중일 때 export하면 반쪽 빌드가 나올 수 있으니, 수정이 끝난 뒤 export.

## 3. 개발 테스트 계정 (실계정 대신 사용)
로그인 화면 하단 **"닉네임으로 시작 (개발용)"** 에 닉네임만 넣으면 dev-login 된다.
- **닉네임 = 결정적 계정**: `POST /api/auth/dev-login {nickname}` 는 닉네임으로 파생한 이메일(`{nickname}@today.local`)로 **find-or-create** → 같은 닉네임이면 항상 같은 유저. (실제 카카오 계정 정보는 건드리지 않음.)
- **미리 만들어 둔 커플**: `qaA` ↔ `qaB` 는 서로 연결된 커플(테스트 일기 데이터 보유). 커플이라 로그인하면 바로 홈으로 들어간다.
- 커플 미연결 계정으로 로그인하면 "커플 연결" 화면에서 멈추니, **화면 검증엔 `qaA`(연결됨)로 로그인**할 것.

## 4. 더미 데이터 만들기 (애니풍 플레이스홀더 사진 포함)
사진은 **실제 사진 대신 일러스트 아바타**(DiceBear)를 URL로 그대로 넣는다. 앱은 `http`로 시작하는 url을 그대로 렌더한다(`components/ui.tsx`의 `url.startsWith('http') ? url : API_URL+url`). 업로드 불필요.

토큰 발급 후 `POST /api/entries/{date}` 로 양쪽(qaA·qaB)이 같은 날짜에 쓰면 그 날 일기가 "공개(OPEN)" 상태가 된다.
```bash
B=http://127.0.0.1:8083
TA=$(curl -s -X POST $B/api/auth/dev-login -H 'Content-Type: application/json' -d '{"nickname":"qaA"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
# 예: 애니풍 사진 + 좌표 포함 장소
curl -s -X POST $B/api/entries/2026-07-01 -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{
  "mode":"TEMPLATE","templateType":"default",
  "answers":[{"promptKey":"where","text":"연남동 카페투어"},{"promptKey":"best","text":"노을 진 한강"},{"promptKey":"toPartner","text":"고마워"}],
  "mood":"love","rating":5,
  "locations":["연남동 감성카페"],
  "locationPoints":[{"name":"연남동 감성카페","lat":37.5623,"lng":126.9256,"category":"카페"}],
  "photoUrls":["https://api.dicebear.com/9.x/adventurer/png?seed=Mochi&size=400"]
}'
```
- 유효 값: `mood` = happy·love·calm·soso·sad·tired / `promptKey` = where·best·toPartner (템플릿).
- 애니풍 아바타 스타일 예: `adventurer`, `fun-emoji`, `big-smile`, `big-ears`, `bottts`. seed만 바꾸면 다른 이미지.
- `locationPoints`(name/lat/lng/category)를 넣으면 좌표까지 저장돼 지도 재현 테스트에 좋다.

## 5. 브라우저에서 모바일 뷰로 캡처
- Chrome 개발자도구 → 기기 툴바(모바일)로 보거나, **창을 폰 비율로 좁혀** 캡처하면 PC 와이드 레이아웃 대신 앱처럼 보인다.
- 접속: `https://today-web.hammerslog.trade` → 닉네임 `qaA` 로 시작 → 홈(달력).

## 6. 한계 (웹 QA로 못 보는 것 = 실기기 필요)
- **카카오 지도 WebView**: 등록 도메인(today-web)에서 로드되긴 하나, 롱프레스·정밀 제스처·위치 권한 흐름은 기기에서 확인이 정확.
- **expo-location / expo-media-library / 카카오 로그인 리다이렉트** 등 네이티브 권한·딥링크는 Expo Go(기기)에서 검증.
- 웹 라우팅 가드가 기기와 미묘하게 다를 수 있음(예: 로그아웃 후 전환) → 최종 확인은 기기.

## 7. 참고: DB로 상태 세팅 (고급)
`mysql -h127.0.0.1 -P3307 -uroot today` 로 직접 커플/일기 상태를 만들 수도 있다. 데이터 이전·정리처럼 API로 어려운 조작은 **먼저 `mysqldump`로 백업** 후 트랜잭션으로.
```bash
mysqldump -h127.0.0.1 -P3307 -uroot --databases today > backups/today-$(date +%Y%m%d-%H%M%S).sql
```
