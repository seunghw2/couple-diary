import { API_URL } from './config';

/** 상대경로(/files/...) → 절대 URL. 외부 http 이미지는 그대로. */
export function toFull(url: string): string {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

/**
 * 썸네일 URL. 우리 백엔드가 서빙하는 /files/ 업로드 이미지만 리사이즈 썸네일 엔드포인트로,
 * 외부(DiceBear 등 http) 이미지는 원본 그대로 반환.
 * @param w 목표 가로 px(그리드/리스트용 작은 값 권장)
 */
export function toThumb(url: string, w = 300): string {
  if (!url) return url;
  if (url.startsWith('/files/')) {
    return `${API_URL}/api/photos/thumb?path=${encodeURIComponent(url)}&w=${w}`;
  }
  const full = toFull(url);
  const prefix = `${API_URL}/files/`;
  if (full.startsWith(prefix)) {
    const path = full.slice(API_URL.length); // "/files/xxx.jpg"
    return `${API_URL}/api/photos/thumb?path=${encodeURIComponent(path)}&w=${w}`;
  }
  return full;
}
