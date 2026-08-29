import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { HUB_CHANGED_EVENT } from '../api/client';
import { ActionProposal } from '../types';

export type HubAction = ActionProposal & { proposedBy?: string };

export const HUB_OVERVIEW_QUERY_KEY = ['hub', 'overview'] as const;

export function mapHubAction(a: any): HubAction {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    type: a.type,
    entityId: a.entity_id || a.entityId,
    entityName: a.entityName || a.entity_name || '',
    entityType: a.entityType || a.entity_type,
    priority: a.priority || 'medium',
    confidence: a.confidence ?? 0,
    reasoningChain: a.reasoningChain || a.reasoning_chain,
    actionDefinition: a.action_definition || a.actionDefinition,
    status: a.status,
    timestamp: a.timestamp,
    proposedBy: a.proposed_by,
  } as HubAction;
}

export function useHubOverview() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: HUB_OVERVIEW_QUERY_KEY,
    queryFn: () => apiClient.getHubOverview(),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const onChange = () => {
      queryClient.invalidateQueries({ queryKey: HUB_OVERVIEW_QUERY_KEY });
    };
    window.addEventListener(HUB_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(HUB_CHANGED_EVENT, onChange);
  }, [queryClient]);

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    overview: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? '加载失败' : '',
    reload,
  };
}

export function objectName(overview: any, id?: string): string {
  if (!id) return '';
  if (overview?.focal_object?.id === id) return overview.focal_object.name || '';
  const hit = (overview?.alerts || []).find((a: any) => a.id === id);
  return hit?.name || '';
}
