// 프로필 아바타 아이콘 — 무채색 라인. Phosphor 중심 + Lucide/Tabler 보충(전부 라인 스타일).
// 값 인코딩: "ph:cat" | "lu:turtle" | "tb:deer". prefix 없으면 구버전(이모지/이니셜) 폴백 대상.
import { ComponentType, ReactElement } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import {
  Cat, Dog, Rabbit, Bird, Butterfly, Fish, Horse, Cow, Shrimp,
  IceCream, Cake, Coffee, Cookie, Popcorn, Cherries, Carrot, Avocado, Egg, Hamburger, Pizza, Orange, Cheese, Bread, Pepper, OrangeSlice,
  Heart, HandHeart, Star, Sparkle, Crown, Flower, Ghost, Rainbow,
  Rocket, Camera, GameController, MusicNotes, Guitar, Palette, Planet, MagicWand,
  Barbell, SoccerBall, Confetti, Umbrella,
} from 'phosphor-react-native';
import { Turtle, Snail, Squirrel, Rat, Panda } from 'lucide-react-native';
import { IconDeer, IconPig } from '@tabler/icons-react-native';
import { colors } from '../theme/theme';
import { useThemeStore } from '../store/useThemeStore';

type IconProps = { size: number; color: string };

// 각 라이브러리 컴포넌트를 공통 시그니처로 감싼다. (Tabler는 굵기 prop이 strokeWidth)
const ph = (C: ComponentType<any>) => ({ size, color }: IconProps) => <C size={size} color={color} weight="regular" />;
const lu = (C: ComponentType<any>) => ({ size, color }: IconProps) => <C size={size} color={color} strokeWidth={2} />;
const tb = (C: ComponentType<any>) => ({ size, color }: IconProps) => <C size={size} color={color} strokeWidth={2} />;

const REGISTRY: Record<string, (p: IconProps) => ReactElement> = {
  // 동물 16
  'ph:cat': ph(Cat), 'ph:dog': ph(Dog), 'ph:rabbit': ph(Rabbit), 'ph:bird': ph(Bird),
  'ph:butterfly': ph(Butterfly), 'ph:fish': ph(Fish), 'ph:horse': ph(Horse), 'ph:cow': ph(Cow), 'ph:shrimp': ph(Shrimp),
  'lu:turtle': lu(Turtle), 'lu:snail': lu(Snail), 'lu:squirrel': lu(Squirrel), 'lu:rat': lu(Rat), 'lu:panda': lu(Panda),
  'tb:deer': tb(IconDeer), 'tb:pig': tb(IconPig),
  // 음식 16
  'ph:ice-cream': ph(IceCream), 'ph:cake': ph(Cake), 'ph:coffee': ph(Coffee), 'ph:cookie': ph(Cookie),
  'ph:popcorn': ph(Popcorn), 'ph:cherries': ph(Cherries), 'ph:carrot': ph(Carrot), 'ph:avocado': ph(Avocado),
  'ph:egg': ph(Egg), 'ph:hamburger': ph(Hamburger), 'ph:pizza': ph(Pizza), 'ph:orange': ph(Orange),
  'ph:cheese': ph(Cheese), 'ph:bread': ph(Bread), 'ph:pepper': ph(Pepper), 'ph:orange-slice': ph(OrangeSlice),
  // 러블리 8
  'ph:heart': ph(Heart), 'ph:hand-heart': ph(HandHeart), 'ph:star': ph(Star), 'ph:sparkle': ph(Sparkle),
  'ph:crown': ph(Crown), 'ph:flower': ph(Flower), 'ph:ghost': ph(Ghost), 'ph:rainbow': ph(Rainbow),
  // 사물 12 (운동 2: barbell·soccer-ball 포함)
  'ph:rocket': ph(Rocket), 'ph:camera': ph(Camera), 'ph:game-controller': ph(GameController), 'ph:music-notes': ph(MusicNotes),
  'ph:guitar': ph(Guitar), 'ph:palette': ph(Palette), 'ph:planet': ph(Planet), 'ph:magic-wand': ph(MagicWand),
  'ph:barbell': ph(Barbell), 'ph:soccer-ball': ph(SoccerBall), 'ph:confetti': ph(Confetti), 'ph:umbrella': ph(Umbrella),
};

// 피커 섹션 구성.
export const AVATAR_SECTIONS: { key: string; label: string; items: string[] }[] = [
  { key: 'animal', label: '동물', items: [
    'ph:cat','ph:dog','ph:rabbit','ph:bird','ph:butterfly','ph:fish','ph:horse','ph:cow','ph:shrimp',
    'lu:turtle','lu:snail','lu:squirrel','lu:rat','lu:panda','tb:deer','tb:pig' ] },
  { key: 'food', label: '음식', items: [
    'ph:ice-cream','ph:cake','ph:coffee','ph:cookie','ph:popcorn','ph:cherries','ph:carrot','ph:avocado',
    'ph:egg','ph:hamburger','ph:pizza','ph:orange','ph:cheese','ph:bread','ph:pepper','ph:orange-slice' ] },
  { key: 'lovely', label: '러블리', items: [
    'ph:heart','ph:hand-heart','ph:star','ph:sparkle','ph:crown','ph:flower','ph:ghost','ph:rainbow' ] },
  { key: 'object', label: '사물', items: [
    'ph:rocket','ph:camera','ph:game-controller','ph:music-notes','ph:guitar','ph:palette','ph:planet','ph:magic-wand',
    'ph:barbell','ph:soccer-ball','ph:confetti','ph:umbrella' ] },
];

/** value가 아이콘 아바타면 true(구버전 이모지/이니셜과 구분). */
export function isAvatarIcon(value?: string | null): boolean {
  return !!value && Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

export function AvatarIcon({ value, size, color }: { value?: string | null; size: number; color: string }) {
  const Cmp = value ? REGISTRY[value] : undefined;
  if (!Cmp) return null;
  return <Cmp size={size} color={color} />;
}

/**
 * 프로필 사진 = 그 사람이 고른 앱 컬러 배경 + 아이콘(흰색).
 * 아이콘 없으면 구버전 이모지, 그것도 없으면 닉네임 이니셜.
 * self=true면 "내" 프로필 → 현재 앱 색상(appPrimary)을 배경으로(즉시 반영).
 * self=false(상대)면 color(상대 avatarColor)를 배경으로.
 */
export function AvatarBubble({
  value,
  color,
  name,
  size,
  self,
  style,
}: {
  value?: string | null;
  color?: string | null;
  name?: string | null;
  size: number;
  self?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const appPrimary = useThemeStore((s) => s.appPrimary);
  const bg = self ? appPrimary : color || colors.coralSofter;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        style,
      ]}
    >
      {isAvatarIcon(value) ? (
        <AvatarIcon value={value} size={Math.round(size * 0.56)} color={colors.white} />
      ) : value ? (
        <Text style={{ fontSize: Math.round(size * 0.5) }}>{value}</Text>
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.42), fontWeight: '800', color: colors.white }}>
          {(name ?? '?').slice(0, 1)}
        </Text>
      )}
    </View>
  );
}
