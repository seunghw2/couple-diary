/**
 * "투데이" 디자인 토큰 — 워밍 코럴 & 크림.
 * 목업(1a-sticker-calendar) 기준. 시스템 폰트, 큰 라운드, 은은한 그림자.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: '#FFF6EF',
  card: '#FFFDFA',
  primary: '#FF8E72', // coral
  coralSoft: '#FFA98C',
  coralSofter: '#FFC7B0',
  text: '#5A4038',
  subText: '#7A5A4E',
  border: '#F1E2D6',
  placeholder: '#B39685', // 입력 placeholder — border보다 진한 subText 계열

  // 보조 (파트너/블러 등)
  partner: '#9B8CFF',
  partnerSoft: '#C7BEFF',
  white: '#FFFFFF',
  star: '#FFB443',
  danger: '#E5654B',
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 은은한 그림자 (iOS/Android/web 공통). */
export const shadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#C9967E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  android: { elevation: 4 },
  default: {
    boxShadow: '0 6px 14px rgba(201,150,126,0.18)',
  },
}) as ViewStyle;

export const font = {
  h1: { fontSize: 28, fontWeight: '800', color: colors.text } as TextStyle,
  h2: { fontSize: 20, fontWeight: '700', color: colors.text } as TextStyle,
  title: { fontSize: 17, fontWeight: '700', color: colors.text } as TextStyle,
  body: { fontSize: 15, fontWeight: '400', color: colors.text } as TextStyle,
  label: { fontSize: 13, fontWeight: '600', color: colors.subText } as TextStyle,
  caption: { fontSize: 12, fontWeight: '400', color: colors.subText } as TextStyle,
};

/**
 * thumbSeed 문자열 → 부드러운 코럴/파스텔 그라데이션 색 2개.
 * 결정적(deterministic): 같은 seed면 항상 같은 색.
 */
export function seedGradient(seed: string | null | undefined): [string, string] {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 28) % 360;
  return [`hsl(${hue}, 72%, 78%)`, `hsl(${hue2}, 70%, 68%)`];
}
