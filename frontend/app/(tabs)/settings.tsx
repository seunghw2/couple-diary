import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../lib/api';
import { confirmAsync } from '../../lib/dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { Button, Card } from '../../components/ui';
import { colors, font, radius, spacing } from '../../theme/theme';

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
  const { user, partner, logout, setUser } = useAuthStore();
  const { couple, setAnniversary } = useCoupleStore();
  const [anniv, setAnniv] = useState(couple?.anniversaryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<string | null>(null);

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
});
