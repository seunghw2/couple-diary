import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  WorldcupCompare,
  WorldcupDetail,
  WorldcupItem,
  WorldcupRecords,
  worldcupApi,
} from '../../../lib/api';
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
    compare?: string;
  }>();
  const key = params.key;
  const justWon = params.justWon === '1';
  // 알림 딥링크(compare=1)로 들어오면 결과 비교를 바로 펼친다.
  const autoOpen = justWon || params.compare === '1';

  const [detail, setDetail] = useState<WorldcupDetail | null>(null);
  const [records, setRecords] = useState<WorldcupRecords | null>(null);
  const [showRecords, setShowRecords] = useState(autoOpen);
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

  // 완주 직후·비교 딥링크면 기록/비교를 바로 로드.
  useEffect(() => {
    if (autoOpen) loadRecords();
  }, [autoOpen, loadRecords]);

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
                  <JourneyCompare cmp={cmp} />
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

/** 라운드 아코디언 비교 — 우승·결승·4강·8강은 펼쳐 보이고, 16·32강은 접었다 펼침. */
function JourneyCompare({ cmp }: { cmp: WorldcupCompare }) {
  const c = useColors();
  const [showLow, setShowLow] = useState(false);
  const shared = new Set(cmp.sharedTop8.map((i) => i.id));
  const items = (who: 'me' | 'partner', stage: number) =>
    (who === 'me' ? cmp.me : cmp.partner).stages.find((g) => g.stage === stage)?.items ?? [];

  const LABEL: Record<number, string> = {
    1: '🏆 우승', 2: '🥈 결승', 4: '🔥 4강', 8: '8강', 16: '16강', 32: '32강',
  };

  const renderTier = (stage: number) => (
    <View key={stage} style={styles.tier}>
      <Text style={styles.tierLabel}>{LABEL[stage]}</Text>
      <View style={styles.twoCol}>
        <View style={styles.side}>
          {items('me', stage).map((it) => <Chip key={it.id} item={it} dup={shared.has(it.id)} />)}
        </View>
        <View style={styles.midline} />
        <View style={styles.side}>
          {items('partner', stage).map((it) => <Chip key={it.id} item={it} dup={shared.has(it.id)} />)}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.journeyCard, shadow]}>
      <Text style={styles.jRate}>
        {cmp.sameWinner ? '우승작까지 똑같아요! 💞' : `취향 일치율 ${cmp.matchRate}%`}
      </Text>
      <Text style={styles.jRateSub}>테두리 표시 = 둘 다 8강 이상 올린 취향</Text>
      <View style={styles.whoHead}>
        <Text style={[styles.whoName, { color: c.primary }]}>나</Text>
        <Text style={[styles.whoName, { color: colors.partner, textAlign: 'right' }]}>
          {cmp.partnerNickname}
        </Text>
      </View>
      {[1, 2, 4, 8].map(renderTier)}
      {showLow ? (
        [16, 32].map(renderTier)
      ) : (
        <Pressable style={styles.fold} onPress={() => setShowLow(true)}>
          <Text style={styles.foldText}>16강 · 32강 전체 보기</Text>
          <Icon name="chevron-down" size={18} color={colors.subText} />
        </Pressable>
      )}
    </View>
  );
}

/** 그림 + 이름 칩. 둘 다 8강 이상이면 테두리 강조. */
function Chip({ item, dup }: { item: WorldcupItem; dup: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.chip, dup && { borderColor: c.coralSoft, backgroundColor: '#FFF4EE' }]}>
      <Text style={styles.chipEmoji}>{item.emoji}</Text>
      <Text style={styles.chipName}>{item.label}</Text>
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

  journeyCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  jRate: { ...font.h2, fontSize: 17, textAlign: 'center', color: '#E3902C' },
  jRateSub: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: 2, marginBottom: spacing.lg },
  whoHead: { flexDirection: 'row', marginBottom: spacing.sm },
  whoName: { ...font.caption, fontWeight: '800', flex: 1 },
  tier: { marginBottom: spacing.md },
  tierLabel: { ...font.caption, fontWeight: '800', color: colors.subText, marginBottom: spacing.sm },
  twoCol: { flexDirection: 'row' },
  side: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' },
  midline: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  chipEmoji: { fontSize: 15 },
  chipName: { ...font.caption, fontWeight: '700', color: colors.text },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  foldText: { ...font.body, fontWeight: '700', color: colors.subText },

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
