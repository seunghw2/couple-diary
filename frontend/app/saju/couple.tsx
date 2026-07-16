import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { SajuCouple, sajuApi } from '../../lib/api';
import { Icon, Button } from '../../components/ui';
import { SajuLoading } from '../../components/SajuLoading';
import { Collapsible } from '../../components/Collapsible';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useFirstVisitIntro } from '../../hooks/useFirstVisitIntro';
import { coupleScoreColor, coupleScoreLabel } from '../../lib/sajuUi';
import { showToast } from '../../lib/dialog';
import { errorMessage } from '../../lib/errors';
import { ErrorState } from '../../components/ErrorState';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';
import { cardStyles, barStyles } from '../../theme/cardStyles';

/** 카테고리별 대표 아이콘 1개(문단마다 이모지 난립 방지, 통일). */
const CAT_ICON: Record<string, string> = {
  CHEMI: '✨',
  TALK: '💬',
  AFFECTION: '♥',
  STABILITY: '🏠',
  GROWTH: '🌱',
};

const SCORE_INFO =
  '종합 점수는 오행의 상생·상극, 일간의 합·충 등 12가지 관계를 종합해 계산해요. 아래 항목 점수는 첫끌림·대화·애정·안정감·성장을 따로 본 값이라, 항목을 더해 나눈 값과는 다를 수 있어요. 그래서 종합과 항목 평균이 일치하지 않는 게 정상이랍니다. 😊';

