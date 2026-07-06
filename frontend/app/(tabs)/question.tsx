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
import { dailyQuestionApi, QuestionAnswer } from '../../lib/api';
import { confirmAsync, showAlert, showToast } from '../../lib/dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useQuestionStore } from '../../store/useQuestionStore';
import { Button, Card, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 오늘의 질문 — 감성 편지함. state별로 봉투 도착 → 선택 → 답장 → 열람 흐름. */
export default function QuestionScreen() {
  const router = useRouter();
  const c = useColors();
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.partner);
  const today = useQuestionStore((s) => s.today);
  const loading = useQuestionStore((s) => s.loading);
  const loadToday = useQuestionStore((s) => s.loadToday);
  const choose = useQuestionStore((s) => s.choose);
  const react = useQuestionStore((s) => s.react);

  const [refreshing, setRefreshing] = useState(false);
  const [chosenSlot, setChosenSlot] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [reacting, setReacting] = useState(false);
  // 신고한 봉투 id들(로컬) — 화면에서 흐리게 비활성 처리, 중복 신고 방지.
  const [reportedIds, setReportedIds] = useState<number[]>([]);
  const [reportingId, setReportingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadToday();
      setChosenSlot(null);
      setReportedIds([]);
    }, [loadToday])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadToday();
    setRefreshing(false);
  }, [loadToday]);

  async function onChoose() {
    if (chosenSlot == null || !today?.choices) return;
    const picked = today.choices.find((ch) => ch.slot === chosenSlot);
    if (!picked) return;
    setChoosing(true);
    try {
      await choose(picked.id);
    } catch {
      showAlert('편지를 정하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setChoosing(false);
    }
  }

  async function onReact(answer: QuestionAnswer) {
    if (reacting) return;
    setReacting(true);
    try {
      await react(answer.id);
    } catch {
      showAlert('하트를 전하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setReacting(false);
    }
  }

  async function onReport(choice: { id: number; slot: number }) {
    if (reportingId != null || reportedIds.includes(choice.id)) return;
    const ok = await confirmAsync('이 질문 덜 보여드릴까요?', '비슷한 질문을 앞으로 조금 덜 보여드릴게요.');
    if (!ok) return;
    setReportingId(choice.id);
    try {
      await dailyQuestionApi.report(choice.id);
      setReportedIds((prev) => (prev.includes(choice.id) ? prev : [...prev, choice.id]));
      // 신고한 봉투가 선택돼 있었다면 선택 해제.
      setChosenSlot((s) => (s === choice.slot ? null : s));
      showToast('덜 보여드릴게요');
    } catch {
      showAlert('신고를 전하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setReportingId(null);
    }
  }

  // ── 첫 로딩(데이터 없음)만 전체 스피너 ──
  if (!today && loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header streak={0} showStreak={false} />
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── 로드 실패(데이터 없음) ──
  if (!today) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header streak={0} showStreak={false} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>오늘의 편지를 불러오지 못했어요.</Text>
          <Button label="다시 시도" variant="soft" onPress={loadToday} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const showStreak = today.streak > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header streak={today.streak} showStreak={showStreak} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* 미연결 */}
        {!today.coupled ? (
          <Card style={styles.stateCard}>
            <Icon name="heart-outline" size={40} color={c.coralSoft} />
            <Text style={styles.stateTitle}>짝과 연결해요</Text>
            <Text style={styles.stateBody}>
              짝과 연결하면 매일 오늘의 질문을 편지로 받을 수 있어요.
            </Text>
            <Button
              label="연결하러 가기"
              onPress={() => router.push('/(tabs)/settings')}
              style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
            />
          </Card>
        ) : today.state === 'BEFORE_ARRIVAL' ? (
          /* 도착 전 */
          <Card style={styles.stateCard}>
            <Icon name="mail-outline" size={40} color={c.coralSoft} />
            <Text style={styles.stateTitle}>곧 오늘의 편지가 도착해요</Text>
            <Text style={styles.stateBody}>매일 {today.arrivalTime}에 새 질문이 도착해요.</Text>
          </Card>
        ) : today.state === 'NEEDS_CHOICE' ? (
          /* 봉투 2개 중 선택 */
          <View>
            <Text style={styles.sectionHint}>오늘 함께 나눌 편지를 하나 골라요</Text>
            <View style={styles.envelopes}>
              {(today.choices ?? []).map((ch) => {
                const reported = reportedIds.includes(ch.id);
                const selected = !reported && chosenSlot === ch.slot;
                return (
                  <Pressable
                    key={ch.id}
                    onPress={() => !reported && setChosenSlot(ch.slot)}
                    disabled={reported}
                    style={[
                      styles.envelope,
                      shadow,
                      { borderColor: selected ? c.primary : colors.border },
                      selected && { backgroundColor: '#FFF3E4' },
                      reported && styles.envelopeReported,
                    ]}
                  >
                    <View style={[styles.seal, { backgroundColor: selected ? c.primary : c.coralSofter }]}>
                      <Icon name="heart" size={16} color={colors.white} />
                    </View>
                    <Text style={styles.envelopeText}>{ch.text}</Text>
                    {selected ? (
                      <View style={styles.envCheck}>
                        <Icon name="checkmark-circle" size={20} color={c.primary} />
                      </View>
                    ) : reported ? (
                      <Text style={styles.envReportedTag}>덜 보여드릴게요</Text>
                    ) : (
                      // 은은한 신고 — 카드 우상단 흐린 아이콘.
                      <Pressable
                        onPress={() => onReport(ch)}
                        disabled={reportingId != null}
                        hitSlop={10}
                        style={styles.envReport}
                        accessibilityLabel="이 질문 별로예요"
                      >
                        <Icon name="ellipsis-horizontal" size={16} color={colors.placeholder} />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Button
              label="오늘의 편지로 정하기"
              onPress={onChoose}
              loading={choosing}
              disabled={chosenSlot == null}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        ) : today.state === 'NEEDS_ANSWER' ? (
          /* 질문 확정, 답장 필요 */
          <View>
            <LetterCard question={today.question?.text}>
              <ChosenLine chosenByMe={today.chosenByMe} nickname={today.chosenBy?.nickname} />
            </LetterCard>
            <StatusPill icon="create-outline" text="아직 답장을 쓰지 않았어요" tone="coral" />
            <Button
              label="답장 쓰러 가기"
              icon="mail-open-outline"
              onPress={() => router.push('/question/write')}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : today.state === 'WAITING_PARTNER' ? (
          /* 내 답 봉인, 상대 대기 */
          <View>
            <LetterCard question={today.question?.text}>
              <ChosenLine chosenByMe={today.chosenByMe} nickname={today.chosenBy?.nickname} />
            </LetterCard>
            <SealedAnswer label="내 답장" text={today.myAnswer?.text} who="mine" />
            <View style={[styles.lockCard, shadow]}>
              <Icon name="lock-closed-outline" size={22} color={c.coralSoft} />
              <Text style={styles.lockText}>
                {partner?.nickname ?? '상대'}가 답하면 두 편지가 함께 열려요.
              </Text>
            </View>
            <StatusPill icon="hourglass-outline" text="상대의 답장을 기다리는 중" tone="partner" />
            <Text style={styles.midnightHint}>오늘 자정까지 답하지 않으면 편지는 봉인된 채 보관돼요.</Text>
          </View>
        ) : (
          /* OPENED — 둘 다 열림 */
          <View>
            <LetterCard question={today.question?.text}>
              <ChosenLine chosenByMe={today.chosenByMe} nickname={today.chosenBy?.nickname} />
            </LetterCard>

            <OpenedAnswer
              label={me?.nickname ? `${me.nickname}의 답장` : '내 답장'}
              text={today.myAnswer?.text}
              who="mine"
              reactedByPartner={today.myAnswer?.reactedByPartner}
            />
            <OpenedAnswer
              label={partner?.nickname ? `${partner.nickname}의 답장` : '상대의 답장'}
              text={today.partnerAnswer?.text}
              who="partner"
              reactable={!!today.partnerAnswer}
              reactedByMe={today.partnerAnswer?.reactedByMe}
              onReact={() => today.partnerAnswer && onReact(today.partnerAnswer)}
              reacting={reacting}
            />

            <Pressable style={styles.archiveLink} onPress={() => router.push('/question/archive')} hitSlop={8}>
              <Icon name="albums-outline" size={16} color={c.primary} />
              <Text style={[styles.archiveLinkText, { color: c.primary }]}>지난 편지함</Text>
              <Icon name="chevron-forward" size={16} color={c.primary} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 상단 헤더 — 제목 + 은은한 스트릭 + 설정. */
function Header({ streak, showStreak }: { streak: number; showStreak: boolean }) {
  const c = useColors();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: c.primary }]}>오늘의 질문</Text>
        <Icon name="mail" size={20} color={c.primary} />
      </View>
      <View style={styles.headerRight}>
        {showStreak ? (
          <View style={styles.streak}>
            <Icon name="heart" size={13} color={c.primary} />
            <Text style={[styles.streakText, { color: c.primary }]}>{streak}일째</Text>
          </View>
        ) : null}
        <Pressable onPress={() => router.push('/question/settings')} hitSlop={10}>
          <Icon name="options-outline" size={22} color={colors.subText} />
        </Pressable>
      </View>
    </View>
  );
}

/** 편지지 느낌 질문 카드. */
function LetterCard({ question, children }: { question?: string; children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.letter, shadow]}>
      <View style={[styles.letterSeal, { backgroundColor: c.primary }]}>
        <Icon name="heart" size={16} color={colors.white} />
      </View>
      <Text style={styles.letterLabel}>오늘의 질문</Text>
      <Text style={styles.letterQuestion}>{question ?? ''}</Text>
      {children}
    </View>
  );
}

/** 누가 골랐는지 한 줄. */
function ChosenLine({ chosenByMe, nickname }: { chosenByMe?: boolean; nickname?: string }) {
  const text = chosenByMe ? '내가 고른 편지예요' : nickname ? `${nickname}가 고른 편지예요` : '';
  if (!text) return null;
  return <Text style={styles.chosenLine}>{text}</Text>;
}

/** 봉인된 답장(내용 살짝 흐리게 or '봉인됨'). */
function SealedAnswer({ label, text, who }: { label: string; text?: string; who: 'mine' | 'partner' }) {
  const tint = who === 'mine' ? colors.primary : colors.partner;
  return (
    <View style={[styles.answerCard, shadow]}>
      <View style={styles.answerHead}>
        <Text style={[styles.answerLabel, { color: tint }]}>{label}</Text>
        <View style={styles.sealTag}>
          <Icon name="lock-closed" size={11} color={colors.subText} />
          <Text style={styles.sealTagText}>봉인됨</Text>
        </View>
      </View>
      {text ? (
        <Text style={styles.sealedText} numberOfLines={2}>
          {text}
        </Text>
      ) : (
        <Text style={styles.sealedText}>답장을 봉인해 두었어요.</Text>
      )}
    </View>
  );
}

/** 열린 답장 + (상대 답이면) 하트 반응. */
function OpenedAnswer({
  label,
  text,
  who,
  reactable,
  reactedByMe,
  reactedByPartner,
  onReact,
  reacting,
}: {
  label: string;
  text?: string;
  who: 'mine' | 'partner';
  reactable?: boolean;
  reactedByMe?: boolean;
  reactedByPartner?: boolean;
  onReact?: () => void;
  reacting?: boolean;
}) {
  const c = useColors();
  const tint = who === 'mine' ? c.primary : colors.partner;
  return (
    <View style={[styles.answerCard, shadow]}>
      <View style={styles.answerHead}>
        <Text style={[styles.answerLabel, { color: tint }]}>{label}</Text>
        {/* 내 답에 상대가 하트를 눌렀으면 표시 */}
        {who === 'mine' && reactedByPartner ? (
          <View style={styles.reactedTag}>
            <Icon name="heart" size={13} color={c.primary} />
            <Text style={[styles.reactedTagText, { color: c.primary }]}>하트 받음</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.answerText}>{text ?? ''}</Text>
      {reactable && onReact ? (
        <Pressable style={styles.reactBtn} onPress={onReact} disabled={reacting} hitSlop={8}>
          <Icon name={reactedByMe ? 'heart' : 'heart-outline'} size={20} color={c.primary} />
          <Text style={[styles.reactBtnText, { color: c.primary }]}>
            {reactedByMe ? '하트 전함' : '하트 보내기'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 상태 pill. */
function StatusPill({
  icon,
  text,
  tone,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  text: string;
  tone: 'coral' | 'partner';
}) {
  const c = useColors();
  const bg = tone === 'coral' ? '#FFF3E4' : '#F0EDFF';
  const fg = tone === 'coral' ? c.primary : colors.partner;
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Icon name={icon} size={15} color={fg} />
      <Text style={[styles.statusPillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl * 2, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 24, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...shadow,
  },
  streakText: { ...font.label, color: colors.primary },

  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },

  // 상태 카드(안내형)
  stateCard: { alignItems: 'center', paddingVertical: spacing.xxl, marginTop: spacing.lg },
  stateTitle: { ...font.h2, marginTop: spacing.md, textAlign: 'center' },
  stateBody: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },

  // 봉투 선택
  sectionHint: { ...font.title, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  envelopes: { gap: spacing.lg },
  envelope: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  seal: {
    position: 'absolute',
    top: -14,
    left: spacing.xl,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeText: { ...font.title, fontWeight: '600', lineHeight: 24 },
  envCheck: { position: 'absolute', top: spacing.md, right: spacing.md },
  envReport: { position: 'absolute', top: spacing.md, right: spacing.md, opacity: 0.6, padding: 2 },
  envelopeReported: { opacity: 0.45 },
  envReportedTag: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    ...font.caption,
    color: colors.placeholder,
  },

  // 편지지 카드
  letter: {
    backgroundColor: '#FFFBF4',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    marginTop: spacing.lg,
  },
  letterSeal: {
    position: 'absolute',
    top: -14,
    left: spacing.xl,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterLabel: { ...font.caption, color: colors.coralSoft, letterSpacing: 1 },
  letterQuestion: { fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 27, marginTop: spacing.sm },
  chosenLine: { ...font.caption, color: colors.subText, marginTop: spacing.md, fontStyle: 'italic' },

  // 답장 카드
  answerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  answerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  answerLabel: { ...font.label, fontWeight: '700' },
  answerText: { ...font.body, lineHeight: 22, marginTop: spacing.sm },
  sealedText: { ...font.body, color: colors.placeholder, marginTop: spacing.sm, fontStyle: 'italic' },
  sealTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sealTagText: { ...font.caption, color: colors.subText },
  reactedTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reactedTagText: { ...font.caption, fontWeight: '600' },
  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: '#FFF3E4',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  reactBtnText: { ...font.label, fontWeight: '700' },

  // 잠금 카드
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  lockText: { ...font.body, color: colors.subText, flex: 1, lineHeight: 21 },

  // pill/힌트
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  statusPillText: { ...font.label, fontWeight: '600' },
  midnightHint: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.md },

  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  archiveLinkText: { ...font.label, fontWeight: '700' },
});
