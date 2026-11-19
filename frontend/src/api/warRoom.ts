// SSE client for the Agent war room and the OAG-vs-plain-LLM comparison.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface WarRoomEvent {
  type: string;
  [key: string]: any;
}

export interface Preset {
  id: string;
  label: string;
  query?: string;
  hint?: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** POST + read an SSE stream. Resolves when the stream ends; rejects on HTTP / network errors. */
export async function streamEvents(
  path: string,
  body: unknown,
  onEvent: (ev: WarRoomEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(res.status === 401 ? '登录已过期，请重新登录' : `请求失败（HTTP ${res.status}）`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue; // ignore ":" keep-alive comments
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        /* ignore a malformed frame */
      }
    }
  }
}

export const warRoomApi = {
  presets: () => getJson<Preset[]>('/api/agent/presets'),
  llmStatus: (ping = false) => getJson<any>(`/api/agent/llm-status${ping ? '?ping=true' : ''}`),
  run: (query: string, onEvent: (ev: WarRoomEvent) => void, opts: { replay?: string; signal?: AbortSignal } = {}) =>
    streamEvents(`/api/agent/run/stream${opts.replay ? `?replay=${encodeURIComponent(opts.replay)}` : ''}`, { query }, onEvent, opts.signal),
};

export const compareApi = {
  presets: () => getJson<Preset[]>('/api/oag/compare/presets'),
  run: (query: string, squeeze: boolean, onEvent: (ev: WarRoomEvent) => void, signal?: AbortSignal) =>
    streamEvents('/api/oag/compare/stream', { query, simulate_budget_squeeze: squeeze }, onEvent, signal),
};
