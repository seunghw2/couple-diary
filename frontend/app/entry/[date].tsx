import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../../lib/config';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ApiException, CommentView, DayDetail, EntryView, QuestionResponse, entryApi, isLocked } from '../../lib/api';
import { dDay, formatDday, formatKoShort, todayISO, weekdayKo } from '../../lib/date';
import { confirmAsync, showAlert } from '../../lib/dialog';
import { moodIcon } from '../../constants/content';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotifStore } from '../../store/useNotifStore';
import { useDataCache, invalidateAfterMutation } from '../../store/useDataCache';
import { Button, Card, Icon, PhotoThumb, Pill, StarRating } from '../../components/ui';
import { DatePickerSheet } from '../../components/DatePickerSheet';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

/** YYYY-MM-DD가 실제 존재하는 날짜인지 검증. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function EntryDetailScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateStr = date ?? todayISO();
  const couple = useCoupleStore((s) => s.couple);
  const me = useAuthStore((s) => s.user);
  const poke = useNotifStore((s) => s.poke);
  const loadDetail = useDataCache((s) => s.loadDetail);
  const getDetail = useDataCache((s) => s.getDetail);
  const setCacheDetail = useDataCache((s) => s.setDetail);

  // 캐시된 상세가 있으면 즉시 렌더(깜빡임 없음).
  const [detail, setDetail] = useState<DayDetail | null>(() => getDetail(dateStr) ?? null);
  const [loading, setLoading] = useState(!getDetail(dateStr));
  const [error, setError] = useState<string | null>(null);
  const [poking, setPoking] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 날짜 변경 모달
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState('');
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  // 사진 풀스크린 뷰어: 열 사진 url 목록 + 시작 인덱스
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);

  function openPhotoViewer(urls: string[], index: number) {
    if (urls.length === 0) return;
    setViewer({ urls, index });
  }

  // 캐시우선 + 백그라운드 갱신. 캐시 없을 때만 스피너.
  const load = useCallback(async () => {
    const cached = getDetail(dateStr);
    if (cached) setDetail(cached);
    else setLoading(true);
    setError(null);
    const d = await loadDetail(dateStr);
    setDetail(d);
    setLoading(false);
  }, [dateStr, getDetail, loadDetail]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onPoke() {
    if (poking) return;
    setPoking(true);
    const res = await poke();
    setPoking(false);
    if (res.ok) {
      showAlert('콕 찔렀어요!', '상대에게 알림이 갔어요');
    } else if (res.reason === 'not-connected') {
      showAlert('아직 보낼 수 없어요', '상대와 연결된 뒤 다시 시도해 주세요.');
    } else {
      showAlert('콕 찌르기에 실패했어요', '잠시 후 다시 시도해 주세요.');
    }
  }

  async function onComment() {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    setCommentError(null);
    try {
      const c = await entryApi.addComment(dateStr, text);
      setDetail((d) => {
        if (!d) return d;
        const updated = { ...d, comments: [...d.comments, c] };
        setCacheDetail(dateStr, updated); // 캐시도 최신화
        return updated;
      });
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      invalidateAfterMutation(dateStr); // 알림 등 갱신
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
      invalidateAfterMutation(dateStr); // 해당 date detail + 그 달 month 무효화
      router.replace('/(tabs)');
    } catch {
      showAlert('삭제에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  }

  function openMove() {
    setMoveDate('');
    setMoveError(null);
    setMoveOpen(true);
  }

  async function onConfirmMove() {
    if (moving) return;
    const target = moveDate.trim();
    if (!isValidDate(target)) {
      setMoveError('존재하는 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    if (target > todayISO()) {
      setMoveError('오늘 이후 날짜로는 옮길 수 없어요.');
      return;
    }
    if (target === dateStr) {
      setMoveError('지금과 같은 날짜예요. 다른 날짜를 입력해 주세요.');
      return;
    }
    setMoving(true);
    setMoveError(null);
    try {
      await entryApi.move(dateStr, target);
      // 이전/새 날짜 detail + 두 달 month 무효화
      invalidateAfterMutation(dateStr);
      invalidateAfterMutation(target);
      setMoveOpen(false);
      router.replace({ pathname: '/entry/[date]', params: { date: target } });
    } catch (e) {
      if (e instanceof ApiException && e.status === 409) {
        setMoveError('그 날짜엔 이미 일기가 있어요. 다른 날짜를 골라주세요.');
      } else if (e instanceof ApiException && e.status === 400) {
        setMoveError('옮길 수 없는 날짜예요. 다시 확인해 주세요.');
      } else {
        setMoveError('날짜 변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setMoving(false);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={{ flex: 1 }}
      >
        {/* 헤더 */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Icon name="chevron-back" size={28} color={colors.subText} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.dateTitle}>{formatKoShort(dateStr)}</Text>
            <Text style={styles.dateSub}>
              {weekdayKo(dateStr)}요일{dday != null ? ` · ${formatDday(dday)}` : ''}
            </Text>
          </View>
          {mineWritten ? (
            <Pressable onPress={openMove} hitSlop={12}>
              <Icon name="calendar-outline" size={24} color={colors.subText} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                    onOpenPhoto={openPhotoViewer}
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
                  onPoke={onPoke}
                  poking={poking}
                />
              ) : partnerOpen ? (
                <SideCard
                  title="상대가 쓴 일기"
                  side={partnerOpen}
                  tone="partner"
                  mode={detail.mode}
                  questions={detail.questions}
                  onOpenPhoto={openPhotoViewer}
                />
              ) : status === 'LOCKED' ? (
                <Card style={styles.waitCard}>
                  <Icon name="lock-closed" size={22} color={colors.coralSoft} style={{ marginBottom: spacing.sm }} />
                  <Text style={styles.waitText}>상대가 아직 오늘 일기를 안 썼어요{'\n'}상대가 쓰면 자동으로 열려요!</Text>
                </Card>
              ) : null}

              {/* 획득 스티커(OPEN) */}
              {status === 'OPEN' ? (
                <View style={styles.stickerRow}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={22} color={colors.white} /></View>
                  <Text style={styles.stickerText}>이 날의 스티커를 획득했어요!</Text>
                </View>
              ) : null}

              {/* 댓글 (OPEN에서만) */}
              {status === 'OPEN' ? (
                <View style={{ marginTop: spacing.lg }}>
                  <View style={styles.sectionLabelRow}>
                    <Icon name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                    <Text style={styles.sectionLabel}>댓글</Text>
                  </View>
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
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
              placeholder="댓글 달기..."
              placeholderTextColor={colors.placeholder}
              style={styles.commentInput}
            />
            <Button label="등록" variant="soft" onPress={onComment} loading={posting} style={styles.commentBtn} />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* 사진 풀스크린 뷰어 */}
      <PhotoViewer viewer={viewer} onClose={() => setViewer(null)} />

      {/* 날짜 변경 모달 */}
      <Modal visible={moveOpen} transparent animationType="fade" onRequestClose={() => setMoveOpen(false)}>
        <Pressable style={styles.moveBackdrop} onPress={() => setMoveOpen(false)}>
          <Pressable style={styles.moveSheet} onPress={() => {}}>
            <Text style={styles.moveTitle}>날짜 변경</Text>
            <Text style={styles.moveSub}>이 날의 일기를 옮길 날짜를 골라 주세요.</Text>
            <Pressable style={styles.moveField} onPress={() => setMovePickerOpen(true)}>
              <Text style={[styles.moveFieldText, !moveDate && { color: colors.placeholder }]}>
                {moveDate || '날짜 선택'}
              </Text>
              <Icon name="calendar-outline" size={20} color={colors.primary} />
            </Pressable>
            {moveError ? <Text style={styles.moveError}>{moveError}</Text> : null}
            <View style={styles.moveActions}>
              <Button
                label="취소"
                variant="ghost"
                onPress={() => setMoveOpen(false)}
                style={{ flex: 1, height: 44 }}
              />
              <Button
                label="옮기기"
                onPress={onConfirmMove}
                loading={moving}
                style={{ flex: 1, height: 44 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 옮길 날짜 선택(미래 불가) */}
      <DatePickerSheet
        visible={movePickerOpen}
        value={moveDate || dateStr}
        maxDate={todayISO()}
        title="옮길 날짜 선택"
        onClose={() => setMovePickerOpen(false)}
        onConfirm={(d) => {
          setMoveDate(d);
          setMoveError(null);
          setMovePickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

/** 풀스크린 사진 뷰어. 여러 장이면 좌우 스와이프. */
function PhotoViewer({
  viewer,
  onClose,
}: {
  viewer: { urls: string[]; index: number } | null;
  onClose: () => void;
}) {
  const win = Dimensions.get('window');
  if (!viewer) return null;
  const toUri = (u: string) => (u.startsWith('http') ? u : `${API_URL}${u}`);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBg}>
        <FlatList
          data={viewer.urls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={viewer.index}
          getItemLayout={(_, i) => ({ length: win.width, offset: win.width * i, index: i })}
          keyExtractor={(u, i) => u + i}
          renderItem={({ item }) => (
            <View style={{ width: win.width, height: win.height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: toUri(item) }} style={{ width: win.width, height: win.height }} resizeMode="contain" />
            </View>
          )}
        />
        <Pressable onPress={onClose} style={styles.viewerClose} hitSlop={12}>
          <Icon name="close" size={28} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

function EmptyState({ future, onWrite }: { future: boolean; onWrite: () => void }) {
  if (future) {
    return (
      <Card style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
        <Icon name="moon-outline" size={40} color={colors.coralSoft} style={{ marginBottom: spacing.md }} />
        <Text style={styles.emptyTitle}>아직 오지 않은 날이에요</Text>
        <Text style={styles.emptySub}>그날이 되면 함께 기록해요</Text>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
      <Icon name="create-outline" size={40} color={colors.coralSoft} style={{ marginBottom: spacing.md }} />
      <Text style={styles.emptyTitle}>아직 이 날의 일기가 없어요</Text>
      <Text style={styles.emptySub}>먼저 오늘을 기록해볼까요?</Text>
      <Button label="일기 쓰기" onPress={onWrite} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
    </Card>
  );
}

function LockedPartner({
  onWrite,
  onPoke,
  poking,
}: {
  onWrite: () => void;
  onPoke: () => void;
  poking: boolean;
}) {
  return (
    <Card style={[styles.lockedCard]}>
      <View style={styles.blurBox}>
        <Text style={styles.blurText}>█████ ███ ██████{'\n'}███████ ████ ██</Text>
        <View style={styles.lockOverlay}>
          <Icon name="lock-closed" size={30} color={colors.coralSoft} />
        </View>
      </View>
      <Text style={styles.lockedTitle}>상대의 일기는 잠겨 있어요</Text>
      <Text style={styles.lockedSub}>내 일기를 쓰면 서로의 글이 열려요</Text>
      <Button label="내 일기 쓰기" onPress={onWrite} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
      <Button
        label="콕 찌르기"
        icon="hand-left-outline"
        variant="ghost"
        onPress={onPoke}
        loading={poking}
        style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
      />
    </Card>
  );
}

function SideCard({
  title,
  side,
  tone,
  mode,
  questions,
  onOpenPhoto,
}: {
  title: string;
  side: EntryView;
  tone: 'coral' | 'partner';
  mode: DayDetail['mode'];
  questions: QuestionResponse[];
  onOpenPhoto: (urls: string[], index: number) => void;
}) {
  const c = useColors();
  const accent = tone === 'coral' ? c.primary : colors.partner;
  // 표시할 장소: locations[] 우선, 없으면 단일 locationName 폴백.
  const locs = side.locations && side.locations.length > 0
    ? side.locations
    : side.locationName ? [side.locationName] : [];
  // 실제 이미지 url이 있는 사진만 뷰어 대상.
  const photoUrls = side.photos.map((p) => p.url).filter((u): u is string => !!u);
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={styles.sideHead}>
        <Text style={[styles.sideTitle, { color: accent }]}>{title}</Text>
        {side.rating ? <StarRating value={side.rating} size={16} /> : null}
      </View>

      {/* 메타: 기분 / 위치 */}
      <View style={styles.metaRow}>
        {side.mood ? (
          <Pill tone={tone}>
            <View style={styles.pillRow}>
              {moodIcon(side.mood) ? (
                <Icon name={moodIcon(side.mood)!} size={14} color={colors.text} />
              ) : null}
              <Text style={styles.pillLabel}>기분</Text>
            </View>
          </Pill>
        ) : null}
        {locs.map((loc) => (
          <Pill key={loc} tone="neutral">
            <View style={styles.pillRow}>
              <Icon name="location-outline" size={14} color={colors.text} />
              <Text style={styles.pillLabel}>{loc}</Text>
            </View>
          </Pill>
        ))}
      </View>

      {/* 사진: url 있으면 실제 이미지, 없으면 색시드 썸네일 */}
      {side.photos.length > 0 ? (
        <View style={styles.photoRow}>
          {side.photos.slice(0, 3).map((p, i) => {
            // 뷰어에서의 인덱스(url 있는 사진들 기준)
            const viewerIndex = p.url ? photoUrls.indexOf(p.url) : -1;
            return (
              <Pressable
                key={p.id}
                disabled={viewerIndex < 0}
                onPress={() => onOpenPhoto(photoUrls, Math.max(0, viewerIndex))}
              >
                <PhotoThumb
                  url={p.url}
                  seed={p.colorSeed}
                  size={90}
                  round={false}
                  label={
                    i === 2 && side.photos.length > 3
                      ? `+${side.photos.length - 2}`
                      : <Icon name="image-outline" size={30} color={colors.white} />
                  }
                />
              </Pressable>
            );
          })}
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
  const c = useColors();
  return (
    <View style={[styles.commentRow, mine && { alignItems: 'flex-end' }]}>
      <View style={[styles.commentBubble, mine ? [styles.commentMine, { backgroundColor: c.coralSofter }] : styles.commentPartner]}>
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

  waitCard: { marginTop: spacing.lg, backgroundColor: '#FFF3E4', alignItems: 'center' },
  waitText: { ...font.body, color: colors.subText, textAlign: 'center', lineHeight: 22 },

  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillLabel: { ...font.label, color: colors.text },

  sideHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideTitle: { ...font.title },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  answerQ: { ...font.label, marginBottom: 2 },
  answerText: { ...font.body, lineHeight: 23 },

  stickerRow: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  stickerText: { ...font.label, color: colors.subText },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  sectionLabel: { ...font.title },
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

  moveBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  moveSheet: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow,
  },
  moveTitle: { ...font.title },
  moveSub: { ...font.caption, marginTop: spacing.xs },
  moveField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    marginTop: spacing.md,
  },
  moveFieldText: { fontSize: 16, color: colors.text },
  moveError: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
  moveActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
