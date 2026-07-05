/** 정적 콘텐츠: 기분, 템플릿 프롬프트. */
import type { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * 기분 선택지. 사용자가 고른 기분은 문자열(key)로 저장.
 * 벡터 아이콘(잎·원·달)은 감정이 잘 안 드러나서 이모지로 표시.
 * key=저장/식별용, emoji=UI 표시, label=보조 설명.
 */
export const MOODS: { key: string; emoji: string; label: string }[] = [
  { key: 'happy', emoji: '😊', label: '기쁨' },
  { key: 'love', emoji: '🥰', label: '사랑' },
  { key: 'calm', emoji: '😌', label: '평온' },
  { key: 'soso', emoji: '😐', label: '그냥' },
  { key: 'sad', emoji: '😢', label: '슬픔' },
  { key: 'tired', emoji: '😴', label: '피곤' },
];

/** 저장된 mood key → 이모지. 없으면 undefined. */
export function moodEmoji(key: string | null | undefined): string | undefined {
  return MOODS.find((m) => m.key === key)?.emoji;
}

/** 저장된 mood key → 한글 라벨. 없으면 undefined. */
export function moodLabel(key: string | null | undefined): string | undefined {
  return MOODS.find((m) => m.key === key)?.label;
}

/** 템플릿 모드 빈칸(promptKey → 라벨). icon=라벨 앞 벡터 아이콘. */
export const TEMPLATE_PROMPTS: { promptKey: string; icon: IconName; label: string; placeholder: string }[] = [
  { promptKey: 'where', icon: 'location-outline', label: '오늘 어디서 뭐 했어?', placeholder: '오늘의 데이트를 적어봐...' },
  { promptKey: 'best', icon: 'heart-outline', label: '오늘 제일 좋았던 순간은?', placeholder: '가장 좋았던 순간...' },
  { promptKey: 'toPartner', icon: 'chatbox-outline', label: '상대에게 한마디', placeholder: '오늘도 고마워, 라고 적어볼까...' },
];
