/**
 * 풀스크린 사진 뷰어. 여러 장이면 좌우 스와이프, 아래로 스와이프하면 닫힘, 저장 버튼 제공.
 * 일기 상세와 작성 위저드 사진 단계가 함께 쓴다.
 */
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { Directory, File as FsFile, Paths } from 'expo-file-system';
import { API_URL } from '../lib/config';
import { showAlert } from '../lib/dialog';
import { Icon } from './ui';
import { colors, font, radius, spacing } from '../theme/theme';

const DISMISS_THRESHOLD = 120; // 이만큼 아래로 끌면 닫힘
const DISMISS_VELOCITY = 0.8; // 또는 이 속도 이상 아래로 튕기면 닫힘

export type PhotoViewerTarget = { urls: string[]; index: number } | null;

export function PhotoViewer({
  viewer,
  onClose,
}: {
  viewer: PhotoViewerTarget;
  onClose: () => void;
}) {
  const win = Dimensions.get('window');
  // 현재 보이는 사진 인덱스(저장 대상). viewer가 null이 되면 초기화.
  const [index, setIndex] = useState(viewer?.index ?? 0);
  const [saving, setSaving] = useState(false);

  // 저장 완료 토스트 — 전역 토스트는 이 풀스크린 Modal 뒤에 가려지므로 여기 안에서 직접 띄운다.
  const [savedVisible, setSavedVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const showSavedToast = useCallback(() => {
    setSavedVisible(true);
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(
        () => setSavedVisible(false)
      );
    }, 1500);
  }, [toastOpacity]);

  // 세로 드래그 값. 배경 투명도는 이 값에서 파생.
  const translateY = useRef(new Animated.Value(0)).current;
  // FlatList 가로 스크롤과 충돌 방지: 세로 우세일 때만 dismiss 제스처 활성화.
  const panResponder = useRef(
    PanResponder.create({
      // 캡처 단계에서 세로 우세 제스처를 가로 FlatList보다 먼저 가로챈다.
      // (가로 스와이프는 false를 반환해 페이징으로 넘어감)
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        // 아래로만 따라가게(위로 당기면 저항).
        translateY.setValue(g.dy > 0 ? g.dy : g.dy * 0.2);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > DISMISS_VELOCITY) {
          Animated.timing(translateY, {
            toValue: win.height,
            duration: 180,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  if (!viewer) return null;
  const toUri = (u: string) => (u.startsWith('http') ? u : `${API_URL}${u}`);

  // 드래그 거리에 따라 배경이 점점 투명해짐.
  const bgOpacity = translateY.interpolate({
    inputRange: [0, win.height],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  async function onSave() {
    if (saving) return;
    const url = viewer!.urls[index];
    if (!url) return;
    setSaving(true);
    let temp: Awaited<ReturnType<typeof FsFile.downloadFileAsync>> | null = null;
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        showAlert('저장할 수 없어요', '사진 앨범 접근 권한을 허용해 주세요.');
        return;
      }
      // 원격 URL이면 캐시에 내려받은 뒤 저장.
      let localUri = url;
      if (/^https?:\/\//.test(localUri) || !localUri.startsWith('file:')) {
        const remote = toUri(url);
        temp = await FsFile.downloadFileAsync(remote, new Directory(Paths.cache));
        localUri = temp.uri;
      }
      await MediaLibrary.saveToLibraryAsync(localUri);
      showSavedToast();
    } catch {
      showAlert('저장 실패', '사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      try {
        temp?.delete();
      } catch {}
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerRoot}>
        <Animated.View style={[styles.viewerBg, { opacity: bgOpacity }]} />
        <Animated.View
          style={{ flex: 1, transform: [{ translateY }] }}
          {...panResponder.panHandlers}
        >
          <FlatList
            data={viewer.urls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewer.index}
            getItemLayout={(_, i) => ({ length: win.width, offset: win.width * i, index: i })}
            keyExtractor={(u, i) => u + i}
            onMomentumScrollEnd={(e) =>
              setIndex(Math.round(e.nativeEvent.contentOffset.x / win.width))
            }
            renderItem={({ item }) => (
              <View style={{ width: win.width, height: win.height, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={{ uri: toUri(item) }}
                  style={{ width: win.width, height: win.height }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={150}
                />
              </View>
            )}
          />
        </Animated.View>
        {Platform.OS !== 'web' && (
          <Pressable onPress={onSave} style={styles.viewerSave} hitSlop={12} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Icon name="download-outline" size={26} color={colors.white} />
            )}
          </Pressable>
        )}
        <Pressable onPress={onClose} style={styles.viewerClose} hitSlop={12}>
          <Icon name="close" size={28} color={colors.white} />
        </Pressable>

        {savedVisible && (
          <Animated.View pointerEvents="none" style={[styles.viewerToast, { opacity: toastOpacity }]}>
            <Text style={styles.viewerToastText}>이미지 저장이 완료되었습니다.</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewerRoot: { flex: 1 },
  viewerBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerSave: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerToast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(40, 28, 24, 0.92)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  viewerToastText: { ...font.body, color: colors.white },
});
