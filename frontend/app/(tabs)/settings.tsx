import { useRef, useState } from 'react';
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
import { authApi } from '../../lib/api';
import { confirmAsync } from '../../lib/dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Button, Card, Icon } from '../../components/ui';
import { DatePickerSheet } from '../../components/DatePickerSheet';
import { todayISO } from '../../lib/date';
import { colors, font, radius, spacing, useColors } from '../../theme/theme';

/** 내 아바타/앱 색 팔레트(뮤트 웜 18색). */
const AVATAR_COLORS = [
  '#FF8E72', '#FF9E80', '#FFB59E', '#F49BA0',
  '#E98A8A', '#E0A98F', '#D6A16A', '#CBB994',
  '#E3B23C', '#B0857A', '#A8B58F', '#8FB4A0',
  '#7FB0A8', '#9AB6C9', '#A99BC4', '#C29BB8',
  '#D98CA6', '#C98A8A',
] as const;

/** 숫자만 받아 YYYY-MM-DD 자동 하이픈 마스킹. */
/** YYYY-MM-DD가 실제 존재하는 날짜인지 검증. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const { user, partner, logout, setUser } = useAuthStore();
  const { couple, setAnniversary } = useCoupleStore();
  const appPrimary = useThemeStore((s) => s.appPrimary);
  const setAppPrimary = useThemeStore((s) => s.setAppPrimary);

  const scrollRef = useRef<ScrollView>(null);

  const [anniv, setAnniv] = useState(couple?.anniversaryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<string | null>(null);

  // 색상: 탭하면 "선택" 상태만 되고, 두 버튼 중 하나로 적용.
  const [selectedColor, setSelectedColor] = useState<string>(user?.avatarColor ?? appPrimary);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorMsg, setColorMsg] = useState<string | null>(null);

  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [bdaySaving, setBdaySaving] = useState(false);
  const [bdayMsg, setBdayMsg] = useState<string | null>(null);
  const [bdayPickerOpen, setBdayPickerOpen] = useState(false);
  const [annivPickerOpen, setAnnivPickerOpen] = useState(false);

  /** 포커스된 입력을 키보드 위로 스크롤. */
  async function onApplyProfileColor() {
    if (colorSaving || selectedColor === user?.avatarColor) return;
    setColorSaving(true);
    setColorMsg(null);
    try {
      const updated = await authApi.updateMe({ avatarColor: selectedColor });
      setUser(updated); // 내 일기 색 즉시 반영
      setColorMsg('프로필 컬러를 바꿨어요');
    } catch {
      setColorMsg('프로필 컬러 변경에 실패했어요.');
    } finally {
      setColorSaving(false);
    }
  }

  function onApplyAppColor() {
    setAppPrimary(selectedColor); // 로컬 앱 테마 primary 즉시 반영
    setColorMsg('앱 컬러를 바꿨어요');
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

  const isProfileColor = selectedColor === user?.avatarColor;
  const isAppColor = selectedColor === appPrimary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>설정</Text>

          <Card style={{ marginTop: spacing.xl }}>
            <Text style={styles.label}>내 정보</Text>
            <Text style={styles.sub}>{user?.email ?? ''}</Text>
            <View style={styles.nickRow}>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, { flex: 1, marginTop: 0 }]}
              />
              <Button
                label="저장"
                variant="soft"
                onPress={onSaveNickname}
                loading={nickSaving}
                style={styles.nickBtn}
              />
            </View>
            {nickMsg ? <Text style={[styles.msg, { color: c.primary }]}>{nickMsg}</Text> : null}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.label}>내 색상</Text>
            <Text style={styles.hint}>
              스와치를 고른 뒤 아래 버튼으로 적용하세요. 프로필 컬러는 상대 화면의 내 일기 색,
              앱 컬러는 내 기기의 앱 강조색이에요.
            </Text>
            <View style={styles.swatchWrap}>
              {AVATAR_COLORS.map((sw) => {
                const selected = selectedColor === sw;
                const isProfile = user?.avatarColor === sw;
                const isApp = appPrimary === sw;
                return (
                  <Pressable
                    key={sw}
                    onPress={() => setSelectedColor(sw)}
                    style={[
                      styles.swatch,
                      { backgroundColor: sw },
                      selected && [styles.swatchSelected, { borderColor: colors.text }],
                    ]}
                  >
                    {selected ? <Icon name="checkmark" size={18} color={colors.white} /> : null}
                    {(isProfile || isApp) && !selected ? <View style={styles.swatchDot} /> : null}
                  </Pressable>
                );
              })}
            </View>

            {/* 현재 적용값 표시 */}
            <View style={styles.currentRow}>
              <View style={styles.currentItem}>
                <View style={[styles.currentDot, { backgroundColor: user?.avatarColor ?? colors.primary }]} />
                <Text style={styles.currentLabel}>현재 프로필</Text>
              </View>
              <View style={styles.currentItem}>
                <View style={[styles.currentDot, { backgroundColor: appPrimary }]} />
                <Text style={styles.currentLabel}>현재 앱 컬러</Text>
              </View>
            </View>

            <View style={styles.colorBtnRow}>
              <Button
                label="프로필 컬러 적용"
                variant="soft"
                onPress={onApplyProfileColor}
                loading={colorSaving}
                disabled={isProfileColor}
                style={styles.colorBtn}
              />
              <Button
                label="앱 컬러 적용"
                onPress={onApplyAppColor}
                disabled={isAppColor}
                style={styles.colorBtn}
              />
            </View>
            {colorMsg ? <Text style={[styles.msg, { color: c.primary }]}>{colorMsg}</Text> : null}
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

          <Pressable onPress={() => router.push('/anniversaries')} style={{ marginTop: spacing.lg }}>
            <Card style={styles.linkRow}>
              <View style={styles.linkLeft}>
                <Icon name="gift-outline" size={22} color={c.primary} />
                <Text style={styles.linkLabel}>기념일 보기</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push('/bug-reports')} style={{ marginTop: spacing.lg }}>
            <Card style={styles.linkRow}>
              <View style={styles.linkLeft}>
                <Icon name="bug-outline" size={22} color={c.primary} />
                <Text style={styles.linkLabel}>버그 리포트</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.subText} />
            </Card>
          </Pressable>

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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  title: { ...font.h1 },
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
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderWidth: 3 },
  swatchDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  currentRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  currentItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  currentDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  currentLabel: { ...font.caption },
  colorBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  colorBtn: { flex: 1, height: 48, paddingHorizontal: spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkLabel: { ...font.title },
});
