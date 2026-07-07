import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WorldcupDetail, WorldcupRecords, worldcupApi } from '../../../lib/api';
import { Button, Icon } from '../../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../../theme/theme';

/** 월드컵 상세 — 진행하기 / 이전 기록 보기 + 커플 비교. 완주 직후엔 축하 배너. */
export default function WorldcupDetailScreen() {
  const router = useRouter();
  const c = useColors();
  const params = useLocalSearchParams<{
    key: string;
    justWon?: string;
    winnerLabel?: string;
    winnerEmoji?: string;
  }>();
  const key = params.key;
  const justWon = params.justWon === '1';

  const [detail, setDetail] = useState<WorldcupDetail | null>(null);
  const [records, setRecords] = useState<WorldcupRecords | null>(null);
  const [showRecords, setShowRecords] = useState(justWon);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    worldcupApi.detail(key).then(setDetail).catch(() => {});
  }, [key]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      setRecords(await worldcupApi.records(key));
    } catch {
      /* 무시 */
    } finally {
      setLoadingRecords(false);
    }
  }, [key]);

  // 완주 직후엔 기록/비교를 바로 로드.
  useEffect(() => {
    if (justWon) loadRecords();
  }, [justWon, loadRecords]);

  function onShowRecords() {
    setShowRecords(true);
    if (!records) loadRecords();
  }

  const title = detail?.title ?? records?.title ?? '월드컵';
  const cmp = records?.compare;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={[styles.topTitle, { color: c.primary }]} numberOfLines={1}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 완주 축하 배너 */}
        {justWon ? (
          <View style={[styles.winBanner, { backgroundColor: c.primary }]}>
            <Text style={styles.winLabel}>🏆 우승!</Text>
            <Text style={styles.winEmoji}>{params.winnerEmoji}</Text>
            <Text style={styles.winName}>{params.winnerLabel}</Text>
          </View>
        ) : (
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>{detail?.emoji ?? '🏆'}</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            {detail ? <Text style={styles.heroSub}>{detail.size}강 토너먼트</Text> : null}
          </View>
        )}

        {/* 액션 */}
        <Button
          label={justWon ? '다시 도전하기' : '진행하기'}
          icon="play"
          onPress={() => router.push(`/worldcup/${key}/play`)}
          style={{ marginTop: spacing.xl }}
        />
        {!showRecords ? (
          <Button
            label="이전 기록 보기"
            variant="soft"
            icon="albums-outline"
            onPress={onShowRecords}
            style={{ marginTop: spacing.md }}
          />
        ) : null}

        {/* 기록 + 커플 비교 */}
        {showRecords ? (
          <View style={{ marginTop: spacing.xl }}>
            {loadingRecords ? (
              <ActivityIndicator color={c.primary} style={{ marginTop: spacing.lg }} />
            ) : (
              <>
                {cmp ? (
                  <View style={[styles.compareCard, shadow]}>
                    <Text style={styles.compareTitle}>🏆 우리의 우승작</Text>
                    <View style={styles.cmpRow}>
                      <View style={styles.cmpCol}>
                        <Text style={[styles.cmpWho, { color: c.primary }]}>나의 최애</Text>
                        <Text style={styles.cmpEmoji}>{cmp.myWinner.emoji}</Text>
                        <Text style={styles.cmpName}>{cmp.myWinner.label}</Text>
                      </View>
                      <View style={styles.cmpCol}>
                        <Text style={[styles.cmpWho, { color: colors.partner }]}>
                          {cmp.partnerNickname}의 최애
                        </Text>
                        <Text style={styles.cmpEmoji}>{cmp.partnerWinner.emoji}</Text>
                        <Text style={styles.cmpName}>{cmp.partnerWinner.label}</Text>
                      </View>
                    </View>
                    <View style={styles.rateBox}>
                      <Text style={styles.rateText}>
                        {cmp.sameWinner
                          ? '우승작이 똑같아요! 찰떡궁합 💞'
                          : `취향 일치율 ${cmp.matchRate}%`}
                      </Text>
                    </View>
                  </View>
                ) : records ? (
                  <Text style={styles.hint}>
                    {records.myRecords.length === 0
                      ? '아직 기록이 없어요. 먼저 진행해 보세요!'
                      : '상대가 아직 안 했어요. 둘 다 완주하면 취향을 비교할 수 있어요.'}
                  </Text>
                ) : null}

                {/* 내 기록 목록 */}
                {records && records.myRecords.length > 0 ? (
                  <View style={{ marginTop: spacing.xl }}>
                    <Text style={styles.sectionLabel}>내 기록</Text>
                    {records.myRecords.map((r) => (
                      <View key={r.id} style={styles.recRow}>
                        <Text style={styles.recEmoji}>{r.winner.emoji}</Text>
                        <Text style={styles.recName}>{r.winner.label}</Text>
                        <Text style={styles.recDate}>{r.playedAt}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
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
  topTitle: { ...font.h2, fontWeight: '800', flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },

  hero: { alignItems: 'center', marginTop: spacing.xl },
  heroEmoji: { fontSize: 64 },
  heroTitle: { ...font.h1, marginTop: spacing.md },
  heroSub: { ...font.caption, color: colors.subText, marginTop: spacing.xs },

  winBanner: { alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.xl, marginTop: spacing.md },
  winLabel: { ...font.body, color: colors.white, fontWeight: '800' },
  winEmoji: { fontSize: 66, marginVertical: spacing.sm },
  winName: { fontSize: 26, fontWeight: '800', color: colors.white },

  compareCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  compareTitle: { ...font.h2, fontSize: 17, textAlign: 'center', marginBottom: spacing.lg },
  cmpRow: { flexDirection: 'row', gap: spacing.md },
  cmpCol: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  cmpWho: { ...font.caption, fontWeight: '800', marginBottom: spacing.sm },
  cmpEmoji: { fontSize: 42 },
  cmpName: { ...font.h2, fontSize: 16, marginTop: spacing.xs },
  rateBox: { backgroundColor: '#FFF6EE', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  rateText: { ...font.body, fontWeight: '800', color: '#E3902C', textAlign: 'center' },

  hint: { ...font.body, color: colors.subText, textAlign: 'center', paddingVertical: spacing.lg },
  sectionLabel: { ...font.label, fontWeight: '800', marginBottom: spacing.sm },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recEmoji: { fontSize: 22 },
  recName: { ...font.body, flex: 1, fontWeight: '700' },
  recDate: { ...font.caption, color: colors.subText },
});
