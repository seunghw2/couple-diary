import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { locationApi, type PlaceDetail } from '../lib/api';
import { API_URL } from '../lib/config';
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
    if (!placeName) return;
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
          {/* 헤더 카드: 별명(크게) + 장소명(작게) + 편집 */}
          <View style={styles.headCard}>
            <View style={[styles.headIcon, { backgroundColor: c.coralSofter }]}>
              <Icon name="heart" size={22} color={c.primary} />
            </View>

            {editing ? (
              <View style={styles.editWrap}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="별명 (예: 우리 아지트)"
                  placeholderTextColor={colors.placeholder}
                  style={styles.editInput}
                  autoFocus
                  maxLength={30}
                  returnKeyType="done"
                  onSubmitEditing={saveNickname}
                />
                <View style={styles.editBtns}>
                  <Pressable onPress={() => setEditing(false)} style={styles.editCancel} hitSlop={6}>
                    <Text style={styles.editCancelText}>취소</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveNickname}
                    style={[styles.editSave, { backgroundColor: c.primary }]}
                    disabled={saving}
                    hitSlop={6}
                  >
                    <Text style={styles.editSaveText}>{saving ? '저장 중…' : '저장'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {nickname ? (
                  <>
                    <Text style={styles.nickname} numberOfLines={2}>{nickname}</Text>
                    <Text style={styles.placeName} numberOfLines={1}>{placeName}</Text>
                  </>
                ) : (
                  <Text style={styles.nickname} numberOfLines={2}>{placeName}</Text>
                )}
              </View>
            )}

            {!editing && (
              <Pressable onPress={startEdit} hitSlop={8} style={styles.editIconBtn}>
                <Icon name={nickname ? 'pencil' : 'add-circle-outline'} size={20} color={c.primary} />
              </Pressable>
            )}
          </View>
          {!editing && !nickname ? (
            <Text style={styles.nickHint}>연필/＋ 을 눌러 이 장소에 별명을 지어보세요.</Text>
          ) : null}

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
                style={({ pressed }) => [styles.entryCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push({ pathname: '/entry/[date]', params: { date: e.date } })}
              >
                {e.thumbUrl ? (
                  <Image
                    source={{ uri: e.thumbUrl.startsWith('http') ? e.thumbUrl : `${API_URL}${e.thumbUrl}` }}
                    style={styles.thumb}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.coralSofter }]}>
                    <Icon name="heart" size={20} color={c.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryDate}>
                    {formatKoLong(e.date)} ({weekdayKo(e.date)})
                  </Text>
                  {e.snippet ? (
                    <Text style={styles.entrySnippet} numberOfLines={2}>{e.snippet}</Text>
                  ) : (
                    <Text style={[styles.entrySnippet, { color: colors.placeholder }]}>기록을 열어보기</Text>
                  )}
                </View>
                <Icon name="chevron-forward" size={18} color={colors.placeholder} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
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
  nickname: { ...font.h1, fontSize: 24 },
  placeName: { ...font.caption, color: colors.subText, marginTop: 2 },
  editIconBtn: { padding: 4 },
  nickHint: { ...font.caption, color: colors.subText, marginTop: spacing.sm, marginLeft: spacing.sm },

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

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadow,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.border },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  entryDate: { ...font.title },
  entrySnippet: { ...font.caption, color: colors.text, marginTop: 3, lineHeight: 18 },

  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  emptyText: { ...font.body, color: colors.subText, textAlign: 'center' },
});
