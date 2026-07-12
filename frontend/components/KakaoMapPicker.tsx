import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { placeApi, type PlaceResult, type SelectedPlace } from '../lib/api';
import { KAKAO_JS_KEY } from '../lib/config';
import { Icon } from './ui';
import { colors, font, radius, shadow, spacing, useColors } from '../theme/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** "N곳 일기에 넣기" 확정 시 담은 장소들을 넘김. */
  onConfirm: (places: SelectedPlace[]) => void;
  /** 이미 작성화면에 담겨 있는 장소(초기 바스켓/핀 표시). */
  initial?: SelectedPlace[];
};

/** Kakao 콘솔 "JavaScript SDK 도메인"에 등록한 값 — WebView Referer로 사용. */
const MAP_REFERER = 'https://lovetoday-web.terrylovesapp.uk';
/** 위치 권한 거부 시 폴백 중심(서울시청). */
const FALLBACK = { lat: 37.5665, lng: 126.978 };

/** 지도 탭 근처 후보(카테고리 검색 + 건물명). dist=탭 지점 기준 거리(m). */
type NearbyCandidate = PlaceResult & { dist?: number | null };

/** WebView → RN 메시지 계약. */
type WebMessage =
  | { type: 'ready' }
  | { type: 'select'; name: string; address?: string; category?: string; lat?: number; lng?: number }
  | { type: 'longpress'; lat: number; lng: number; address?: string }
  | { type: 'nearby'; lat: number; lng: number; candidates: NearbyCandidate[] }
  | { type: 'error'; message: string };

