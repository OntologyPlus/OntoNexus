import React, { createContext, useContext, useReducer, ReactNode, useCallback, useEffect, useState } from 'react';
import { Reminder } from '../interaction/SmartReminderSystem';
import { ProactiveSuggestion } from '../interaction/ProactiveSuggestionGenerator';
import { apiClient } from '../api/client';

interface CognitiveState {
  reminders: Reminder[];
  suggestions: ProactiveSuggestion[];
  agentStatus: 'idle' | 'perceiving' | 'reasoning' | 'planning' | 'executing' | 'learning';
  currentTask: string | null;
  source: 'backend' | 'local' | 'none';
}

type CognitiveAction =
  | { type: 'UPDATE_COGNITIVE'; payload: Partial<CognitiveState> }
  | { type: 'SET_SUGGESTIONS'; payload: { suggestions: ProactiveSuggestion[]; source: 'backend' | 'local' } }
  | { type: 'SET_REMINDERS'; payload: Reminder[] }
  | { type: 'ADD_REMINDER'; payload: Reminder }
  | { type: 'DISMISS_REMINDER'; payload: { reminderId: string } }
  | { type: 'ADD_SUGGESTION'; payload: ProactiveSuggestion }
  | { type: 'DISMISS_SUGGESTION'; payload: { suggestionId: string } };

const initialCognitiveState: CognitiveState = {
  reminders: [],
  suggestions: [],
  agentStatus: 'idle',
  currentTask: null,
  source: 'none',
};

function cognitiveReducer(state: CognitiveState, action: CognitiveAction): CognitiveState {
  switch (action.type) {
    case 'UPDATE_COGNITIVE':
      return { ...state, ...action.payload };
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.payload.suggestions, source: action.payload.source };
    case 'SET_REMINDERS':
      return { ...state, reminders: action.payload };
    case 'ADD_REMINDER':
      return { ...state, reminders: [...state.reminders, action.payload] };
    case 'DISMISS_REMINDER':
      return { ...state, reminders: state.reminders.filter(r => r.id !== action.payload.reminderId) };
    case 'ADD_SUGGESTION':
      return { ...state, suggestions: [...state.suggestions, action.payload] };
    case 'DISMISS_SUGGESTION':
      return { ...state, suggestions: state.suggestions.filter(s => s.id !== action.payload.suggestionId) };
    default:
      return state;
  }
}

interface CognitiveContextValue {
  state: CognitiveState;
  dispatch: React.Dispatch<CognitiveAction>;
  addReminder: (reminder: Reminder) => void;
  dismissReminder: (reminderId: string) => void;
  addSuggestion: (suggestion: ProactiveSuggestion) => void;
  dismissSuggestion: (suggestionId: string) => void;
  setAgentStatus: (status: CognitiveState['agentStatus'], task?: string) => void;
  refreshSuggestions: () => Promise<void>;
  refreshReminders: () => Promise<void>;
}

const CognitiveContext = createContext<CognitiveContextValue | undefined>(undefined);

interface CognitiveProviderProps {
  children: ReactNode;
}

export function CognitiveProvider({ children }: CognitiveProviderProps) {
  const [state, dispatch] = useReducer(cognitiveReducer, initialCognitiveState);
  const [isFetching, setIsFetching] = useState(false);

  const refreshSuggestions = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);

    try {
      const backendSuggestions = await apiClient.getSuggestions();
      if (backendSuggestions && backendSuggestions.length > 0) {
        dispatch({
          type: 'SET_SUGGESTIONS',
          payload: { suggestions: backendSuggestions as ProactiveSuggestion[], source: 'backend' }
        });
        setIsFetching(false);
        return;
      }
    } catch {
      // Backend unavailable, fallback to local
    }

    setIsFetching(false);
  }, [isFetching]);

  const refreshReminders = useCallback(async () => {
    try {
      const userId = localStorage.getItem('user_id') || '';
      if (userId) {
        const backendReminders = await apiClient.getReminders(userId);
        if (backendReminders && backendReminders.length > 0) {
          dispatch({ type: 'SET_REMINDERS', payload: backendReminders as Reminder[] });
          return;
        }
      }
    } catch {
      // Backend unavailable
    }
  }, []);

  useEffect(() => {
    refreshSuggestions();
    refreshReminders();
  }, []);

  const addReminder = useCallback((reminder: Reminder) => { dispatch({ type: 'ADD_REMINDER', payload: reminder }); }, []);
  const dismissReminder = useCallback((reminderId: string) => { dispatch({ type: 'DISMISS_REMINDER', payload: { reminderId } }); apiClient.dismissReminder(reminderId).catch(console.error); }, []);
  const addSuggestion = useCallback((suggestion: ProactiveSuggestion) => { dispatch({ type: 'ADD_SUGGESTION', payload: suggestion }); }, []);
  const dismissSuggestion = useCallback((suggestionId: string) => { dispatch({ type: 'DISMISS_SUGGESTION', payload: { suggestionId } }); }, []);
  const setAgentStatus = useCallback((status: CognitiveState['agentStatus'], task?: string) => { dispatch({ type: 'UPDATE_COGNITIVE', payload: { agentStatus: status, currentTask: task || null } }); }, []);

  const value: CognitiveContextValue = { state, dispatch, addReminder, dismissReminder, addSuggestion, dismissSuggestion, setAgentStatus, refreshSuggestions, refreshReminders };

  return <CognitiveContext.Provider value={value}>{children}</CognitiveContext.Provider>;
}

export function useCognitiveContext() {
  const context = useContext(CognitiveContext);
  if (!context) throw new Error('useCognitiveContext must be used within a CognitiveProvider');
  return context;
}

export { CognitiveContext };
