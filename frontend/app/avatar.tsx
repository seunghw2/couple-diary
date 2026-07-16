import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { Icon } from '../components/ui';
import { AvatarIcon, AVATAR_SECTIONS } from '../components/AvatarIcon';
import { showToast } from '../lib/dialog';
import { errorMessage } from '../lib/errors';
import { colors, font, shadow, spacing, useColors } from '../theme/theme';

export default function AvatarPickScreen() {
  const c = useColors();
  const { user, setUser } = useAuthStore();
  const [saving, setSaving] = useState<string | null>(null);
  const current = user?.avatar ?? '';

  async function pick(value: string) {
    if (saving) return;
    setSaving(value);
    try {
      const u = await authApi.updateMe({ avatar: value });
      setUser(u);
      showToast('프로필 사진을 바꿨어요');
      router.back();
    } catch (e) {
      showToast(errorMessage(e, '변경에 실패했어요'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>프로필 사진</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>귀여운 아이콘 중에서 골라보세요</Text>
        {AVATAR_SECTIONS.map((sec) => (
          <View key={sec.key} style={styles.section}>
            <Text style={styles.secLabel}>{sec.label}</Text>
            <View style={styles.grid}>
              {sec.items.map((value) => {
                const selected = current === value;
                return (
                  <Pressable key={value} onPress={() => pick(value)} style={styles.cell} hitSlop={4}>
                    <View
                      style={[
                        styles.circle,
                        selected && [styles.selected, { borderColor: c.primary, backgroundColor: c.coralSofter }],
                      ]}
                    >
                      {saving === value ? (
                        <ActivityIndicator color={c.primary} />
                      ) : (
                        <AvatarIcon value={value} size={34} color={colors.subText} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const CIRCLE = 66;
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
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  hint: { ...font.caption, color: colors.subText, textAlign: 'center', marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  secLabel: { ...font.body, fontWeight: '800', color: colors.text, marginBottom: spacing.md, marginLeft: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: spacing.md, columnGap: 0 },
  cell: { width: '25%', alignItems: 'center' },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow,
  },
  selected: { borderWidth: 3 },
});
