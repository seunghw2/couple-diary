import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArchiveItem, ArchiveResponse, dailyQuestionApi } from '../../lib/api';
import { formatKoShort, weekdayKo } from '../../lib/date';
import { Card, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 지난 편지함 (pushed). 요약 카드 + 날짜별 리스트. 무한 스크롤. */
export default function QuestionArchiveScreen() {
  const router = useRouter();
  const c = useColors();

  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [summary, setSummary] = useState<{ totalOpened: number; streak: number; milestone?: string } | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const apply = useCallback((res: ArchiveResponse, append: boolean) => {
    const list = res.items ?? [];
    setItems((prev) => (append ? [...prev, ...list] : list));
    setCursor(res.nextCursor);
    setSummary({ totalOpened: res.totalOpened, streak: res.streak, milestone: res.milestone });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await dailyQuestionApi.archive(undefined, 30);
      apply(res, false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await dailyQuestionApi.archive(cursor, 30);
      apply(res, true);
    } catch {
      /* 더 불러오기 실패는 조용히 무시 */
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, loading, apply]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>지난 편지함</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>편지함을 불러오지 못했어요.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.date}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListHeaderComponent={
            summary ? (
              <Card style={styles.summary}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryNum, { color: c.primary }]}>{summary.totalOpened}</Text>
                    <Text style={styles.summaryLabel}>주고받은 편지</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <View style={styles.streakNum}>
                      <Icon name="heart" size={16} color={c.primary} />
                      <Text style={[styles.summaryNum, { color: c.primary }]}>{summary.streak}</Text>
                    </View>
                    <Text style={styles.summaryLabel}>연속 일수</Text>
                  </View>
                </View>
                {summary.milestone ? (
                  <View style={styles.milestone}>
                    <Icon name="sparkles-outline" size={14} color={c.primary} />
                    <Text style={[styles.milestoneText, { color: c.primary }]}>{summary.milestone}</Text>
                  </View>
                ) : null}
              </Card>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>아직 주고받은 편지가 없어요.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={c.primary} style={{ marginVertical: spacing.lg }} /> : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/question/[date]', params: { date: item.date } })}
              style={({ pressed }) => [styles.row, shadow, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: item.opened ? '#FFF3E4' : colors.border }]}>
                <Icon
                  name={item.opened ? 'mail-open' : 'mail-outline'}
                  size={18}
                  color={item.opened ? c.primary : colors.placeholder}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowDate}>
                  {formatKoShort(item.date)} ({weekdayKo(item.date)})
                </Text>
                <Text
                  style={[styles.rowText, !item.opened && { color: colors.placeholder }]}
                  numberOfLines={1}
                >
                  {item.opened ? item.questionText : '지나간 편지'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.coralSoft} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.h2 },
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },

  summary: { marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  summaryNum: { fontSize: 24, fontWeight: '800' },
  streakNum: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryLabel: { ...font.caption, color: colors.subText },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  milestoneText: { ...font.label, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDate: { ...font.caption, color: colors.subText },
  rowText: { ...font.body, fontWeight: '600', marginTop: 2 },
});
