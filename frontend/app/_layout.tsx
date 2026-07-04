import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { colors } from '../theme/theme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { status, bootstrap } = useAuthStore();
  const { couple, loaded: coupleLoaded, refresh: refreshCouple, reset: resetCouple } = useCoupleStore();

  // 앱 로드시 세션 확인
  useEffect(() => {
    bootstrap();
  }, []);

  // 로그인되면 커플 상태 로드, 로그아웃되면 초기화
  useEffect(() => {
    if (status === 'authenticated') refreshCouple();
    if (status === 'guest') resetCouple();
  }, [status]);

  // 라우팅 가드
  useEffect(() => {
    if (status === 'unknown') return;
    const segs = segments as string[];
    const first = segs[0] as string | undefined;
    const inAuth = first === '(auth)';

    if (status === 'guest') {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // authenticated: 커플 상태 확정 전에는 대기
    if (!coupleLoaded) return;

    const connected = couple?.connected === true;
    // 현재 세그먼트 파악
    const second = segs[1] as string | undefined;
    const onConnectScreen = inAuth && second === 'couple-connect';

    if (!connected) {
      if (!onConnectScreen) router.replace('/(auth)/couple-connect');
    } else if (inAuth) {
      router.replace('/(tabs)');
    }
  }, [status, coupleLoaded, couple?.connected, segments]);

  if (status === 'unknown') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry/[date]" />
        <Stack.Screen name="write/[date]" />
      </Stack>
    </SafeAreaProvider>
  );
}
