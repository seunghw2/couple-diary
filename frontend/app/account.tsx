import { useState } from 'react';
import {
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { authApi, uploadPhoto } from '../lib/api';
import { API_URL } from '../lib/config';
import { confirmAsync, showAlert } from '../lib/dialog';
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

  const [photoSaving, setPhotoSaving] = useState(false);

  const profileUri = user?.profileImageUrl
    ? user.profileImageUrl.startsWith('http')
      ? user.profileImageUrl
      : `${API_URL}${user.profileImageUrl}`
    : null;
  const avatarInitial = (user?.nickname ?? '?').trim().charAt(0).toUpperCase() || '?';

  /** 갤러리에서 사진 선택 → 업로드 → /api/me 반영. */
  async function onPickProfile() {
    if (photoSaving) return;
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
      setPhotoSaving(true);
      const { url } = await uploadPhoto({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      const updated = await authApi.updateMe({ profileImageUrl: url });
      setUser(updated);
    } catch {
      showAlert('프로필 사진 변경에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setPhotoSaving(false);
    }
  }

  /** 프로필 사진 삭제(빈 문자열로 초기화). */
  async function onDeleteProfile() {
    if (photoSaving) return;
    const ok = await confirmAsync('프로필 사진 삭제', '프로필 사진을 삭제할까요?', '삭제', true);
    if (!ok) return;
    setPhotoSaving(true);
    try {
      const updated = await authApi.updateMe({ profileImageUrl: '' });
      setUser(updated);
    } catch {
      showAlert('삭제에 실패했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setPhotoSaving(false);
    }
  }

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
    } catch {
      setBdayMsg('저장에 실패했어요.');
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
    } catch {
      setMsg('저장에 실패했어요.');
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
    } catch {
      setNickMsg('저장에 실패했어요.');
    } finally {
      setNickSaving(false);
    }
  }

  async function confirmLogout() {
    const ok = await confirmAsync('로그아웃', '정말 로그아웃할까요?', '로그아웃', true);
    if (ok) logout();
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
          <Card style={styles.photoCard}>
            <Text style={styles.label}>프로필 사진</Text>
            <View style={styles.avatarWrap}>
              {profileUri ? (
                <Image source={{ uri: profileUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: c.primary }]}>
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                </View>
              )}
            </View>
            <View style={styles.photoBtnRow}>
              <Button
                label={profileUri ? '사진 변경' : '사진 추가'}
                variant="soft"
                onPress={onPickProfile}
                loading={photoSaving}
                style={styles.photoBtn}
              />
              {profileUri ? (
                <Button
                  label="삭제"
                  variant="ghost"
                  onPress={onDeleteProfile}
                  disabled={photoSaving}
                  style={styles.photoBtn}
                />
              ) : null}
            </View>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>닉네임</Text>
            <Text style={styles.sub}>{user?.email ?? ''}</Text>
            <View style={styles.nickRow}>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor={colors.placeholder}
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

          <Pressable onPress={confirmLogout} style={{ marginTop: spacing.xxl, alignSelf: 'center' }}>
            <Text style={styles.logout}>로그아웃</Text>
          </Pressable>
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
  photoCard: { alignItems: 'center' },
  avatarWrap: { marginTop: spacing.md, marginBottom: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.border },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 40, fontWeight: '800' },
  photoBtnRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  photoBtn: { flex: 1, height: 48, paddingHorizontal: spacing.lg },
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
});
