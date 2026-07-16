import { useEffect, useState } from 'react';
import {
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
import { useRouter } from 'expo-router';
import { authApi } from '../lib/api';
import { confirmAsync, showAlert, showToast } from '../lib/dialog';
import { errorMessage } from '../lib/errors';
import { todayISO, dDay } from '../lib/date';
import { useAuthStore } from '../store/useAuthStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { Button, Card, Icon } from '../components/ui';
import { DatePickerSheet } from '../components/DatePickerSheet';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

/** YYYY-MM-DD가 실제 존재하는 날짜인지 검증. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** 기념일 기준 D-day 라벨(D+n / D-day). */
function ddayLabel(anniv?: string | null): string {
  const n = dDay(anniv);
  if (n == null) return '함께';
  return n >= 0 ? `D+${n}` : `D${n}`;
}

/** 설정 > 내 정보. 닉네임/프로필 컬러/생일/상대/기념일/로그아웃을 한데 모은 화면. */
export default function AccountScreen() {
  const router = useRouter();
  const c = useColors();
  const { user, partner, logout, setUser } = useAuthStore();
  const { couple, setAnniversary } = useCoupleStore();

  const [anniv, setAnniv] = useState(couple?.anniversaryDate ?? '');

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [editingNick, setEditingNick] = useState(false);

  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [bdayPickerOpen, setBdayPickerOpen] = useState(false);
  const [annivPickerOpen, setAnnivPickerOpen] = useState(false);

  // 직접 진입 시 스토어가 늦게 로드돼 필드가 비던 문제 방지: 값이 도착하면 프리필.
  // (스토어 값이 바뀔 때만 동기화 → 사용자가 입력 중인 값은 덮지 않음)
  useEffect(() => {
    if (couple?.anniversaryDate) setAnniv(couple.anniversaryDate);
  }, [couple?.anniversaryDate]);
  useEffect(() => {
    if (user?.birthday) setBirthday(user.birthday);
  }, [user?.birthday]);

  async function onSaveBirthday(value?: string) {
    const v = (value ?? birthday).trim();
    if (!isValidDate(v)) {
      showToast('존재하는 날짜를 골라 주세요.');
      return;
    }
    try {
      const updated = await authApi.updateMe({ birthday: v });
      setUser(updated);
      showToast('저장했어요');
    } catch (e) {
      showToast(errorMessage(e, '저장에 실패했어요.'));
    }
  }

  async function onSaveAnniv(value?: string) {
    const v = (value ?? anniv).trim();
    if (!isValidDate(v)) {
      showToast('존재하는 날짜를 골라 주세요.');
      return;
    }
    try {
      await setAnniversary(v);
      showToast('저장했어요');
    } catch (e) {
      showToast(errorMessage(e, '저장에 실패했어요.'));
    }
  }

  async function onSaveNickname() {
    const v = nickname.trim();
    if (!v) {
      setNickMsg('닉네임을 입력해 주세요.');
      return;
    }
    setNickSaving(true);
    setNickMsg(null);
    try {
      const updated = await authApi.updateMe({ nickname: v });
      setUser(updated);
      setNickMsg(null);
      setEditingNick(false);
    } catch (e) {
      setNickMsg(errorMessage(e, '저장에 실패했어요.'));
    } finally {
      setNickSaving(false);
    }
  }

  async function confirmLogout() {
    const ok = await confirmAsync('로그아웃', '정말 로그아웃할까요?', '로그아웃', true);
    if (ok) logout();
  }

  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteAccount() {
    // 2단계 확인: 실수 삭제 방지. 되돌릴 수 없는 하드 삭제라 강조.
    const first = await confirmAsync(
      '계정 삭제',
      '정말 삭제할까요? 되돌릴 수 없어요. 커플 연결, 일기, 편지, 사진이 모두 사라져요.',
      '삭제',
      true
    );
    if (!first) return;
    const second = await confirmAsync(
      '한 번 더 확인',
      '이 작업은 취소할 수 없어요. 계정을 완전히 삭제할까요?',
      '완전히 삭제',
      true
    );
    if (!second) return;

    setDeleting(true);
    try {
      await authApi.deleteAccount();
      // 서버에서 삭제 완료 → 세션 정리 후 로그인으로. (가드가 /(auth)/login으로 보냄)
      await logout();
    } catch {
      setDeleting(false);
      showAlert('삭제 실패', '계정 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>내 정보</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 프로필 헤더 */}
          <View style={styles.hero}>
            <View style={[styles.avatar, { backgroundColor: user?.avatarColor || c.coralSofter }]}>
              <Text style={styles.avatarText}>{(user?.nickname ?? '?').slice(0, 1)}</Text>
            </View>
            {editingNick ? (
              <View style={styles.nickEdit}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="닉네임"
                  placeholderTextColor={colors.placeholder}
                  maxLength={30}
                  autoFocus
                  style={styles.input}
                />
                {nickMsg ? <Text style={[styles.msg, { color: c.primary }]}>{nickMsg}</Text> : null}
                <View style={styles.nickBtns}>
                  <Button
                    label="취소"
                    variant="soft"
                    onPress={() => {
                      setEditingNick(false);
                      setNickname(user?.nickname ?? '');
                      setNickMsg(null);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button label="저장" onPress={() => onSaveNickname()} loading={nickSaving} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.heroName}>{user?.nickname ?? ''}</Text>
                <Pressable onPress={() => setEditingNick(true)} hitSlop={8} style={styles.editLink}>
                  <Icon name="pencil" size={13} color={c.primary} />
                  <Text style={[styles.editLinkText, { color: c.primary }]}>닉네임 수정</Text>
                </Pressable>
                {partner?.nickname ? (
                  <View style={[styles.dday, { backgroundColor: c.coralSofter }]}>
                    <Text style={[styles.ddayText, { color: c.primary }]}>
                      {partner.nickname}님과 {ddayLabel(anniv || couple?.anniversaryDate)} 💛
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* 정보 리스트 */}
          <View style={styles.group}>
            <Pressable style={styles.li} onPress={() => setBdayPickerOpen(true)}>
              <Text style={styles.liKey}>생일</Text>
              <View style={styles.liRight}>
                <Text style={[styles.liVal, !birthday && { color: colors.placeholder }]}>{birthday || '선택'}</Text>
                <Icon name="chevron-forward" size={18} color={colors.subText} />
              </View>
            </Pressable>
            <Pressable style={[styles.li, styles.liBorder]} onPress={() => setAnnivPickerOpen(true)}>
              <Text style={styles.liKey}>기념일 (D-day 기준)</Text>
              <View style={styles.liRight}>
                <Text style={[styles.liVal, !anniv && { color: colors.placeholder }]}>{anniv || '선택'}</Text>
                <Icon name="chevron-forward" size={18} color={colors.subText} />
              </View>
            </Pressable>
            <View style={[styles.li, styles.liBorder]}>
              <Text style={styles.liKey}>상대</Text>
              <Text style={styles.liVal}>{partner?.nickname ?? '연결 대기 중'}</Text>
            </View>
          </View>

          {/* 계정 */}
          <View style={[styles.group, styles.section]}>
            <Pressable style={styles.li} onPress={confirmLogout}>
              <Text style={styles.liKey}>로그아웃</Text>
              <Icon name="chevron-forward" size={18} color={colors.subText} />
            </Pressable>
            <Pressable style={[styles.li, styles.liBorder]} onPress={confirmDeleteAccount} disabled={deleting}>
              <Text style={[styles.liKey, { color: colors.danger, fontWeight: '700' }]}>
                {deleting ? '삭제 중…' : '계정 삭제'}
              </Text>
              <Icon name="chevron-forward" size={18} color={colors.danger} />
            </Pressable>
          </View>
          <Text style={styles.dangerHint}>계정을 삭제하면 커플 연결과 일기·편지·사진이 모두 사라지고 되돌릴 수 없어요.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerSheet
        visible={bdayPickerOpen}
        value={birthday}
        maxDate={todayISO()}
        title="생일 선택"
        onClose={() => setBdayPickerOpen(false)}
        onConfirm={(d) => {
          setBirthday(d);
          setBdayPickerOpen(false);
          onSaveBirthday(d);
        }}
      />
      <DatePickerSheet
        visible={annivPickerOpen}
        value={anniv}
        maxDate={todayISO()}
        title="기념일 선택"
        onClose={() => setAnnivPickerOpen(false)}
        onConfirm={(d) => {
          setAnniv(d);
          setAnnivPickerOpen(false);
          onSaveAnniv(d);
        }}
      />
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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },

  // 프로필 헤더
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow,
  },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 34, fontWeight: '800', color: colors.white },
  heroName: { ...font.h1, fontSize: 22, marginTop: spacing.md },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  editLinkText: { ...font.label, fontWeight: '700' },
  dday: { marginTop: spacing.md, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  ddayText: { ...font.label, fontWeight: '800' },
  nickEdit: { alignSelf: 'stretch', marginTop: spacing.md },
  nickBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  // 설정 리스트
  group: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.lg, ...require('../theme/theme').shadow },
  li: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 15 },
  liBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  liKey: { ...font.body, fontWeight: '600', color: colors.text },
  liRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liVal: { ...font.body, color: colors.subText },
  section: { marginTop: spacing.lg },
  saveBtn: { marginTop: spacing.md },
  label: { ...font.label, marginBottom: spacing.xs },
  hint: { ...font.caption, marginTop: 2, marginBottom: spacing.xs },
  value: { ...font.title },
  sub: { ...font.caption, marginTop: 2 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  nickBtn: { height: 48, paddingHorizontal: spacing.lg },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.sm,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    marginTop: spacing.sm,
  },
  dateText: { fontSize: 16, color: colors.text },
  msg: { ...font.caption, marginTop: spacing.sm },
  logout: { ...font.body, color: colors.danger, textDecorationLine: 'underline' },
  dangerZone: { marginTop: spacing.xxl, alignItems: 'center' },
  dangerHint: { ...font.caption, color: colors.subText, textAlign: 'center', marginBottom: spacing.md },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    height: 48,
    alignSelf: 'stretch',
  },
  deleteBtnText: { ...font.body, color: colors.white, fontWeight: '700' },
});
