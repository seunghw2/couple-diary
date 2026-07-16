import { useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { KAKAO_JS_KEY } from '../lib/config';
import { Icon } from './ui';
import { colors, font, radius, spacing } from '../theme/theme';

type Props = {
  /** 장소 이름 목록(좌표 없음). WebView 안에서 좌표로 변환해 핀 표시. */
  places: string[];
  /** 장소별 방문 일수. 2 이상이면 핀에 숫자 뱃지 표시. */
  counts?: Record<string, number>;
  /** 마커(핀) 탭 시 해당 장소명 전달. */
  onSelectPlace?: (name: string) => void;
  /** 지도 빈 곳 탭 시(마커 아님) — 선택 해제용. */
  onDeselect?: () => void;
};

/** Kakao 콘솔 "JavaScript SDK 도메인"에 등록한 값 — WebView Referer로 사용. */
const MAP_REFERER = 'https://lovetoday-web.terrylovesapp.uk';

/** WebView → RN 메시지 계약. */
type WebMessage =
  | { type: 'select'; name: string }
  | { type: 'deselect' }
  | { type: 'ready' }
  | { type: 'error'; message: string };

/**
 * Kakao Maps JS SDK(services 라이브러리)를 self-contained HTML로 로드하는 지도.
 * - 각 장소명을 Geocoder(주소)로 변환, 실패 시 Places.keywordSearch로 좌표 획득.
 * - 코럴 하트 CustomOverlay 마커 표시 + 전체 범위 자동 fit.
 * - 마커 탭 → postMessage(select) → onSelectPlace.
 * - KAKAO_JS_KEY 비어 있으면 지도 대신 안내 화면.
 */
export function KakaoMap({ places, counts, onSelectPlace, onDeselect }: Props) {
  const webRef = useRef<WebView>(null);

  const html = useMemo(() => buildHtml(KAKAO_JS_KEY, places, counts ?? {}), [places, counts]);

  // 웹은 react-native-webview 미지원 → Kakao 지도 렌더 불가. 리스트로 보라는 안내.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallback}>
        <Icon name="map-outline" size={48} color={colors.coralSoft} style={{ marginBottom: spacing.md }} />
        <Text style={styles.fallbackTitle}>지도는 앱에서 볼 수 있어요</Text>
        <Text style={styles.fallbackSub}>웹에서는 지도가 표시되지 않아요.{'\n'}아래 ‘리스트’로 장소를 확인해 주세요.</Text>
      </View>
    );
  }

  if (!KAKAO_JS_KEY) {
    return (
      <View style={styles.fallback}>
        <Icon name="map-outline" size={48} color={colors.coralSoft} style={{ marginBottom: spacing.md }} />
        <Text style={styles.fallbackTitle}>지도를 보려면 Kakao 키가 필요해요</Text>
        <Text style={styles.fallbackSub}>
          developers.kakao.com에서 JavaScript 키를 발급받아{'\n'}app.json의 extra.kakaoJsKey에 넣어 주세요.
        </Text>
      </View>
    );
  }

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as WebMessage;
      if (msg.type === 'select' && msg.name) onSelectPlace?.(msg.name);
      else if (msg.type === 'deselect') onDeselect?.();
    } catch {
      // 파싱 실패는 조용히 무시.
    }
  };

  return (
    <WebView
      ref={webRef}
      style={styles.web}
      originWhitelist={['*']}
      // Kakao Maps JS SDK는 요청 Referer의 도메인을 화이트리스트와 대조한다.
      // source.html만 주면 origin이 about:blank라 거부되므로, 카카오 콘솔에
      // 등록한 도메인을 baseUrl로 지정해 Referer를 맞춘다.
      source={{ html, baseUrl: MAP_REFERER }}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      // iOS에서 지도 제스처가 부드럽게 동작하도록.
      scrollEnabled={false}
      // 지도 SDK가 mixed content(http)로 뜨는 것을 허용(Android).
      mixedContentMode="always"
    />
  );
}

/** JSON을 인라인 <script>에 안전하게 삽입(장소명에 </script> 등 포함 시 태그 탈출 방지). */
function safeJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

/** 장소 배열 → JS 리터럴(안전 인코딩). */
function toJsArray(places: string[]): string {
  return safeJson(places.filter((p) => typeof p === 'string' && p.trim().length > 0));
}