export default function SajuCouplePage() {
  const c = useColors();
  const [data, setData] = useState<SajuCouple | null>(null);
  const [error, setError] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const { firstVisit, introTimeUp, finishIntro } = useFirstVisitIntro('saju_seen_couple');
  const [infoOpen, setInfoOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await sajuApi.couple());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function requestBirthday() {
    if (requesting) return;
    setRequesting(true);
    try {
      await sajuApi.requestBirthday();
      showToast('상대에게 생일 등록을 요청했어요');
    } catch (e) {
      showToast(errorMessage(e, '요청에 실패했어요'));
    } finally {
      setRequesting(false);
    }
  }

  async function onShare() {
    if (!data) return;
    try {
      await Share.share({
        message:
          `우리 사주 궁합 ${data.percent}% · ${coupleScoreLabel(data.percent)}\n` +
          `${data.meNickname} × ${data.partnerNickname}\n` +
          `${data.meTypeName} × ${data.partnerTypeName}\n` +
          `"${data.relComment}"`,
      });
    } catch {
      // 공유 취소는 무시.
    }
  }

  if (firstVisit === null) return <View style={styles.safe} />;
  if (firstVisit && (!introTimeUp || (data == null && !error))) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SajuLoading label="우리 궁합을 푸는 중" onDone={finishIntro} />
      </SafeAreaView>
    );
  }

  const strong = data?.categories?.find((x) => x.key === data.strongestKey);
  const weak = data?.categories?.find((x) => x.key === data.weakestKey);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="우리 궁합" />

      {data == null && !error ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : !data!.canCompute ? (
        <View style={styles.centerBox}>
          <Text style={styles.bigEmoji}>💌</Text>
          <Text style={styles.needTitle}>아직 궁합을 볼 수 없어요</Text>
          <Text style={styles.needSub}>{data!.blockReason ?? '조건이 갖춰지면 궁합을 볼 수 있어요.'}</Text>
          {data!.canRequestBirthday ? (
            <Button
              label="상대에게 생일 요청"
              icon="paper-plane-outline"
              loading={requesting}
              onPress={requestBirthday}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* ① 대표 결과 히어로 */}
            <View style={[styles.hero, shadow]}>
              <View style={styles.pairRow}>
                <View style={styles.person}>
                  <Text style={styles.personEmoji}>{data!.meEmoji}</Text>
                  <Text style={styles.personName}>{data!.meNickname}</Text>
                  <Text style={styles.personType}>{data!.meTypeName}</Text>
                </View>
                <Text style={[styles.heart, { color: c.primary }]}>♥</Text>
                <View style={styles.person}>
                  <Text style={styles.personEmoji}>{data!.partnerEmoji}</Text>
                  <Text style={styles.personName}>{data!.partnerNickname}</Text>
                  <Text style={styles.personType}>{data!.partnerTypeName}</Text>
                </View>
              </View>

              <View style={styles.percentRow}>
                <Text style={[styles.percent, { color: coupleScoreColor(data!.percent) }]}>{data!.percent}%</Text>
                <Pressable onPress={() => setInfoOpen(true)} hitSlop={10} style={styles.infoBtn}>
                  <Icon name="information-circle-outline" size={20} color={colors.subText} />
                </Pressable>
              </View>
              <View style={[styles.labelPill, { backgroundColor: coupleScoreColor(data!.percent) }]}>
                <Text style={styles.labelPillText}>{coupleScoreLabel(data!.percent)}궁합</Text>
              </View>
              {data!.relComment ? <Text style={styles.relComment}>{data!.relComment}</Text> : null}
            </View>

            {/* ② 우리 관계 한눈에 보기 */}
            <View style={[styles.card, shadow]}>
              <Text style={styles.cardHead}>우리 관계 한눈에</Text>
              {strong ? (
                <View style={styles.glanceRow}>
                  <Text style={styles.glanceLabel}>가장 잘 맞는 곳</Text>
                  <Text style={styles.glanceValue}>
                    {strong.name} <Text style={{ color: coupleScoreColor(strong.score) }}>{strong.score}</Text>
                  </Text>
                </View>
              ) : null}
              {weak ? (
                <View style={styles.glanceRow}>
                  <Text style={styles.glanceLabel}>가장 다른 곳</Text>
                  <Text style={styles.glanceValue}>
                    {weak.name} <Text style={{ color: coupleScoreColor(weak.score) }}>{weak.score}</Text>
                  </Text>
                </View>
              ) : null}
              {data!.keywords?.length > 0 ? (
                <View style={[styles.glanceRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.glanceLabel}>관계 키워드</Text>
                  <View style={styles.kwRow}>
                    {data!.keywords.map((k) => (
                      <View key={k} style={[styles.kwChip, { backgroundColor: c.coralSofter }]}>
                        <Text style={styles.kwText}>{k}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            {/* ③ 딱 3줄 해석 */}
            {data!.summaryLines?.length > 0 ? (
              <View style={[styles.card, shadow]}>
                {data!.summaryLines.map((line, i) => (
                  <View key={i} style={styles.summaryRow}>
                    <Text style={[styles.summaryDot, { color: c.primary }]}>·</Text>
                    <Text style={styles.summaryLine}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ④ 항목별 궁합 (2줄 프리뷰 + 자세히 보기) */}
            <View style={[styles.card, shadow]}>
              <Text style={styles.cardHead}>항목별 궁합</Text>
              <View style={{ gap: spacing.lg }}>
                {data!.categories.map((cat) => {
                  return (
                    <View key={cat.key}>
                      <View style={styles.catHead}>
                        <Text style={styles.catName}>
                          {CAT_ICON[cat.key] ?? '·'} {cat.name}
                        </Text>
                        <View style={styles.catRight}>
                          <View style={[styles.catPill, { backgroundColor: coupleScoreColor(cat.score) }]}>
                            <Text style={styles.catPillText}>{coupleScoreLabel(cat.score)}</Text>
                          </View>
                          <Text style={styles.catScore}>{cat.score}</Text>
                        </View>
                      </View>
                      <View style={barStyles.track}>
                        <View
                          style={[
                            barStyles.fill,
                            { width: `${Math.max(4, Math.min(100, cat.score))}%`, backgroundColor: coupleScoreColor(cat.score) },
                          ]}
                        />
                      </View>
                      {cat.comment ? <Text style={styles.catComment}>{cat.comment}</Text> : null}
                      {cat.sajuNote ? (
                        <View style={[styles.sajuBox, { backgroundColor: c.coralSofter }]}>
                          <Text style={[styles.sajuBoxLabel, { color: c.primary }]}>사주로 보면</Text>
                          <Text style={styles.sajuBoxText}>{cat.sajuNote}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ⑤ 관계 꿀팁 */}
            {data!.tips?.length > 0 ? (
              <View style={[styles.card, shadow]}>
                <Text style={styles.cardHead}>관계 꿀팁</Text>
                {data!.tips.map((t, i) => (
                  <View key={i} style={styles.summaryRow}>
                    <Text style={[styles.summaryDot, { color: c.primary }]}>·</Text>
                    <Text style={styles.tip}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ⑥ 사주 근거 보기 (기본 접힘) */}
            {data!.badges.length > 0 ? (
              <View style={[styles.card, shadow]}>
                <Collapsible title="우리 궁합의 사주 근거 보기">
                  {data!.badges.map((b) => (
                    <View key={b} style={styles.summaryRow}>
                      <Text style={[styles.summaryDot, { color: c.primary }]}>·</Text>
                      <Text style={styles.badgeLine}>{b}</Text>
                    </View>
                  ))}
                  {!data!.hasHour ? (
                    <Text style={styles.badgeHint}>생시를 넣으면 시주까지 반영돼 더 정확해져요.</Text>
                  ) : null}
                </Collapsible>
              </View>
            ) : null}

            {data!.disclaimer ? <Text style={styles.disclaimer}>{data!.disclaimer}</Text> : null}
          </ScrollView>

          {/* ⑦ 공유 (하단 고정) */}
          <View style={styles.footer}>
            <Button label="우리 궁합 카드 공유하기" icon="share-outline" onPress={onShare} />
          </View>
        </>
      )}

      {/* 종합 점수 설명 모달 */}
      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setInfoOpen(false)}>
          <View style={[styles.modalCard, shadow]}>
            <Text style={styles.modalTitle}>종합 점수는 어떻게 나오나요?</Text>
            <Text style={styles.modalBody}>{SCORE_INFO}</Text>
            <Button label="알겠어요" variant="soft" onPress={() => setInfoOpen(false)} style={{ marginTop: spacing.md }} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  bigEmoji: { fontSize: 52 },
  needTitle: { ...font.h2, marginTop: spacing.sm },
  needSub: { ...font.caption, color: colors.subText, textAlign: 'center' },

  hero: cardStyles.heroBase,
  pairRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  person: { alignItems: 'center', width: 92 },
  personEmoji: { fontSize: 40 },
  personName: { ...font.title, color: colors.text, marginTop: 4 },
  personType: { ...font.caption, color: colors.subText, marginTop: 1 },
  heart: { fontSize: 22, marginTop: 12 },
  percentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.md },
  percent: { fontSize: 52, fontWeight: '800' },
  infoBtn: { marginTop: 8, marginLeft: 2 },
  labelPill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 5, marginTop: spacing.xs },
  labelPillText: { ...font.label, color: colors.white, fontWeight: '800' },
  relComment: { ...font.body, textAlign: 'center', marginTop: spacing.md, lineHeight: 22 },

  card: cardStyles.cardBase,
  cardHead: { ...cardStyles.cardHeadBase, marginBottom: spacing.md },

  glanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  glanceLabel: { ...font.label, color: colors.subText },
  glanceValue: { ...font.body, fontWeight: '700', color: colors.text },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'flex-end', flexShrink: 1 },
  kwChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  kwText: { ...font.label, color: colors.text },

  summaryRow: { flexDirection: 'row', marginTop: 6 },
  summaryDot: { ...font.body, fontWeight: '800', marginRight: 6, lineHeight: 24 },
  summaryLine: { ...font.body, color: colors.text, lineHeight: 24, flex: 1 },
  tip: { ...font.body, color: colors.text, lineHeight: 24, flex: 1 },

  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catName: { ...font.label, color: colors.text, fontSize: 14 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catPill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  catPillText: { ...font.caption, color: colors.white, fontWeight: '700', fontSize: 11 },
  catScore: { ...font.label, color: colors.subText, minWidth: 24, textAlign: 'right' },
  catComment: { color: colors.subText, marginTop: 8, lineHeight: 22, fontSize: 14 },
  sajuBox: { borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11, marginTop: 10 },
  sajuBoxLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, marginBottom: 5 },
  sajuBoxText: { color: colors.text, fontSize: 13.5, lineHeight: 21 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  moreText: { ...font.label, fontWeight: '700' },

  badgeLine: { ...font.body, color: colors.text, lineHeight: 22, flex: 1, fontSize: 14 },
  badgeHint: { ...font.caption, color: colors.subText, marginTop: spacing.md },

  disclaimer: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.md },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  empty: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.xxl },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl },
  modalTitle: { ...font.title, marginBottom: spacing.sm },
  modalBody: { ...font.body, color: colors.text, lineHeight: 23 },
});
