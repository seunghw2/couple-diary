import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, ReactNode, useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setOnUnauthorized } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { useNotifStore } from '../store/useNotifStore';
import { useThemeStore } from '../store/useThemeStore';
import { colors, font, spacing } from '../theme/theme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { status, coupled, bootstrap } = useAuthStore();
  const { loaded: coupleLoaded, refresh: refreshCouple, reset: resetCouple } = useCoupleStore();

  // 앱 로드시 세션 확인 + 401 전역 핸들러 등록(토큰 만료 → 로그인 복귀)
  useEffect(() => {
    setOnUnauthorized(() => {
      useAuthStore.getState().logout();
    });
    bootstrap();
    // 저장된 앱 컬러 복원(로컬).
    void useThemeStore.getState().hydrate();
    return () => setOnUnauthorized(null);
  }, []);

  // 로그인되면 커플 상태 로드, 로그아웃되면 초기화.
  useEffect(() => {
    if (status === 'authenticated') refreshCouple();
    if (status === 'guest') {
      resetCouple();
      useNotifStore.getState().reset();
    }
  }, [status]);

  // 커플 연결되면 알림 조회(연결 직후·복귀 포함). 미연결이면 비움.
  useEffect(() => {
    if (status === 'authenticated' && coupled) void useNotifStore.getState().fetch();
    else useNotifStore.getState().reset();
  }, [status, coupled]);

  // ── 백그라운드 복귀(active) 시: bootstrap 전체 재실행 금지, 데이터만 조용히 refetch ──
  // 증상 방어: 복귀 시 status를 loading/guest로 되돌려 화면이 백지가 되던 문제.
  // bootstrap()은 세션을 unknown/guest로 흔들 수 있으므로 호출하지 않는다.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        // 이미 인증된 상태면 세션은 건드리지 않고 데이터만 조용히 갱신.
        if (useAuthStore.getState().status === 'authenticated') {
          void useCoupleStore.getState().refresh();
          void useNotifStore.getState().fetch();
          // month/detail 캐시는 각 화면의 useFocusEffect가 캐시우선으로 갱신.
        }
      }
    });
    return () => sub.remove();
  }, []);

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

    const connected = coupled;
    // 현재 세그먼트 파악
    const second = segs[1] as string | undefined;
    const onConnectScreen = inAuth && second === 'couple-connect';

    if (!connected) {
      if (!onConnectScreen) router.replace('/(auth)/couple-connect');
    } else if (inAuth) {
      router.replace('/(tabs)');
    }
  }, [status, coupleLoaded, coupled, segments]);

  if (status === 'unknown') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entry/[date]" />
          <Stack.Screen name="write/[date]" />
          <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
          <Stack.Screen name="anniversaries" options={{ presentation: 'card' }} />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ── 최상위 안전 폴백: 렌더 예외로 화면 전체가 백지가 되는 것을 방지 ──
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    // 개발 편의용 로깅. 프로덕션 원격 로깅은 후속.
    console.warn('[ErrorBoundary]', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={[font.title, { textAlign: 'center' }]}>잠깐 문제가 생겼어요</Text>
          <Text style={[font.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
            아래 버튼을 눌러 다시 시도해 주세요.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.primary,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
