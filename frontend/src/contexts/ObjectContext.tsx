import React, { createContext, useContext, useReducer, ReactNode, useCallback, useEffect } from 'react';
import { OntologyObject, ActionProposal, Notification, AuditLogEntry, ObjectType } from '../types';
import apiClient from '../api/client';
import { mapApiObjectToOntologyObject, mapApiActionToActionProposal } from '../utils/apiMappers';

interface ObjectState {
  objects: OntologyObject[];
  actions: ActionProposal[];
  notifications: Notification[];
  auditLog: AuditLogEntry[];
  selectedObjectId: string | null;
  actionHistory: ActionProposal[];
  actionFuture: ActionProposal[];
  loading: boolean;
  error: string | null;
}

type ObjectAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_OBJECTS'; payload: OntologyObject[] }
  | { type: 'SET_ACTIONS'; payload: ActionProposal[] }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'EXECUTE_ACTION'; payload: { actionId: string; objectId: string; params: Record<string, any> } }
  | { type: 'APPROVE_ACTION'; payload: { actionId: string } }
  | { type: 'REJECT_ACTION'; payload: { actionId: string; reason?: string } }
  | { type: 'EXECUTE_ACTION_ROLLBACK'; payload: { actionId: string } }
  | { type: 'APPROVE_ACTION_ROLLBACK'; payload: { actionId: string; previousStatus: string } }
  | { type: 'REJECT_ACTION_ROLLBACK'; payload: { actionId: string; previousStatus: string } }
  | { type: 'SELECT_OBJECT'; payload: { objectId: string | null } }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: { notificationId: string } }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLogEntry }
  | { type: 'UPDATE_OBJECT'; payload: { objectId: string; updates: Partial<OntologyObject> } }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const initialState: ObjectState = {
  objects: [],
  actions: [],
  notifications: [],
  auditLog: [],
  selectedObjectId: null,
  actionHistory: [],
  actionFuture: [],
  loading: false,
  error: null,
};

