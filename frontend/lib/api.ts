import { API_URL } from './config';
import { tokenStore } from './tokenStore';

export type ApiErrorBody = { code?: string; message?: string; details?: Record<string, string> };

export class ApiException extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? '요청에 실패했어요');
    this.status = status;
    this.body = body;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestOpts = { method?: Method; body?: unknown; auth?: boolean };

// ── 401 전역 처리: 순환의존 없이 _layout에서 핸들러 등록 ──
let unauthorizedHandler: (() => void) | null = null;

/** 401 응답 시 호출될 콜백 등록 (앱 루트에서 로그아웃 처리용). */
export function setOnUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function handleUnauthorized() {
  await tokenStore.clear();
  unauthorizedHandler?.();
}

async function request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await tokenStore.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    // 토큰 만료/무효 → 세션 정리 후 로그인으로 복귀
    await handleUnauthorized();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    throw new ApiException(res.status, (data as ApiErrorBody) ?? { message: '요청 실패' });
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/** JSON 헬퍼. */
export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'PATCH', body, auth }),
  put: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'PUT', body, auth }),
  del: <T = void>(path: string, auth = true) => request<T>(path, { method: 'DELETE', auth }),
};

// ─────────────────────────── 사진 업로드 (multipart) ───────────────────────────

export type PickedImage = { uri: string; fileName?: string | null; mimeType?: string | null };

/**
 * POST /api/photos — multipart/form-data(field: `file`)로 업로드.
 * 응답: { url: "/files/xxx.jpg" } (상대경로).
 * 웹(blob:/data: uri)은 blob으로 변환해 append, 네이티브는 {uri,name,type} 객체.
 */
