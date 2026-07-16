import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { WorldcupSummary, worldcupApi } from '../../lib/api';
import { ErrorState } from '../../components/ErrorState';
import { Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 월드컵 게임 홈 — 월드컵 목록에서 하나 선택. 설정 탭에서 진입. */
export default function WorldcupHome() {
  const router = useRouter();
  const c = useColors();
  const [cups, setCups] = useState<WorldcupSummary[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setCups(await worldcupApi.list());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // 목록을 열면 '상대 새 완료' 배지 초기화(설정 배지 사라짐).
      worldcupApi.markSeen().catch(() => {});
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]}>월드컵 게임</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>둘이 즐기는 취향 대결 🏆</Text>

        {cups == null && !error ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : (
          cups!.map((cup) => (
            <Pressable
              key={cup.key}
              onPress={() => router.push(`/worldcup/${cup.key}`)}
              style={({ pressed }) => [
                styles.card,
                shadow,
                cup.myPlayed && { borderLeftWidth: 4, borderLeftColor: c.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.emoji}>{cup.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{cup.title}</Text>
                  {cup.myPlayed ? (
                    <View style={[styles.donePill, { backgroundColor: c.primary }]}>
                      <Text style={styles.donePillText}>✓ 완료</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.status}>{statusLabel(cup)}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: c.coralSofter }]}>
                <Text style={styles.chipText}>{cup.size}강</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(cup: WorldcupSummary): string {
  if (cup.myPlayed && cup.partnerPlayed) return '둘 다 완료 ✓ · 결과 비교 가능';
  if (cup.myPlayed) return '내 기록 있음 · 상대는 아직';
  if (cup.partnerPlayed) return '상대는 완료 · 나도 해볼까?';
  return '아직 안 해봤어요';
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
  topTitle: { ...font.h2, fontWeight: '800' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },
  sub: { ...font.caption, color: colors.subText, marginBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  title: { ...font.h2, fontSize: 17 },
  donePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  donePillText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  status: { ...font.caption, color: colors.subText, marginTop: 3 },
  chip: { borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  chipText: { ...font.caption, color: colors.white, fontWeight: '800' },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
