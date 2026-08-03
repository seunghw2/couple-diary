/**
 * 장소 식별·이름 정리 로직. 지도 피커와 작성 화면이 함께 쓴다.
 *
 * 배경: 장소는 서버에 "이름"으로 저장된다. 그래서 이름만으로 같고 다름을 따지면
 * 이름이 같은 다른 지점(같은 상호의 두 지점)이 한 곳으로 묶여 같이 담기고 같이 빠졌다.
 * 고르는 동안에는 좌표로 구분하고, 저장할 이름은 지역을 붙여 서로 다르게 만든다.
 */
import type { LocationPoint, SelectedPlace } from './api';

/**
 * 장소 식별키. 좌표가 있으면 좌표로만 구분한다(소수점 5자리 ≈ 1m).
 * 좌표를 기준으로 삼는 이유: 담은 뒤 이름 뒤에 지역이 붙어도(같은 이름 구분용)
 * 지도를 다시 열었을 때 "이미 담긴 곳"으로 그대로 인식돼야 하기 때문.
 */
export function placeKey(p: { name: string; lat?: number | null; lng?: number | null }): string {
  if (p.lat == null || p.lng == null) return p.name.trim();
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

/**
 * 주소에서 지역 조각 하나를 뽑는다. "서울 성동구 성수이로 78" → "성동구".
 * 뒤에서부터 찾아 가장 좁은 지역을 고르고, 도로명("성수이로")이나 번지는 걸러진다.
 */
export function areaHint(address?: string | null): string | null {
  if (!address) return null;
  const tokens = address.trim().split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.length >= 2 && !/^\d/.test(t) && /[동구시읍면군]$/.test(t)) return t;
  }
  return null;
}

/**
 * 지도에서 확정한 장소들 → 저장할 이름 목록 + 좌표 메타.
 * - 같은 좌표는 한 번만 담는다.
 * - 이름이 겹치는 곳이 둘 이상이면 "이름 (지역)"으로, 지역까지 같으면 뒤에 순번을 붙인다.
 */
export function mergePickedPlaces(places: SelectedPlace[]): {
  names: string[];
  points: LocationPoint[];
} {
  const names: string[] = [];
  const points: LocationPoint[] = [];

  // 같은 좌표를 두 번 담은 건 먼저 걸러낸다. (이름 세기 전에 걸러야 한 곳뿐인데
  // 이름이 겹친 것으로 보여 쓸데없이 지역이 붙는 일이 없다.)
  const seen = new Set<string>();
  const unique: SelectedPlace[] = [];
  for (const pl of places) {
    if (!pl.name.trim()) continue;
    const key = placeKey(pl);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(pl);
  }

  const nameCount = new Map<string, number>();
  for (const pl of unique) {
    const nm = pl.name.trim();
    nameCount.set(nm, (nameCount.get(nm) ?? 0) + 1);
  }

  const used = new Set<string>();
  for (const pl of unique) {
    const base = pl.name.trim();
    let nm = base;
    if ((nameCount.get(base) ?? 0) > 1) {
      const area = areaHint(pl.address);
      if (area) nm = `${base} (${area})`;
    }
    if (used.has(nm)) {
      let i = 2;
      while (used.has(`${nm} ${i}`)) i++;
      nm = `${nm} ${i}`;
    }
    used.add(nm);

    names.push(nm);
    if (pl.lat != null && pl.lng != null) {
      points.push({ name: nm, lat: pl.lat, lng: pl.lng, category: pl.category });
    }
  }
  return { names, points };
}
