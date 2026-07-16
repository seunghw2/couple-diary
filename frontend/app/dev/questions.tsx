import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '../../components/ErrorState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DevPoolItem, devApi } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

type Status = 'all' | 'active' | 'inactive' | 'template' | 'trigger' | 'unused';

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '활성' },
  { key: 'inactive', label: '비활성' },
  { key: 'template', label: '템플릿' },
  { key: 'trigger', label: '트리거' },
  { key: 'unused', label: '미사용' },
];

function matchStatus(q: DevPoolItem, s: Status) {
  switch (s) {
    case 'active': return q.active;
    case 'inactive': return !q.active;
    case 'template': return q.template;
    case 'trigger': return !!q.contextTrigger;
    case 'unused': return q.usedCount === 0;
    default: return true;
  }
}

export default function DevQuestionBank() {
  const [items, setItems] = useState<DevPoolItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cat, setCat] = useState<string | null>(null);
  const [depth, setDepth] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('all');

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

  // 필터 후보(전체 데이터 기준)
  const categories = useMemo(
    () => Array.from(new Set((items ?? []).map((q) => q.category || '기타'))).sort(),
    [items],
  );
  const depths = useMemo(
    () => Array.from(new Set((items ?? []).map((q) => q.depth))).sort((a, b) => a - b),
    [items],
  );

  // 필터 적용 + 카테고리별 그룹
  const groups = useMemo(() => {
    if (!items) return [] as [string, DevPoolItem[]][];
    const filtered = items.filter(
      (q) =>
        (cat == null || (q.category || '기타') === cat) &&
        (depth == null || q.depth === depth) &&
        matchStatus(q, status),
    );
    const map = new Map<string, DevPoolItem[]>();
    for (const it of filtered) {
      const key = it.category || '기타';
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(it);
    }
    return Array.from(map.entries());
  }, [items, cat, depth, status]);

  const shown = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="질문 뱅크" />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 필터 바 */}
          <FilterRow label="카테고리">
            <Chip label="전체" on={cat == null} onPress={() => setCat(null)} />
            {categories.map((cName) => (
              <Chip key={cName} label={cName} on={cat === cName} onPress={() => setCat(cName)} />
            ))}
          </FilterRow>
          <FilterRow label="깊이">
            <Chip label="전체" on={depth == null} onPress={() => setDepth(null)} />
            {depths.map((d) => (
              <Chip key={d} label={`깊이 ${d}`} on={depth === d} onPress={() => setDepth(d)} />
            ))}
          </FilterRow>
          <FilterRow label="상태">
            {STATUS_OPTIONS.map((s) => (
              <Chip key={s.key} label={s.label} on={status === s.key} onPress={() => setStatus(s.key)} />
            ))}
          </FilterRow>

          <Text style={styles.summary}>
            {shown}개 표시 · 전체 {items.length}개
          </Text>

          {shown === 0 ? (
            <Text style={styles.empty}>조건에 맞는 질문이 없어요.</Text>
          ) : (
            groups.map(([cName, list]) => (
              <View key={cName}>
                <Text style={styles.groupLabel}>
                  {cName} · {list.length}
                </Text>
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
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {children}
      </ScrollView>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  filterLabel: { ...font.caption, color: colors.subText, width: 48 },
  chips: { gap: 6, paddingRight: spacing.md },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.subText },
  chipTextOn: { color: colors.white },

  summary: { ...font.caption, color: colors.subText, marginTop: spacing.sm, marginBottom: spacing.sm, marginLeft: spacing.xs },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: 40 },
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
