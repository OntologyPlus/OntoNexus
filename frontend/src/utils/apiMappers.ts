import { OntologyObject, ActionProposal, ObjectType } from '../types';

export function mapApiObjectToOntologyObject(apiObj: any): OntologyObject {
  return {
    id: apiObj.id,
    objectType: apiObj.objectType as ObjectType,
    name: apiObj.name,
    properties: apiObj.properties || {},
    links: (apiObj.links || []).map((l: any) => ({
      linkType: l.linkType,
      targetId: l.targetId,
      targetName: l.targetName,
      targetType: l.targetType,
      properties: l.properties,
    })),
    actions: (apiObj.actions || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      parameters: a.parameters || [],
      preconditions: a.preconditions || [],
      sideEffects: a.sideEffects || [],
      writeBackTargets: a.writeBackTargets || [],
      requiresApproval: a.requiresApproval || false,
    })),
    events: (apiObj.events || []).map((e: any) => ({
      id: e.id,
      eventType: e.eventType,
      timestamp: e.timestamp,
      description: e.description,
      relatedObjectId: e.relatedObjectId,
      relatedObjectName: e.relatedObjectName,
    })),
    timeSeries: apiObj.timeSeries || {},
    interfaces: apiObj.interfaces || [],
    status: apiObj.status,
    lifecycleStage: apiObj.lifecycleStage,
    sentiment: apiObj.sentiment,
    complianceRiskLevel: apiObj.complianceRiskLevel,
  };
}

export function mapApiActionToActionProposal(a: any): ActionProposal {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    type: a.type,
    entityId: a.entity_id,
    entityName: a.entity_name,
    entityType: a.entity_type as ObjectType,
    priority: a.priority,
    confidence: a.confidence || 0.9,
    reasoningChain: a.reasoning_chain ? {
      conclusion: a.reasoning_chain.conclusion || '',
      evidence: a.reasoning_chain.evidence || [],
      confidence: a.reasoning_chain.confidence || 0.9,
      alternativeHypotheses: a.reasoning_chain.alternativeHypotheses || [],
      suggestedActions: a.reasoning_chain.suggestedActions || [],
    } : {
      conclusion: a.description || '',
      evidence: [],
      confidence: 0.9,
      alternativeHypotheses: [],
      suggestedActions: [],
    },
    actionDefinition: a.action_definition ? {
      id: a.action_definition.id,
      name: a.action_definition.name,
      description: a.action_definition.description || '',
      parameters: a.action_definition.parameters || [],
      preconditions: a.action_definition.preconditions || [],
      sideEffects: a.action_definition.sideEffects || [],
      writeBackTargets: a.action_definition.writeBackTargets || [],
      requiresApproval: a.action_definition.requiresApproval || false,
    } : {
      id: a.type,
      name: a.type,
      description: a.description || '',
      parameters: [],
      preconditions: [],
      sideEffects: [],
      writeBackTargets: [],
      requiresApproval: true,
    },
    status: a.status,
    timestamp: a.timestamp,
  };
}
