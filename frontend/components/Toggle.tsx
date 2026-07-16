import { Pressable, StyleSheet, View } from 'react-native';
import { colors, useColors } from '../theme/theme';

/**
 * 앱 톤 커스텀 토글(클래식 iOS풍). 코럴 트랙 + 흰 노브.
 * RN 기본 Switch가 플랫폼마다 색이 제각각이라 통일 위해 직접 그린다.
 */
export function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.track,
        { backgroundColor: value ? c.primary : colors.border },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 48, height: 28, borderRadius: 999, padding: 2, justifyContent: 'center' },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
});
