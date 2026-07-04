# 다른 네트워크에서 실행하기 (무료 Cloudflare Tunnel)

로컬 dev 서버를 **다른 와이파이/셀룰러에서도** 열 수 있게 하는 방법. Expo Go 네이티브가 아니라 **웹 버전을 공개 URL로** 띄우는 방식(가장 견고, 앱 설치 불필요).

## 무료 터널 옵션 비교
| 방법 | 무료 제한 | 비고 |
|------|-----------|------|
| **ngrok** (Expo `--tunnel` 기본) | **동시 터널 1개**, URL 매번 랜덤 | overload/gymtracker가 이미 점유 → 3번째 충돌 |
| **Cloudflare Quick Tunnel** (`cloudflared --url`) | 계정 불필요·개수 제한 없음 | URL 매 재시작마다 바뀜, 업타임 보장 없음(개발용) ✅ 채택 |
| Cloudflare Named Tunnel | 무료(계정+도메인 필요) | 고정 URL. 이미 `hammerslog.trade` 보유 → 영구 URL 원하면 이 쪽 |

> 참고: 네이티브 Expo Go를 quick 터널로 여는 건 **매니페스트 번들 URL에 `:8088` 포트가 박혀** 실패함(quick 터널은 443만 노출). 그래서 웹 방식을 씀. 네이티브 원격이 꼭 필요하면 named 터널(`expo.hammerslog.trade`처럼) + Expo `--tunnel` 대체 셋업 필요.

## 절차
```bash
# 0) 백엔드/DB 실행 (MySQL today@3307)
cd backend && ./mvnw spring-boot:run          # localhost:8083

# 1) 백엔드를 공개 URL로 (기존 ~/.cloudflared/config.yml과 충돌 안 나게 빈 config로 격리)
echo "" > /tmp/empty-cf.yml
cloudflared tunnel --config /tmp/empty-cf.yml --url http://localhost:8083
#   → https://<random-A>.trycloudflare.com  (= API_URL)

# 2) 웹 빌드 (app.json extra.apiUrl 를 <random-A> 로 바꾸고, 캐시 비우고 빌드)
cd frontend
#   app.json: "extra": { "apiUrl": "https://<random-A>.trycloudflare.com" }
rm -rf dist node_modules/.cache "$TMPDIR"/metro-*
npx expo export -p web --clear
sed -i '' 's/<script src=/<script type="module" src=/' dist/index.html   # 필수(백지 방지)

# 3) 웹 정적 서버 + 공개 터널
npx serve -s dist -l 8088
cloudflared tunnel --config /tmp/empty-cf.yml --url http://localhost:8088
#   → https://<random-B>.trycloudflare.com  ← 이 URL을 폰 브라우저에서 열면 됨
```

## CORS
백엔드 `app.cors.allowed-origins` 에 `https://*.trycloudflare.com` 포함(커밋됨). Bearer 토큰만 쓰므로 `allowedOriginPatterns`로 와일드카드 허용 OK.

## 검증 완료
공개 웹 URL(<random-B>)을 헤드리스 Chrome으로 로드 → 공개 백엔드(<random-A>)로 `/api/me·couple·entries` **전부 200**, 홈 실데이터 렌더 확인(2026-07-05 기준).

## 주의 (무료 quick 터널 특성)
- URL은 **cloudflared 재시작마다 바뀜** → 바뀌면 2)의 app.json apiUrl + 재빌드 필요.
- 업타임 보장 없음(개발/공유용). **고정 URL**이 필요하면 named 터널(`*.hammerslog.trade`) 또는 웹을 **Cloudflare Pages**(무료)로 배포 권장.
