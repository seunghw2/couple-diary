import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { Icon } from '../components/ui';
import { showToast } from '../lib/dialog';
import { errorMessage } from '../lib/errors';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

// 프로필 아바타(귀여운 이모지, 남녀 다양). 16종.
const AVATARS = [
  '👦', '👧', '👨', '👩', '🧑', '🧔', '👱‍♂️', '👱‍♀️',
  '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳', '🧒', '👶',
];

export default function AvatarPickScreen() {
  const c = useColors();
  const { user, setUser } = useAuthStore();
  const [saving, setSaving] = useState<string | null>(null);
  const current = user?.avatar ?? '';

  async function pick(emoji: string) {
    if (saving) return;
    setSaving(emoji);
    try {
      const u = await authApi.updateMe({ avatar: emoji });
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
        <View style={styles.grid}>
          {AVATARS.map((e) => {
            const selected = current === e;
            return (
              <Pressable key={e} onPress={() => pick(e)} style={styles.cell} hitSlop={4}>
                <View
                  style={[
                    styles.circle,
                    { backgroundColor: user?.avatarColor || c.coralSofter },
                    selected && [styles.selected, { borderColor: c.primary }],
                  ]}
                >
                  {saving === e ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.emoji}>{e}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CIRCLE = 68;
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
  hint: { ...font.caption, color: colors.subText, textAlign: 'center', marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
  cell: { width: '25%', alignItems: 'center' },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  selected: { borderWidth: 3 },
  emoji: { fontSize: 36 },
});
