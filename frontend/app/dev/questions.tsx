import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '../../components/ErrorState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DevPoolItem, devApi } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

export default function DevQuestionBank() {
  const [items, setItems] = useState<DevPoolItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setItems(await devApi.questions());
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  // 카테고리별 그룹
  const groups = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, DevPoolItem[]>();
    for (const it of items) {
      const key = it.category || '기타';
      (map.get(key) ?? map.set(key, []).get(key)!).push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="질문 뱅크" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !items ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>질문 뱅크가 비어 있어요.</Text>
        ) : (
          <>
            <Text style={styles.summary}>총 {items.length}개 · 앞으로 이 풀에서 매일 하나씩 나와요</Text>
            {groups.map(([cat, list]) => (
              <View key={cat}>
                <Text style={styles.groupLabel}>{cat} · {list.length}</Text>
                <View style={styles.groupCard}>
                  {list.map((q, i) => (
                    <View key={q.id} style={[styles.row, i < list.length - 1 && styles.rowBorder]}>
                      <Text style={styles.qText}>{q.text}</Text>
                      <View style={styles.badges}>
                        <Text style={styles.badge}>깊이 {q.depth}</Text>
                        {q.usedCount > 0 ? <Text style={styles.badge}>사용 {q.usedCount}</Text> : null}
                        {q.contextTrigger ? (
                          <Text style={[styles.badge, styles.badgeCtx]}>{q.contextTrigger}</Text>
                        ) : null}
                        {q.template ? <Text style={[styles.badge, styles.badgeCtx]}>템플릿</Text> : null}
                        {!q.active ? <Text style={[styles.badge, styles.badgeOff]}>비활성</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: 40 },
  summary: { ...font.caption, color: colors.subText, marginBottom: spacing.sm, marginLeft: spacing.xs },
  groupLabel: { ...font.label, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  groupCard: { backgroundColor: colors.card, borderRadius: radius.md, ...shadow, overflow: 'hidden' },
  row: { paddingHorizontal: spacing.md, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  qText: { ...font.body, color: colors.text, lineHeight: 21 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.subText,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeCtx: { color: colors.text, backgroundColor: colors.coralSofter },
  badgeOff: { color: colors.white, backgroundColor: colors.placeholder },
});