function objectReducer(state: ObjectState, action: ObjectAction): ObjectState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_OBJECTS':
      return { ...state, objects: action.payload };
    case 'SET_ACTIONS':
      return { ...state, actions: action.payload };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'EXECUTE_ACTION': {
      const { actionId, objectId, params } = action.payload;
      const targetObject = state.objects.find(o => o.id === objectId);
      if (!targetObject) return state;
      const newAction: ActionProposal = {
        id: `ap-${Date.now()}`,
        title: `执行 ${actionId}`,
        description: `正在对 ${targetObject.name} 执行 ${actionId}`,
        type: actionId,
        entityId: objectId,
        entityName: targetObject.name,
        entityType: targetObject.objectType,
        priority: 'medium',
        confidence: 0.95,
        reasoningChain: { conclusion: `已为 ${targetObject.name} 执行 ${actionId}`, evidence: [], confidence: 0.95, alternativeHypotheses: [], suggestedActions: [] },
        actionDefinition: targetObject.actions.find(a => a.id === actionId) || { id: actionId, name: actionId, description: '', parameters: [], preconditions: [], sideEffects: [], writeBackTargets: [], requiresApproval: false },
        status: 'executed',
        timestamp: new Date().toISOString(),
      };
      const updatedObjects = state.objects.map(o => o.id === objectId ? { ...o, events: [...o.events, { id: `evt-${Date.now()}`, eventType: 'ActionExecuted', timestamp: new Date().toISOString(), description: `执行动作: ${actionId}`, relatedObjectId: objectId, relatedObjectName: targetObject.name }] } : o);
      const newAuditLog: AuditLogEntry = { id: `al-${Date.now()}`, action: 'execute', entityType: targetObject.objectType, entityId: objectId, entityName: targetObject.name, userId: 'current_user', timestamp: new Date().toISOString(), details: `执行动作 ${actionId}，参数: ${JSON.stringify(params)}` };
      return { ...state, objects: updatedObjects, actions: [...state.actions, newAction], auditLog: [newAuditLog, ...state.auditLog], actionHistory: [...state.actionHistory, newAction], actionFuture: [] };
    }
    case 'APPROVE_ACTION': {
      const { actionId } = action.payload;
      const targetAction = state.actions.find(a => a.id === actionId);
      const updatedActions = state.actions.map(a => a.id === actionId ? { ...a, status: 'approved' as const, approvedBy: 'current_user', approvedAt: new Date().toISOString() } : a);
      const newNotification: Notification = { id: `n-${Date.now()}`, type: 'action_approved', title: '动作已批准', message: targetAction ? `动作 "${targetAction.title}" 已批准执行` : '', timestamp: Date.now(), read: false, priority: 'low' };
      const newAuditLog: AuditLogEntry = { id: `al-${Date.now()}`, action: 'approve', entityType: 'ActionProposal', entityId: actionId, entityName: targetAction?.title || '', userId: 'current_user', timestamp: new Date().toISOString(), details: '批准动作提案' };
      return { ...state, actions: updatedActions, notifications: [newNotification, ...state.notifications], auditLog: [newAuditLog, ...state.auditLog] };
    }
    case 'REJECT_ACTION': {
      const { actionId, reason } = action.payload;
      const targetAction = state.actions.find(a => a.id === actionId);
      const updatedActions = state.actions.map(a => a.id === actionId ? { ...a, status: 'rejected' as const } : a);
      const newAuditLog: AuditLogEntry = { id: `al-${Date.now()}`, action: 'reject', entityType: 'ActionProposal', entityId: actionId, entityName: targetAction?.title || '', userId: 'current_user', timestamp: new Date().toISOString(), details: `拒绝动作提案，原因: ${reason || '未说明'}` };
      return { ...state, actions: updatedActions, auditLog: [newAuditLog, ...state.auditLog] };
    }
    case 'EXECUTE_ACTION_ROLLBACK': {
      const { actionId } = action.payload;
      return {
        ...state,
        objects: state.objects,
        actions: state.actions.filter(a => a.id !== actionId),
        error: 'Action execution failed',
      };
    }
    case 'APPROVE_ACTION_ROLLBACK': {
      const { actionId, previousStatus } = action.payload;
      return {
        ...state,
        actions: state.actions.map(a => a.id === actionId ? { ...a, status: previousStatus as any } : a),
        error: 'Action approval failed',
      };
    }
    case 'REJECT_ACTION_ROLLBACK': {
      const { actionId, previousStatus } = action.payload;
      return {
        ...state,
        actions: state.actions.map(a => a.id === actionId ? { ...a, status: previousStatus as any } : a),
        error: 'Action rejection failed',
      };
    }
    case 'SELECT_OBJECT':
      return { ...state, selectedObjectId: action.payload.objectId };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload.notificationId ? { ...n, read: true } : n) };
    case 'UPDATE_OBJECT':
      return { ...state, objects: state.objects.map(o => o.id === action.payload.objectId ? { ...o, ...action.payload.updates } : o) };
    case 'UNDO': {
      if (state.actionHistory.length === 0) return state;
      const lastAction = state.actionHistory[state.actionHistory.length - 1];
      return { ...state, actionHistory: state.actionHistory.slice(0, -1), actionFuture: [lastAction, ...state.actionFuture] };
    }
    case 'REDO': {
      if (state.actionFuture.length === 0) return state;
      const nextAction = state.actionFuture[0];
      return { ...state, actionFuture: state.actionFuture.slice(1), actionHistory: [...state.actionHistory, nextAction] };
    }
    default:
      return state;
  }
}

interface ObjectContextValue {
  state: ObjectState;
  dispatch: React.Dispatch<ObjectAction>;
  executeAction: (actionId: string, objectId: string, params?: Record<string, any>) => Promise<void>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string, reason?: string) => Promise<void>;
  selectObject: (objectId: string | null) => void;
  markNotificationRead: (notificationId: string) => void;
  getObjectById: (id: string) => OntologyObject | undefined;
  getObjectsByType: (type: ObjectType) => OntologyObject[];
  getPendingActions: () => ActionProposal[];
  getUnreadNotifications: () => Notification[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  refreshData: () => Promise<void>;
  searchObjects: (type: string, query: string) => Promise<OntologyObject[]>;
}

