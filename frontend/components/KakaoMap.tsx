import { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { KAKAO_JS_KEY } from '../lib/config';
import { Icon } from './ui';
import { colors, font, radius, spacing } from '../theme/theme';

type Props = {
  /** 장소 이름 목록(좌표 없음). WebView 안에서 좌표로 변환해 핀 표시. */
  places: string[];
  /** 마커(핀) 탭 시 해당 장소명 전달. */
  onSelectPlace?: (name: string) => void;
};

/** WebView → RN 메시지 계약. */
type WebMessage =
  | { type: 'select'; name: string }
  | { type: 'ready' }
  | { type: 'error'; message: string };

/**
 * Kakao Maps JS SDK(services 라이브러리)를 self-contained HTML로 로드하는 지도.
 * - 각 장소명을 Geocoder(주소)로 변환, 실패 시 Places.keywordSearch로 좌표 획득.
 * - 코럴 하트 CustomOverlay 마커 표시 + 전체 범위 자동 fit.
 * - 마커 탭 → postMessage(select) → onSelectPlace.
 * - KAKAO_JS_KEY 비어 있으면 지도 대신 안내 화면.
 */
export function KakaoMap({ places, onSelectPlace }: Props) {
  const webRef = useRef<WebView>(null);

  const html = useMemo(() => buildHtml(KAKAO_JS_KEY, places), [places]);

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
    } catch {
      // 파싱 실패는 조용히 무시.
    }
  };

  return (
    <WebView
      ref={webRef}
      style={styles.web}
      originWhitelist={['*']}
      source={{ html }}
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

/** 장소 배열 → JS 리터럴(안전 인코딩). */
function toJsArray(places: string[]): string {
  return JSON.stringify(places.filter((p) => typeof p === 'string' && p.trim().length > 0));
}

/** Kakao Maps를 로드·핀 표시하는 완결형 HTML 문자열. */
function buildHtml(key: string, places: string[]): string {
  const placesJson = toJsArray(places);
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
          el.innerHTML = '<div class="pin">\\u2665</div><div class="label"></div>';
          el.querySelector('.label').textContent = name;
          el.addEventListener('click', function () { post({ type: 'select', name: name }); });
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
