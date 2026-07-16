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
          cups!.map((cup) => {
            const tag = statusTag(cup);
            const tagBg =
              tag.kind === 'both'
                ? c.primary
                : tag.kind === 'me'
                  ? c.coralSofter
                  : tag.kind === 'partner'
                    ? colors.partnerSoft
                    : colors.border;
            return (
              <Pressable
                key={cup.key}
                onPress={() =>
                  router.push(cup.myPlayed ? `/worldcup/${cup.key}` : `/worldcup/${cup.key}/play`)
                }
                style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.emoji}>{cup.emoji}</Text>
                <View style={styles.mid}>
                  <Text style={styles.title} numberOfLines={1}>{cup.title}</Text>
                  <View style={[styles.tag, { backgroundColor: tagBg }]}>
                    <Text style={[styles.tagText, { color: tag.kind === 'both' ? '#fff' : colors.subText }]}>
                      {tag.label}
                    </Text>
                  </View>
                </View>
                <View style={[styles.chip, { backgroundColor: c.coralSofter }]}>
                  <Text style={styles.chipText}>{cup.size}강</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.subText} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 진행 상태를 태그로(모든 카드가 태그 한 줄을 가져 높이가 통일된다). */
function statusTag(cup: WorldcupSummary): { label: string; kind: 'both' | 'me' | 'partner' | 'none' } {
  if (cup.myPlayed && cup.partnerPlayed) return { label: '둘다완료', kind: 'both' };
  if (cup.myPlayed) return { label: '나 완료', kind: 'me' };
  if (cup.partnerPlayed) return { label: '연인 완료', kind: 'partner' };
  return { label: '아직 안 함', kind: 'none' };
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
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 28 },
  mid: { flex: 1, gap: 5 },
  title: { ...font.h2, fontSize: 16.5 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11.5, fontWeight: '800' },
  chip: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8 },
  chipText: { ...font.caption, color: colors.white, fontWeight: '800', fontSize: 11 },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
