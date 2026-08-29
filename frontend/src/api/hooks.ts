import { useState, useCallback, useEffect, useRef } from 'react';
import apiClient, { WS_STATUS_EVENT, WsConnectionStatus } from './client';

export function useChat(userId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    message: string,
    context?: Record<string, any>
  ): Promise<{ response: string; thread_id: string; actions: any[] } | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.chat(message, userId, threadId || undefined, context);
      setThreadId(response.thread_id);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, threadId]);

  return {
    sendMessage,
    loading,
    error,
    threadId,
    setThreadId,
  };
}

export function useOntology(userId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getObject = useCallback(async (
    objectType: string,
    objectId: string
  ): Promise<any | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getOntologyObject(objectType, objectId, userId);
      return {
        id: response.id,
        objectType: objectType,
        name: response.properties.name || response.id,
        properties: response.properties,
        links: response.links,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const searchObjects = useCallback(async (
    objectType: string,
    query: string
  ): Promise<any[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.searchOntologyObjects(objectType, query);
      return (Array.isArray(response) ? response : []).map(item => ({
        id: item.id,
        objectType: objectType,
        name: item.properties?.name || item.name || item.id,
        properties: item.properties || {},
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const executeAction = useCallback(async (
    objectType: string,
    objectId: string,
    action: string,
    params: Record<string, any>
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.executeOntologyAction(
        objectType,
        objectId,
        action,
        params,
        userId
      );
      return response.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    getObject,
    searchObjects,
    executeAction,
    loading,
    error,
  };
}

export function useActions(userId: string) {
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingActions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const actions = await apiClient.getPendingActions(userId);
      setPendingActions(actions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const approveAction = useCallback(async (actionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.approveAction(actionId, userId);
      setPendingActions(prev => prev.filter(a => a.id !== actionId));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const rejectAction = useCallback(async (actionId: string, feedback?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.rejectAction(actionId, userId, feedback);
      setPendingActions(prev => prev.filter(a => a.id !== actionId));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPendingActions();
  }, [fetchPendingActions]);

  return {
    pendingActions,
    approveAction,
    rejectAction,
    fetchPendingActions,
    loading,
    error,
  };
}

export function useWebSocketChat(clientId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!clientId) return;
    try {
      wsRef.current = apiClient.connectWebSocket(
        clientId,
        (data) => {
          if (data.type === 'connected') {
            setIsConnected(true);
          } else if (data.type === 'chunk') {
            setMessages(prev => [...prev, data].slice(-100));
          } else if (data.type === 'done') {
            // keep connected state
          } else if (data.type === 'error') {
            setError(data.message);
          } else if (data.type === 'new_alert' || data.type === 'action_status_change' || data.type === 'reminder_update') {
            setMessages(prev => [...prev, data].slice(-100));
          }
        },
        () => {
          setIsConnected(false);
          // Don't show error to user, reconnection will happen automatically
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
    }
  }, [clientId]);

  const disconnect = useCallback(() => {
    apiClient.disconnectWebSocket();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((
    message: string,
    userId: string,
    threadId?: string,
    territory?: string
  ) => {
    try {
      apiClient.sendWebSocketMessage(message, userId, threadId, territory);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const status = detail.status as WsConnectionStatus;
      if (status) {
        setConnectionStatus(status);
        setIsConnected(status === 'connected');
        if (status === 'failed') {
          setError('实时连接已断开，已停止重试');
        }
      }
    };
    window.addEventListener(WS_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(WS_STATUS_EVENT, onStatus);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    connectionStatus,
    messages,
    error,
  };
}

export function useScenarios(category?: string) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getScenarios(category);
      setScenarios(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  return { scenarios, loading, error, refetch: fetchScenarios };
}

export function useInferenceRules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getInferenceRules();
      setRules(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return { rules, loading, error, refetch: fetchRules };
}

export function useReminders(userId: string) {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getReminders(userId);
      setReminders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const dismiss = useCallback(async (reminderId: string) => {
    try {
      await apiClient.dismissReminder(reminderId);
      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  return { reminders, loading, error, dismiss, refetch: fetchReminders };
}

export function useAgentStatus() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getAgentStatus();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { agents, loading, error, refetch: fetchStatus };
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getNotifications(userId);
      setNotifications(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await apiClient.markNotificationRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { notifications, loading, error, markRead, refetch: fetchNotifications };
}

export function usePerception() {
  const [perceptions, setPerceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerception = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPerception();
      setPerceptions(data);
    } catch {
      setError('数据加载失败，请检查网络连接');
      setPerceptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntityPerception = useCallback(async (entityId: string) => {
    try {
      return await apiClient.getEntityPerception(entityId);
    } catch {
      return null;
    }
  }, []);

  return { perceptions, loading, error, fetchPerception, fetchEntityPerception };
}

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getSuggestions();
      setSuggestions(data);
    } catch {
      setError('数据加载失败，请检查网络连接');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { suggestions, loading, error, fetchSuggestions };
}

export function useInsights() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getInsights();
      setInsights(data);
    } catch {
      setError('数据加载失败，请检查网络连接');
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { insights, loading, error, fetchInsights };
}

export function useAttributionAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttribution = useCallback(async (
    targetId: string,
    targetMetric: string = 'prescription_volume',
    period: string = '90d',
    method: string = 'shapley'
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        target_id: targetId,
        target_metric: targetMetric,
        period,
        method,
      });
      const response = await apiClient.request(`/api/reasoning/attribution?${params.toString()}`, {
        method: 'POST',
      });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : '归因分析请求失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMultiDimension = useCallback(async (
    targetId: string,
    targetMetric: string = 'prescription_volume',
    period: string = '90d',
    dimensions?: string[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        target_id: targetId,
        target_metric: targetMetric,
        period,
      });
      if (dimensions) {
        params.set('dimensions', dimensions.join(','));
      }
      const response = await apiClient.request(`/api/reasoning/attribution/dimensions?${params.toString()}`, {
        method: 'POST',
      });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : '多维度归因分析请求失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchValidation = useCallback(async (
    targetId: string,
    targetMetric: string = 'prescription_volume',
    period: string = '90d'
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        target_id: targetId,
        target_metric: targetMetric,
        period,
      });
      const response = await apiClient.request(`/api/reasoning/attribution/validate?${params.toString()}`, {
        method: 'POST',
      });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : '归因验证请求失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReport = useCallback(async (
    targetId: string,
    targetMetric: string = 'prescription_volume',
    period: string = '90d',
    format: string = 'json'
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        target_id: targetId,
        target_metric: targetMetric,
        period,
        format,
      });
      const response = await apiClient.request(`/api/reasoning/attribution/report?${params.toString()}`, {
        method: 'POST',
      });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : '归因报告请求失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    fetchAttribution,
    fetchMultiDimension,
    fetchValidation,
    fetchReport,
    loading,
    error,
  };
}
