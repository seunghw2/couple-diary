import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { authApi } from '../../lib/api';
import { confirmAsync } from '../../lib/dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { Button, Card, Icon } from '../../components/ui';
import { colors, font, radius, spacing } from '../../theme/theme';

/** 내 아바타 색 팔레트(뮤트 웜 16색). */
const AVATAR_COLORS = [
  '#FF8E72', '#FF9E80', '#FFB59E', '#F49BA0',
  '#E98A8A', '#E0A98F', '#D6A16A', '#CBB994',
  '#A8B58F', '#8FB4A0', '#7FB0A8', '#9AB6C9',
  '#A99BC4', '#C29BB8', '#D98CA6', '#C98A8A',
] as const;

/** 숫자만 받아 YYYY-MM-DD 자동 하이픈 마스킹. */
function maskDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** YYYY-MM-DD가 실제 존재하는 날짜인지 검증. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, partner, logout, setUser } = useAuthStore();
  const { couple, setAnniversary } = useCoupleStore();
  const [anniv, setAnniv] = useState(couple?.anniversaryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<string | null>(null);

  const [colorSaving, setColorSaving] = useState(false);

  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [bdaySaving, setBdaySaving] = useState(false);
  const [bdayMsg, setBdayMsg] = useState<string | null>(null);

  async function onPickColor(c: string) {
    if (colorSaving || c === user?.avatarColor) return;
    setColorSaving(true);
    try {
      const updated = await authApi.updateMe({ avatarColor: c });
      setUser(updated); // 즉시 반영
    } catch {
      /* 무시: 다음 시도로 복구 */
    } finally {
      setColorSaving(false);
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
      <ScrollView contentContainerStyle={styles.scroll}>
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
          {nickMsg ? <Text style={styles.msg}>{nickMsg}</Text> : null}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>내 색상</Text>
          <View style={styles.swatchWrap}>
            {AVATAR_COLORS.map((c) => {
              const selected = user?.avatarColor === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => onPickColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, selected && styles.swatchSelected]}
                >
                  {selected ? <Icon name="checkmark" size={18} color={colors.white} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>생일</Text>
          <TextInput
            value={birthday}
            onChangeText={(t) => setBirthday(maskDate(t))}
            placeholder="19960101 → 1996-01-01"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            keyboardType="number-pad"
            maxLength={10}
            style={styles.input}
          />
          {bdayMsg ? <Text style={styles.msg}>{bdayMsg}</Text> : null}
          <Button label="생일 저장" variant="soft" onPress={onSaveBirthday} loading={bdaySaving} style={{ marginTop: spacing.md }} />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>상대</Text>
          <Text style={styles.value}>{partner?.nickname ?? '연결 대기 중'}</Text>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.label}>기념일 (D-day 기준)</Text>
          <TextInput
            value={anniv}
            onChangeText={(t) => setAnniv(maskDate(t))}
            placeholder="20250101 → 2025-01-01"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            keyboardType="number-pad"
            maxLength={10}
            style={styles.input}
          />
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <Button label="기념일 저장" variant="soft" onPress={onSaveAnniv} loading={saving} style={{ marginTop: spacing.md }} />
        </Card>

        <Pressable onPress={() => router.push('/anniversaries')} style={{ marginTop: spacing.lg }}>
          <Card style={styles.linkRow}>
            <View style={styles.linkLeft}>
              <Icon name="gift-outline" size={22} color={colors.primary} />
              <Text style={styles.linkLabel}>기념일 보기</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.subText} />
          </Card>
        </Pressable>

        <Pressable onPress={confirmLogout} style={{ marginTop: spacing.xxl, alignSelf: 'center' }}>
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  title: { ...font.h1 },
  label: { ...font.label, marginBottom: spacing.xs },
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
  msg: { ...font.caption, color: colors.primary, marginTop: spacing.sm },
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
  swatchSelected: { borderColor: colors.text },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkLabel: { ...font.title },
});
