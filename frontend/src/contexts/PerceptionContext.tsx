import { createContext, useContext, useReducer, ReactNode, useCallback, useMemo, useState } from 'react';
import { OntologyObject } from '../types';
import { PerceptionEngine, EntityPerception, AnomalyDetectionResult } from '../perception';
import { apiClient } from '../api/client';

interface PerceptionState {
  entityPerceptions: Map<string, EntityPerception>;
  anomalyAlerts: AnomalyDetectionResult[];
  lastPerceptionTime: number | null;
  source: 'backend' | 'local' | 'none';
}

type PerceptionAction =
  | { type: 'UPDATE_PERCEPTION'; payload: { perceptions: Map<string, EntityPerception>; alerts: AnomalyDetectionResult[]; source: 'backend' | 'local' } }
  | { type: 'SET_PERCEIVING'; payload: boolean };

const initialPerceptionState: PerceptionState = {
  entityPerceptions: new Map(),
  anomalyAlerts: [],
  lastPerceptionTime: null,
  source: 'none',
};

function perceptionReducer(state: PerceptionState, action: PerceptionAction): PerceptionState {
  switch (action.type) {
    case 'UPDATE_PERCEPTION':
      return { entityPerceptions: action.payload.perceptions, anomalyAlerts: action.payload.alerts, lastPerceptionTime: Date.now(), source: action.payload.source };
    case 'SET_PERCEIVING':
      return state;
    default:
      return state;
  }
}

interface PerceptionContextValue {
  state: PerceptionState;
  runPerception: (objects: OntologyObject[]) => void;
  getEntityPerception: (entityId: string) => EntityPerception | undefined;
  getAnomalyAlerts: () => AnomalyDetectionResult[];
}

const PerceptionContext = createContext<PerceptionContextValue | undefined>(undefined);

interface PerceptionProviderProps {
  children: ReactNode;
}

function mapBackendPerceptionToEntityPerception(bp: any): EntityPerception {
  return {
    entityId: bp.entity_id,
    entityName: bp.entity_name,
    entityType: bp.entity_type,
    state: bp.state,
    anomalies: bp.anomalies.map((a: any) => ({
      type: a.type,
      description: a.description,
      severity: a.severity || 'medium',
      confidence: a.confidence || 0.8,
      timestamp: new Date().toISOString(),
      value: null,
      expectedMin: 0,
      expectedMax: 100,
    })),
    patterns: bp.patterns.map((p: any) => ({
      type: p.type,
      description: p.description,
      confidence: p.confidence || 0.7,
    })),
    alerts: bp.alerts.map((a: any) => ({
      id: a.id || `alert_${bp.entity_id}_${Date.now()}`,
      type: (a.type || 'risk') as 'risk' | 'opportunity' | 'anomaly' | 'trend',
      title: a.title,
      description: a.description,
      severity: a.severity || 'medium',
      suggestedActions: a.suggestedActions || [],
      relatedMetrics: a.relatedMetrics || [],
      confidence: a.confidence || 0.8,
    })),
    importance: {
      overall: 0.5,
      dimensions: {
        financial: 0.5,
        strategic: 0.5,
        relational: 0.5,
        risk: 0.5,
        growth: 0.5,
      },
      factors: [],
      recommendation: '建议关注',
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function PerceptionProvider({ children }: PerceptionProviderProps) {
  const [state, dispatch] = useReducer(perceptionReducer, initialPerceptionState);
  const [isFetching, setIsFetching] = useState(false);
  const perceptionEngine = useMemo(() => new PerceptionEngine(), []);

  const runPerception = useCallback(async (objects: OntologyObject[]) => {
    if (isFetching) return;
    setIsFetching(true);

    try {
      const backendData = await apiClient.getPerception();
      if (backendData && backendData.length > 0) {
        const perceptions = new Map<string, EntityPerception>();
        const allAlerts: AnomalyDetectionResult[] = [];
        backendData.forEach((bp: any) => {
          const ep = mapBackendPerceptionToEntityPerception(bp);
          perceptions.set(bp.entity_id, ep);
          allAlerts.push(...bp.anomalies.map((a: any) => ({
            type: a.type,
            description: a.description,
            severity: a.severity,
            confidence: a.confidence,
          })));
        });
        dispatch({ type: 'UPDATE_PERCEPTION', payload: { perceptions, alerts: allAlerts, source: 'backend' } });
        setIsFetching(false);
        return;
      }
    } catch {
      // Backend unavailable, fallback to local
    }

    const perceptions = new Map<string, EntityPerception>();
    const allAlerts: AnomalyDetectionResult[] = [];
    const localObjects = objects.slice(0, 80);
    localObjects.forEach(obj => {
      const perception = perceptionEngine.perceiveEntity(obj);
      perceptions.set(obj.id, perception);
      allAlerts.push(...perception.anomalies);
    });
    dispatch({ type: 'UPDATE_PERCEPTION', payload: { perceptions, alerts: allAlerts, source: 'local' } });
    setIsFetching(false);
  }, [perceptionEngine, isFetching]);

  const getEntityPerception = useCallback((entityId: string) => state.entityPerceptions.get(entityId), [state.entityPerceptions]);
  const getAnomalyAlerts = useCallback(() => state.anomalyAlerts, [state.anomalyAlerts]);

  const value: PerceptionContextValue = { state, runPerception, getEntityPerception, getAnomalyAlerts };

  return <PerceptionContext.Provider value={value}>{children}</PerceptionContext.Provider>;
}

export function usePerceptionContext() {
  const context = useContext(PerceptionContext);
  if (!context) throw new Error('usePerceptionContext must be used within a PerceptionProvider');
  return context;
}

export { PerceptionContext };
