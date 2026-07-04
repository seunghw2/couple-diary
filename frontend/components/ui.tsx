import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { API_URL } from '../lib/config';
import { colors, font, radius, seedGradient, shadow, spacing } from '../theme/theme';

/** 화면 배경(크림). */
export function ScreenBg({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

/** 라운드 카드. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, shadow, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'soft' | 'ghost';
  style?: StyleProp<ViewStyle>;
};

/** 코럴 CTA 버튼. */
export function Button({ label, onPress, disabled, loading, variant = 'primary', style }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        variant === 'soft' && styles.btnSoft,
        isGhost && styles.btnGhost,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text
          style={[
            styles.btnLabel,
            isPrimary && { color: colors.white },
            (variant === 'soft' || isGhost) && { color: colors.primary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** 별점 (읽기/입력 겸용). */
export function StarRating({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={4}>
          <Text style={{ fontSize: size, color: i <= value ? colors.star : colors.border }}>
            {i <= value ? '★' : '☆'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** thumbSeed 기반 그라데이션 썸네일 (진짜 이미지 대체 placeholder). */
export function SeedThumb({
  seed,
  size = 56,
  round = true,
  label,
  ring,
  style,
}: {
  seed: string | null | undefined;
  size?: number;
  round?: boolean;
  label?: string;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [c1, c2] = seedGradient(seed);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : radius.md,
          backgroundColor: c1,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: ring ? 3 : 0,
          borderColor: ring ? colors.primary : 'transparent',
        },
        style,
      ]}
    >
      {/* 아래 반쪽에 두 번째 색을 겹쳐 유사 그라데이션 */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: c2, opacity: 0.85 }} />
      {label ? <Text style={{ fontSize: size * 0.4 }}>{label}</Text> : null}
    </View>
  );
}

/** 실제 이미지 url 있으면 <Image>, 없으면 SeedThumb 그라데이션 폴백. */
export function PhotoThumb({
  url,
  seed,
  size = 56,
  round = true,
  label,
  ring,
  style,
}: {
  url?: string | null;
  seed: string | null | undefined;
  size?: number;
  round?: boolean;
  label?: string;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (url) {
    const uri = url.startsWith('http') ? url : `${API_URL}${url}`;
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: round ? size / 2 : radius.md,
            borderWidth: ring ? 3 : 0,
            borderColor: ring ? colors.primary : 'transparent',
            backgroundColor: colors.border,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }
  return <SeedThumb seed={seed} size={size} round={round} label={label} ring={ring} style={style} />;
}

export function Badge({ text, color = colors.primary }: { text: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

/** 라벨 pill (위치/닉네임 등). */
export function Pill({ children, tone = 'coral' }: { children: ReactNode; tone?: 'coral' | 'partner' | 'neutral' }) {
  const bg = tone === 'coral' ? colors.coralSofter : tone === 'partner' ? colors.partnerSoft : colors.border;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {typeof children === 'string' ? <Text style={pillText}>{children}</Text> : children}
    </View>
  );
}

const pillText: TextStyle = { ...font.label, color: colors.text };

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  btn: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSoft: { backgroundColor: colors.coralSofter },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.coralSoft },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
