# 08 · UI 전면 벡터 아이콘화 (기본 이모지 제거)

**날짜**: 2026-07-05
**목표**: "다른 앱들은 OS 기본 이모지를 안 쓴다" → 진짜 앱처럼 벡터 아이콘 UI로.

## 한 일
- **@expo/vector-icons(Ionicons)** 도입(Expo 기본 포함). `components/ui.tsx`에 `<Icon>` 래퍼 + Button `icon` prop.
- 전 화면 이모지 → 라인 아이콘(코럴 톤):
  - 탭바 📅🗺️⚙️ → `calendar`/`map`/`settings`
  - 별점 ★ → `star`/`star-outline`, 잠금 🔒 → `lock-closed`, 작성 ✏️ → `create`, 댓글 💬 → `chatbubble-ellipses`, 위치 📍 → `location`, D-day/하트 → `heart`, 사진 없을 때 → `image-outline`, 월이동 → `chevron`
  - 기분: 이모지 문자열 저장 → key 저장 + 아이콘 표시(`moodIcon`)
- 장식용 이모지(로고 하트·리본·💕 등) 제거하거나 아이콘/텍스트로 대체.
- (프레임워크 질문 답변: Expo 유지가 맞음 — EAS Build로 앱스토어 정식 배포 가능, @expo/vector-icons는 순수 RN에서도 동일 동작.)

## 검증 (실제 캡처 · 아이콘 적용 후)
| 홈 (탭바·로고·별점 아이콘) | 상세 (별·위치·사진 아이콘) |
|---|---|
| ![](captures/app-02-home.png) | ![](captures/app-03-detail.png) |

- 헤드리스 실제 렌더 확인, `tsc --noEmit` 0. 커밋: `bcd9a9a`
- 참고: 기존 테스트 데이터의 기분은 아이콘 매핑 안 됨(신규 작성분부터 정상).
