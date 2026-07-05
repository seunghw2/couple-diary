/**
 * "투데이" 디자인 토큰 — 워밍 코럴 & 크림.
 * 목업(1a-sticker-calendar) 기준. 시스템 폰트, 큰 라운드, 은은한 그림자.
 */
import { useMemo } from 'react';
import { Platform, TextStyle, ViewStyle } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';

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
/** #RRGGBB → {r,g,b}. 파싱 실패 시 코럴 폴백. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return { r: 0xff, g: 0x8e, b: 0x72 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** base 색을 흰색 쪽으로 amount(0~1)만큼 섞어 밝은 톤 생성. */
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const to2 = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

/** 정적 colors 타입(리터럴을 string으로 넓혀 오버라이드 가능하게). */
export type Colors = { [K in keyof typeof colors]: string };

/**
 * 동적 앱 컬러 훅. 정적 colors를 복사하되 primary(및 primary 파생 강조색)를
 * 스토어의 appPrimary로 오버라이드해 반환. 나머지 색은 그대로.
 * appPrimary가 바뀌면 스토어 구독으로 즉시 리렌더된다.
 */
export function useColors(): Colors {
  const appPrimary = useThemeStore((s) => s.appPrimary);
  return useMemo<Colors>(
    () => ({
      ...colors,
      primary: appPrimary,
      // 코럴에서 파생되던 밝은 톤들도 appPrimary 기준으로 재생성.
      coralSoft: lighten(appPrimary, 0.22),
      coralSofter: lighten(appPrimary, 0.5),
    }),
    [appPrimary]
  );
}

export function seedGradient(seed: string | null | undefined): [string, string] {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 28) % 360;
  return [`hsl(${hue}, 72%, 78%)`, `hsl(${hue2}, 70%, 68%)`];
}