export async function uploadPhoto(image: PickedImage): Promise<{ url: string }> {
  const token = await tokenStore.getToken();
  const name = image.fileName ?? `photo-${Date.now()}.jpg`;
  const type = image.mimeType ?? 'image/jpeg';

  const form = new FormData();
  if (image.uri.startsWith('blob:') || image.uri.startsWith('data:')) {
    const blob = await (await fetch(image.uri)).blob();
    (form as unknown as { append(k: string, v: unknown, n?: string): void }).append('file', blob, name);
  } else {
    form.append('file', { uri: image.uri, name, type } as unknown as Blob);
  }

  const res = await fetch(`${API_URL}/api/photos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (res.status === 401) await handleUnauthorized();
  if (!res.ok) throw new ApiException(res.status, { message: '사진 업로드에 실패했어요' });
  return (await res.json()) as { url: string };
}

// ─────────────────────────── 타입 (백엔드 계약) ───────────────────────────
// JSON은 jackson non_null → null 필드는 아예 생략됨. 그래서 전부 optional.

/** 내 계정 요약 (GET/PATCH /api/me, 로그인 응답). profileImage 없음. */
export type UserSummary = {
  id: number;
  email: string;
  nickname: string;
  avatarColor: string;
  birthday?: string; // YYYY-MM-DD
  inviteCode: string;
};

/** 상대 요약. */
export type PartnerSummary = {
  id: number;
  nickname: string;
  avatarColor: string;
};

export type DevLoginResponse = { accessToken: string; user: UserSummary };

/** GET /api/me 래퍼. */
export type MeResponse = {
  user: UserSummary;
  coupled: boolean;
  coupleId?: number;
  partner?: PartnerSummary;
};

/** GET/PUT/connect 커플 응답. user1=커플 생성자, user2=상대. */
export type CoupleResponse = {
  id: number;
  user1: PartnerSummary;
  user2: PartnerSummary;
  anniversaryDate?: string; // YYYY-MM-DD
  ddayCount?: number;
};

export type QuestionType = 'NORMAL' | 'INLINE_BLANK';

export type QuestionResponse = {
  id: number;
  orderNo: number;
  text: string;
  type: QuestionType;
};

export type EntryStatus = 'EMPTY' | 'LOCKED' | 'OPEN';

/** 캘린더 그리드용 월 요약 (GET /api/entries?year=&month=). */
export type MonthEntrySummary = {
  date: string; // YYYY-MM-DD
  status: EntryStatus;
  photoCount: number;
  thumbSeed?: string;
  mineWritten: boolean;
  partnerWritten: boolean;
};

export type EntryMode = 'TEMPLATE' | 'QUESTION_PICK';

export type AnswerView = {
  questionId?: number;
  promptKey?: string;
  text: string;
};

export type PhotoView = {
  id: number;
  colorSeed: string;
  /** 실제 업로드된 이미지 상대경로(/files/...). 없으면 colorSeed 그라데이션 폴백. */
  url?: string;
};

/** 한 사람이 쓴 일기 본문 (OPEN 상태). */
export type EntryView = {
  id: number;
  authorId: number;
  rating?: number; // 별점 1~5
  mood?: string; // 이모지
  locationName?: string; // locations[0]와 동일(하위호환)
  locations?: string[]; // 다중 장소
  answers: AnswerView[];
  photos: PhotoView[];
  createdAt: string;
  editableAfter: string;
  editable: boolean;
};

/** 상대 일기가 아직 안 열렸을 때. */
export type LockedEntryView = { locked: true };

/** partnerEntry가 잠금 상태인지 판별. */
export function isLocked(v: EntryView | LockedEntryView | undefined): v is LockedEntryView {
  return !!v && (v as LockedEntryView).locked === true;
}

export type CommentView = {
  id: number;
  authorId: number;
  authorNickname?: string;
  text: string;
  createdAt: string;
};

/** 일기 상세 (GET/POST /api/entries/{date}). */
export type DayDetail = {
  date: string;
  status: EntryStatus;
  mode: EntryMode;
  templateType?: string;
  questions: QuestionResponse[];
  myEntry?: EntryView;
  partnerEntry?: EntryView | LockedEntryView;
  comments: CommentView[];
};

/** 작성 요청 (UpsertEntryRequest). 사진은 업로드 후 photoUrls로 전송. */
export type UpsertEntryRequest = {
  mode: EntryMode;
  templateType?: string;
  questionIds?: number[];
  answers: AnswerView[];
  photoSeeds?: string[];
  photoUrls?: string[];
  locations?: string[]; // 다중 장소
  rating?: number;
  mood?: string;
};

// ─────────────────────────── 도메인 API ───────────────────────────

export const authApi = {
  devLogin: (nickname: string) =>
    api.post<DevLoginResponse>('/api/auth/dev-login', { nickname }, false),
  me: () => api.get<MeResponse>('/api/me'),
  updateMe: (patch: Partial<Pick<UserSummary, 'nickname' | 'avatarColor' | 'birthday'>>) =>
    api.patch<UserSummary>('/api/me', patch),
};

export const coupleApi = {
  get: () => api.get<CoupleResponse>('/api/couple'),
  invite: () => api.post<{ inviteCode: string }>('/api/couple/invite'),
  connect: (inviteCode: string) => api.post<CoupleResponse>('/api/couple/connect', { inviteCode }),
  setAnniversary: (anniversaryDate: string) =>
    api.put<CoupleResponse>('/api/couple/anniversary', { anniversaryDate }),
};

export const questionApi = {
  list: () => api.get<QuestionResponse[]>('/api/questions'),
};

/** 이전에 쓴 장소 추천 목록. */
export const locationApi = {
  list: () => api.get<{ locations: string[] }>('/api/locations'),
};

// ─────────────────────────── 알림 (인앱) ───────────────────────────

export type NotificationType =
  | 'PARTNER_WROTE'
  | 'ENTRY_OPENED'
  | 'COMMENT'
  | 'POKE'
  | 'ANNIVERSARY'
  | 'COUPLE_CONNECTED';

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  entryDate?: string; // YYYY-MM-DD
  read: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  items: Notification[];
  unreadCount: number;
};

export const notificationApi = {
  list: () => api.get<NotificationListResponse>('/api/notifications'),
  read: (id: number) => api.post<void>(`/api/notifications/${id}/read`),
  readAll: () => api.post<void>('/api/notifications/read-all'),
  /** 콕 찌르기. 미연결 400, 1시간 dedup. */
  poke: () => api.post<void>('/api/poke'),
};

export const entryApi = {
  month: (year: number, month: number) =>
    api.get<MonthEntrySummary[]>(`/api/entries?year=${year}&month=${month}`),
  detail: (date: string) => api.get<DayDetail>(`/api/entries/${date}`),
  create: (date: string, payload: UpsertEntryRequest) =>
    api.post<DayDetail>(`/api/entries/${date}`, payload),
  remove: (date: string) => api.del(`/api/entries/${date}`),
  comments: (date: string) => api.get<CommentView[]>(`/api/entries/${date}/comments`),
  addComment: (date: string, text: string) =>
    api.post<CommentView>(`/api/entries/${date}/comments`, { text }),
};
