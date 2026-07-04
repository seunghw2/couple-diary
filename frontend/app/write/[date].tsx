import { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AnswerView,
  DayDetail,
  EntryMode,
  QuestionResponse,
  UpsertEntryRequest,
  entryApi,
  questionApi,
} from '../../lib/api';
import { formatKoLong, todayISO, weekdayKo } from '../../lib/date';
import { FALLBACK_QUESTIONS, MOODS, TEMPLATE_PROMPTS, randomSeed } from '../../constants/content';
import { Button, Card, SeedThumb, StarRating } from '../../components/ui';
import { colors, font, radius, shadow, spacing } from '../../theme/theme';

type Step = 'mode' | 'form';
/** 화면 로컬 모드. 'FREE'=내가 질문 3개를 고르는 단계(제출 시 QUESTION_PICK으로 저장). */
type FormMode = EntryMode | 'FREE';

export default function WriteScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateStr = date ?? todayISO();

  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<FormMode>('TEMPLATE');
  const [loadingDetail, setLoadingDetail] = useState(true);

  // 자유(질문) 관련
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]); // 내가 고르는 3개(먼저 쓰는 사람)
  const [fixedQuestions, setFixedQuestions] = useState<QuestionResponse[] | null>(null); // 상대가 이미 고른 범위

  // 공통 입력
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [location, setLocation] = useState('');
  const [photoSeeds, setPhotoSeeds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 진입 시: 상대가 먼저 QUESTION_PICK으로 질문을 골랐는지 detail로 판단
  useEffect(() => {
    (async () => {
      try {
        const detail: DayDetail = await entryApi.detail(dateStr);
        if (detail.mode === 'QUESTION_PICK' && detail.questions.length > 0) {
          // 상대가 고른 질문 범위 내에서 답만 작성
          setFixedQuestions(detail.questions);
          setMode('QUESTION_PICK');
          setStep('form');
        }
      } catch {
        // detail 없음 = 내가 먼저 쓰는 사람. 모드 선택부터.
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [dateStr]);

  const loadQuestions = useCallback(async (): Promise<QuestionResponse[]> => {
    try {
      const qs = await questionApi.list();
      if (qs.length > 0) {
        setQuestions(qs);
        return qs;
      }
    } catch {
      /* fall through */
    }
    const fallback = FALLBACK_QUESTIONS as unknown as QuestionResponse[];
    setQuestions(fallback);
    return fallback;
  }, []);

  function chooseMode(m: FormMode) {
    setMode(m);
    if (m === 'FREE') {
      loadQuestions();
    }
    setStep('form');
  }

  function togglePick(id: string) {
    setPickedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // 최대 3개
      return [...prev, id];
    });
  }

  function setAnswer(key: string, text: string) {
    setAnswers((prev) => ({ ...prev, [key]: text }));
  }

  function addPhoto() {
    if (photoSeeds.length >= 6) return;
    setPhotoSeeds((prev) => [...prev, randomSeed()]);
  }

  function buildAnswers(): AnswerView[] {
    if (mode === 'TEMPLATE') {
      return TEMPLATE_PROMPTS.filter((p) => (answers[p.promptKey] ?? '').trim().length > 0).map((p) => ({
        promptKey: p.promptKey,
        text: answers[p.promptKey].trim(),
      }));
    }
    // FREE(먼저 고르는 사람): pickedIds / QUESTION_PICK(범위 내 답): fixedQuestions
    const activeQs =
      mode === 'QUESTION_PICK' && fixedQuestions
        ? fixedQuestions
        : questions.filter((q) => pickedIds.includes(String(q.id)));
    return activeQs
      .filter((q) => (answers[String(q.id)] ?? '').trim().length > 0)
      .map((q) => ({ questionId: Number(q.id), text: answers[String(q.id)].trim() }));
  }

  function canSubmit(): boolean {
    if (mode === 'FREE' && !fixedQuestions && pickedIds.length !== 3) return false;
    return buildAnswers().length > 0;
  }

  async function onSubmit() {
    if (!canSubmit()) {
      setError(mode === 'FREE' && !fixedQuestions ? '질문 3개를 골라주세요.' : '한 칸 이상 적어주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);

    // FREE에서 내가 먼저 고르면 서버엔 QUESTION_PICK으로 저장(상대가 범위 내 답).
    const outMode: EntryMode = mode === 'FREE' ? 'QUESTION_PICK' : mode;
    const questionIds: number[] | undefined =
      outMode === 'QUESTION_PICK'
        ? (fixedQuestions ? fixedQuestions.map((q) => Number(q.id)) : pickedIds.map(Number))
        : undefined;

    const payload: UpsertEntryRequest = {
      mode: outMode,
      templateType: mode === 'TEMPLATE' ? 'default' : undefined,
      questionIds,
      answers: buildAnswers(),
      photoSeeds,
      locationName: location.trim() || undefined,
      rating: rating > 0 ? rating : undefined,
      mood: mood ?? undefined,
    };

    try {
      await entryApi.create(dateStr, payload);
      router.replace({ pathname: '/entry/[date]', params: { date: dateStr } });
    } catch {
      setError('저장에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingDetail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => (step === 'form' && !fixedQuestions ? setStep('mode') : router.back())} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>오늘의 일기</Text>
            <Text style={styles.dateSub}>{formatKoLong(dateStr)} · {weekdayKo(dateStr)}요일</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {step === 'mode' ? (
          <ModeSelect onChoose={chooseMode} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* 기분 */}
            <Text style={styles.sectionLabel}>🎨 오늘의 기분</Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMood(m)}
                  style={[styles.moodItem, mood === m && styles.moodSelected]}
                >
                  <Text style={{ fontSize: 26 }}>{m}</Text>
                </Pressable>
              ))}
            </View>

            {/* 별점 */}
            <Card style={styles.ratingCard}>
              <Text style={styles.ratingLabel}>⭐ 오늘 데이트 점수</Text>
              <StarRating value={rating} onChange={setRating} size={28} />
            </Card>

            {/* 본문 폼 */}
            {mode === 'TEMPLATE' ? (
              <TemplateForm answers={answers} onChange={setAnswer} />
            ) : mode === 'QUESTION_PICK' && fixedQuestions ? (
              <FixedQuestionForm questions={fixedQuestions} answers={answers} onChange={setAnswer} />
            ) : (
              <FreePickForm
                questions={questions}
                picked={pickedIds}
                onToggle={togglePick}
                answers={answers}
                onChange={setAnswer}
              />
            )}

            {/* 사진(색시드) */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>📎 오늘의 흔적</Text>
            <View style={styles.photoRow}>
              {photoSeeds.map((s, i) => (
                <SeedThumb key={s + i} seed={s} size={72} round={false} label="📷" />
              ))}
              {photoSeeds.length < 6 ? (
                <Pressable onPress={addPhoto} style={styles.addPhoto}>
                  <Text style={{ fontSize: 28, color: colors.coralSoft }}>＋</Text>
                </Pressable>
              ) : null}
            </View>

            {/* 위치 */}
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="📍 장소 이름 (예: 성수동 · 대림창고)"
              placeholderTextColor={colors.border}
              style={styles.locationInput}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Card style={styles.lockNote}>
              <Text style={styles.lockNoteText}>
                저장하면 잠금 상태로 대기해요 🔒{'\n'}둘 다 쓰면 서로의 글이 열려요!
              </Text>
            </Card>

            <Button
              label="저장하고 잠금 대기 🔒"
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit()}
              style={{ marginTop: spacing.lg }}
            />
            <Text style={styles.subNote}>상대가 쓰면 자동으로 열려요</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeSelect({ onChoose }: { onChoose: (m: FormMode) => void }) {
  return (
    <View style={styles.modeWrap}>
      <Text style={styles.modeHeading}>어떻게 기록할까요?</Text>
      <Pressable style={[styles.modeCard, shadow]} onPress={() => onChoose('TEMPLATE')}>
        <Text style={styles.modeEmoji}>📝</Text>
        <Text style={styles.modeTitle}>템플릿으로 쓰기</Text>
        <Text style={styles.modeDesc}>정해진 빈칸을 채우며 가볍게</Text>
      </Pressable>
      <Pressable style={[styles.modeCard, shadow]} onPress={() => onChoose('FREE')}>
        <Text style={styles.modeEmoji}>💬</Text>
        <Text style={styles.modeTitle}>질문 골라 쓰기</Text>
        <Text style={styles.modeDesc}>질문 8개 중 3개를 골라 서로 답하기</Text>
      </Pressable>
    </View>
  );
}

function TemplateForm({
  answers,
  onChange,
}: {
  answers: Record<string, string>;
  onChange: (key: string, text: string) => void;
}) {
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <Text style={styles.formHeading}>✏️ 빈칸 채우기</Text>
      {TEMPLATE_PROMPTS.map((p, i) => (
        <View key={p.promptKey} style={i > 0 ? styles.formDivider : undefined}>
          <Text style={styles.promptLabel}>{p.emoji} {p.label}</Text>
          <TextInput
            value={answers[p.promptKey] ?? ''}
            onChangeText={(t) => onChange(p.promptKey, t)}
            placeholder={p.placeholder}
            placeholderTextColor={colors.border}
            multiline
            style={styles.multiInput}
          />
        </View>
      ))}
    </Card>
  );
}

function FixedQuestionForm({
  questions,
  answers,
  onChange,
}: {
  questions: QuestionResponse[];
  answers: Record<string, string>;
  onChange: (key: string, text: string) => void;
}) {
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <Text style={styles.formHeading}>💬 상대가 고른 질문에 답하기</Text>
      {questions.map((q, i) => (
        <View key={String(q.id)} style={i > 0 ? styles.formDivider : undefined}>
          <Text style={styles.promptLabel}>Q{i + 1}. {q.text}</Text>
          <TextInput
            value={answers[String(q.id)] ?? ''}
            onChangeText={(t) => onChange(String(q.id), t)}
            placeholder="답을 적어봐..."
            placeholderTextColor={colors.border}
            multiline
            style={styles.multiInput}
          />
        </View>
      ))}
    </Card>
  );
}

function FreePickForm({
  questions,
  picked,
  onToggle,
  answers,
  onChange,
}: {
  questions: QuestionResponse[];
  picked: string[];
  onToggle: (id: string) => void;
  answers: Record<string, string>;
  onChange: (key: string, text: string) => void;
}) {
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <Text style={styles.formHeading}>💬 질문 3개 고르기 ({picked.length}/3)</Text>
      <View style={styles.chipWrap}>
        {questions.map((q) => {
          const id = String(q.id);
          const on = picked.includes(id);
          return (
            <Pressable key={id} onPress={() => onToggle(id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: colors.white }]}>{q.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {picked.map((id, i) => {
        const q = questions.find((x) => String(x.id) === id);
        if (!q) return null;
        return (
          <View key={id} style={styles.formDivider}>
            <Text style={styles.promptLabel}>Q{i + 1}. {q.text}</Text>
            <TextInput
              value={answers[id] ?? ''}
              onChangeText={(t) => onChange(id, t)}
              placeholder="답을 적어봐..."
              placeholderTextColor={colors.border}
              multiline
              style={styles.multiInput}
            />
          </View>
        );
      })}
    </Card>
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
  title: { ...font.h2 },
  dateSub: { ...font.caption },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },

  // 모드 선택
  modeWrap: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg },
  modeHeading: { ...font.h2, marginBottom: spacing.sm },
  modeCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl },
  modeEmoji: { fontSize: 34 },
  modeTitle: { ...font.title, marginTop: spacing.sm },
  modeDesc: { ...font.caption, marginTop: spacing.xs },

  sectionLabel: { ...font.title, marginTop: spacing.lg, marginBottom: spacing.md },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodItem: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow,
  },
  moodSelected: { borderColor: colors.primary },

  ratingCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingLabel: { ...font.title },

  formHeading: { ...font.title, marginBottom: spacing.md },
  formDivider: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  promptLabel: { ...font.label, color: colors.primary, marginBottom: spacing.sm },
  multiInput: {
    ...font.body,
    minHeight: 48,
    textAlignVertical: 'top',
    color: colors.text,
    lineHeight: 22,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...font.caption, color: colors.text },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  locationInput: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    color: colors.text,
    ...font.body,
  },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
  lockNote: { marginTop: spacing.lg, backgroundColor: '#FFF3E4' },
  lockNoteText: { ...font.body, color: colors.subText, lineHeight: 22 },
  subNote: { ...font.caption, textAlign: 'center', marginTop: spacing.sm },
});
