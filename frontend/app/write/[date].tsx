import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  PanResponder,
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
import * as ImageManipulator from 'expo-image-manipulator';
import {
  AnswerView,
  DayDetail,
  EntryMode,
  LocationPoint,
  QuestionResponse,
  SelectedPlace,
  UpsertEntryRequest,
  entryApi,
  locationApi,
  questionApi,
  uploadPhoto,
} from '../../lib/api';
import { formatKoLong, todayISO, weekdayKo } from '../../lib/date';
import { showAlert } from '../../lib/dialog';
import { errorMessage } from '../../lib/errors';
import { invalidateAfterMutation } from '../../store/useDataCache';
import { clearDraft, draftHasContent, loadDraft, saveDraft } from '../../lib/writeDraft';
import { MOODS, MOOD_CATS, TEMPLATE_PROMPTS } from '../../constants/content';
import { Button, Card, Icon, PhotoThumb } from '../../components/ui';
import { KakaoMapPicker } from '../../components/KakaoMapPicker';
import { colors, font, radius, shadow, spacing, useColors } from '../../theme/theme';

type Step = 'mode' | 'form';

/** 서명 쿼리(?exp=..&sig=..)를 뗀 bare 경로 — 대표 사진 매칭 비교용. */
function bareUrl(u?: string | null): string {
  if (!u) return '';
  const i = u.indexOf('?');
  return i >= 0 ? u.slice(0, i) : u;
}

