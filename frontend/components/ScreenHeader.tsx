import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './ui';
import { colors, font, spacing, useColors } from '../theme/theme';

/** 사주 화면 공용 상단바 — 뒤로가기 + 타이틀 + 우측 여백(중앙정렬 유지). */
export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  const c = useColors();
  return (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Icon name="chevron-back" size={28} color={colors.subText} />
      </Pressable>
      <Text style={[styles.topTitle, { color: c.primary }]}>{title}</Text>
      <View style={{ width: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.h2, fontWeight: '800' },
});
