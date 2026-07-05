import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntryMode, LocationPoint } from './api';

/**
 * 일기 작성 중인 임시 초안. iOS(Expo Go)에서 앱을 백그라운드 갔다 오면
 * 리마운트되며 React 상태가 날아가 화면이 초기화/백지가 되는 문제를 막기 위해,
 * 작성 상태를 기기 저장소에 debounce 저장하고 재진입 시 복원한다.
 */
export type WriteDraft = {
  step: 'mode' | 'form';
  mode: EntryMode | 'FREE';
  answers: Record<string, string>;
  scenes: Record<string, string[]>;
  mood: string | null;
  locations: string[];
  /** 지도에서 찍은 장소의 좌표 메타(이름은 locations에 하위호환 저장). 없을 수 있음. */
  locationPoints?: LocationPoint[];
  photoUrls: string[];
  pickedIds: string[];
  savedAt: number;
};

const keyOf = (date: string) => `write_draft:${date}`;

export async function loadDraft(date: string): Promise<WriteDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(date));
    return raw ? (JSON.parse(raw) as WriteDraft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(date: string, draft: WriteDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(keyOf(date), JSON.stringify(draft));
  } catch {
    /* 저장 실패는 무시(작성 흐름 우선) */
  }
}

export async function clearDraft(date: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyOf(date));
  } catch {
    /* 무시 */
  }
}

/** 초안이 실제로 작성 중인 내용을 담고 있는지(빈 초안은 저장/복원 불필요). */
export function draftHasContent(d: Pick<WriteDraft, 'answers' | 'scenes' | 'mood' | 'locations' | 'photoUrls'>): boolean {
  if (d.mood) return true;
  if (d.locations.length > 0 || d.photoUrls.length > 0) return true;
  if (Object.values(d.answers).some((v) => v && v.trim())) return true;
  if (Object.values(d.scenes).some((arr) => arr.some((v) => v && v.trim()))) return true;
  return false;
}