/** 왼쪽으로 밀면 삭제되는 장소 행(공유 목록용). */
function SwipeDeleteRow({ label, onDelete, tint }: { label: string; onDelete: () => void; tint: string }) {
  const tx = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx < -6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        if (g.dx < 0) tx.setValue(Math.max(g.dx, -110));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -70) {
          Animated.timing(tx, { toValue: -500, duration: 160, useNativeDriver: true }).start(() => onDelete());
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;
  return (
    <View style={styles.swipeWrap}>
      <View style={styles.swipeDeleteBg}>
        <Icon name="trash-outline" size={16} color={colors.white} />
        <Text style={styles.swipeDeleteText}>삭제</Text>
      </View>
      <Animated.View style={[styles.swipeRow, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <Icon name="location" size={15} color={tint} />
        <Text style={styles.swipeRowText} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </View>
  );
}
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
  const [editExpired, setEditExpired] = useState(false); // 내 일기 수정 가능 시간(24시간) 경과

  // 자유(질문) 관련 — 서버 질문 로드 실패 시 자유 모드 비활성화(폴백 없음)
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [questionsFailed, setQuestionsFailed] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]); // 내가 고르는 3개(먼저 쓰는 사람)
  const [fixedQuestions, setFixedQuestions] = useState<QuestionResponse[] | null>(null); // 내가 이미 고른 질문(수정 시 프리필)
  const [modeLocked, setModeLocked] = useState(false); // 커플이 이미 정한 모드가 있어 모드 선택 단계 생략
  const [wizardStep, setWizardStep] = useState(0); // 작성 위저드 단계(0:기분 1:이야기 2:사진 3:장소)

  // 공통 입력
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // 장면 질문(기억에 남는 장면) 전용: 질문 id → 장면 여러 개
  const [scenes, setScenes] = useState<Record<string, string[]>>({});
  const [mood, setMood] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>([]); // 다중 장소 칩(이름, 하위호환)
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]); // 좌표 메타(지도에서 찍은 곳)
  const [locationInput, setLocationInput] = useState('');
  const [prevLocations, setPrevLocations] = useState<string[]>([]); // 이전 장소 추천
  const [mapPickerOpen, setMapPickerOpen] = useState(false); // 지도+검색 통합 시트
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); // 업로드 완료된 /files/... 경로(커플 공용)
  // 각 사진 소유(bare url → 'me'|'partner'). 인당 3장 제한·삭제권한 구분용. 미기록=내 새 업로드.
  const [photoAuthors, setPhotoAuthors] = useState<Record<string, 'me' | 'partner'>>({});
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 초안 복원을 딱 한 번만 수행하기 위한 플래그.
  const hydratedRef = useRef(false);

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
        // 다녀온 장소는 커플 공유 목록 — 내가 안 썼어도 상대가 넣은 게 항상 보인다.
        const shared = detail.places ?? [];
        setLocations(shared.map((p) => p.name));
        setLocationPoints(
          shared
            .filter((p) => p.lat != null && p.lng != null)
            .map((p) => ({ name: p.name, lat: p.lat as number, lng: p.lng as number, category: p.category ?? undefined }))
        );
        // 사진도 커플 공용 — 상대가 올린 것까지 합쳐 항상 로드하고, 소유(내/상대)를 기록.
        const sharedPhotos = (detail.photos ?? []).filter((p): p is typeof p & { url: string } => !!p.url);
        setPhotoUrls(sharedPhotos.map((p) => p.url));
        const myAid = mine?.authorId;
        const authors: Record<string, 'me' | 'partner'> = {};
        for (const p of sharedPhotos) {
          authors[bareUrl(p.url)] = myAid != null && p.authorId === myAid ? 'me' : 'partner';
        }
        setPhotoAuthors(authors);
        if (mine) {
          // 수정 진입: editable=false면 작성 화면 대신 안내
          if (!mine.editable) {
            setEditExpired(true);
            return;
          }
          setMode(detail.mode);
          setModeLocked(true);
          if (detail.mode === 'QUESTION_PICK') setFixedQuestions(detail.questions);
          const prefill: Record<string, string> = {};
          for (const a of mine.answers) {
            const key = a.promptKey ?? (a.questionId != null ? String(a.questionId) : null);
            if (key) prefill[key] = a.text;
          }
          setAnswers(prefill);
          setMood(mine.mood ?? null);
          // 장소·사진은 위에서 공유(detail.places/photos)로 이미 세팅함 — 여기선 건드리지 않음.
          setStep('form');
        } else if (detail.mode === 'QUESTION_PICK') {
          // 커플이 질문 모드 → 나도 내 질문을 직접 고른다(상대와 독립). 모드 변경은 잠금.
          setMode('FREE');
          setModeLocked(true);
          setStep('form');
        } else if (detail.mode === 'TEMPLATE') {
          // 커플이 템플릿 모드 → 나도 템플릿으로 작성(모드 변경 잠금).
          setMode('TEMPLATE');
          setModeLocked(true);
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

  // ── 초안(draft) 복원: 백그라운드 복귀로 리마운트돼도 작성 중이던 내용을 되살린다 ──
  // 서버 detail 로딩이 끝난 뒤 한 번만, 저장된 초안이 있으면 덮어써 복원.
  useEffect(() => {
    if (loadingDetail || editExpired || hydratedRef.current) return;
    hydratedRef.current = true;
    (async () => {
      const d = await loadDraft(dateStr);
      if (!d || !draftHasContent(d)) return;
      setStep(d.step);
      setMode(d.mode);
      setAnswers(d.answers ?? {});
      setScenes(d.scenes ?? {});
      setMood(d.mood ?? null);
      setLocations(d.locations ?? []);
      setLocationPoints(d.locationPoints ?? []);
      setPhotoUrls(d.photoUrls ?? []);
      // 내 사진 소유 복원(기록 없으면 새 업로드=내 것으로 간주됨).
      if (d.myPhotoBares && d.myPhotoBares.length > 0) {
        const authors: Record<string, 'me' | 'partner'> = {};
        for (const u of d.photoUrls ?? []) {
          authors[bareUrl(u)] = d.myPhotoBares.includes(bareUrl(u)) ? 'me' : 'partner';
        }
        setPhotoAuthors(authors);
      }
      setPickedIds(d.pickedIds ?? []);
    })();
  }, [loadingDetail, editExpired, dateStr]);

  // ── 초안 저장: 작성 중(form) 상태를 debounce로 기기에 저장 ──
  useEffect(() => {
    if (!hydratedRef.current || step !== 'form') return;
    const myPhotoBares = photoUrls.filter((u) => (photoAuthors[bareUrl(u)] ?? 'me') === 'me').map((u) => bareUrl(u));
    const draft = { step, mode, answers, scenes, mood, locations, locationPoints, photoUrls, myPhotoBares, pickedIds, savedAt: Date.now() };
    if (!draftHasContent(draft)) return;
    const t = setTimeout(() => void saveDraft(dateStr, draft), 600);
    return () => clearTimeout(t);
  }, [step, mode, answers, scenes, mood, locations, locationPoints, photoUrls, pickedIds, dateStr]);

  function chooseMode(m: FormMode) {
    if (m === 'FREE' && questionsFailed) return;
    setMode(m);
    setWizardStep(0);
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
    setLocationPoints((prev) => prev.filter((p) => p.name !== name));
  }

  /** 지도 시트에서 확정한 장소들을 이름 칩 + 좌표 메타로 병합. */
  // 피커는 initial=현재 locations 전체로 시작하므로, 확정 시 넘어온 바스켓이 '최종 상태'다.
  // → add-only가 아니라 통째로 교체해야 피커에서 뺀 장소가 실제로 빠진다.
  function applyPickedPlaces(places: SelectedPlace[]) {
    const names: string[] = [];
    const points: LocationPoint[] = [];
    const seen = new Set<string>();
    for (const pl of places) {
      const nm = pl.name.trim();
      if (!nm || seen.has(nm)) continue;
      seen.add(nm);
      names.push(nm);
      if (pl.lat != null && pl.lng != null) {
        points.push({ name: nm, lat: pl.lat, lng: pl.lng, category: pl.category });
      }
    }
    setLocations(names);
    setLocationPoints(points);
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

  // 내가 올린 사진 수(미기록=내 새 업로드로 간주). 인당 최대 3장.
  const myPhotoCount = photoUrls.filter((u) => (photoAuthors[bareUrl(u)] ?? 'me') === 'me').length;
  const canAddPhoto = !uploading && myPhotoCount < 3 && photoUrls.length < 6;

  /** 내가 올린 사진만 삭제(상대 사진은 여기서 못 지움). */
  function deleteMyPhoto(url: string) {
    const bare = bareUrl(url);
    setPhotoUrls((prev) => prev.filter((u) => bareUrl(u) !== bare));
    setPhotoAuthors((prev) => {
      const next = { ...prev };
      delete next[bare];
      return next;
    });
  }

  /** 갤러리에서 이미지 선택 → 서버 업로드 → url 목록에 추가(내 사진, 인당 3장 제한). */
  async function pickAndUploadPhoto() {
    if (!canAddPhoto) return;
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
      // 업로드 전 리사이즈/압축 → 파일 크기를 줄여 로딩을 빠르게. (네이티브만)
      let up = { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType };
      if (Platform.OS !== 'web') {
        try {
          const actions =
            asset.width && asset.width > 1440 ? [{ resize: { width: 1440 } }] : [];
          const m = await ImageManipulator.manipulateAsync(asset.uri, actions, {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          up = {
            uri: m.uri,
            fileName: (asset.fileName?.replace(/\.[^.]+$/, '') ?? `photo-${Date.now()}`) + '.jpg',
            mimeType: 'image/jpeg',
          };
        } catch {
          /* 리사이즈 실패 시 원본 업로드 */
        }
      }
      const { url } = await uploadPhoto(up);
      setPhotoUrls((prev) => [...prev, url]);
      setPhotoAuthors((prev) => ({ ...prev, [bareUrl(url)]: 'me' }));
    } catch (e) {
      showAlert('사진 업로드에 실패했어요', errorMessage(e, '연결을 확인하고 다시 시도해 주세요.'));
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
    if (!mood) return false; // 기분 필수
    if (mode === 'FREE' && !fixedQuestions && pickedIds.length !== 3) return false;
    return buildAnswers().length > 0;
  }

  // ── 작성 위저드(단계별 한 화면) ──
  const WIZ = ['mood', 'story', 'photo', 'place'] as const;
  const curStep = WIZ[wizardStep];
  const isLastStep = wizardStep === WIZ.length - 1;

  function storyValid(): boolean {
    if (mode === 'FREE' && !fixedQuestions && pickedIds.length !== 3) return false;
    return buildAnswers().length > 0;
  }
  function stepValid(): boolean {
    if (curStep === 'mood') return !!mood;
    if (curStep === 'story') return storyValid();
    return true; // 사진·장소는 선택(건너뛰기 가능)
  }
  function goNext() {
    if (!stepValid()) {
      setError(
        curStep === 'mood'
          ? '오늘의 기분을 선택해주세요.'
          : mode === 'FREE' && !fixedQuestions && pickedIds.length !== 3
            ? '질문 3개를 골라주세요.'
            : '한 칸 이상 적어주세요.'
      );
      return;
    }
    setError(null);
    setWizardStep((s) => Math.min(s + 1, WIZ.length - 1));
  }
  function goBackStep() {
    if (wizardStep > 0) {
      setError(null);
      setWizardStep((s) => s - 1);
    } else if (!fixedQuestions && !modeLocked) {
      setStep('mode');
    } else {
      router.back();
    }
  }

  async function onSubmit() {
    if (!canSubmit()) {
      if (!mood) {
        setError('오늘의 기분을 선택해주세요.');
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
      // 커플 공유 장소 목록(이름+좌표). 항상 전송해 삭제도 반영.
      places: locations.map((name) => {
        const pt = locationPoints.find((p) => p.name === name);
        return pt ? { name, lat: pt.lat, lng: pt.lng, category: pt.category } : { name };
      }),
      mood: mood ?? undefined,
    };

    try {
      await entryApi.create(dateStr, payload);
      // 저장 성공 → 임시 초안 제거
      await clearDraft(dateStr);
      // 캐시 무효화: 해당 date detail + 그 달 month + 알림 최신화
      invalidateAfterMutation(dateStr);
      router.replace({ pathname: '/entry/[date]', params: { date: dateStr } });
    } catch (e) {
      setError(errorMessage(e, '저장에 실패했어요. 다시 시도해 주세요.'));
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
            <Text style={styles.expiredTitle}>수정 가능 시간(24시간)이 지났어요</Text>
            <Text style={styles.expiredSub}>이미 쓴 일기는 24시간 안에만 고칠 수 있어요.</Text>
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
          <Pressable onPress={() => (step === 'form' ? goBackStep() : router.back())} hitSlop={12}>
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
          <>
            {/* 진행바 */}
            <View style={styles.progWrap}>
              <View style={styles.progTrack}>
                <View style={[styles.progFill, { width: `${((wizardStep + 1) / WIZ.length) * 100}%`, backgroundColor: c.primary }]} />
              </View>
              <Text style={styles.progLabel}>{wizardStep + 1}/{WIZ.length}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 1) 기분 */}
              {curStep === 'mood' ? (
                <>
                  <Text style={styles.stepTitle}>오늘 기분 어땠어?</Text>
                  {MOOD_CATS.map((ct) => (
                    <View key={ct.cat}>
                      <Text style={styles.moodCatLabel}>{ct.label}</Text>
                      <View style={styles.moodCatRow}>
                        {MOODS.filter((m) => m.cat === ct.cat).map((m) => {
                          const on = mood === m.key;
                          const MIcon = m.Icon;
                          return (
                            <Pressable
                              key={m.key}
                              onPress={() => { setMood(m.key); setError(null); }}
                              style={[
                                styles.moodChip,
                                on && { borderColor: c.primary, backgroundColor: `${c.primary}14` },
                              ]}
                            >
                              <MIcon size={20} color={on ? c.primary : colors.subText} strokeWidth={1.7} style={styles.moodIcon} />
                              <Text style={[styles.moodChipLabel, on && { color: c.primary, fontWeight: '700' }]}>{m.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </>
              ) : null}

              {/* 2) 이야기(질문/답변 또는 템플릿) */}
              {curStep === 'story' ? (
                <>
                  <Text style={styles.stepTitle}>
                    {mode === 'TEMPLATE' ? '오늘을 채워볼까?' : fixedQuestions ? '그 순간을 적어줘' : '어떤 이야기를 남길까?'}
                  </Text>
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
                </>
              ) : null}

              {/* 3) 사진(선택) — 필름 스트립. 커플 공용, 인당 최대 3장/총 6장. */}
              {curStep === 'photo' ? (
                <>
                  <Text style={styles.stepTitle}>오늘의 사진</Text>
                  <Text style={styles.stepSub}>
                    {photoUrls.length > 0
                      ? `오늘을 담은 순간들 · 내 사진 ${myPhotoCount}/3`
                      : '선택이에요 · 넘어가도 돼요'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filmStrip}
                    keyboardShouldPersistTaps="handled"
                  >
                    {photoUrls.map((u, i) => {
                      const mineOwn = (photoAuthors[bareUrl(u)] ?? 'me') === 'me';
                      return (
                        <View key={u + i} style={styles.filmCard}>
                          <PhotoThumb url={u} seed={u} size={148} round={false} />
                          {mineOwn ? (
                            <Pressable onPress={() => deleteMyPhoto(u)} style={styles.filmDel} hitSlop={6}>
                              <Icon name="close" size={15} color={colors.white} />
                            </Pressable>
                          ) : (
                            <View style={styles.filmPartner}>
                              <Icon name="person" size={11} color={colors.white} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {uploading ? (
                      <View style={styles.filmAdd}>
                        <ActivityIndicator color={c.primary} />
                      </View>
                    ) : canAddPhoto ? (
                      <Pressable onPress={pickAndUploadPhoto} style={styles.filmAdd}>
                        <Icon name="add" size={30} color={c.primary} />
                        <Text style={[styles.filmAddText, { color: c.primary }]}>추가</Text>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                  {myPhotoCount >= 3 ? (
                    <Text style={styles.photoCapHint}>내 사진은 최대 3장까지 담을 수 있어요</Text>
                  ) : null}
                </>
              ) : null}

              {/* 4) 장소(선택) */}
              {curStep === 'place' ? (
                <>
                  <Text style={styles.stepTitle}>어디 다녀왔어?</Text>
                  <Text style={styles.stepSub}>선택이에요 · 넘어가도 돼요</Text>
                  {/* 검색 먼저: 지도/검색으로 장소 찾기 */}
                  <Pressable style={[styles.placeSearch, { borderColor: c.primary }]} onPress={() => setMapPickerOpen(true)}>
                    <Icon name="search" size={18} color={c.primary} />
                    <Text style={styles.placeSearchText}>장소 검색 (성수동 · 대림창고…)</Text>
                  </Pressable>
                  {/* 최근 함께 간 곳: 원탭 추가 */}
                  {prevLocations.filter((l) => !locations.includes(l)).length > 0 ? (
                    <>
                      <Text style={styles.prevLocLabel}>최근 함께 간 곳 · 탭해서 추가</Text>
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
                  {/* 직접 입력(보조) */}
                  <View style={styles.locationRow}>
                    <Icon name="add-circle-outline" size={18} color={colors.subText} />
                    <TextInput
                      value={locationInput}
                      onChangeText={setLocationInput}
                      onSubmitEditing={() => addLocation(locationInput)}
                      returnKeyType="done"
                      placeholder="여기 없으면 직접 입력"
                      placeholderTextColor={colors.placeholder}
                      style={styles.locationInput}
                    />
                    {locationInput.trim() ? (
                      <Pressable onPress={() => addLocation(locationInput)} hitSlop={8}>
                        <Icon name="checkmark-circle" size={24} color={c.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                  {/* 담은 곳 라인 리스트(← 밀어서 삭제) */}
                  {locations.length > 0 ? (
                    <>
                      <Text style={styles.prevLocLabel}>담은 곳 ({locations.length})</Text>
                      <View style={styles.placeList}>
                        {locations.map((loc) => (
                          <SwipeDeleteRow key={loc} label={loc} onDelete={() => removeLocation(loc)} tint={c.primary} />
                        ))}
                      </View>
                      <Text style={styles.swipeHint}>← 왼쪽으로 밀어 삭제해요</Text>
                    </>
                  ) : null}
                  <Card style={styles.lockNote}>
                    <View style={styles.lockNoteRow}>
                      <Icon name="lock-closed" size={16} color={colors.subText} style={{ marginTop: 2 }} />
                      <Text style={styles.lockNoteText}>
                        저장하면 잠금 상태로 대기해요{'\n'}둘 다 쓰면 서로의 글이 열려요!
                      </Text>
                    </View>
                  </Card>
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            {/* 하단 내비 */}
            <View style={styles.wizFooter}>
              {curStep === 'photo' || curStep === 'place' ? (
                <Pressable
                  onPress={() => (isLastStep ? onSubmit() : setWizardStep((s) => Math.min(s + 1, WIZ.length - 1)))}
                  style={styles.skipBtn}
                  hitSlop={8}
                >
                  <Text style={styles.skipText}>건너뛰기</Text>
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button
                  label={isLastStep ? '저장하고 잠금 대기' : '다음'}
                  icon={isLastStep ? 'lock-closed' : undefined}
                  onPress={isLastStep ? onSubmit : goNext}
                  loading={submitting}
                  disabled={isLastStep ? !canSubmit() : !stepValid()}
                />
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <KakaoMapPicker
        visible={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onConfirm={applyPickedPlaces}
        initial={locations.map((name) => {
          const pt = locationPoints.find((p) => p.name === name);
          return pt ? { name, lat: pt.lat, lng: pt.lng, category: pt.category } : { name };
        })}
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
    <View style={{ marginTop: spacing.md }}>
      <View style={styles.formHeadingRow}>
        <Icon name="help-circle-outline" size={18} color={colors.text} />
        <Text style={styles.formHeading}>누르면 그 자리에서 바로 써요 ({picked.length}/3)</Text>
      </View>
      {questions.length === 0 ? (
        <Text style={styles.error}>질문을 불러오지 못했어요</Text>
      ) : null}
      {/* 리스트 아코디언: 질문 탭 = 선택 + 그 자리 입력 펼침. 최대 3개. */}
      {questions.map((q) => {
        const id = String(q.id);
        const on = picked.includes(id);
        const atMax = !on && picked.length >= 3;
        return (
          <View key={id} style={[styles.accCard, on && { borderColor: c.primary }]}>
            <Pressable onPress={() => onToggle(id)} style={styles.accHead} disabled={atMax}>
              <View style={[styles.accCheck, on && { backgroundColor: c.primary, borderColor: c.primary }]}>
                {on ? <Icon name="checkmark" size={13} color={colors.white} /> : null}
              </View>
              <Text style={[styles.accText, atMax && { color: colors.placeholder }]} numberOfLines={2}>{q.text}</Text>
              <Icon name={on ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.subText} />
            </Pressable>
            {on ? (
              <View style={styles.accBody}>
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
                    placeholder="여기에 적어줘..."
                  />
                )}
              </View>
            ) : null}
          </View>
        );
      })}
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
  title: { ...font.h2 },
  dateSub: { ...font.caption },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  // 위저드
  progWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  progTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 3 },
  progLabel: { ...font.caption, color: colors.subText, fontWeight: '700' },
  stepTitle: { ...font.h1, fontSize: 22, marginTop: spacing.md, marginBottom: spacing.xs },
  stepSub: { ...font.caption, color: colors.subText, marginBottom: spacing.md },
  wizFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  skipBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  skipText: { ...font.body, color: colors.subText, fontWeight: '700' },

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
  // 기분 24개 — 좋아/차분/힘들어 카테고리별 아이콘+라벨 칩.
  moodCatLabel: { ...font.label, color: colors.subText, marginTop: spacing.md, marginBottom: spacing.sm },
  moodCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  moodChipLabel: { ...font.body, fontSize: 14, color: colors.text },
  // Tabler mood 아이콘이 살짝 아래로 보여 광학 보정(위로 1px).
  moodIcon: { transform: [{ translateY: -1 }] },

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
  placeList: { gap: spacing.sm },
  swipeHint: { ...font.caption, color: colors.subText, marginTop: 6, marginLeft: 2 },
  swipeWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.danger },
  swipeDeleteBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  swipeDeleteText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  swipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  swipeRowText: { ...font.body, color: colors.text, flex: 1 },
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

  // 이야기 단계 아코디언(탭=선택=그자리 입력)
  accCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13, paddingHorizontal: spacing.md },
  accCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accText: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
  accBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 2 },

  // 사진 단계 — 필름 스트립
  filmStrip: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.md },
  filmCard: { position: 'relative', borderRadius: radius.md, overflow: 'hidden' },
  filmDel: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(90,64,56,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmPartner: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(90,64,56,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmAdd: {
    width: 100,
    height: 148,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.coralSoft,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.card,
  },
  filmAddText: { ...font.label },
  photoCapHint: { ...font.caption, color: colors.subText, marginTop: spacing.sm },

  // 장소 단계 — 검색 먼저
  placeSearch: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  placeSearchText: { ...font.body, color: colors.placeholder, flex: 1 },
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
