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
            return (
              <Pressable
                key={cup.key}
                onPress={() => router.push(`/worldcup/${cup.key}`)}
                style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.emoji}>{cup.emoji}</Text>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{cup.title}</Text>
                  {tag ? (
                    <View
                      style={[
                        styles.tag,
                        tag.kind === 'both'
                          ? { backgroundColor: c.primary }
                          : tag.kind === 'me'
                            ? { backgroundColor: c.coralSofter }
                            : { backgroundColor: colors.partnerSoft },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: tag.kind === 'both' ? '#fff' : colors.text }]}>
                        {tag.label}
                      </Text>
                    </View>
                  ) : null}
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

/** 진행 상태를 태그로. 아무도 안 했으면 태그 없음(제목만). */
function statusTag(cup: WorldcupSummary): { label: string; kind: 'both' | 'me' | 'partner' } | null {
  if (cup.myPlayed && cup.partnerPlayed) return { label: '둘다완료', kind: 'both' };
  if (cup.myPlayed) return { label: '나 완료', kind: 'me' };
  if (cup.partnerPlayed) return { label: '연인 완료', kind: 'partner' };
  return null;
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
  emoji: { fontSize: 26 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...font.h2, fontSize: 16, flexShrink: 1 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11.5, fontWeight: '800' },
  chip: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8 },
  chipText: { ...font.caption, color: colors.white, fontWeight: '800', fontSize: 11 },
  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },
});