/** Kakao Maps를 로드·핀 표시하는 완결형 HTML 문자열. */
function buildHtml(key: string, places: string[], counts: Record<string, number>): string {
  const placesJson = toJsArray(places);
  const countsJson = safeJson(counts ?? {});
  const sdkUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: ${colors.bg}; }
    #map { width: 100%; height: 100%; }
    .heart {
      position: relative;
      transform: translate(-50%, -100%);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .heart .pin {
      font-size: 30px;
      line-height: 1;
      color: ${colors.primary};
      text-shadow: 0 2px 4px rgba(0,0,0,0.25);
    }
    .heart .badge {
      position: absolute;
      top: -6px;
      right: -8px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      box-sizing: border-box;
      background: ${colors.text};
      color: #fff;
      border-radius: 9px;
      font: 700 11px -apple-system, system-ui, sans-serif;
      line-height: 18px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .heart .label {
      position: absolute;
      left: 50%;
      top: 100%;
      transform: translateX(-50%);
      margin-top: 2px;
      background: ${colors.card};
      color: ${colors.text};
      font: 600 12px -apple-system, system-ui, sans-serif;
      padding: 3px 8px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    #empty {
      position: absolute; inset: 0; display: none;
      align-items: center; justify-content: center;
      color: ${colors.subText};
      font: 400 15px -apple-system, system-ui, sans-serif;
      text-align: center; padding: 24px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="empty">아직 지도에 표시할 장소가 없어요</div>
  <script src="${sdkUrl}"></script>
  <script>
    (function () {
      var PLACES = ${placesJson};
      var COUNTS = ${countsJson};
      function post(obj) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch (e) {}
      }
      if (!window.kakao || !window.kakao.maps) {
        post({ type: 'error', message: 'SDK load failed' });
        document.getElementById('empty').style.display = 'flex';
        document.getElementById('empty').textContent = '지도를 불러오지 못했어요 (키/도메인 확인)';
        return;
      }
      kakao.maps.load(function () {
        var container = document.getElementById('map');
        // 기본 중심: 서울 시청(핀이 하나도 안 잡힐 때 폴백).
        var map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 8
        });
        // 마커 탭 직후 따라오는 map click(빈곳 탭=해제)을 억제하는 플래그.
        var suppressDeselect = false;
        // 지도 빈 곳 탭 → 선택 해제.
        kakao.maps.event.addListener(map, 'click', function () {
          if (suppressDeselect) { suppressDeselect = false; return; }
          post({ type: 'deselect' });
        });
        post({ type: 'ready' });

        if (!PLACES.length) {
          document.getElementById('empty').style.display = 'flex';
          return;
        }

        var geocoder = new kakao.maps.services.Geocoder();
        var places = new kakao.maps.services.Places();
        var bounds = new kakao.maps.LatLngBounds();
        var pinned = 0;
        var pending = PLACES.length;

        function addPin(name, lat, lng) {
          var pos = new kakao.maps.LatLng(lat, lng);
          var el = document.createElement('div');
          el.className = 'heart';
          var cnt = COUNTS[name] || 0;
          var badge = cnt >= 2 ? '<div class="badge"></div>' : '';
          el.innerHTML = '<div class="pin">\\u2665</div>' + badge + '<div class="label"></div>';
          el.querySelector('.label').textContent = name;
          if (cnt >= 2) el.querySelector('.badge').textContent = String(cnt);
          el.addEventListener('click', function () {
            suppressDeselect = true;
            setTimeout(function () { suppressDeselect = false; }, 400);
            post({ type: 'select', name: name });
          });
          var overlay = new kakao.maps.CustomOverlay({
            position: pos, content: el, xAnchor: 0.5, yAnchor: 1.0, clickable: true
          });
          overlay.setMap(map);
          bounds.extend(pos);
          pinned++;
        }

        function done() {
          pending--;
          if (pending > 0) return;
          if (pinned > 0) {
            map.setBounds(bounds);
            // 핀이 하나뿐이면 setBounds가 과도확대 → 레벨 보정.
            if (pinned === 1) map.setLevel(5);
          } else {
            document.getElementById('empty').style.display = 'flex';
          }
        }

        // 주소 지오코딩 실패 시 키워드 검색으로 폴백.
        function resolve(name) {
          geocoder.addressSearch(name, function (result, status) {
            if (status === kakao.maps.services.Status.OK && result[0]) {
              addPin(name, parseFloat(result[0].y), parseFloat(result[0].x));
              done();
            } else {
              places.keywordSearch(name, function (data, kstatus) {
                if (kstatus === kakao.maps.services.Status.OK && data[0]) {
                  addPin(name, parseFloat(data[0].y), parseFloat(data[0].x));
                }
                done();
              });
            }
          });
        }

        PLACES.forEach(resolve);
      });
    })();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.bg },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  fallbackTitle: { ...font.title, textAlign: 'center' },
  fallbackSub: { ...font.body, color: colors.subText, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
});
