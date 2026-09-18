const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface ChatResponse {
  response: string;
  thread_id: string;
  actions: any[];
  reasoning?: string;
}

interface OntologyObjectResponse {
  id: string;
  type: string;
  properties: Record<string, any>;
  links: Record<string, any[]>;
  metadata: Record<string, any>;
}

interface ActionResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  code?: string;
  transaction_id: string;
}

interface PendingAction {
  id: string;
  title: string;
  description: string;
  type: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  timestamp: string;
  proposed_by: string;
}

interface StreamChunkData {
    type: 'thinking' | 'answer' | 'done' | 'error' | 'connected' | 'intent' | 'skill' | 'reasoning' | 'content' | 'tools_used' | 'suggestions' | 'actions' | 'data_card' | 'routing';
  content: string;
  thinking?: string;
  answer?: string;
  thread_id?: string;
  intent?: string;
  skill?: string;
  skills?: string[];
  decision_id?: string;
  suggestions?: string[];
  actions?: Array<Record<string, any>>;
  data_card?: Record<string, any>;
  data_cards?: Array<Record<string, any>>;
  reasoning_trace?: Array<Record<string, any>>;
}

type StreamCallback = (data: StreamChunkData) => void;

class ApiClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private wsOnMessage: ((data: any) => void) | null = null;
  private wsOnError: ((error: Event) => void) | null = null;
  private heartbeatInterval: number | null = null;
  private wsIntentionalClose = false;
  private wsReconnectTimer: number | null = null;
  private wsStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'failed' = 'disconnected';

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('auth_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string; name: string; version: string }> {
    return this.request('/health');
  }

  async login(username: string, password: string): Promise<{ access_token: string; token_type: string; user_id: string; username?: string; display_name: string; role?: string }> {
    const result = await this.request<{ access_token: string; token_type: string; user_id: string; username?: string; display_name: string; role?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('auth_token', result.access_token);
    localStorage.setItem('user_id', result.user_id);
    return result;
  }

  async register(username: string, password: string, displayName?: string): Promise<{ access_token: string; token_type: string; user_id: string; display_name: string }> {
    const result = await this.request<{ access_token: string; token_type: string; user_id: string; display_name: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, display_name: displayName }),
    });
    localStorage.setItem('auth_token', result.access_token);
    localStorage.setItem('user_id', result.user_id);
    return result;
  }

  async chat(message: string, userId: string, threadId?: string, context?: Record<string, any>): Promise<ChatResponse> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        user_id: userId,
        thread_id: threadId,
        context,
      }),
    });
  }

  async chatStream(
    message: string,
    userId: string,
    onChunk: StreamCallback,
    onError: (error: Error) => void,
    threadId?: string,
    context?: Record<string, any>
  ): Promise<void> {
    const url = `${this.baseUrl}/api/chat/stream`;
    const token = localStorage.getItem('auth_token');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message,
          user_id: userId,
          thread_id: threadId,
          context,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.detail || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine || trimmedLine.startsWith(':')) {
            continue;
          }

          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6).trim();

            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataStr);
              onChunk(data);
            } catch (e) {
              console.warn('[SSE] Failed to parse stream data:', dataStr, e);
            }
          }
        }
      }
    } catch (error) {
      console.error('[SSE] Error:', error);
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async getOntologyObjects(
    objectType?: string,
    options?: { page?: number; pageSize?: number; compact?: boolean }
  ): Promise<{ results: any[]; total: number; page?: number; page_size?: number; has_next?: boolean }> {
    const params = new URLSearchParams();
    if (objectType) params.set('type', objectType);
    if (options?.page) params.set('page', String(options.page));
    if (options?.pageSize) params.set('page_size', String(options.pageSize));
    if (options?.compact) params.set('compact', 'true');
    const qs = params.toString();
    return this.request(`/api/ontology/objects${qs ? `?${qs}` : ''}`);
  }

  async getAllOntologyObjects(objectType?: string): Promise<{ results: any[]; total: number }> {
    const pageSize = 200;
    const collected: any[] = [];
    let page = 1;
    let hasNext = true;
    let total = 0;
    while (hasNext && page <= 50) {
      const res = await this.getOntologyObjects(objectType, { page, pageSize, compact: true });
      collected.push(...(res.results || []));
      total = res.total ?? collected.length;
      hasNext = Boolean(res.has_next);
      page += 1;
    }
    return { results: collected, total };
  }

  async getOntologyObject(objectType: string, objectId: string, userId: string): Promise<OntologyObjectResponse> {
    return this.request(`/api/ontology/${objectType}/${objectId}?user_id=${userId}`);
  }

  async searchOntologyObjects(objectType: string, query: string): Promise<any[]> {
    return this.request(`/api/ontology/${objectType}/search?q=${encodeURIComponent(query)}`);
  }

  async createOntologyObject(objectType: string, data: Record<string, any>): Promise<any> {
    return this.request(`/api/ontology/${objectType}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOntologyObject(objectType: string, objectId: string, data: Record<string, any>): Promise<any> {
    return this.request(`/api/ontology/${objectType}/${objectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOntologyObject(objectType: string, objectId: string): Promise<any> {
    return this.request(`/api/ontology/${objectType}/${objectId}`, {
      method: 'DELETE',
    });
  }

  async executeOntologyAction(
    objectType: string,
    objectId: string,
    action: string,
    params: Record<string, any>,
    userId: string
  ): Promise<ActionResponse> {
    return this.request(`/api/ontology/${objectType}/${objectId}/action`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        params,
        user_id: userId,
      }),
    });
  }

  async getPendingActions(userId: string): Promise<PendingAction[]> {
    return this.request(`/api/actions/pending?user_id=${userId}`);
  }

  async getHubOverview(): Promise<any> {
    return this.request('/api/hub/overview');
  }

  async getDecisionCases(status?: string): Promise<any[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/api/decisions/cases${query}`);
  }

  async getCaseTimeline(caseId: string): Promise<any> {
    return this.request(`/api/decisions/cases/${caseId}/timeline`);
  }

  async hubRun(query: string, objectId?: string, decisionId?: string): Promise<any> {
    return this.request('/api/hub/run', {
      method: 'POST',
      body: JSON.stringify({
        query,
        object_id: objectId,
        decision_id: decisionId,
      }),
    });
  }

  async getHubLogic(): Promise<any> {
    return this.request('/api/hub/logic');
  }

  async ingestSync(source: string, records: Array<Record<string, unknown>>): Promise<any> {
    return this.request('/api/ingest/sync', {
      method: 'POST',
      body: JSON.stringify({ source, records }),
    });
  }

  async evaluateLearning(): Promise<{ evaluated: number; results: any[] }> {
    return this.request('/api/decisions/learning/evaluate', { method: 'POST' });
  }

  async approveAction(actionId: string, userId: string): Promise<{ action_id: string; status: string; message: string }> {
    return this.request<{ action_id: string; status: string; message: string }>(`/api/actions/${actionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        approved: true,
        user_id: userId,
      }),
    });
  }

  async rejectAction(actionId: string, userId: string, feedback?: string): Promise<{ action_id: string; status: string; message: string }> {
    return this.request(`/api/actions/${actionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({
        approved: false,
        feedback,
        user_id: userId,
      }),
    });
  }

  async getScenarios(category?: string): Promise<{ results: any[]; total: number }> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request(`/api/scenarios/${params}`);
  }

  async getScenario(scenarioId: string): Promise<any> {
    return this.request(`/api/scenarios/${scenarioId}`);
  }

  async getInferenceRules(): Promise<{ results: any[]; total: number }> {
    return this.request('/api/inference/rules');
  }

  async executeInferenceRule(ruleId: string): Promise<any> {
    return this.request(`/api/inference/rules/${ruleId}/execute`, {
      method: 'POST',
    });
  }

  async getNotifications(userId: string): Promise<{ results: any[]; total: number }> {
    return this.request(`/api/notifications/?user_id=${userId}`);
  }

  async markNotificationRead(notificationId: string): Promise<any> {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async getReminders(userId: string): Promise<any[]> {
    return this.request(`/api/reminders/?user_id=${userId}`);
  }

  async dismissReminder(reminderId: string): Promise<any> {
    return this.request(`/api/reminders/${reminderId}/dismiss`, {
      method: 'POST',
    });
  }

  async getPerception(): Promise<any[]> {
    return this.request('/api/perception/run', {
      method: 'POST',
    });
  }

  async getEntityPerception(entityId: string): Promise<any> {
    return this.request(`/api/perception/${entityId}`);
  }

  async getSuggestions(): Promise<any[]> {
    return this.request('/api/suggestions/');
  }

  async getInsights(): Promise<any[]> {
    return this.request('/api/insights/');
  }

  async getAgentStatus(): Promise<any[]> {
    return this.request('/api/agent/status');
  }

  async invokeAgent(query: string): Promise<{
    status: string;
    perception: string;
    reasoning: string;
    plan: string;
    execution: string;
  }> {
    return this.request('/api/agent/invoke', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  private notifyWsStatus(status: WsConnectionStatus) {
    this.wsStatus = status;
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(WS_STATUS_EVENT, {
      detail: {
        status,
        attempt: this.wsReconnectAttempts,
        max: this.maxReconnectAttempts,
      },
    }));
  }

  getWebSocketStatus(): WsConnectionStatus {
    return this.wsStatus;
  }

  connectWebSocket(userId: string, onMessage: (data: any) => void, onError?: (error: Event) => void): WebSocket {
    this.wsOnMessage = onMessage;
    this.wsOnError = onError ?? null;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return this.ws;
    }
    this.wsReconnectAttempts = 0;
    this.wsIntentionalClose = false;
    this.notifyWsStatus('connecting');
    return this.connectWebSocketInternal(userId);
  }

  private connectWebSocketInternal(userId: string): WebSocket {
    const wsUrl = this.baseUrl ? this.baseUrl.replace(/^http/, 'ws') : `ws://${window.location.host}`;
    const token = localStorage.getItem('auth_token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    this.ws = new WebSocket(`${wsUrl}/api/ws/${userId}${query}`);

    this.ws.onopen = () => {
      this.wsReconnectAttempts = 0;
      this.notifyWsStatus('connected');
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = window.setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.wsOnMessage?.(data);
    };

    this.ws.onerror = (error) => {
      this.wsOnError?.(error);
    };

    this.ws.onclose = () => {
      if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
      if (this.wsIntentionalClose) {
        this.wsIntentionalClose = false;
        this.notifyWsStatus('disconnected');
        return;
      }
      if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
        this.notifyWsStatus('reconnecting');
        if (this.wsReconnectTimer) window.clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = window.setTimeout(() => {
          this.wsReconnectAttempts++;
          this.connectWebSocketInternal(userId);
        }, delay);
      } else {
        this.notifyWsStatus('failed');
      }
    };

    return this.ws;
  }

  sendWebSocketMessage(message: string, userId: string, threadId?: string, territory?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'chat',
      message,
      user_id: userId,
      thread_id: threadId,
      territory,
    }));
  }

  disconnectWebSocket(): void {
    this.wsIntentionalClose = true;
    if (this.wsReconnectTimer) { window.clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null; }
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyWsStatus('disconnected');
  }

  async searchDecisions(q?: string): Promise<any[]> {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.request(`/api/decisions/search${params}`);
  }

  async getDecision(id: string): Promise<any> {
    return this.request(`/api/decisions/${id}`);
  }

  async getDecisionChain(id: string): Promise<any> {
    return this.request(`/api/decisions/${id}/chain`);
  }

  async explainDecision(id: string): Promise<any> {
    return this.request(`/api/decisions/${id}/explain`, { method: 'POST' });
  }
}

export const HUB_CHANGED_EVENT = 'ontonexus:hub-changed';
export const WS_STATUS_EVENT = 'ontonexus:ws-status';

export type WsConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'failed';

export function notifyHubChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HUB_CHANGED_EVENT));
  }
}

export const apiClient = new ApiClient();
export default apiClient;
