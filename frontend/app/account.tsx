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
import { confirmAsync, showAlert } from '../lib/dialog';
import { errorMessage } from '../lib/errors';
import { todayISO } from '../lib/date';
import { useAuthStore } from '../store/useAuthStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { Button, Card, Icon } from '../components/ui';
import { DatePickerSheet } from '../components/DatePickerSheet';
import { colors, font, radius, spacing, useColors } from '../theme/theme';

/** YYYY-MM-DD가 실제 존재하는 날짜인지 검증. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** 설정 > 내 정보. 닉네임/프로필 컬러/생일/상대/기념일/로그아웃을 한데 모은 화면. */
export default function AccountScreen() {
  const router = useRouter();
  const c = useColors();
  const { user, partner, logout, setUser } = useAuthStore();
  const { couple, setAnniversary } = useCoupleStore();

  const [anniv, setAnniv] = useState(couple?.anniversaryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<string | null>(null);

  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [bdaySaving, setBdaySaving] = useState(false);
  const [bdayMsg, setBdayMsg] = useState<string | null>(null);
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

  async function onSaveBirthday() {
    const v = birthday.trim();
    if (!isValidDate(v)) {
      setBdayMsg('존재하는 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setBdaySaving(true);
    setBdayMsg(null);
    try {
      const updated = await authApi.updateMe({ birthday: v });
      setUser(updated);
      setBdayMsg('저장했어요');
    } catch (e) {
      setBdayMsg(errorMessage(e, '저장에 실패했어요.'));
    } finally {
      setBdaySaving(false);
    }
  }

  async function onSaveAnniv() {
    const v = anniv.trim();
    if (!isValidDate(v)) {
      setMsg('존재하는 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await setAnniversary(v);
      setMsg('저장했어요');
    } catch (e) {
      setMsg(errorMessage(e, '저장에 실패했어요.'));
    } finally {
      setSaving(false);
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
      setNickMsg('저장했어요');
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
          <Card>
            <Text style={styles.label}>닉네임</Text>
            <Text style={styles.sub}>{user?.email ?? ''}</Text>
            <View style={styles.nickRow}>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor={colors.placeholder}
                maxLength={30}
                style={[styles.input, { flex: 1, marginTop: 0 }]}
              />
              <Button label="저장" variant="soft" onPress={onSaveNickname} loading={nickSaving} style={styles.nickBtn} />
            </View>
            {nickMsg ? <Text style={[styles.msg, { color: c.primary }]}>{nickMsg}</Text> : null}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>생일</Text>
            <Pressable style={styles.dateField} onPress={() => setBdayPickerOpen(true)}>
              <Text style={[styles.dateText, !birthday && { color: colors.placeholder }]}>
                {birthday || '생일 선택'}
              </Text>
              <Icon name="calendar-outline" size={20} color={c.primary} />
            </Pressable>
            {bdayMsg ? <Text style={[styles.msg, { color: c.primary }]}>{bdayMsg}</Text> : null}
            <Button label="생일 저장" variant="soft" onPress={onSaveBirthday} loading={bdaySaving} style={{ marginTop: spacing.md }} />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>상대</Text>
            <Text style={styles.value}>{partner?.nickname ?? '연결 대기 중'}</Text>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>기념일 (D-day 기준)</Text>
            <Pressable style={styles.dateField} onPress={() => setAnnivPickerOpen(true)}>
              <Text style={[styles.dateText, !anniv && { color: colors.placeholder }]}>
                {anniv || '기념일 선택'}
              </Text>
              <Icon name="calendar-outline" size={20} color={c.primary} />
            </Pressable>
            {msg ? <Text style={[styles.msg, { color: c.primary }]}>{msg}</Text> : null}
            <Button label="기념일 저장" variant="soft" onPress={onSaveAnniv} loading={saving} style={{ marginTop: spacing.md }} />
          </Card>

          <Button
            label="로그아웃"
            variant="soft"
            icon="log-out-outline"
            onPress={confirmLogout}
            style={{ marginTop: spacing.xxl }}
          />

          {/* 계정 삭제 (앱스토어 필수) — 위험 강조. 커플·일기·편지·사진 전부 삭제. */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerHint}>
              계정을 삭제하면 커플 연결과 일기, 편지, 사진이 모두 사라지고 되돌릴 수 없어요.
            </Text>
            <Pressable
              onPress={confirmDeleteAccount}
              disabled={deleting}
              style={({ pressed }) => [styles.deleteBtn, (pressed || deleting) && { opacity: 0.6 }]}
            >
              <Icon name="trash-outline" size={18} color={colors.white} />
              <Text style={styles.deleteBtnText}>{deleting ? '삭제 중…' : '계정 삭제'}</Text>
            </Pressable>
          </View>
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
          setBdayMsg(null);
          setBdayPickerOpen(false);
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
          setMsg(null);
          setAnnivPickerOpen(false);
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
