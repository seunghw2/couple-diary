import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/ui';
import { colors, font, spacing } from '../../theme/theme';

/** 지도 탭 — 향후 위치 핀 모아보기(TODO). 지금은 플레이스홀더. */
export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <Icon name="map-outline" size={52} color={colors.coralSoft} style={{ marginBottom: spacing.lg }} />
        <Text style={styles.title}>우리의 지도</Text>
        <Text style={styles.sub}>일기에 남긴 장소들이 여기 모여요{'\n'}(준비 중)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...font.h2 },
  sub: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.sm },
});
