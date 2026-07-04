# 04 · 원격 실행 — Cloudflare 터널 고정 URL

**날짜**: 2026-07-04~05
**목표**: 다른 네트워크에서도 앱을 쓸 수 있게(폰에서 접속). 무료로.

## 무료 터널 비교
- **ngrok**(Expo `--tunnel` 기본): 무료 동시 1개 제한 → gymtracker/overload가 이미 점유.
- **Cloudflare Quick Tunnel**: 무료·개수 무제한, URL이 매번 바뀜.
- **Cloudflare Named Tunnel**(보유 도메인 `hammerslog.trade`): 고정 URL. ← 채택.

## 한 일
- 백엔드(8083)·웹(8087)·Metro(8088)를 named 터널 서브도메인으로:
  - `today-api.hammerslog.trade` → 8083 (백엔드)
  - `today-web.hammerslog.trade` → 8087 (웹, `expo export` 정적빌드 + `serve`)
  - `today-expo.hammerslog.trade` → 8088 (Metro, Expo Go)
- CORS에 `https://*.trycloudflare.com`, `https://today-web.hammerslog.trade` 허용.

## 삽질/교훈
- named 터널이 **root 시스템 데몬**이라 config 변경 시 `sudo launchctl kickstart -k system/com.cloudflare.cloudflared` 필요(내 권한으로 kill 안 됨).
- 옛 config 인스턴스 + 수동 인스턴스가 **동시에 붙어 요청이 분산**되며 간헐적 404 → 인스턴스 정리로 해결.
- **Expo Go over 터널의 포트 함정**: 기본은 번들 URL에 `:8088`이 박혀 실패(quick 터널은 443만 노출). → `EXPO_PACKAGER_PROXY_URL=https://today-expo.hammerslog.trade` 환경변수로 번들 URL을 443(포트 없음)으로 만들어 해결. (gymtracker의 `expo.hammerslog.trade` 방식과 동일)

## 검증
- 고정 웹 URL로 헤드리스 로그인→홈 실제 200, 크로스오리진 CORS 통과.
- 재현 문서: [docs/implemented/RUN_REMOTE.md](../implemented/RUN_REMOTE.md)
