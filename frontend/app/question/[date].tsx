import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArchiveDetail, CommentView, dailyQuestionApi } from '../../lib/api';
import { usePollWhileFocused } from '../../hooks/usePollWhileFocused';
import { formatKoLong, weekdayKo } from '../../lib/date';
import { subj } from '../../lib/josa';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Icon } from '../../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** 지난 편지 하나 상세 (pushed). 질문 + 누가 골랐는지 + 두 답장 편지지. */
export default function QuestionDetailScreen() {
  const router = useRouter();
  const c = useColors();
  const { date } = useLocalSearchParams<{ date: string }>();
  const me = useAuthStore((s) => s.user);

  const scrollRef = useRef<ScrollView>(null);
  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(false);
    try {
      const res = await dailyQuestionApi.archiveDetail(date);
      setDetail(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 화면이 열려 있는 동안 상대 댓글이 실시간처럼 들어오도록 조용히 폴링(로딩 표시 없이).
  usePollWhileFocused(() => {
    if (!date) return;
    dailyQuestionApi.archiveDetail(date).then((res) => setDetail(res)).catch(() => {});
  }, 6000);

  async function onComment() {
    const text = commentText.trim();
    if (!text || posting || !date) return;
    setPosting(true);
    setCommentError(null);
    try {
      const added = await dailyQuestionApi.comment(text, date);
      setDetail((d) => (d ? { ...d, comments: [...(d.comments ?? []), added] } : d));
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch {
      setCommentError('댓글 등록에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setPosting(false);
    }
  }

  const chosenLine = detail?.chosenBy?.nickname ? `${subj(detail.chosenBy.nickname)} 고른 편지예요` : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>{date ? formatKoLong(date) : '지난 편지'}</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading && !detail ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : error && !detail ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>편지를 불러오지 못했어요.</Text>
        </View>
      ) : detail ? (
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
        >
          <Text style={styles.dateSub}>{date ? weekdayKo(date) + '요일' : ''}</Text>

          {/* 질문 편지지 */}
          <View style={[styles.letter, shadow]}>
            <View style={[styles.letterSeal, { backgroundColor: c.primary }]}>
              <Icon name="heart" size={16} color={colors.white} />
            </View>
            <Text style={styles.letterLabel}>오늘의 질문</Text>
            <Text style={styles.letterQuestion}>{detail.questionText}</Text>
            {chosenLine ? <Text style={styles.chosenLine}>{chosenLine}</Text> : null}
          </View>

          {detail.opened ? (
            <>
              <AnswerCard
                label="내 답장"
                text={detail.myAnswer?.text}
                tint={c.primary}
              />
              <AnswerCard
                label={detail.partnerNickname ? `${detail.partnerNickname}의 답장` : '상대의 답장'}
                text={detail.partnerAnswer?.text}
                tint={colors.partner}
              />

              {/* 댓글 */}
              <View style={styles.commentSection}>
                <View style={styles.sectionLabelRow}>
                  <Icon name="chatbubble-ellipses-outline" size={18} color={c.primary} />
                  <Text style={[styles.sectionLabel, { color: c.primary }]}>댓글</Text>
                </View>
                {(detail.comments ?? []).map((cm) => (
                  <CommentRow key={cm.id} comment={cm} mine={cm.authorId === me?.id} />
                ))}
                {(detail.comments ?? []).length === 0 ? (
                  <Text style={styles.noComment}>첫 댓글을 남겨보세요</Text>
                ) : null}
                {commentError ? <Text style={styles.commentError}>{commentError}</Text> : null}
              </View>
            </>
          ) : (
            <View style={[styles.lockCard, shadow]}>
              <Icon name="lock-closed-outline" size={22} color={c.coralSoft} />
              <Text style={styles.lockText}>이 편지는 열리지 않은 채 보관되었어요.</Text>
            </View>
          )}
        </ScrollView>

        {/* 댓글 입력 (opened에서만) */}
        {detail.opened ? (
          <View style={styles.commentBar}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
              placeholder="댓글 달기…"
              placeholderTextColor={colors.placeholder}
              style={styles.commentInput}
            />
            <Button label="보내기" variant="soft" onPress={onComment} loading={posting} style={styles.commentBtn} />
          </View>
        ) : null}
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}

/** 댓글 한 줄(내/상대 구분 말풍선). */
function CommentRow({ comment, mine }: { comment: CommentView; mine: boolean }) {
  const c = useColors();
  return (
    <View style={[cstyles.commentRow, mine && { alignItems: 'flex-end' }]}>
      <View
        style={[
          cstyles.commentBubble,
          mine ? { backgroundColor: c.coralSofter } : { backgroundColor: c.coralSoft },
        ]}
      >
        <Text style={cstyles.commentAuthor}>{comment.authorNickname ?? (mine ? '나' : '상대')}</Text>
        <Text style={cstyles.commentContent}>{comment.text}</Text>
      </View>
    </View>
  );
}

function AnswerCard({
  label,
  text,
  tint,
}: {
  label: string;
  text?: string;
  tint: string;
}) {
  return (
    <View style={[styles.answerCard, shadow]}>
      <Text style={[styles.answerLabel, { color: tint }]}>{label}</Text>
      {/* 내용이 있으면 항상 보여준다(아카이브 공개 대상). 없을 때만 봉인 문구.
          내 답장은 서버가 항상 내려주고, 상대 답장은 그때 둘 다 답해 열린 편지만 내려온다. */}
      {!text ? (
        <Text style={styles.sealedText}>아직 열리지 않은 편지예요.</Text>
      ) : (
        <Text style={styles.answerText}>{text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  topTitle: { ...font.title },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  dateSub: { ...font.caption, color: colors.subText, marginBottom: spacing.md },

  letter: {
    backgroundColor: '#FFFBF4',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
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

  answerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  answerLabel: { ...font.label, fontWeight: '700' },
  answerText: { ...font.body, lineHeight: 22, marginTop: spacing.sm },
  sealedText: { ...font.body, color: colors.placeholder, marginTop: spacing.sm, fontStyle: 'italic' },

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

  // 댓글
  commentSection: { marginTop: spacing.xl },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  sectionLabel: { ...font.title },
  noComment: { ...font.caption, color: colors.subText },
  commentError: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
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

const cstyles = StyleSheet.create({
  commentRow: { marginBottom: spacing.sm, alignItems: 'flex-start' },
  commentBubble: { maxWidth: '80%', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  commentAuthor: { ...font.caption, color: colors.subText, marginBottom: 2 },
  commentContent: { ...font.body },
});
