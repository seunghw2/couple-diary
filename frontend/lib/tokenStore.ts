import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'today_access_token';

// SecureStore는 웹 미지원 → 웹은 AsyncStorage(localStorage)로 폴백.
async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function deleteItem(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  saveToken: (token: string) => setItem(ACCESS_KEY, token),
  getToken: () => getItem(ACCESS_KEY),
  clear: () => deleteItem(ACCESS_KEY),
};
