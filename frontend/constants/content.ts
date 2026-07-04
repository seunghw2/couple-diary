/** 정적 콘텐츠: 기분, 템플릿 프롬프트. */
import type { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * 기분 선택지. 사용자가 고른 기분은 문자열로 저장/표시되는 콘텐츠 데이터.
 * key=저장/식별용, icon=UI에 그릴 벡터 아이콘.
 */
export const MOODS: { key: string; icon: IconName }[] = [
  { key: 'happy', icon: 'happy-outline' },
  { key: 'love', icon: 'heart-outline' },
  { key: 'calm', icon: 'leaf-outline' },
  { key: 'soso', icon: 'ellipse-outline' },
  { key: 'sad', icon: 'sad-outline' },
  { key: 'tired', icon: 'moon-outline' },
];

/** 저장된 mood key → 아이콘 이름. 없으면 undefined. */
export function moodIcon(key: string | null | undefined): IconName | undefined {
  return MOODS.find((m) => m.key === key)?.icon;
}

/** 템플릿 모드 빈칸(promptKey → 라벨). icon=라벨 앞 벡터 아이콘. */
export const TEMPLATE_PROMPTS: { promptKey: string; icon: IconName; label: string; placeholder: string }[] = [
  { promptKey: 'where', icon: 'location-outline', label: '오늘 어디서 뭐 했어?', placeholder: '오늘의 데이트를 적어봐...' },
  { promptKey: 'best', icon: 'heart-outline', label: '오늘 제일 좋았던 순간은?', placeholder: '가장 좋았던 순간...' },
  { promptKey: 'toPartner', icon: 'chatbox-outline', label: '상대에게 한마디', placeholder: '오늘도 고마워, 라고 적어볼까...' },
];
