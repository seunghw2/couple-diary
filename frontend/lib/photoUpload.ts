import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadPhoto } from './api';

/** ImagePicker 자산에서 우리가 쓰는 필드만. */
export type PickerAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number;
};

/**
 * 자산 1장을 리사이즈(≤1440)·압축(0.7) 후 업로드하고 서버 url을 반환.
 * 리사이즈 실패 시 원본 업로드, 업로드 실패 시 null.
 */
export async function resizeAndUploadAsset(asset: PickerAsset): Promise<string | null> {
  let up: { uri: string; fileName?: string | null; mimeType?: string | null } = {
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  };
  if (Platform.OS !== 'web') {
    try {
      const actions = asset.width && asset.width > 1440 ? [{ resize: { width: 1440 } }] : [];
      const m = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      up = {
        uri: m.uri,
        fileName: (asset.fileName?.replace(/\.[^.]+$/, '') ?? `photo-${Date.now()}`) + '.jpg',
        mimeType: 'image/jpeg',
      };
    } catch {
      /* 리사이즈 실패 시 원본 업로드 */
    }
  }
  try {
    const { url } = await uploadPhoto(up);
    return url;
  } catch {
    return null;
  }
}

/**
 * 여러 자산을 **병렬**로 리사이즈·업로드(대기시간 단축).
 * 성공한 url 배열(선택 순서 유지)과 실패 수를 반환.
 */
export async function uploadAssetsParallel(assets: PickerAsset[]): Promise<{ urls: string[]; failed: number }> {
  const results = await Promise.all(assets.map((a) => resizeAndUploadAsset(a)));
  const urls = results.filter((u): u is string => !!u);
  return { urls, failed: results.length - urls.length };
}