/** 두 좌표 간 거리(m). */
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function sameName(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/**
 * 지도 + 검색 통합 시트(장소 콕 찍기).
 * - 열릴 때 현재위치 중심(권한 거부 시 서울시청 폴백) + 이미 담은 핀 표시.
 * - 상단 검색바(디바운스) → placeApi.search → 핀 갱신 + 카메라 이동.
 * - 핀 탭 → 장소 카드(거리·주소) → "담기"(멀티선택, 담김✓ 토글).
 * - 롱프레스 → 좌표 코럴 핀 + 역지오코딩 주소 + 이름 입력 → 좌표까지 담기.
 * - 검색 0건 → 이름만 등록 / 이름+지도에서 위치 직접 선택 두 옵션.
 */
export function KakaoMapPicker({ visible, onClose, onConfirm, initial = [] }: Props) {
  const c = useColors();
  const webRef = useRef<WebView>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [netError, setNetError] = useState(false);
  const seq = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [permDenied, setPermDenied] = useState(false);

  // 하단 상태: 담을 후보(핀 탭한 장소) / 롱프레스로 찍은 좌표 / 지도 탭 근처 후보 목록
  const [active, setActive] = useState<SelectedPlace | null>(null);
  const [pinned, setPinned] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [pinnedName, setPinnedName] = useState('');
  const [nearby, setNearby] = useState<{ lat: number; lng: number; candidates: NearbyCandidate[] } | null>(null);

  const [basket, setBasket] = useState<SelectedPlace[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // ── 열릴 때 초기화 + 위치 권한 요청 ──
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setSearched(false);
    setNetError(false);
    setActive(null);
    setPinned(null);
    setPinnedName('');
    setNearby(null);
    setBasket(initial);
    setMapReady(false);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermDenied(true);
          setMe(null);
          return;
        }
        setPermDenied(false);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setPermDenied(true);
        setMe(null);
      }
    })();
    // initial은 열릴 때 스냅샷만 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toWeb = useCallback((obj: unknown) => {
    const js = `window.__handle && window.__handle(${JSON.stringify(obj)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, []);

  // ── 지도 준비되면 현재위치/폴백 + 담은 핀 반영 ──
  useEffect(() => {
    if (!mapReady) return;
    const center = me ?? FALLBACK;
    toWeb({ cmd: 'init', center, hasMe: !!me });
  }, [mapReady, me, toWeb]);

  // 바스켓/후보 바뀌면 담긴 핀(초록) 목록 동기화
  useEffect(() => {
    if (!mapReady) return;
    const added = basket
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }));
    toWeb({ cmd: 'added', added });
  }, [basket, mapReady, toWeb]);

  // ── 디바운스 검색 ──
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      setNetError(false);
      return;
    }
    setSearching(true);
    setNetError(false);
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await placeApi.search(q);
        if (my !== seq.current) return;
        const places = res?.places ?? [];
        // 검색은 목록으로만 보여준다(핀 흩뿌리기·카메라 이동 없음 → 전국 결과로 줌아웃되는 문제 방지).
        setResults(places);
        setSearched(true);
        setNetError(false);
        setActive(null);
        setPinned(null);
        setNearby(null);
      } catch {
        if (my === seq.current) {
          setResults([]);
          setSearched(true);
          setNetError(true);
        }
      } finally {
        if (my === seq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, toWeb]);

  // 토스트 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: WebMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data) as WebMessage;
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      setMapReady(true);
    } else if (msg.type === 'select') {
      setActive({
        name: msg.name,
        address: msg.address,
        category: msg.category,
        lat: msg.lat,
        lng: msg.lng,
      });
      setPinned(null);
      setNearby(null);
    } else if (msg.type === 'longpress') {
      setPinned({ lat: msg.lat, lng: msg.lng, address: msg.address });
      setPinnedName('');
      setActive(null);
      setNearby(null);
    } else if (msg.type === 'nearby') {
      // 지도를 탭한 지점 근처 후보 목록 → 아래 시트에 표시.
      setNearby({ lat: msg.lat, lng: msg.lng, candidates: msg.candidates });
      setActive(null);
      setPinned(null);
    }
  };

  const addedSet = useMemo(() => new Set(basket.map((p) => p.name.trim())), [basket]);

  function toggleBasket(place: SelectedPlace) {
    setBasket((prev) => {
      const exists = prev.find((p) => sameName(p.name, place.name));
      if (exists) return prev.filter((p) => !sameName(p.name, place.name));
      return [...prev, place];
    });
  }

  function addManualPinned() {
    const name = pinnedName.trim();
    if (!name || !pinned) return;
    toggleBasket({
      name,
      address: pinned.address,
      lat: pinned.lat,
      lng: pinned.lng,
      manual: true,
    });
    setPinned(null);
    setPinnedName('');
    setToast(`'${name}' 담았어요`);
  }

  /** 검색 재시도(네트워크 오류 시): seq를 바꿔 디바운스 이펙트 재실행. */
  function retrySearch() {
    setNetError(false);
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    const my = ++seq.current;
    (async () => {
      try {
        const res = await placeApi.search(q);
        if (my !== seq.current) return;
        const places = res?.places ?? [];
        setResults(places);
        setSearched(true);
        setNetError(false);
      } catch {
        if (my === seq.current) setNetError(true);
      } finally {
        if (my === seq.current) setSearching(false);
      }
    })();
  }

  /** 검색 0건: 이름만 등록. */
  function addNameOnly() {
    const name = query.trim();
    if (!name) return;
    toggleBasket({ name });
    setToast(`'${name}' 담았어요`);
    setQuery('');
  }

  /** 검색 결과 목록에서 한 곳 탭 → 담기 토글 + 지도 중심을 그 장소로(줌 고정). */
  function pickFromList(p: PlaceResult) {
    toggleBasket({ name: p.name, address: p.address, category: p.category, lat: p.lat, lng: p.lng });
    if (p.lat != null && p.lng != null) toWeb({ cmd: 'focus', lat: p.lat, lng: p.lng });
  }

  /** 검색 0건: 이름 + 지도에서 위치 직접 선택 → 이름 프리필하고 롱프레스 대기. */
  function startPickOnMap() {
    const name = query.trim();
    setPinnedName(name);
    setToast('지도를 길게 눌러 위치를 찍어주세요');
    setActive(null);
    setNearby(null);
    // 검색 0건 카드(zeroResults)를 숨겨 '위치 찍기' 흐름만 남긴다. 이름은 pinnedName에 보관.
    setQuery('');
    setResults([]);
    setSearched(false);
    // pinned는 롱프레스가 채운다.
  }

  const distanceOf = useCallback(
    (p: { lat?: number; lng?: number }): string | null => {
      if (!me || p.lat == null || p.lng == null) return null;
      return formatDistance(haversine(me, { lat: p.lat, lng: p.lng }));
    },
    [me]
  );

  const html = useMemo(() => buildHtml(KAKAO_JS_KEY), []);

  const zeroResults = searched && !searching && results.length === 0 && !netError && query.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* 상단 검색바 + 헤더 */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 54 : spacing.lg }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
              <Icon name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <View style={styles.searchBox}>
              <Icon name="search" size={18} color={colors.placeholder} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={permDenied ? '장소 이름으로 검색해도 돼요' : '장소 검색 (예: 성수 대림창고)'}
                placeholderTextColor={colors.placeholder}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {searching ? <ActivityIndicator size="small" color={c.primary} /> : null}
              {query.length > 0 && !searching ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Icon name="close-circle" size={18} color={colors.placeholder} />
                </Pressable>
              ) : null}
            </View>
            {/* 담은 장소 N 바스켓 칩 */}
            <View style={[styles.basketChip, { backgroundColor: c.primary }]}>
              <Icon name="location" size={13} color={colors.white} />
              <Text style={styles.basketChipText}>{basket.length}</Text>
            </View>
          </View>
        </View>

        {/* 지도 */}
        <View style={styles.mapWrap}>
          {KAKAO_JS_KEY && Platform.OS !== 'web' ? (
            <WebView
              ref={webRef}
              style={styles.web}
              originWhitelist={['*']}
              source={{ html, baseUrl: MAP_REFERER }}
              onMessage={onMessage}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              mixedContentMode="always"
            />
          ) : (
            <View style={styles.mapFallback}>
              <Icon name="map-outline" size={44} color={c.coralSoft} />
              <Text style={styles.fallbackText}>
                {Platform.OS === 'web'
                  ? '지도는 앱에서 사용할 수 있어요.\n위에서 장소를 검색해 담아 주세요.'
                  : '지도를 보려면 Kakao 키가 필요해요'}
              </Text>
            </View>
          )}

          {/* 로딩 스켈레톤(지도 준비 전) */}
          {!mapReady && KAKAO_JS_KEY && Platform.OS !== 'web' ? (
            <View style={styles.mapLoading} pointerEvents="none">
              <ActivityIndicator color={c.primary} />
              <Text style={styles.mapLoadingText}>지도를 불러오는 중…</Text>
            </View>
          ) : null}

          {/* 토스트 */}
          {toast ? (
            <View style={styles.toast} pointerEvents="none">
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}

          {/* 검색 결과 목록(지도 위 오버레이) — 탭하면 담기 + 지도 중심 이동 */}
          {results.length > 0 ? (
            <View style={styles.listOverlay}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}>
                {results.map((p, i) => {
                  const added = addedSet.has(p.name.trim());
                  const dist = distanceOf(p);
                  return (
                    <Pressable
                      key={`${p.name}-${i}`}
                      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                      onPress={() => pickFromList(p)}
                    >
                      <View style={[styles.listPin, { backgroundColor: c.coralSofter }]}>
                        <Icon name="location" size={16} color={c.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listName} numberOfLines={1}>
                          {p.name}
                          {p.category ? <Text style={styles.listCat}>  {p.category}</Text> : null}
                        </Text>
                        <Text style={styles.listAddr} numberOfLines={1}>
                          {dist ? `${dist} · ` : ''}
                          {p.address}
                        </Text>
                      </View>
                      <Icon
                        name={added ? 'checkmark-circle' : 'add-circle-outline'}
                        size={24}
                        color={added ? '#4CAF7D' : c.primary}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* 하단 시트 */}
        <View style={styles.bottom}>
          {/* 지도 탭 → 근처 후보 목록 (탭하면 담기 + 지도 중심 이동) */}
          {nearby ? (
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={styles.cardTitle}>이 근처 장소</Text>
                <Pressable onPress={() => setNearby(null)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Icon name="close" size={20} color={colors.subText} />
                </Pressable>
              </View>
              {nearby.candidates.length === 0 ? (
                <Text style={styles.cardSub}>
                  이 지점에서 장소를 못 찾았어요. 지도를 길게 눌러 직접 이름으로 담을 수 있어요.
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                  {nearby.candidates.map((p, i) => {
                    const added = addedSet.has(p.name.trim());
                    const dist = p.dist != null ? formatDistance(p.dist) : distanceOf(p);
                    return (
                      <Pressable
                        key={`${p.name}-${i}`}
                        style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                        onPress={() => pickFromList(p)}
                      >
                        <View style={[styles.listPin, { backgroundColor: c.coralSofter }]}>
                          <Icon name="location" size={16} color={c.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listName} numberOfLines={1}>
                            {p.name}
                            {p.category ? <Text style={styles.listCat}>  {p.category}</Text> : null}
                          </Text>
                          <Text style={styles.listAddr} numberOfLines={1}>
                            {dist ? `${dist} · ` : ''}
                            {p.address}
                          </Text>
                        </View>
                        <Icon
                          name={added ? 'checkmark-circle' : 'add-circle-outline'}
                          size={24}
                          color={added ? '#4CAF7D' : c.primary}
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : null}

          {/* E1: 위치 권한 없음 안내(검색은 여전히 가능) */}
          {permDenied && !active && !pinned && !nearby && !zeroResults && !query.trim() ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>지금 위치를 알 수 없어요</Text>
              <Text style={styles.cardSub}>검색하거나 지도를 길게 눌러 직접 찍어보세요.</Text>
            </View>
          ) : null}

          {/* E2: 검색 0건 → 두 옵션 */}
          {zeroResults && !pinned && !nearby && !active ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={1}>‘{query.trim()}’ 못 찾았어요</Text>
              <Text style={styles.cardSub}>카카오맵에 없는 곳이거나 오타일 수 있어요. 어떻게 담을까요?</Text>
              <Pressable style={[styles.optionBtn, { borderColor: c.primary }]} onPress={addNameOnly}>
                <Icon name="text-outline" size={18} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: c.primary }]}>이름만 등록</Text>
                  <Text style={styles.optionDesc}>‘{query.trim()}’를 이름만으로 담기</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.optionBtn, { borderColor: c.primary }]} onPress={startPickOnMap}>
                <Icon name="pin-outline" size={18} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: c.primary }]}>이름 + 지도에서 위치 직접 선택</Text>
                  <Text style={styles.optionDesc}>지도를 길게 눌러 위치를 찍어 담기</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* E3: 검색 네트워크 오류 */}
          {netError && query.trim() && !searching ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>네트워크가 불안정해요</Text>
              <Pressable style={[styles.retryBtn, { borderColor: c.primary }]} onPress={retrySearch}>
                <Icon name="refresh" size={16} color={c.primary} />
                <Text style={[styles.retryText, { color: c.primary }]}>다시 시도</Text>
              </Pressable>
            </View>
          ) : null}

          {/* 롱프레스로 찍은 좌표 → 이름 입력 카드 */}
          {pinned ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>직접 찍은 위치</Text>
              {pinned.address ? <Text style={styles.cardSub}>{pinned.address} 근처</Text> : null}
              <View style={styles.nameInputRow}>
                <Icon name="pencil" size={16} color={colors.subText} />
                <TextInput
                  value={pinnedName}
                  onChangeText={setPinnedName}
                  placeholder="이 곳의 이름 (예: 우리 아지트)"
                  placeholderTextColor={colors.placeholder}
                  style={styles.nameInput}
                  autoFocus
                />
              </View>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: pinnedName.trim() ? c.primary : c.coralSofter }]}
                disabled={!pinnedName.trim()}
                onPress={addManualPinned}
              >
                <Text style={styles.primaryBtnText}>이 이름으로 담기</Text>
              </Pressable>
            </View>
          ) : null}

          {/* 핀 탭 → 장소 카드 */}
          {active && !pinned ? (
            (() => {
              const added = addedSet.has(active.name.trim());
              const dist = distanceOf(active);
              return (
                <View style={styles.card}>
                  <View style={styles.cardHeadRow}>
                    <View style={[styles.pinThumb, { backgroundColor: c.coralSofter }]}>
                      <Icon name="location" size={18} color={c.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>{active.name}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {active.category ? `${active.category} · ` : ''}
                        {dist ? `${dist} · ` : ''}
                        {active.address ?? ''}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: added ? '#4CAF7D' : c.primary },
                    ]}
                    onPress={() => toggleBasket(active)}
                  >
                    <Icon name={added ? 'checkmark' : 'add'} size={18} color={colors.white} />
                    <Text style={styles.primaryBtnText}>{added ? '담김' : '이 장소 담기'}</Text>
                  </Pressable>
                </View>
              );
            })()
          ) : null}

          {/* 확정 버튼 */}
          {basket.length > 0 ? (
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: c.primary }]}
              onPress={() => {
                onConfirm(basket);
                onClose();
              }}
            >
              <Text style={styles.confirmText}>{basket.length}곳 일기에 넣기</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Kakao Maps 지도 + 검색핀 + 담긴핀 + 롱프레스를 처리하는 완결형 HTML. */
function buildHtml(key: string): string {
  const sdkUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: ${colors.bg}; }
    #map { width: 100%; height: 100%; }
    .pin { position: relative; transform: translate(-50%, -100%); cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .pin .dot { font-size: 28px; line-height: 1; color: ${colors.primary}; text-shadow: 0 2px 4px rgba(0,0,0,0.25); }
    .pin.added .dot { color: #4CAF7D; }
    /* 탭 위치 핀: CustomOverlay 앵커(0.5,0.5)로 좌표 중앙에 놓으므로 CSS 이중 오프셋 제거. */
    .pin.active { transform: none; }
    .pin.active .dot { font-size: 36px; }
    .pin .check {
      position: absolute; top: -4px; right: -8px; width: 16px; height: 16px;
      background: #4CAF7D; color: #fff; border-radius: 8px;
      font: 700 11px -apple-system, system-ui, sans-serif; line-height: 16px; text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .me {
      width: 16px; height: 16px; border-radius: 8px; background: #4285F4;
      border: 2px solid #fff; box-shadow: 0 0 0 4px rgba(66,133,244,0.25);
      transform: translate(-50%, -50%);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${sdkUrl}"></script>
  <script>
    (function () {
      function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
      if (!window.kakao || !window.kakao.maps) { post({ type: 'error', message: 'SDK load failed' }); return; }
      kakao.maps.load(function () {
        var map = new kakao.maps.Map(document.getElementById('map'), {
          center: new kakao.maps.LatLng(${FALLBACK.lat}, ${FALLBACK.lng}), level: 5
        });
        var geocoder = new kakao.maps.services.Geocoder();
        var places = new kakao.maps.services.Places();
        // 각 검색핀을 {name, el, overlay}로 보관해 담김(초록) 상태를 이름으로 갱신.
        var resultPins = [], addedNames = {}, meOverlay = null, pickOverlay = null;
        // 롱프레스 직후 따라오는 click 억제 플래그.
        var suppressClick = false;

        function clearPins() { resultPins.forEach(function (r) { r.overlay.setMap(null); }); resultPins = []; }

        function makePin(place) {
          var el = document.createElement('div');
          el.className = addedNames[place.name] ? 'pin added' : 'pin';
          el.innerHTML = '<div class="dot">\\u2665</div><div class="check">\\u2713</div>';
          el.addEventListener('click', function () {
            post({ type: 'select', name: place.name, address: place.address, category: place.category, lat: place.lat, lng: place.lng });
          });
          var overlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(place.lat, place.lng),
            content: el, xAnchor: 0.5, yAnchor: 1.0, clickable: true
          });
          return { name: place.name, el: el, overlay: overlay };
        }

        function renderResults(list) {
          clearPins();
          if (!list || !list.length) return;
          var bounds = new kakao.maps.LatLngBounds();
          list.forEach(function (p) {
            var r = makePin(p); r.overlay.setMap(map); resultPins.push(r);
            bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
          });
          map.setBounds(bounds);
          if (list.length === 1) map.setLevel(4);
        }

        function refreshAdded() {
          resultPins.forEach(function (r) {
            r.el.className = addedNames[r.name] ? 'pin added' : 'pin';
          });
        }

        function setMe(center, hasMe) {
          if (meOverlay) { meOverlay.setMap(null); meOverlay = null; }
          var pos = new kakao.maps.LatLng(center.lat, center.lng);
          map.setCenter(pos);
          if (hasMe) {
            var el = document.createElement('div'); el.className = 'me';
            meOverlay = new kakao.maps.CustomOverlay({ position: pos, content: el, xAnchor: 0.5, yAnchor: 0.5 });
            meOverlay.setMap(map);
          }
        }

        function dropPick(lat, lng) {
          if (pickOverlay) { pickOverlay.setMap(null); pickOverlay = null; }
          var el = document.createElement('div'); el.className = 'pin active';
          el.innerHTML = '<div class="dot">\\u2665</div>';
          // 하트 중앙을 탭한 좌표에 정확히 맞춤(앵커 0.5,0.5 + CSS transform 제거).
          pickOverlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(lat, lng), content: el, xAnchor: 0.5, yAnchor: 0.5
          });
          pickOverlay.setMap(map);
        }

        // 지도 탭 지점 근처 후보 검색: 카테고리(음식/카페/편의점 등 거리순) + 역지오코딩 건물명.
        // 카카오는 라벨 직접 클릭 이벤트를 안 열어줘서, 탭 좌표 주변을 검색해 후보 목록을 만든다.
        var NEARBY_CODES = ['FD6','CE7','CS2','MT1','HP8','PM9','BK9','CT1','AD5','AT4'];
        function nearbySearch(lat, lng) {
          dropPick(lat, lng);
          var loc = new kakao.maps.LatLng(lat, lng);
          var seen = {}, list = [], pending = NEARBY_CODES.length + 1;
          function finish() {
            if (--pending > 0) return;
            list.sort(function (a, b) {
              var da = a.dist == null ? 1e9 : a.dist, db = b.dist == null ? 1e9 : b.dist;
              return da - db;
            });
            post({ type: 'nearby', lat: lat, lng: lng, candidates: list.slice(0, 12) });
          }
          function push(name, address, category, plat, plng, dist) {
            if (!name) return;
            var k = name + '|' + (address || '');
            if (seen[k]) return; seen[k] = true;
            list.push({ name: name, address: address || '', category: category, lat: plat, lng: plng, dist: dist });
          }
          NEARBY_CODES.forEach(function (code) {
            places.categorySearch(code, function (data, status) {
              if (status === kakao.maps.services.Status.OK) {
                data.forEach(function (p) {
                  push(p.place_name,
                       p.road_address_name || p.address_name,
                       p.category_group_name || p.category_name,
                       parseFloat(p.y), parseFloat(p.x),
                       p.distance ? parseInt(p.distance, 10) : null);
                });
              }
              finish();
            }, { location: loc, radius: 100, sort: kakao.maps.services.SortBy.DISTANCE });
          });
          // 오피스텔/타워 등은 category_group_code가 없어 categorySearch에 안 잡히고,
          // 역지오코딩 building_name도 자주 빈다. → 탭 지점의 도로명/지번 주소를 키워드로
          // 검색하면 그 주소의 건물·입점 매장이 잡혀(건물이 0m로 최상단) 후보에 포함된다.
          geocoder.coord2Address(lng, lat, function (res, status) {
            var addr = '';
            if (status === kakao.maps.services.Status.OK && res[0]) {
              var ra = res[0].road_address, ja = res[0].address;
              addr = (ra && ra.address_name) || (ja && ja.address_name) || '';
            }
            if (!addr) { finish(); return; }
            places.keywordSearch(addr, function (data, status2) {
              if (status2 === kakao.maps.services.Status.OK) {
                data.forEach(function (p) {
                  push(p.place_name,
                       p.road_address_name || p.address_name,
                       p.category_group_name || p.category_name,
                       parseFloat(p.y), parseFloat(p.x),
                       p.distance ? parseInt(p.distance, 10) : null);
                });
              }
              finish();
            }, { location: loc, radius: 100, sort: kakao.maps.services.SortBy.DISTANCE });
          });
        }

        // 지도 탭(드래그 아님) → 근처 후보 검색. 롱프레스 직후 click은 억제.
        kakao.maps.event.addListener(map, 'click', function (mouseEvent) {
          if (suppressClick) { suppressClick = false; return; }
          var ll = mouseEvent.latLng;
          nearbySearch(ll.getLat(), ll.getLng());
        });

        // 롱프레스: 카카오 지도는 longclick 미지원 → mousedown/touchstart 타이머로 구현.
        var pressTimer = null, downPos = null;
        var container = document.getElementById('map');
        function longStart(clientX, clientY) {
          pressTimer = setTimeout(function () {
            var proj = map.getProjection();
            var rect = container.getBoundingClientRect();
            var point = new kakao.maps.Point(clientX - rect.left, clientY - rect.top);
            var latlng = proj.coordsFromContainerPoint ? proj.coordsFromContainerPoint(point) : null;
            if (!latlng) { latlng = map.getCenter(); }
            var lat = latlng.getLat(), lng = latlng.getLng();
            dropPick(lat, lng);
            // 롱프레스가 발동하면 뒤따르는 지도 click(근처검색)을 잠시 억제.
            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 800);
            geocoder.coord2Address(lng, lat, function (res, status) {
              var addr;
              if (status === kakao.maps.services.Status.OK && res[0]) {
                addr = (res[0].road_address && res[0].road_address.address_name) ||
                       (res[0].address && res[0].address.address_name) || undefined;
              }
              post({ type: 'longpress', lat: lat, lng: lng, address: addr });
            });
          }, 550);
        }
        function longCancel() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }
        container.addEventListener('touchstart', function (e) {
          if (e.touches && e.touches.length === 1) { var t = e.touches[0]; longStart(t.clientX, t.clientY); }
        }, { passive: true });
        container.addEventListener('touchmove', longCancel, { passive: true });
        container.addEventListener('touchend', longCancel, { passive: true });
        container.addEventListener('mousedown', function (e) { longStart(e.clientX, e.clientY); });
        container.addEventListener('mousemove', longCancel);
        container.addEventListener('mouseup', longCancel);

        window.__handle = function (msg) {
          if (!msg || !msg.cmd) return;
          if (msg.cmd === 'init') { setMe(msg.center, msg.hasMe); }
          else if (msg.cmd === 'results') { renderResults(msg.results); }
          else if (msg.cmd === 'focus') {
            var pos = new kakao.maps.LatLng(msg.lat, msg.lng);
            map.setLevel(4); map.setCenter(pos); dropPick(msg.lat, msg.lng);
          }
          else if (msg.cmd === 'added') {
            addedNames = {}; (msg.added || []).forEach(function (a) { addedNames[a.name] = true; });
            refreshAdded();
          }
        };

        post({ type: 'ready' });
      });
    })();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, ...shadow },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 30, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  basketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: radius.pill,
  },
  basketChipText: { color: colors.white, fontWeight: '800', fontSize: 13 },

  mapWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  listOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xl },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listPin: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  listName: { ...font.title },
  listCat: { ...font.caption, color: colors.subText, fontWeight: '400' },
  listAddr: { ...font.caption, marginTop: 2 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  fallbackText: { ...font.body, color: colors.subText, textAlign: 'center' },
  mapLoading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  mapLoadingText: { ...font.caption, color: colors.subText },
  toast: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  toastText: { color: colors.white, ...font.caption, fontWeight: '600' },

  bottom: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
    ...shadow,
  },
  card: { gap: spacing.sm },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pinThumb: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  cardName: { ...font.title },
  cardMeta: { ...font.caption, marginTop: 2 },
  cardTitle: { ...font.title },
  cardSub: { ...font.caption },

  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionTitle: { ...font.body, fontWeight: '700' },
  optionDesc: { ...font.caption, marginTop: 2 },

  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  nameInput: { flex: 1, ...font.body, color: colors.text, paddingVertical: 0 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
  },
  primaryBtnText: { color: colors.white, ...font.body, fontWeight: '700' },

  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  retryText: { ...font.body, fontWeight: '700' },

  confirmBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: colors.white, ...font.title },
});
