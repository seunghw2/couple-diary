import { useCallback, useState } from 'react';
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
import { CommentView, DayDetail, EntryView, QuestionResponse, entryApi, isLocked } from '../../lib/api';
import { dDay, formatDday, formatKoShort, todayISO, weekdayKo } from '../../lib/date';
import { confirmAsync, showAlert } from '../../lib/dialog';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Card, PhotoThumb, Pill, SeedThumb, StarRating } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

export default function EntryDetailScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateStr = date ?? todayISO();
  const couple = useCoupleStore((s) => s.couple);
  const me = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await entryApi.detail(dateStr);
      setDetail(d);
    } catch {
      // 404 등 = 아직 아무도 안 쓴 날
      setDetail(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onComment() {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    setCommentError(null);
    try {
      const c = await entryApi.addComment(dateStr, text);
      setDetail((d) => (d ? { ...d, comments: [...d.comments, c] } : d));
      setCommentText('');
    } catch {
      setCommentError('댓글 등록에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setPosting(false);
    }
  }

  function onEditMine() {
    const mine = detail?.myEntry;
    if (!mine) return;
    if (!mine.editable) {
      showAlert('수정 가능 시간(3시간)이 지났어요', '이미 쓴 일기는 3시간 안에만 고칠 수 있어요.');
      return;
    }
    router.push({ pathname: '/write/[date]', params: { date: dateStr } });
  }

  async function onDeleteMine() {
    if (deleting) return;
    const ok = await confirmAsync('일기 삭제', '이 날의 내 일기를 삭제할까요?', '삭제', true);
    if (!ok) return;
    setDeleting(true);
    try {
      await entryApi.remove(dateStr);
      router.replace('/(tabs)');
    } catch {
      showAlert('삭제에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }

  const dday = couple?.ddayCount ?? dDay(couple?.anniversaryDate);
  const status = detail?.status ?? 'EMPTY';
  const mineWritten = !!detail?.myEntry;
  const partnerEntry = detail?.partnerEntry;
  const partnerOpen = partnerEntry && !isLocked(partnerEntry) ? partnerEntry : null;
  const isFuture = dateStr > todayISO();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.dateTitle}>{formatKoShort(dateStr)}</Text>
            <Text style={styles.dateSub}>
              {weekdayKo(dateStr)}요일{dday != null ? ` · ${formatDday(dday)}` : ''}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
          ) : status === 'EMPTY' || !detail ? (
            <EmptyState
              future={isFuture}
              onWrite={() => router.push({ pathname: '/write/[date]', params: { date: dateStr } })}
            />
          ) : (
            <>
              {/* 내 일기 */}
              {detail.myEntry ? (
                <>
                  <SideCard
                    title="내가 쓴 일기"
                    side={detail.myEntry}
                    tone="coral"
                    mode={detail.mode}
                    questions={detail.questions}
                  />
                  <View style={styles.myActions}>
                    <Button label="수정하기" variant="soft" onPress={onEditMine} style={{ flex: 1, height: 44 }} />
                    <Button
                      label="삭제"
                      variant="ghost"
                      onPress={onDeleteMine}
                      loading={deleting}
                      style={{ flex: 1, height: 44 }}
                    />
                  </View>
                </>
              ) : null}

              {/* 상대 일기 — LOCKED면 블러 안내 */}
              {status === 'LOCKED' && !mineWritten ? (
                <LockedPartner
                  onWrite={() => router.push({ pathname: '/write/[date]', params: { date: dateStr } })}
                />
              ) : partnerOpen ? (
                <SideCard
                  title="상대가 쓴 일기"
                  side={partnerOpen}
                  tone="partner"
                  mode={detail.mode}
                  questions={detail.questions}
                />
              ) : status === 'LOCKED' ? (
                <Card style={styles.waitCard}>
                  <Text style={styles.waitText}>상대가 아직 오늘 일기를 안 썼어요 🔒{'\n'}상대가 쓰면 자동으로 열려요!</Text>
                </Card>
              ) : null}

              {/* 획득 스티커(OPEN) */}
              {status === 'OPEN' ? (
                <View style={styles.stickerRow}>
                  <SeedThumb seed={dateStr} size={48} label="💗" />
                  <Text style={styles.stickerText}>이 날의 스티커를 획득했어요!</Text>
                </View>
              ) : null}

              {/* 댓글 (OPEN에서만) */}
              {status === 'OPEN' ? (
                <View style={{ marginTop: spacing.lg }}>
                  <Text style={styles.sectionLabel}>💬 댓글</Text>
                  {detail.comments.map((c) => (
                    <CommentRow key={c.id} comment={c} mine={c.authorId === me?.id} />
                  ))}
                  {detail.comments.length === 0 ? (
                    <Text style={styles.noComment}>첫 댓글을 남겨보세요</Text>
                  ) : null}
                  {commentError ? <Text style={styles.commentError}>{commentError}</Text> : null}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* 댓글 입력 (OPEN에서만) */}
        {status === 'OPEN' ? (
          <View style={styles.commentBar}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="댓글 달기..."
              placeholderTextColor={colors.placeholder}
              style={styles.commentInput}
            />
            <Button label="등록" variant="soft" onPress={onComment} loading={posting} style={styles.commentBtn} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ future, onWrite }: { future: boolean; onWrite: () => void }) {
  if (future) {
    return (
      <Card style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
        <Text style={{ fontSize: 44, marginBottom: spacing.md }}>🌙</Text>
        <Text style={styles.emptyTitle}>아직 오지 않은 날이에요</Text>
        <Text style={styles.emptySub}>그날이 되면 함께 기록해요</Text>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
      <Text style={{ fontSize: 44, marginBottom: spacing.md }}>✏️</Text>
      <Text style={styles.emptyTitle}>아직 이 날의 일기가 없어요</Text>
      <Text style={styles.emptySub}>먼저 오늘을 기록해볼까요?</Text>
      <Button label="일기 쓰기" onPress={onWrite} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
    </Card>
  );
}

function LockedPartner({ onWrite }: { onWrite: () => void }) {
  return (
    <Card style={[styles.lockedCard]}>
      <View style={styles.blurBox}>
        <Text style={styles.blurText}>█████ ███ ██████{'\n'}███████ ████ ██</Text>
        <View style={styles.lockOverlay}>
          <Text style={{ fontSize: 32 }}>🔒</Text>
        </View>
      </View>
      <Text style={styles.lockedTitle}>상대의 일기는 잠겨 있어요</Text>
      <Text style={styles.lockedSub}>내 일기를 쓰면 서로의 글이 열려요</Text>
      <Button label="내 일기 쓰기" onPress={onWrite} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
    </Card>
  );
}

function SideCard({
  title,
  side,
  tone,
  mode,
  questions,
}: {
  title: string;
  side: EntryView;
  tone: 'coral' | 'partner';
  mode: DayDetail['mode'];
  questions: QuestionResponse[];
}) {
  const accent = tone === 'coral' ? colors.primary : colors.partner;
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={styles.sideHead}>
        <Text style={[styles.sideTitle, { color: accent }]}>{title}</Text>
        {side.rating ? <StarRating value={side.rating} size={16} /> : null}
      </View>

      {/* 메타: 기분 / 위치 */}
      <View style={styles.metaRow}>
        {side.mood ? <Pill tone={tone}>{`${side.mood} 기분`}</Pill> : null}
        {side.locationName ? <Pill tone="neutral">{`📍 ${side.locationName}`}</Pill> : null}
      </View>

      {/* 사진: url 있으면 실제 이미지, 없으면 색시드 썸네일 */}
      {side.photos.length > 0 ? (
        <View style={styles.photoRow}>
          {side.photos.slice(0, 3).map((p, i) => (
            <PhotoThumb
              key={p.id}
              url={p.url}
              seed={p.colorSeed}
              size={90}
              round={false}
              label={i === 2 && side.photos.length > 3 ? `+${side.photos.length - 2}` : '📷'}
            />
          ))}
        </View>
      ) : null}

      {/* 답변들 — 질문픽이면 질문 문장을 답 위에 표시 */}
      {side.answers.map((a, i) => {
        const question =
          mode === 'QUESTION_PICK' && a.questionId != null
            ? questions.find((q) => q.id === a.questionId)
            : undefined;
        return (
          <View key={i} style={{ marginTop: spacing.md }}>
            {mode === 'QUESTION_PICK' ? (
              <Text style={[styles.answerQ, { color: accent }]}>
                Q{i + 1}.{question ? ` ${question.text}` : ''}
              </Text>
            ) : null}
            <Text style={styles.answerText}>{a.text}</Text>
          </View>
        );
      })}
    </Card>
  );
}

function CommentRow({ comment, mine }: { comment: CommentView; mine: boolean }) {
  return (
    <View style={[styles.commentRow, mine && { alignItems: 'flex-end' }]}>
      <View style={[styles.commentBubble, mine ? styles.commentMine : styles.commentPartner]}>
        <Text style={styles.commentAuthor}>{comment.authorNickname ?? (mine ? '나' : '상대')}</Text>
        <Text style={styles.commentContent}>{comment.text}</Text>
      </View>
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
  back: { fontSize: 30, color: colors.subText },
  dateTitle: { ...font.h2 },
  dateSub: { ...font.caption },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },

  emptyTitle: { ...font.title },
  emptySub: { ...font.caption, marginTop: spacing.xs },

  myActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  lockedCard: { marginTop: spacing.lg, alignItems: 'center' },
  blurBox: { width: '100%', borderRadius: radius.md, backgroundColor: colors.bg, padding: spacing.xl, overflow: 'hidden' },
  blurText: { ...font.body, color: colors.coralSofter, letterSpacing: 2, textAlign: 'center', opacity: 0.6 },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { ...font.title, marginTop: spacing.lg },
  lockedSub: { ...font.caption, marginTop: spacing.xs },

  waitCard: { marginTop: spacing.lg, backgroundColor: '#FFF3E4' },
  waitText: { ...font.body, color: colors.subText, textAlign: 'center', lineHeight: 22 },

  sideHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideTitle: { ...font.title },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  answerQ: { ...font.label, marginBottom: 2 },
  answerText: { ...font.body, lineHeight: 23 },

  stickerRow: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  stickerText: { ...font.label, color: colors.subText },

  sectionLabel: { ...font.title, marginBottom: spacing.md },
  noComment: { ...font.caption, color: colors.subText },
  commentError: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
  commentRow: { marginBottom: spacing.sm, alignItems: 'flex-start' },
  commentBubble: { maxWidth: '80%', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  commentMine: { backgroundColor: colors.coralSofter },
  commentPartner: { backgroundColor: colors.partnerSoft },
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
