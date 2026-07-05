/** 정적 콘텐츠: 기분, 템플릿 프롬프트. */
import type { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * 기분 선택지(12개). 앱 아웃라인 느낌에 맞춘 Tabler 라인 아이콘으로 표시(글자 없음).
 * 커플/데이트 앱이라 하트 계열(사랑·설렘) 포함. key=저장/식별용(하위호환 유지).
 * (Tabler엔 heart-eyes가 없어 사랑은 mood-heart 사용)
 */
import type { Icon } from '@tabler/icons-react-native';
import {
  IconMoodHappy,
  IconMoodHeart,
  IconHearts,
  IconMoodCrazyHappy,
  IconMoodSmile,
  IconMoodWink,
  IconMoodNeutral,
  IconMoodNervous,
  IconMoodSad,
  IconMoodCry,
  IconMoodSick,
  IconMoodAngry,
} from '@tabler/icons-react-native';

export type MoodIcon = Icon;

export const MOODS: { key: string; label: string; Icon: MoodIcon }[] = [
  { key: 'happy', label: '기쁨', Icon: IconMoodHappy },
  { key: 'love', label: '사랑', Icon: IconMoodHeart },
  { key: 'flutter', label: '설렘', Icon: IconHearts },
  { key: 'excited', label: '신남', Icon: IconMoodCrazyHappy },
  { key: 'calm', label: '평온', Icon: IconMoodSmile },
  { key: 'playful', label: '장난', Icon: IconMoodWink },
  { key: 'soso', label: '그냥', Icon: IconMoodNeutral },
  { key: 'nervous', label: '긴장', Icon: IconMoodNervous },
  { key: 'sad', label: '슬픔', Icon: IconMoodSad },
  { key: 'cry', label: '울음', Icon: IconMoodCry },
  { key: 'sick', label: '아픔', Icon: IconMoodSick },
  { key: 'angry', label: '화남', Icon: IconMoodAngry },
];

/** 저장된 mood key → 아이콘 컴포넌트. 없으면 undefined. */
export function moodIcon(key: string | null | undefined): MoodIcon | undefined {
  return MOODS.find((m) => m.key === key)?.Icon;
}

/** 템플릿 모드 빈칸(promptKey → 라벨). icon=라벨 앞 벡터 아이콘. */
export const TEMPLATE_PROMPTS: { promptKey: string; icon: IconName; label: string; placeholder: string }[] = [
  { promptKey: 'where', icon: 'location-outline', label: '오늘 어디서 뭐 했어?', placeholder: '오늘의 데이트를 적어봐...' },
  { promptKey: 'best', icon: 'heart-outline', label: '오늘 제일 좋았던 순간은?', placeholder: '가장 좋았던 순간...' },
  { promptKey: 'toPartner', icon: 'chatbox-outline', label: '상대에게 한마디', placeholder: '오늘도 고마워, 라고 적어볼까...' },
];
