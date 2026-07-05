import { useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import {
  AnswerView,
  DayDetail,
  EntryMode,
  QuestionResponse,
  UpsertEntryRequest,
  entryApi,
  locationApi,
  questionApi,
  uploadPhoto,
} from '../../lib/api';
import { formatKoLong, todayISO, weekdayKo } from '../../lib/date';
import { showAlert } from '../../lib/dialog';
import { invalidateAfterMutation } from '../../store/useDataCache';
import { MOODS, TEMPLATE_PROMPTS } from '../../constants/content';
import { Button, Card, Icon, PhotoThumb, StarRating } from '../../components/ui';
import { KakaoPlaceSearch } from '../../components/KakaoPlaceSearch';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

type Step = 'mode' | 'form';
/** 화면 로컬 모드. 'FREE'=내가 질문 3개를 고르는 단계(제출 시 QUESTION_PICK으로 저장). */
type FormMode = EntryMode | 'FREE';

/** "기억에 남는 장면 2~3가지" 질문은 여러 입력 행을 제공. 텍스트로 식별. */
const SCENE_MARKER = '기억에 남는 장면';
function isSceneQuestion(text: string | undefined): boolean {
  return !!text && text.includes(SCENE_MARKER);
}

/** 장면 여러 줄("1. …\n2. …")로 저장된 answer text → 개별 장면 배열로 분해(수정 진입 프리필용). */
function splitScenes(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
    .filter((l) => l.length > 0);
}

/** 개별 장면 배열 → "1. …\n2. …" 한 덩어리로 합침. */
function joinScenes(scenes: string[]): string {
  const cleaned = scenes.map((s) => s.trim()).filter((s) => s.length > 0);
  return cleaned.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

export default function WriteScreen() {
  const router = useRouter();
  const c = useColors();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateStr = date ?? todayISO();

  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<FormMode>('TEMPLATE');
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [editExpired, setEditExpired] = useState(false); // 내 일기 수정 가능 시간(3시간) 경과

  // 자유(질문) 관련 — 서버 질문 로드 실패 시 자유 모드 비활성화(폴백 없음)
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [questionsFailed, setQuestionsFailed] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]); // 내가 고르는 3개(먼저 쓰는 사람)
  const [fixedQuestions, setFixedQuestions] = useState<QuestionResponse[] | null>(null); // 상대가 이미 고른 범위

  // 공통 입력
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // 장면 질문(기억에 남는 장면) 전용: 질문 id → 장면 여러 개
  const [scenes, setScenes] = useState<Record<string, string[]>>({});
  const [mood, setMood] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [locations, setLocations] = useState<string[]>([]); // 다중 장소 칩
  const [locationInput, setLocationInput] = useState('');
  const [prevLocations, setPrevLocations] = useState<string[]>([]); // 이전 장소 추천
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false); // 카카오 장소 검색 시트
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); // 업로드 완료된 /files/... 경로
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 진입 시: 서버 질문 목록 로드 (실패 시 자유 모드 비활성화)
  useEffect(() => {
    (async () => {
      try {
        const qs = await questionApi.list();
        if (qs.length > 0) {
          setQuestions(qs);
          setQuestionsFailed(false);
        } else {
          setQuestionsFailed(true);
        }
      } catch {
        setQuestionsFailed(true);
      }
    })();
    // 이전에 쓴 장소 추천 로드 (실패해도 무시)
    (async () => {
      try {
        const { locations: prev } = await locationApi.list();
        setPrevLocations(prev ?? []);
      } catch {
        /* 무시 */
      }
    })();
  }, []);

  // 진입 시: 내 일기(수정 진입) / 상대가 먼저 고른 질문 범위를 detail로 판단
  useEffect(() => {
    (async () => {
      try {
        const detail: DayDetail = await entryApi.detail(dateStr);
        const mine = detail.myEntry;
        if (mine) {
          // 수정 진입: editable=false면 작성 화면 대신 안내
          if (!mine.editable) {
            setEditExpired(true);
            return;
          }
          setMode(detail.mode);
          if (detail.mode === 'QUESTION_PICK') setFixedQuestions(detail.questions);
          const prefill: Record<string, string> = {};
          for (const a of mine.answers) {
            const key = a.promptKey ?? (a.questionId != null ? String(a.questionId) : null);
            if (key) prefill[key] = a.text;
          }
          setAnswers(prefill);
          setRating(mine.rating ?? 0);
          setMood(mine.mood ?? null);
          setLocations(mine.locations ?? (mine.locationName ? [mine.locationName] : []));
          setPhotoUrls(mine.photos.map((p) => p.url).filter((u): u is string => !!u));
          setStep('form');
        } else if (detail.mode === 'QUESTION_PICK' && detail.questions.length > 0) {
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

  // 수정 진입 시: 이미 저장된 장면 질문 답("1. …\n2. …")을 개별 장면 입력으로 분해.
  // 질문 목록과 answers가 모두 준비된 뒤 한 번만 채운다.
  useEffect(() => {
    const pool = fixedQuestions ?? questions;
    if (pool.length === 0) return;
    setScenes((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const q of pool) {
        const key = String(q.id);
        if (!isSceneQuestion(q.text)) continue;
        if (next[key]) continue; // 이미 편집 중이면 덮어쓰지 않음
        const raw = answers[key];
        if (raw && raw.trim()) {
          const parts = splitScenes(raw);
          next[key] = parts.length > 0 ? parts : [''];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // answers는 최초 프리필 값만 참조하면 되므로 의존성에서 제외(무한루프 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, fixedQuestions]);

  function chooseMode(m: FormMode) {
    if (m === 'FREE' && questionsFailed) return;
    setMode(m);
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

  function addLocation(name: string) {
    const v = name.trim();
    if (!v) return;
    setLocations((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setLocationInput('');
  }

  function removeLocation(name: string) {
    setLocations((prev) => prev.filter((l) => l !== name));
  }

  /** 장면 질문의 개별 행 값. 미초기화면 최소 2개(장면 1/2) 빈칸 제공. */
  function sceneRows(key: string): string[] {
    const rows = scenes[key];
    if (rows && rows.length > 0) return rows;
    return ['', ''];
  }
  function setScene(key: string, index: number, text: string) {
    setScenes((prev) => {
      const rows = [...(prev[key] ?? ['', ''])];
      rows[index] = text;
      return { ...prev, [key]: rows };
    });
  }
  function addScene(key: string) {
    setScenes((prev) => {
      const rows = [...(prev[key] ?? ['', ''])];
      if (rows.length >= 3) return prev; // 최대 3개
      return { ...prev, [key]: [...rows, ''] };
    });
  }
  function removeScene(key: string, index: number) {
    setScenes((prev) => {
      const rows = [...(prev[key] ?? ['', ''])];
      if (rows.length <= 1) return prev;
      rows.splice(index, 1);
      return { ...prev, [key]: rows };
    });
  }

  /** 갤러리에서 이미지 선택 → 서버 업로드 → url 목록에 추가. */
  async function pickAndUploadPhoto() {
    if (photoUrls.length >= 6 || uploading) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showAlert('사진 접근 권한이 필요해요', '설정에서 사진 접근을 허용해 주세요.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setUploading(true);
      const { url } = await uploadPhoto({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      setPhotoUrls((prev) => [...prev, url]);
    } catch {
      showAlert('사진 업로드에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
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
      .map((q) => {
        const key = String(q.id);
        // 장면 질문은 여러 행을 "1. …\n2. …"로 합침.
        const text = isSceneQuestion(q.text)
          ? joinScenes(scenes[key] ?? [])
          : (answers[key] ?? '').trim();
        return { questionId: q.id, text };
      })
      .filter((a) => a.text.length > 0);
  }

  function canSubmit(): boolean {
    if (uploading) return false;
    if (!mood || rating === 0) return false; // 기분·별점 필수
    if (mode === 'FREE' && !fixedQuestions && pickedIds.length !== 3) return false;
    return buildAnswers().length > 0;
  }

  async function onSubmit() {
    if (!canSubmit()) {
      if (!mood || rating === 0) {
        setError('기분과 별점을 입력해주세요.');
      } else {
        setError(mode === 'FREE' && !fixedQuestions ? '질문 3개를 골라주세요.' : '한 칸 이상 적어주세요.');
      }
      return;
    }
    setError(null);
    setSubmitting(true);

    // FREE에서 내가 먼저 고르면 서버엔 QUESTION_PICK으로 저장(상대가 범위 내 답).
    const outMode: EntryMode = mode === 'FREE' ? 'QUESTION_PICK' : mode;
    const questionIds: number[] | undefined =
      outMode === 'QUESTION_PICK'
        ? (fixedQuestions ? fixedQuestions.map((q) => q.id) : pickedIds.map(Number))
        : undefined;

    const payload: UpsertEntryRequest = {
      mode: outMode,
      templateType: mode === 'TEMPLATE' ? 'default' : undefined,
      questionIds,
      answers: buildAnswers(),
      photoUrls,
      locations: locations.length > 0 ? locations : undefined,
      rating: rating > 0 ? rating : undefined,
      mood: mood ?? undefined,
    };

    try {
      await entryApi.create(dateStr, payload);
      // 캐시 무효화: 해당 date detail + 그 달 month + 알림 최신화
      invalidateAfterMutation(dateStr);
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
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  if (editExpired) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Card style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
            <Icon name="time-outline" size={40} color={colors.coralSoft} style={{ marginBottom: spacing.md }} />
            <Text style={styles.expiredTitle}>수정 가능 시간(3시간)이 지났어요</Text>
            <Text style={styles.expiredSub}>이미 쓴 일기는 3시간 안에만 고칠 수 있어요.</Text>
            <Button label="돌아가기" onPress={() => router.back()} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => (step === 'form' && !fixedQuestions ? setStep('mode') : router.back())} hitSlop={12}>
            <Icon name="chevron-back" size={28} color={colors.subText} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>오늘의 일기</Text>
            <Text style={styles.dateSub}>{formatKoLong(dateStr)} · {weekdayKo(dateStr)}요일</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {step === 'mode' ? (
          <ModeSelect onChoose={chooseMode} freeDisabled={questionsFailed} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* 기분 */}
            <View style={styles.sectionLabelRow}>
              <Icon name="happy-outline" size={18} color={colors.text} />
              <Text style={styles.sectionLabel}>오늘의 기분</Text>
            </View>
            <View style={styles.moodRow}>
              {MOODS.map((m) => {
                const on = mood === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMood(m.key)}
                    style={[styles.moodItem, on && [styles.moodSelected, { borderColor: c.primary }]]}
                  >
                    <Icon name={m.icon} size={24} color={on ? c.primary : colors.subText} />
                  </Pressable>
                );
              })}
            </View>

            {/* 별점 */}
            <Card style={styles.ratingCard}>
              <View style={[styles.sectionLabelRow, { marginTop: 0, marginBottom: 0 }]}>
                <Icon name="star" size={18} color={colors.star} />
                <Text style={styles.ratingLabel}>오늘 데이트 점수</Text>
              </View>
              <StarRating value={rating} onChange={setRating} size={28} />
            </Card>
            {!mood || rating === 0 ? (
              <Text style={styles.requiredHint}>기분과 별점을 입력해주세요</Text>
            ) : null}

            {/* 본문 폼 */}
            {mode === 'TEMPLATE' ? (
              <TemplateForm answers={answers} onChange={setAnswer} />
            ) : mode === 'QUESTION_PICK' && fixedQuestions ? (
              <FixedQuestionForm
                questions={fixedQuestions}
                answers={answers}
                onChange={setAnswer}
                sceneRows={sceneRows}
                onSceneChange={setScene}
                onSceneAdd={addScene}
                onSceneRemove={removeScene}
              />
            ) : (
              <FreePickForm
                questions={questions}
                picked={pickedIds}
                onToggle={togglePick}
                answers={answers}
                onChange={setAnswer}
                sceneRows={sceneRows}
                onSceneChange={setScene}
                onSceneAdd={addScene}
                onSceneRemove={removeScene}
              />
            )}

            {/* 사진 업로드 */}
            <View style={[styles.sectionLabelRow, { marginTop: spacing.xl }]}>
              <Icon name="images-outline" size={18} color={colors.text} />
              <Text style={styles.sectionLabel}>오늘의 흔적</Text>
            </View>
            <View style={styles.photoRow}>
              {photoUrls.map((u, i) => (
                <PhotoThumb key={u + i} url={u} seed={u} size={72} round={false} />
              ))}
              {uploading ? (
                <View style={styles.addPhoto}>
                  <ActivityIndicator color={c.primary} />
                </View>
              ) : photoUrls.length < 6 ? (
                <Pressable onPress={pickAndUploadPhoto} style={styles.addPhoto}>
                  <Icon name="add" size={30} color={colors.coralSoft} />
                </Pressable>
              ) : null}
            </View>

            {/* 위치 (다중) */}
            <View style={[styles.sectionLabelRow, { marginTop: spacing.xl }]}>
              <Icon name="location-outline" size={18} color={colors.text} />
              <Text style={styles.sectionLabel}>다녀온 장소</Text>
            </View>
            {/* 추가된 장소 칩 */}
            {locations.length > 0 ? (
              <View style={styles.chipWrap}>
                {locations.map((loc) => (
                  <Pressable key={loc} onPress={() => removeLocation(loc)} style={[styles.chip, styles.chipOn, { backgroundColor: c.primary, borderColor: c.primary }]}>
                    <View style={styles.locChipRow}>
                      <Text style={[styles.chipText, { color: colors.white }]}>{loc}</Text>
                      <Icon name="close" size={14} color={colors.white} />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {/* 카카오맵에서 검색 */}
            <Pressable
              style={[styles.mapSearchBtn, { borderColor: c.primary }]}
              onPress={() => setPlaceSearchOpen(true)}
            >
              <Icon name="map" size={18} color={c.primary} />
              <Text style={[styles.mapSearchText, { color: c.primary }]}>카카오맵에서 장소 찾기</Text>
            </Pressable>
            {/* 직접 입력 + 추가 */}
            <View style={styles.locationRow}>
              <Icon name="add-circle-outline" size={18} color={colors.subText} />
              <TextInput
                value={locationInput}
                onChangeText={setLocationInput}
                onSubmitEditing={() => addLocation(locationInput)}
                returnKeyType="done"
                placeholder="직접 입력 (예: 성수동 · 대림창고)"
                placeholderTextColor={colors.placeholder}
                style={styles.locationInput}
              />
              {locationInput.trim() ? (
                <Pressable onPress={() => addLocation(locationInput)} hitSlop={8}>
                  <Icon name="checkmark-circle" size={24} color={c.primary} />
                </Pressable>
              ) : null}
            </View>
            {/* 이전 장소 추천 */}
            {prevLocations.filter((l) => !locations.includes(l)).length > 0 ? (
              <>
                <Text style={styles.prevLocLabel}>이전 장소</Text>
                <View style={styles.chipWrap}>
                  {prevLocations
                    .filter((l) => !locations.includes(l))
                    .map((loc) => (
                      <Pressable key={loc} onPress={() => addLocation(loc)} style={styles.chip}>
                        <Text style={styles.chipText}>{loc}</Text>
                      </Pressable>
                    ))}
                </View>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Card style={styles.lockNote}>
              <View style={styles.lockNoteRow}>
                <Icon name="lock-closed" size={16} color={colors.subText} style={{ marginTop: 2 }} />
                <Text style={styles.lockNoteText}>
                  저장하면 잠금 상태로 대기해요{'\n'}둘 다 쓰면 서로의 글이 열려요!
                </Text>
              </View>
            </Card>

            <Button
              label="저장하고 잠금 대기"
              icon="lock-closed"
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit()}
              style={{ marginTop: spacing.lg }}
            />
            <Text style={styles.subNote}>상대가 쓰면 자동으로 열려요</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <KakaoPlaceSearch
        visible={placeSearchOpen}
        onClose={() => setPlaceSearchOpen(false)}
        onSelect={addLocation}
        alreadyAdded={locations}
      />
    </SafeAreaView>
  );
}

/**
 * 여러 줄 답변 입력. 줄 겹침 방지를 위해 textAlignVertical:'top' + lineHeight 고정 +
 * onContentSizeChange로 내용에 맞춰 높이 자동 확장(최소 48).
 */
function MultilineAnswerInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const [height, setHeight] = useState(48);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      multiline
      textAlignVertical="top"
      onContentSizeChange={(e) => setHeight(Math.max(48, e.nativeEvent.contentSize.height))}
      style={[styles.multiInput, { height }]}
    />
  );
}

/** 장면 질문("기억에 남는 장면") 전용 다중 행 입력(장면 1/2/3). */
function SceneInputs({
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: string[];
  onChange: (index: number, text: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const c = useColors();
  return (
    <View>
      {rows.map((val, i) => (
        <View key={i} style={styles.sceneRow}>
          <View style={styles.sceneNum}>
            <Text style={styles.sceneNumText}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <MultilineAnswerInput
              value={val}
              onChangeText={(t) => onChange(i, t)}
              placeholder={`기억에 남는 장면 ${i + 1}`}
            />
          </View>
          {rows.length > 1 ? (
            <Pressable onPress={() => onRemove(i)} hitSlop={8} style={{ paddingTop: 12 }}>
              <Icon name="remove-circle-outline" size={20} color={colors.coralSoft} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {rows.length < 3 ? (
        <Pressable onPress={onAdd} style={styles.sceneAdd} hitSlop={6}>
          <Icon name="add" size={16} color={c.primary} />
          <Text style={[styles.sceneAddText, { color: c.primary }]}>장면 추가</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ModeSelect({ onChoose, freeDisabled }: { onChoose: (m: FormMode) => void; freeDisabled: boolean }) {
  const c = useColors();
  return (
    <View style={styles.modeWrap}>
      <Text style={styles.modeHeading}>어떻게 기록할까요?</Text>
      <Pressable style={[styles.modeCard, shadow]} onPress={() => onChoose('TEMPLATE')}>
        <Icon name="create-outline" size={30} color={c.primary} style={styles.modeIcon} />
        <Text style={styles.modeTitle}>템플릿으로 쓰기</Text>
        <Text style={styles.modeDesc}>정해진 빈칸을 채우며 가볍게</Text>
      </Pressable>
      <Pressable
        style={[styles.modeCard, shadow, freeDisabled && { opacity: 0.5 }]}
        disabled={freeDisabled}
        onPress={() => onChoose('FREE')}
      >
        <Icon name="help-circle-outline" size={32} color={c.primary} style={styles.modeIcon} />
        <Text style={styles.modeTitle}>질문 골라 쓰기</Text>
        <Text style={styles.modeDesc}>
          {freeDisabled ? '질문을 불러오지 못했어요' : '질문 8개 중 3개를 골라 서로 답하기'}
        </Text>
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
  const c = useColors();
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={styles.formHeadingRow}>
        <Icon name="create-outline" size={18} color={colors.text} />
        <Text style={styles.formHeading}>빈칸 채우기</Text>
      </View>
      {TEMPLATE_PROMPTS.map((p, i) => (
        <View key={p.promptKey} style={i > 0 ? styles.formDivider : undefined}>
          <View style={styles.promptLabelRow}>
            <Icon name={p.icon} size={15} color={c.primary} />
            <Text style={[styles.promptLabel, { color: c.primary }]}>{p.label}</Text>
          </View>
          <MultilineAnswerInput
            value={answers[p.promptKey] ?? ''}
            onChangeText={(t) => onChange(p.promptKey, t)}
            placeholder={p.placeholder}
          />
        </View>
      ))}
    </Card>
  );
}

type SceneProps = {
  sceneRows: (key: string) => string[];
  onSceneChange: (key: string, index: number, text: string) => void;
  onSceneAdd: (key: string) => void;
  onSceneRemove: (key: string, index: number) => void;
};

function FixedQuestionForm({
  questions,
  answers,
  onChange,
  sceneRows,
  onSceneChange,
  onSceneAdd,
  onSceneRemove,
}: {
  questions: QuestionResponse[];
  answers: Record<string, string>;
  onChange: (key: string, text: string) => void;
} & SceneProps) {
  const c = useColors();
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={styles.formHeadingRow}>
        <Icon name="chatbox-outline" size={18} color={colors.text} />
        <Text style={styles.formHeading}>오늘의 질문에 답하기</Text>
      </View>
      {questions.map((q, i) => {
        const key = String(q.id);
        return (
          <View key={key} style={i > 0 ? styles.formDivider : undefined}>
            <Text style={[styles.promptLabel, { color: c.primary }]}>Q{i + 1}. {q.text}</Text>
            {isSceneQuestion(q.text) ? (
              <SceneInputs
                rows={sceneRows(key)}
                onChange={(idx, t) => onSceneChange(key, idx, t)}
                onAdd={() => onSceneAdd(key)}
                onRemove={(idx) => onSceneRemove(key, idx)}
              />
            ) : (
              <MultilineAnswerInput
                value={answers[key] ?? ''}
                onChangeText={(t) => onChange(key, t)}
                placeholder="답을 적어봐..."
              />
            )}
          </View>
        );
      })}
    </Card>
  );
}

function FreePickForm({
  questions,
  picked,
  onToggle,
  answers,
  onChange,
  sceneRows,
  onSceneChange,
  onSceneAdd,
  onSceneRemove,
}: {
  questions: QuestionResponse[];
  picked: string[];
  onToggle: (id: string) => void;
  answers: Record<string, string>;
  onChange: (key: string, text: string) => void;
} & SceneProps) {
  const c = useColors();
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={styles.formHeadingRow}>
        <Icon name="help-circle-outline" size={18} color={colors.text} />
        <Text style={styles.formHeading}>질문 3개 고르기 ({picked.length}/3)</Text>
      </View>
      {questions.length === 0 ? (
        <Text style={styles.error}>질문을 불러오지 못했어요</Text>
      ) : null}
      <View style={styles.chipWrap}>
        {questions.map((q) => {
          const id = String(q.id);
          const on = picked.includes(id);
          return (
            <Pressable key={id} onPress={() => onToggle(id)} style={[styles.chip, on && [styles.chipOn, { backgroundColor: c.primary, borderColor: c.primary }]]}>
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
            <Text style={[styles.promptLabel, { color: c.primary }]}>Q{i + 1}. {q.text}</Text>
            {isSceneQuestion(q.text) ? (
              <SceneInputs
                rows={sceneRows(id)}
                onChange={(idx, t) => onSceneChange(id, idx, t)}
                onAdd={() => onSceneAdd(id)}
                onRemove={(idx) => onSceneRemove(id, idx)}
              />
            ) : (
              <MultilineAnswerInput
                value={answers[id] ?? ''}
                onChangeText={(t) => onChange(id, t)}
                placeholder="답을 적어봐..."
              />
            )}
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
  modeIcon: { marginBottom: spacing.xs },
  modeTitle: { ...font.title, marginTop: spacing.sm },
  modeDesc: { ...font.caption, marginTop: spacing.xs },

  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionLabel: { ...font.title },
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

  formHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  formHeading: { ...font.title },
  formDivider: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  promptLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.sm },
  promptLabel: { ...font.label, color: colors.primary },
  multiInput: {
    ...font.body,
    minHeight: 48,
    textAlignVertical: 'top',
    color: colors.text,
    lineHeight: 21,
    paddingTop: 8,
  },
  requiredHint: { ...font.caption, color: colors.danger, marginTop: spacing.sm },

  sceneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  sceneNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.coralSofter,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  sceneNumText: { ...font.caption, color: colors.text, fontWeight: '700' },
  sceneAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
  sceneAddText: { ...font.label, color: colors.primary },

  locChipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prevLocLabel: { ...font.label, color: colors.subText, marginTop: spacing.md, marginBottom: spacing.xs },

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
  mapSearchBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  mapSearchText: { ...font.body, fontWeight: '700' },
  locationRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  locationInput: {
    flex: 1,
    color: colors.text,
    ...font.body,
  },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
  lockNote: { marginTop: spacing.lg, backgroundColor: '#FFF3E4' },
  lockNoteRow: { flexDirection: 'row', gap: spacing.sm },
  lockNoteText: { ...font.body, color: colors.subText, lineHeight: 22, flex: 1 },
  subNote: { ...font.caption, textAlign: 'center', marginTop: spacing.sm },
  expiredTitle: { ...font.title },
  expiredSub: { ...font.caption, marginTop: spacing.xs },
});
