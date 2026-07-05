import { ComponentProps, ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Button, Card, Icon } from '../../components/ui';
import { colors, font, radius, spacing, useColors } from '../../theme/theme';

/** 내 아바타/앱 색 팔레트(뮤트 웜 18색). */
const AVATAR_COLORS = [
  '#FF8E72', '#FF9E80', '#FFB59E', '#F49BA0',
  '#E98A8A', '#E0A98F', '#D6A16A', '#CBB994',
  '#E3B23C', '#B0857A', '#A8B58F', '#8FB4A0',
  '#7FB0A8', '#9AB6C9', '#A99BC4', '#C29BB8',
  '#D98CA6', '#C98A8A',
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const { user, partner, setUser } = useAuthStore();
  const appPrimary = useThemeStore((s) => s.appPrimary);
  const setAppPrimary = useThemeStore((s) => s.setAppPrimary);

  // 색상: 스와치를 고른 뒤 두 버튼 중 하나로 적용(프로필=서버, 앱=로컬).
  const [selectedColor, setSelectedColor] = useState<string>(user?.avatarColor ?? appPrimary);
  const [colorSaving, setColorSaving] = useState(false);
  const [colorMsg, setColorMsg] = useState<string | null>(null);

  const initial = (user?.nickname ?? '?').trim().charAt(0) || '?';
  const isProfileColor = selectedColor === user?.avatarColor;
  const isAppColor = selectedColor === appPrimary;

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>설정</Text>

        {/* 프로필 헤더 → 내 정보 */}
        <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [pressed && styles.pressed]}>
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? c.primary }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.nickname ?? '나'}</Text>
              <Text style={styles.profileSub}>
                {partner?.nickname ? `${partner.nickname}님과 연결됨` : '내 정보 · 로그아웃'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.subText} />
          </View>
        </Pressable>

        {/* 링크 그룹 */}
        <Text style={styles.groupLabel}>더 보기</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon="gift-outline"
            tint={c.primary}
            label="기념일 보기"
            onPress={() => router.push('/anniversaries')}
          />
          <Divider />
          <SettingsRow
            icon="bulb-outline"
            tint={c.primary}
            label="피드백"
            onPress={() => router.push('/bug-reports')}
            last
          />
        </View>

        {/* 색상(맨 아래) — 프로필 컬러 + 앱 컬러 통합 */}
        <Text style={styles.groupLabel}>색상</Text>
        <Card>
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
      </ScrollView>
    </SafeAreaView>
  );
}

/** 애플 설정 스타일 행: 좌측 컬러 아이콘 + 라벨 + 우측 값/셰브런. */
function SettingsRow({
  icon,
  tint,
  label,
  value,
  onPress,
  last,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  tint: string;
  label: string;
  value?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={17} color={colors.white} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {typeof value === 'string' ? <Text style={styles.rowValue}>{value}</Text> : value}
        <Icon name="chevron-forward" size={18} color={colors.subText} />
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 },
  title: { ...font.h1 },
  pressed: { opacity: 0.6 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  profileName: { ...font.h2 },
  profileSub: { ...font.caption, color: colors.subText, marginTop: 2 },

  groupLabel: { ...font.caption, color: colors.subText, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.sm },
  groupCard: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  rowLast: {},
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...font.body, flex: 1, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...font.body, color: colors.subText },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 56 },

  hint: { ...font.caption, marginBottom: spacing.sm },
  msg: { ...font.caption, marginTop: spacing.sm },
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
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
});
