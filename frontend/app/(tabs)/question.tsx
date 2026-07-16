import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CommentView, dailyQuestionApi } from '../../lib/api';
import { confirmAsync, showAlert, showToast } from '../../lib/dialog';
import { subj } from '../../lib/josa';
import { useAuthStore } from '../../store/useAuthStore';
import { useQuestionStore } from '../../store/useQuestionStore';
import { Button, Card, Icon } from '../../components/ui';
import { FeedbackLink } from '../../components/FeedbackLink';
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
  const comment = useQuestionStore((s) => s.comment);

  const scrollRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
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

  // 댓글 입력창 탭 → 맨 아래(댓글 영역)로. onFocus는 즉시 시도, keyboardDidShow는
  // 키보드가 완전히 올라와 레이아웃이 확정된 뒤 확실히 한 번 더 내려준다.
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (today?.state !== 'OPENED') return;
    const sub = Keyboard.addListener('keyboardDidShow', scrollToBottom);
    return () => sub.remove();
  }, [today?.state, scrollToBottom]);

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

  async function onComment() {
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    setCommentError(null);
    try {
      await comment(text);
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch {
      setCommentError('댓글 등록에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setPosting(false);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={{ flex: 1 }}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            {today.partnerSealed ? (
              <Text style={styles.partnerSealedHint}>
                상대는 이미 답했어요 · 답장을 보내면 바로 열려요
              </Text>
            ) : null}
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
            <SealedAnswer
              label="내 답장"
              text={today.myAnswer?.text}
              who="mine"
              onEdit={today.myAnswerEditable === false ? undefined : () => router.push('/question/write')}
            />
            <View style={[styles.lockCard, shadow]}>
              <Icon name="lock-closed-outline" size={22} color={c.coralSoft} />
              <Text style={styles.lockText}>
                {subj(partner?.nickname ?? '상대')} 답하면 두 편지가 함께 열려요.
              </Text>
            </View>
            <StatusPill icon="hourglass-outline" text="상대의 답장을 기다리는 중" tone="partner" />
            <Text style={styles.midnightHint}>질문 받은 다음날 {today.arrivalTime}까지 답하면 편지가 열려요.</Text>
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
              onEdit={today.myAnswerEditable === false ? undefined : () => router.push('/question/write')}
            />
            <OpenedAnswer
              label={partner?.nickname ? `${partner.nickname}의 답장` : '상대의 답장'}
              text={today.partnerAnswer?.text}
              who="partner"
            />

            {/* 지난 편지함 — 두 답장 아래, 댓글 위(항상 같은 위치) */}
            <Pressable
              style={[styles.letterboxLink, { borderColor: c.coralSofter }]}
              onPress={() => router.push('/question/archive')}
              hitSlop={6}
            >
              <Icon name="albums-outline" size={16} color={c.primary} />
              <Text style={[styles.letterboxLinkText, { color: c.primary }]}>지난 편지함 보기</Text>
              <Icon name="chevron-forward" size={15} color={c.primary} />
            </Pressable>

            {/* 댓글 */}
            <View style={styles.commentSection}>
              <View style={styles.sectionLabelRow}>
                <Icon name="chatbubble-ellipses-outline" size={18} color={c.primary} />
                <Text style={[styles.sectionLabel, { color: c.primary }]}>댓글</Text>
              </View>
              {(today.comments ?? []).map((cm) => (
                <CommentRow key={cm.id} comment={cm} mine={cm.authorId === me?.id} />
              ))}
              {(today.comments ?? []).length === 0 ? (
                <Text style={styles.noComment}>첫 댓글을 남겨보세요</Text>
              ) : null}
              {commentError ? <Text style={styles.commentError}>{commentError}</Text> : null}
            </View>
          </View>
        )}

        <FeedbackLink source="question" />
      </ScrollView>

      {/* 댓글 입력 (OPENED에서만) */}
      {today.state === 'OPENED' ? (
        <View style={styles.commentBar}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            onFocus={scrollToBottom}
            placeholder="댓글 달기…"
            placeholderTextColor={colors.placeholder}
            style={styles.commentInput}
          />
          <Button label="보내기" variant="soft" onPress={onComment} loading={posting} style={styles.commentBtn} />
        </View>
      ) : null}
      </KeyboardAvoidingView>

      {/* 지난 편지함 — 하단 고정 바. OPENED가 아닌 모든 커플 상태에서 항상 노출(스크롤 무관).
          OPENED는 본문 인라인 링크 + 댓글 입력바가 있어 이중 바를 피하려 제외. */}
      {today.coupled && today.state !== 'OPENED' ? (
        <Pressable
          style={styles.letterboxBar}
          onPress={() => router.push('/question/archive')}
          accessibilityRole="button"
        >
          <Icon name="albums-outline" size={17} color={c.primary} />
          <Text style={[styles.letterboxBarText, { color: c.primary }]}>지난 편지함 보기</Text>
          <Icon name="chevron-forward" size={15} color={c.primary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

/** 댓글 한 줄(내/상대 구분 말풍선). */
function CommentRow({ comment, mine }: { comment: CommentView; mine: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.commentRow, mine && { alignItems: 'flex-end' }]}>
      <View
        style={[
          styles.commentBubble,
          mine
            ? { backgroundColor: c.coralSofter }
            : { backgroundColor: c.coralSoft },
        ]}
      >
        <Text style={styles.commentAuthor}>{comment.authorNickname ?? (mine ? '나' : '상대')}</Text>
        <Text style={styles.commentContent}>{comment.text}</Text>
      </View>
    </View>
  );
}

/** 상단 헤더 — 제목 + 은은한 스트릭. */
function Header({ streak, showStreak }: { streak: number; showStreak: boolean }) {
  const c = useColors();
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
  const text = chosenByMe ? '내가 고른 편지예요' : nickname ? `${subj(nickname)} 고른 편지예요` : '';
  if (!text) return null;
  return <Text style={styles.chosenLine}>{text}</Text>;
}

/** 봉인된 답장(내용 살짝 흐리게 or '봉인됨'). mine이면 onEdit로 헤더 우측 '수정'. */
function SealedAnswer({
  label,
  text,
  who,
  onEdit,
}: {
  label: string;
  text?: string;
  who: 'mine' | 'partner';
  onEdit?: () => void;
}) {
  const c = useColors();
  const tint = who === 'mine' ? c.primary : colors.partner;
  return (
    <View style={[styles.answerCard, shadow]}>
      <View style={styles.answerHead}>
        <Text style={[styles.answerLabel, { color: tint }]}>{label}</Text>
        <View style={styles.headRight}>
          {onEdit ? <EditTag onPress={onEdit} color={c.primary} /> : null}
          <View style={styles.sealTag}>
            <Icon name="checkmark-circle" size={12} color={colors.subText} />
            <Text style={styles.sealTagText}>보냄</Text>
          </View>
        </View>
      </View>
      {text ? (
        <Text style={styles.sealedText} numberOfLines={2}>
          {text}
        </Text>
      ) : (
        <Text style={styles.sealedText}>답장을 보내 두었어요.</Text>
      )}
    </View>
  );
}

/** 열린 답장(양쪽 공개). mine이면 onEdit로 카드 헤더 우측에 '수정'. */
function OpenedAnswer({
  label,
  text,
  who,
  onEdit,
}: {
  label: string;
  text?: string;
  who: 'mine' | 'partner';
  onEdit?: () => void;
}) {
  const c = useColors();
  const tint = who === 'mine' ? c.primary : colors.partner;
  return (
    <View style={[styles.answerCard, shadow]}>
      <View style={styles.answerHead}>
        <Text style={[styles.answerLabel, { color: tint }]}>{label}</Text>
        {onEdit ? <EditTag onPress={onEdit} color={c.primary} /> : null}
      </View>
      <Text style={styles.answerText}>{text ?? ''}</Text>
    </View>
  );
}

/** 카드 헤더 우측 '수정' 태그(밖으로 안 삐져나오게 카드 안에서 처리). */
function EditTag({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.editTag} accessibilityLabel="답장 수정">
      <Icon name="create-outline" size={13} color={color} />
      <Text style={[styles.editTagText, { color }]}>수정</Text>
    </Pressable>
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
  title: { fontSize: 26, fontWeight: '800' },
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
  headRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingHorizontal: 2 },
  editTagText: { ...font.caption, fontWeight: '800' },
  // 지난 편지함(답장 아래·댓글 위)
  letterboxLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: '#FFF3EC',
  },
  letterboxLinkText: { ...font.label, fontWeight: '800' },

  // 지난 편지함 하단 고정 바(OPENED 외 상태·항상 노출)
  letterboxBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: '#F6ECE2',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  letterboxBarText: { ...font.label, fontWeight: '800' },

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

  partnerSealedHint: { ...font.caption, color: colors.subText, textAlign: 'center', marginTop: spacing.md },

  // 댓글
  commentSection: { marginTop: spacing.xl },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  sectionLabel: { ...font.title },
  noComment: { ...font.caption, color: colors.subText },
  commentError: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
  commentRow: { marginBottom: spacing.sm, alignItems: 'flex-start' },
  commentBubble: { maxWidth: '80%', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  commentAuthor: { ...font.caption, color: colors.subText, marginBottom: 2 },
  commentContent: { ...font.body },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 44,
    color: colors.text,
  },
  commentBtn: { height: 44, paddingHorizontal: spacing.lg },
});
