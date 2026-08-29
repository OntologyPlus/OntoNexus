import { createContext, useContext, ReactNode, useEffect, useMemo } from 'react';
import { OntologyObject, ActionProposal, Notification, AuditLogEntry, ObjectType } from '../types';
import { EntityPerception, AnomalyDetectionResult } from '../perception';
import { Reminder } from '../interaction/SmartReminderSystem';
import { ProactiveSuggestion } from '../interaction/ProactiveSuggestionGenerator';
import { ObjectProvider, useObjectContext } from './ObjectContext';
import { PerceptionProvider, usePerceptionContext } from './PerceptionContext';
import { CognitiveProvider, useCognitiveContext } from './CognitiveContext';

interface PerceptionState {
  entityPerceptions: Map<string, EntityPerception>;
  anomalyAlerts: AnomalyDetectionResult[];
  lastPerceptionTime: number | null;
}

interface CombinedOntologyState {
  objects: OntologyObject[];
  actions: ActionProposal[];
  notifications: Notification[];
  auditLog: AuditLogEntry[];
  selectedObjectId: string | null;
  actionHistory: ActionProposal[];
  actionFuture: ActionProposal[];
  loading: boolean;
  error: string | null;
  perception: PerceptionState;
  cognitive: {
    reminders: Reminder[];
    suggestions: ProactiveSuggestion[];
    agentStatus: 'idle' | 'perceiving' | 'reasoning' | 'planning' | 'executing' | 'learning';
    currentTask: string | null;
  };
}

interface OntologyContextValue {
  state: CombinedOntologyState;
  dispatch: any;
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
  runPerception: () => void;
  getEntityPerception: (entityId: string) => EntityPerception | undefined;
  getAnomalyAlerts: () => AnomalyDetectionResult[];
  addReminder: (reminder: Reminder) => void;
  dismissReminder: (reminderId: string) => void;
  addSuggestion: (suggestion: ProactiveSuggestion) => void;
  dismissSuggestion: (suggestionId: string) => void;
  setAgentStatus: (status: 'idle' | 'perceiving' | 'reasoning' | 'planning' | 'executing' | 'learning', task?: string) => void;
}

const OntologyContext = createContext<OntologyContextValue | undefined>(undefined);

function OntologyContextProvider({ children }: { children: ReactNode }) {
  const objectCtx = useObjectContext();
  const perceptionCtx = usePerceptionContext();
  const cognitiveCtx = useCognitiveContext();

  useEffect(() => {
    if (objectCtx.state.objects.length > 0 && perceptionCtx.state.lastPerceptionTime === null) {
      perceptionCtx.runPerception(objectCtx.state.objects);
    }
  }, [objectCtx.state.objects, perceptionCtx.state.lastPerceptionTime, perceptionCtx.runPerception]);

  const runPerception = () => {
    cognitiveCtx.setAgentStatus('perceiving', '感知实体状态');
    perceptionCtx.runPerception(objectCtx.state.objects);
    cognitiveCtx.setAgentStatus('idle');
  };

  const value = useMemo<OntologyContextValue>(() => {
    const combinedState: CombinedOntologyState = {
      objects: objectCtx.state.objects,
      actions: objectCtx.state.actions,
      notifications: objectCtx.state.notifications,
      auditLog: objectCtx.state.auditLog,
      selectedObjectId: objectCtx.state.selectedObjectId,
      actionHistory: objectCtx.state.actionHistory,
      actionFuture: objectCtx.state.actionFuture,
      loading: objectCtx.state.loading,
      error: objectCtx.state.error,
      perception: perceptionCtx.state,
      cognitive: cognitiveCtx.state,
    };

    return {
      state: combinedState,
      dispatch: objectCtx.dispatch,
      executeAction: objectCtx.executeAction,
      approveAction: objectCtx.approveAction,
      rejectAction: objectCtx.rejectAction,
      selectObject: objectCtx.selectObject,
      markNotificationRead: objectCtx.markNotificationRead,
      getObjectById: objectCtx.getObjectById,
      getObjectsByType: objectCtx.getObjectsByType,
      getPendingActions: objectCtx.getPendingActions,
      getUnreadNotifications: objectCtx.getUnreadNotifications,
      canUndo: objectCtx.canUndo,
      canRedo: objectCtx.canRedo,
      undo: objectCtx.undo,
      redo: objectCtx.redo,
      refreshData: objectCtx.refreshData,
      searchObjects: objectCtx.searchObjects,
      runPerception,
      getEntityPerception: perceptionCtx.getEntityPerception,
      getAnomalyAlerts: perceptionCtx.getAnomalyAlerts,
      addReminder: cognitiveCtx.addReminder,
      dismissReminder: cognitiveCtx.dismissReminder,
      addSuggestion: cognitiveCtx.addSuggestion,
      dismissSuggestion: cognitiveCtx.dismissSuggestion,
      setAgentStatus: cognitiveCtx.setAgentStatus,
    };
  }, [objectCtx, perceptionCtx, cognitiveCtx]);

  return (
    <OntologyContext.Provider value={value}>
      {children}
    </OntologyContext.Provider>
  );
}

interface OntologyProviderProps {
  children: ReactNode;
  userId: string;
}

export function OntologyProvider({ children, userId }: OntologyProviderProps) {
  return (
    <ObjectProvider userId={userId}>
      <PerceptionProvider>
        <CognitiveProvider>
          <OntologyContextProvider>
            {children}
          </OntologyContextProvider>
        </CognitiveProvider>
      </PerceptionProvider>
    </ObjectProvider>
  );
}

export function useOntologyContext() {
  const context = useContext(OntologyContext);
  if (!context) {
    throw new Error('useOntologyContext must be used within an OntologyProvider');
  }
  return context;
}

export default OntologyContext;
