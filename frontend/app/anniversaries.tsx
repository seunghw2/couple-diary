import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AnniversaryItem, coupleApi } from '../lib/api';
import { formatKoLong, weekdayKo } from '../lib/date';
import { Card, Icon } from '../components/ui';
import { colors, font, radius, spacing, useColors } from '../theme/theme';

/** dday(남은 일수, 0=오늘) → 표기. */
function ddayLabel(dday: number): string {
  if (dday === 0) return 'D-DAY';
  return `D-${dday}`;
}

export default function AnniversariesScreen() {
  const router = useRouter();
  const c = useColors();
  const [items, setItems] = useState<AnniversaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await coupleApi.anniversaries();
      setItems(res.items);
    } catch {
      setError('기념일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.title}>기념일</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.empty}>
              <Icon name="alert-circle-outline" size={40} color={colors.coralSoft} />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="gift-outline" size={40} color={colors.coralSoft} />
              <Text style={styles.emptyText}>
                아직 다가오는 기념일이 없어요.{'\n'}설정에서 기념일과 생일을 등록해 보세요.
              </Text>
            </View>
          ) : (
            items.map((it) => (
              <Card key={`${it.label}-${it.date}`} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{it.label}</Text>
                  <Text style={styles.itemDate}>
                    {formatKoLong(it.date)} ({weekdayKo(it.date)})
                  </Text>
                </View>
                <View style={[styles.ddayPill, { backgroundColor: c.coralSofter }]}>
                  <Text style={[styles.ddayText, { color: c.primary }]}>{ddayLabel(it.dday)}</Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  title: { ...font.h2 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl },

  item: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  itemLabel: { ...font.title },
  itemDate: { ...font.caption, marginTop: 2 },
  ddayPill: {
    backgroundColor: colors.coralSofter,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  ddayText: { ...font.label, color: colors.primary, fontWeight: '700' },

  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center', lineHeight: 22 },
});
