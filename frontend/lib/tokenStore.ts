import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'today_access_token';

// SecureStore는 웹 미지원 → 웹은 AsyncStorage(localStorage)로 폴백.
// 키체인 잠김/백업복원 등 드문 iOS 상태에서 예외가 나도 앱 부팅이 멈추지 않도록 전부 방어.
async function setItem(key: string, value: string) {
  try {
    if (Platform.OS === 'web') await AsyncStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // 저장 실패는 무시(다음 로그인에서 재시도).
  }
}
async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null; // 읽기 실패 = 토큰 없음으로 처리(로그인 화면으로).
  }
}
async function deleteItem(key: string) {
  try {
    if (Platform.OS === 'web') await AsyncStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // 삭제 실패 무시.
  }
}

export const tokenStore = {
  saveToken: (token: string) => setItem(ACCESS_KEY, token),
  getToken: () => getItem(ACCESS_KEY),
  clear: () => deleteItem(ACCESS_KEY),
};
