import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing, useColors } from '../theme/theme';

const PHRASES = [
  '생년월일을 살펴보는 중…',
  '천간과 지지를 세우는 중…',
  '오행의 기운을 읽는 중…',
  '인연의 결을 풀이하는 중…',
];

/** 신비로운 점술풍 로딩(최초 진입 3초). Animated 사용, 새 의존성 없음. */
export function SajuLoading({
  onDone,
  duration = 3000,
  label = '사주를 풀이하는 중',
}: {
  onDone: () => void;
  duration?: number;
  label?: string;
}) {
  const c = useColors();
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const prog = useRef(new Animated.Value(0)).current;
  const [phrase, setPhrase] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(spark, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(spark, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(prog, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();

    const step = Math.max(650, Math.floor(duration / PHRASES.length));
    const iv = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), step);
    const t = setTimeout(onDone, duration);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });
  const sparkOpacity = spark.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const progWidth = prog.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] });

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <View style={styles.center}>
        <Animated.View
          style={[styles.ring, { borderColor: c.primary, opacity: ringOpacity, transform: [{ rotate }] }]}
        />
        <Animated.Text style={[styles.orb, { transform: [{ scale }] }]}>🔮</Animated.Text>
        <Animated.Text style={[styles.spark, styles.spark1, { opacity: sparkOpacity }]}>✨</Animated.Text>
        <Animated.Text style={[styles.spark, styles.spark2, { opacity: sparkOpacity }]}>⭐</Animated.Text>
        <Animated.Text style={[styles.spark, styles.spark3, { opacity: sparkOpacity }]}>✨</Animated.Text>
      </View>
      <Text style={[styles.label, { color: c.primary }]}>{label}</Text>
      <Text style={styles.phrase}>{PHRASES[phrase]}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: c.primary, width: progWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  center: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  orb: { fontSize: 78 },
  spark: { position: 'absolute', fontSize: 22 },
  spark1: { top: 6, right: 26 },
  spark2: { bottom: 20, left: 14, fontSize: 18 },
  spark3: { top: 40, left: 4, fontSize: 16 },
  label: { ...font.h2, fontWeight: '800', marginTop: spacing.lg },
  phrase: { ...font.body, color: colors.subText, marginTop: spacing.sm },
  track: {
    width: 200,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1E1DC',
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  fill: { height: '100%', borderRadius: 3 },
});