const ObjectContext = createContext<ObjectContextValue | undefined>(undefined);

interface ObjectProviderProps {
  children: ReactNode;
  userId: string;
}

export function ObjectProvider({ children, userId }: ObjectProviderProps) {
  const [state, dispatch] = useReducer(objectReducer, initialState);

  const refreshData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const [objectsResponse, pendingActions, notificationsResponse] = await Promise.all([
        apiClient.getAllOntologyObjects(),
        apiClient.getPendingActions(userId),
        apiClient.getNotifications(userId),
      ]);
      dispatch({ type: 'SET_OBJECTS', payload: (objectsResponse.results || []).map(mapApiObjectToOntologyObject) });
      dispatch({ type: 'SET_ACTIONS', payload: (pendingActions || []).map(mapApiActionToActionProposal) });
      dispatch({ type: 'SET_NOTIFICATIONS', payload: (notificationsResponse.results || []).map((n: any) => ({
        id: n.id, type: n.type, title: n.title, message: n.message,
        timestamp: n.timestamp ? new Date(n.timestamp).getTime() : Date.now(),
        read: n.read, priority: n.priority,
      })) });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [userId]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const executeAction = useCallback(async (actionId: string, objectId: string, params: Record<string, any> = {}) => {
    const object = state.objects.find(o => o.id === objectId);
    if (!object) return;

    try {
      const result = await apiClient.executeOntologyAction(object.objectType, objectId, actionId, params, userId);
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', payload: result.error || '动作提交失败' });
        return;
      }
      await refreshData();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : '动作提交失败' });
    }
  }, [state.objects, userId, refreshData]);

  const approveAction = useCallback(async (actionId: string) => {
    try {
      await apiClient.approveAction(actionId, userId);
      await refreshData();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : '审批失败' });
    }
  }, [userId, refreshData]);

  const rejectAction = useCallback(async (actionId: string, reason?: string) => {
    try {
      await apiClient.rejectAction(actionId, userId, reason);
      await refreshData();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : '拒绝失败' });
    }
  }, [userId, refreshData]);

  const selectObject = useCallback((objectId: string | null) => { dispatch({ type: 'SELECT_OBJECT', payload: { objectId } }); }, []);
  const markNotificationRead = useCallback((notificationId: string) => { dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { notificationId } }); apiClient.markNotificationRead(notificationId).catch(console.error); }, []);
  const getObjectById = useCallback((id: string) => state.objects.find(o => o.id === id), [state.objects]);
  const getObjectsByType = useCallback((type: ObjectType) => state.objects.filter(o => o.objectType === type), [state.objects]);
  const getPendingActions = useCallback(() => state.actions.filter(a => a.status === 'pending'), [state.actions]);
  const getUnreadNotifications = useCallback(() => state.notifications.filter(n => !n.read), [state.notifications]);
  const canUndo = useCallback(() => state.actionHistory.length > 0, [state.actionHistory]);
  const canRedo = useCallback(() => state.actionFuture.length > 0, [state.actionFuture]);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const searchObjects = useCallback(async (type: string, query: string): Promise<OntologyObject[]> => {
    try { const result = await apiClient.searchOntologyObjects(type, query); return (Array.isArray(result) ? result : []).map(mapApiObjectToOntologyObject); }
    catch (error) { return []; }
  }, [userId]);

  const value: ObjectContextValue = { state, dispatch, executeAction, approveAction, rejectAction, selectObject, markNotificationRead, getObjectById, getObjectsByType, getPendingActions, getUnreadNotifications, canUndo, canRedo, undo, redo, refreshData, searchObjects };

  return <ObjectContext.Provider value={value}>{children}</ObjectContext.Provider>;
}

export function useObjectContext() {
  const context = useContext(ObjectContext);
  if (!context) throw new Error('useObjectContext must be used within an ObjectProvider');
  return context;
}

export { ObjectContext };
