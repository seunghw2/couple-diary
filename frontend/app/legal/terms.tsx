import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/ui';
import { colors, font, spacing } from '../../theme/theme';

/**
 * 이용약관 (앱스토어 필수). 지금은 뼈대 + placeholder 본문.
 * TODO(문구): 아래 BODY 텍스트를 확정된 전문으로 교체하거나,
 *   원격 URL(예: https://.../terms)로 WebView/Linking 대체 가능.
 *   법률 문구 파일은 docs 쪽에서 별도 작성 중.
 */
const BODY = '여기에 이용약관 전문';

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-back" size={28} color={colors.subText} />
        </Pressable>
        <Text style={styles.topTitle}>이용약관</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{BODY}</Text>
      </ScrollView>
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
  body: { ...font.body, color: colors.text, lineHeight: 24 },
});
