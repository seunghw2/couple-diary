import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { locationApi, type PlaceDetail } from '../lib/api';
import { toThumb } from '../lib/images';
import { formatKoLong, weekdayKo } from '../lib/date';
import { showAlert } from '../lib/dialog';
import { Icon } from '../components/ui';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

/** 지도 > 장소 상세 — 별명 짓기 + 그곳에 갔던 날 일기 모아보기(날짜별 카드). */
export default function PlaceScreen() {
  const router = useRouter();
  const c = useColors();
  const { name } = useLocalSearchParams<{ name: string }>();
  const placeName = name ?? '';

  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 별명 편집 상태
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!placeName) {
      setLoading(false); // 이름 없이 진입 시 무한 스피너 방지
      return;
    }
    try {
      const res = await locationApi.detail(placeName);
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [placeName]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function startEdit() {
    setDraft(detail?.nickname ?? '');
    setEditing(true);
  }

  async function saveNickname() {
    if (saving) return;
    setSaving(true);
    try {
      await locationApi.setNickname(placeName, draft.trim());
      setEditing(false);
      await load();
    } catch {
      showAlert('저장에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  const nickname = detail?.nickname;
  const entries = detail?.entries ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 상단바 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>장소</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 헤더 카드: 원래이름(크게) + 별명 칩(💛) — 칩 탭하면 바텀시트 편집 */}
          <View style={styles.headCard}>
            <View style={[styles.headIcon, { backgroundColor: c.coralSofter }]}>
              <Icon name="heart" size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeTitle} numberOfLines={2}>{placeName}</Text>
              <Pressable onPress={startEdit} hitSlop={6} style={styles.chipTap}>
                {nickname ? (
                  <View style={[styles.nickChip, { backgroundColor: c.coralSofter }]}>
                    <Icon name="heart" size={12} color={c.primary} />
                    <Text style={[styles.nickChipText, { color: c.primary }]} numberOfLines={1}>{nickname}</Text>
                    <Icon name="pencil" size={11} color={c.primary} />
                  </View>
                ) : (
                  <View style={[styles.addChip, { borderColor: c.coralSofter }]}>
                    <Icon name="add" size={13} color={c.primary} />
                    <Text style={[styles.addChipText, { color: c.primary }]}>별명 추가</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* 방문 요약 */}
          <Text style={styles.sectionLabel}>
            함께 간 날 <Text style={{ color: c.primary, fontWeight: '800' }}>{detail?.count ?? entries.length}</Text>일
          </Text>

          {/* 날짜별 일기 카드 목록 */}
          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="calendar-outline" size={40} color={colors.coralSoft} />
              <Text style={styles.emptyText}>이 장소로 남긴 일기가 아직 없어요</Text>
            </View>
          ) : (
            entries.map((e) => (
              <Pressable
                key={e.date}
                style={({ pressed }) => [styles.galleryCard, pressed && { opacity: 0.92 }]}
                onPress={() => router.push({ pathname: '/entry/[date]', params: { date: e.date } })}
              >
                <View style={styles.photoWrap}>
                  {e.thumbUrl ? (
                    <Image
                      source={{ uri: toThumb(e.thumbUrl, 600) }}
                      style={styles.galleryPhoto}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.galleryPhoto, styles.galleryEmpty, { backgroundColor: c.coralSofter }]}>
                      <Icon name="heart" size={30} color={c.primary} />
                    </View>
                  )}
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>
                      {formatKoLong(e.date)} ({weekdayKo(e.date)})
                    </Text>
                  </View>
                </View>
                {e.snippet ? (
                  <Text style={styles.gallerySnippet} numberOfLines={2}>{e.snippet}</Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* 별명 편집 바텀시트 */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.sheetBg} onPress={() => setEditing(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.sheetCard} onPress={() => {}}>
              <Text style={styles.sheetTitle}>이 장소의 별명</Text>
              <Text style={styles.sheetSub}>둘만의 이름을 지어보세요</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="예: 우리 아지트"
                placeholderTextColor={colors.placeholder}
                style={styles.sheetInput}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={saveNickname}
              />
              <View style={styles.sheetBtns}>
                <Pressable onPress={() => setEditing(false)} style={styles.sheetCancel} hitSlop={6}>
                  <Text style={styles.sheetCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={saveNickname}
                  disabled={saving}
                  style={[styles.sheetSave, { backgroundColor: c.primary }]}
                  hitSlop={6}
                >
                  <Text style={styles.sheetSaveText}>{saving ? '저장 중…' : '저장'}</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  topTitle: { ...font.h2 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl * 2 },

  headCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  headIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  placeTitle: { ...font.h1, fontSize: 22 },
  chipTap: { marginTop: 6, alignSelf: 'flex-start' },
  nickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  nickChipText: { ...font.caption, fontWeight: '800', maxWidth: 160 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 10, paddingVertical: 5 },
  addChipText: { ...font.caption, fontWeight: '700' },

  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: spacing.xxl },
  sheetTitle: { ...font.h2, marginBottom: 4 },
  sheetSub: { ...font.caption, color: colors.subText, marginBottom: spacing.md },
  sheetInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
    color: colors.text,
  },
  sheetBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  sheetCancel: { paddingHorizontal: spacing.md, height: 48, justifyContent: 'center' },
  sheetCancelText: { ...font.body, color: colors.subText },
  sheetSave: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sheetSaveText: { ...font.body, fontWeight: '800', color: colors.white },

  editWrap: { flex: 1, gap: spacing.sm },
  editInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: 17,
    color: colors.text,
  },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  editCancel: { paddingHorizontal: spacing.md, height: 36, justifyContent: 'center' },
  editCancelText: { ...font.body, color: colors.subText },
  editSave: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, justifyContent: 'center' },
  editSaveText: { ...font.body, fontWeight: '700', color: colors.white },

  sectionLabel: { ...font.label, color: colors.subText, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.sm },

  // 갤러리형 방문 카드: 큰 사진 + 날짜 오버레이 + 아래 한 줄.
  galleryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    overflow: 'hidden',
    ...shadow,
  },
  photoWrap: { width: '100%', aspectRatio: 16 / 10, position: 'relative' },
  galleryPhoto: { width: '100%', height: '100%' },
  galleryEmpty: { alignItems: 'center', justifyContent: 'center' },
  dateBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dateBadgeText: { ...font.caption, color: colors.white, fontWeight: '800' },
  gallerySnippet: { ...font.body, color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, lineHeight: 20 },

  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },
});
