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
};

// ─────────────────────────── 타입 (백엔드 계약) ───────────────────────────

export type User = {
  id: number | string;
  email: string;
  nickname: string;
  profileImage?: string | null;
};

export type DevLoginResponse = { accessToken: string; user: User };

export type Couple = {
  id?: number | string;
  connected: boolean;
  me?: User;
  partner?: User | null;
  anniversaryDate?: string | null; // YYYY-MM-DD
  inviteCode?: string | null;
};

export type Question = { id: number | string; promptKey?: string; text: string };

export type EntryStatus = 'EMPTY' | 'LOCKED' | 'OPEN';

/** 캘린더 그리드용 요약. */
export type EntrySummary = {
  date: string; // YYYY-MM-DD
  status: EntryStatus;
  photoCount: number;
  thumbSeed?: string | null;
  mineWritten: boolean;
  partnerWritten: boolean;
};

export type EntryMode = 'TEMPLATE' | 'FREE' | 'QUESTION_PICK';

export type Answer = {
  questionId?: number | string;
  promptKey?: string;
  text: string;
};

/** 한 사람이 쓴 일기 본문. */
export type EntrySide = {
  userId?: number | string;
  nickname?: string;
  answers: Answer[];
  photoSeeds: string[];
  locationName?: string | null;
  rating?: number | null; // 별점 1~5
  mood?: string | null; // 이모지
};

export type Comment = {
  id: number | string;
  userId: number | string;
  nickname?: string;
  text: string;
  createdAt?: string;
};

/** 일기 상세. */
export type EntryDetail = {
  date: string;
  status: EntryStatus;
  mode: EntryMode;
  templateType?: string | null;
  questionIds?: (number | string)[];
  mine?: EntrySide | null;
  partner?: EntrySide | null;
  comments?: Comment[];
  thumbSeed?: string | null;
};

export type CreateEntryPayload = {
  mode: EntryMode;
  templateType?: string;
  questionIds?: (number | string)[];
  answers: Answer[];
  photoSeeds: string[];
  locationName?: string;
  rating?: number;
  mood?: string;
};

// ─────────────────────────── 도메인 API ───────────────────────────

export const authApi = {
  devLogin: (email: string, nickname: string) =>
    api.post<DevLoginResponse>('/api/auth/dev-login', { email, nickname }, false),
  me: () => api.get<User>('/api/me'),
  updateMe: (patch: Partial<Pick<User, 'nickname' | 'profileImage'>>) =>
    api.patch<User>('/api/me', patch),
};

export const coupleApi = {
  get: () => api.get<Couple>('/api/couple'),
  invite: () => api.post<{ inviteCode: string }>('/api/couple/invite'),
  connect: (inviteCode: string) => api.post<Couple>('/api/couple/connect', { inviteCode }),
  setAnniversary: (anniversaryDate: string) =>
    api.put<Couple>('/api/couple/anniversary', { anniversaryDate }),
};

export const questionApi = {
  list: () => api.get<Question[]>('/api/questions'),
};

export const entryApi = {
  month: (year: number, month: number) =>
    api.get<EntrySummary[]>(`/api/entries?year=${year}&month=${month}`),
  detail: (date: string) => api.get<EntryDetail>(`/api/entries/${date}`),
  create: (date: string, payload: CreateEntryPayload) =>
    api.post<EntryDetail>(`/api/entries/${date}`, payload),
  comments: (date: string) => api.get<Comment[]>(`/api/entries/${date}/comments`),
  addComment: (date: string, text: string) =>
    api.post<Comment>(`/api/entries/${date}/comments`, { text }),
};
