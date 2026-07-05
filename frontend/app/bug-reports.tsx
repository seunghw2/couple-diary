import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BugReport, bugReportApi } from '../lib/api';
import { timeAgo } from '../lib/date';
import { Icon } from '../components/ui';
import { colors, font, radius, spacing, useColors } from '../theme/theme';

/** 설정 > 버그 리포트 목록. 전역 최신순(커플 두 명 모두). */
export default function BugReportsScreen() {
  const router = useRouter();
  const c = useColors();
  const [items, setItems] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await bugReportApi.list();
      setItems(res.items);
    } catch {
      /* 무시: 빈 목록 유지 */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.title}>버그 리포트</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="bug-outline" size={44} color={colors.coralSoft} />
              <Text style={styles.emptyTitle}>아직 리포트가 없어요</Text>
              <Text style={styles.emptySub}>플로팅 버튼으로 버그나 원하는 기능을 남겨보세요</Text>
            </View>
          ) : (
            items.map((r) => <ReportRow key={r.id} report={r} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ReportRow({ report }: { report: BugReport }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.reporter}>{report.reporterNickname}</Text>
        <Text style={styles.time}>{timeAgo(report.createdAt)}</Text>
      </View>

      {report.bugText ? (
        <View style={styles.block}>
          <View style={[styles.tag, { backgroundColor: colors.danger }]}>
            <Text style={styles.tagText}>버그</Text>
          </View>
          <Text style={styles.blockText}>{report.bugText}</Text>
        </View>
      ) : null}

      {report.wishText ? (
        <View style={[styles.block, report.bugText ? { marginTop: spacing.sm } : null]}>
          <View style={[styles.tag, { backgroundColor: c.primary }]}>
            <Text style={styles.tagText}>기능 제안</Text>
          </View>
          <Text style={styles.blockText}>{report.wishText}</Text>
        </View>
      ) : null}
    </View>
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },

  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reporter: { ...font.title, fontWeight: '700' },
  time: { ...font.caption, color: colors.subText },

  block: { gap: spacing.xs },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  blockText: { ...font.body, color: colors.text, lineHeight: 21 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl * 3, gap: spacing.sm },
  emptyTitle: { ...font.title, marginTop: spacing.sm },
  emptySub: { ...font.caption, textAlign: 'center' },
});
