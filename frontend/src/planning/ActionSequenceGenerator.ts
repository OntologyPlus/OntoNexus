import { OntologyObject, ObjectType } from '../types';
import { SubGoal } from './GoalDecompositionEngine';

export type ActionType = 
  | 'visit' 
  | 'call' 
  | 'meeting' 
  | 'academic_event' 
  | 'policy_negotiation' 
  | 'email' 
  | 'training'
  | 'follow_up'
  | 'review'
  | 'report';

export interface Action {
  id: string;
  type: ActionType;
  name: string;
  description: string;
  targetEntity?: string;
  targetEntityType?: ObjectType;
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: number;
  estimatedEffort: number;
  prerequisites: string[];
  expectedOutcome: string;
  risks: string[];
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledTime?: string;
  assignedTo?: string;
  metadata: Record<string, any>;
}

export interface ActionSequence {
  id: string;
  name: string;
  description: string;
  goalId: string;
  actions: Action[];
  totalDuration: number;
  totalEffort: number;
  dependencies: ActionDependency[];
  milestones: Milestone[];
  status: 'planned' | 'in_progress' | 'completed' | 'on_hold';
}

export interface ActionDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lag: number;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  completedDate?: string;
  status: 'pending' | 'achieved' | 'missed';
  relatedActions: string[];
}

export interface ActionTemplate {
  type: ActionType;
  nameTemplate: string;
  descriptionTemplate: string;
  defaultDuration: number;
  defaultEffort: number;
  requiredParameters: string[];
  optionalParameters: string[];
  applicableEntityTypes: ObjectType[];
}

export interface SequenceGenerationContext {
  goal: SubGoal;
  entities: OntologyObject[];
  constraints: SequenceConstraint[];
  preferences: ActionPreference[];
}

export interface SequenceConstraint {
  type: 'time' | 'resource' | 'dependency' | 'compliance';
  description: string;
  value: any;
}

export interface ActionPreference {
  actionType: ActionType;
  weight: number;
  conditions: string[];
}

const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    type: 'visit',
    nameTemplate: '拜访 {targetName}',
    descriptionTemplate: '拜访 {targetName}，目的：{purpose}',
    defaultDuration: 2,
    defaultEffort: 3,
    requiredParameters: ['targetName', 'purpose'],
    optionalParameters: ['agenda', 'materials'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.Hospital],
  },
  {
    type: 'call',
    nameTemplate: '电话沟通 - {targetName}',
    descriptionTemplate: '与 {targetName} 进行电话沟通，主题：{topic}',
    defaultDuration: 0.5,
    defaultEffort: 1,
    requiredParameters: ['targetName', 'topic'],
    optionalParameters: ['callScript'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.SalesRep],
  },
  {
    type: 'meeting',
    nameTemplate: '会议 - {meetingName}',
    descriptionTemplate: '组织会议：{meetingName}，参与者：{participants}',
    defaultDuration: 2,
    defaultEffort: 5,
    requiredParameters: ['meetingName', 'participants'],
    optionalParameters: ['agenda', 'location'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.Hospital, ObjectType.SalesRep],
  },
  {
    type: 'academic_event',
    nameTemplate: '学术活动 - {eventName}',
    descriptionTemplate: '组织/参与学术活动：{eventName}',
    defaultDuration: 4,
    defaultEffort: 20,
    requiredParameters: ['eventName'],
    optionalParameters: ['speakers', 'location', 'attendees'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.Hospital],
  },
  {
    type: 'policy_negotiation',
    nameTemplate: '政策协商 - {targetName}',
    descriptionTemplate: '与 {targetName} 进行政策协商，议题：{topic}',
    defaultDuration: 3,
    defaultEffort: 10,
    requiredParameters: ['targetName', 'topic'],
    optionalParameters: ['negotiationPoints'],
    applicableEntityTypes: [ObjectType.Hospital, ObjectType.Territory],
  },
  {
    type: 'email',
    nameTemplate: '邮件 - {subject}',
    descriptionTemplate: '发送邮件给 {recipients}，主题：{subject}',
    defaultDuration: 0.25,
    defaultEffort: 0.5,
    requiredParameters: ['recipients', 'subject'],
    optionalParameters: ['attachments'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.SalesRep],
  },
  {
    type: 'training',
    nameTemplate: '培训 - {trainingName}',
    descriptionTemplate: '培训活动：{trainingName}，对象：{trainees}',
    defaultDuration: 4,
    defaultEffort: 15,
    requiredParameters: ['trainingName', 'trainees'],
    optionalParameters: ['materials', 'trainer'],
    applicableEntityTypes: [ObjectType.SalesRep],
  },
  {
    type: 'follow_up',
    nameTemplate: '跟进 - {targetName}',
    descriptionTemplate: '跟进 {targetName} 的 {followUpItem}',
    defaultDuration: 0.5,
    defaultEffort: 1,
    requiredParameters: ['targetName', 'followUpItem'],
    optionalParameters: [],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.Hospital, ObjectType.SalesRep],
  },
  {
    type: 'review',
    nameTemplate: '评审 - {reviewName}',
    descriptionTemplate: '评审：{reviewName}',
    defaultDuration: 1,
    defaultEffort: 2,
    requiredParameters: ['reviewName'],
    optionalParameters: ['reviewers', 'criteria'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.Hospital, ObjectType.SalesRep],
  },
  {
    type: 'report',
    nameTemplate: '报告 - {reportName}',
    descriptionTemplate: '生成报告：{reportName}',
    defaultDuration: 2,
    defaultEffort: 4,
    requiredParameters: ['reportName'],
    optionalParameters: ['format', 'recipients'],
    applicableEntityTypes: [ObjectType.Doctor, ObjectType.Hospital, ObjectType.SalesRep, ObjectType.Territory],
  },
];

const GOAL_TYPE_ACTION_PREFERENCES: Record<string, { actionType: ActionType; weight: number }[]> = {
  acquisition: [
    { actionType: 'visit', weight: 0.3 },
    { actionType: 'call', weight: 0.25 },
    { actionType: 'email', weight: 0.2 },
    { actionType: 'meeting', weight: 0.15 },
    { actionType: 'follow_up', weight: 0.1 },
  ],
  retention: [
    { actionType: 'visit', weight: 0.35 },
    { actionType: 'call', weight: 0.25 },
    { actionType: 'follow_up', weight: 0.2 },
    { actionType: 'meeting', weight: 0.15 },
    { actionType: 'email', weight: 0.05 },
  ],
  expansion: [
    { actionType: 'visit', weight: 0.25 },
    { actionType: 'academic_event', weight: 0.25 },
    { actionType: 'meeting', weight: 0.2 },
    { actionType: 'policy_negotiation', weight: 0.15 },
    { actionType: 'call', weight: 0.15 },
  ],
  efficiency: [
    { actionType: 'training', weight: 0.3 },
    { actionType: 'review', weight: 0.25 },
    { actionType: 'report', weight: 0.25 },
    { actionType: 'meeting', weight: 0.2 },
  ],
  satisfaction: [
    { actionType: 'visit', weight: 0.3 },
    { actionType: 'call', weight: 0.25 },
    { actionType: 'follow_up', weight: 0.25 },
    { actionType: 'meeting', weight: 0.2 },
  ],
  training: [
    { actionType: 'training', weight: 0.5 },
    { actionType: 'review', weight: 0.25 },
    { actionType: 'follow_up', weight: 0.25 },
  ],
  monitoring: [
    { actionType: 'review', weight: 0.4 },
    { actionType: 'report', weight: 0.35 },
    { actionType: 'follow_up', weight: 0.25 },
  ],
  documentation: [
    { actionType: 'report', weight: 0.5 },
    { actionType: 'email', weight: 0.25 },
    { actionType: 'review', weight: 0.25 },
  ],
  improvement: [
    { actionType: 'review', weight: 0.3 },
    { actionType: 'training', weight: 0.3 },
    { actionType: 'meeting', weight: 0.25 },
    { actionType: 'follow_up', weight: 0.15 },
  ],
};

export class ActionSequenceGenerator {
  generateSequence(context: SequenceGenerationContext): ActionSequence {
    const actions = this.generateActions(context);
    const sortedActions = this.sortByPriority(actions);
    const dependencies = this.generateDependencies(sortedActions);
    const milestones = this.generateMilestones(sortedActions, context.goal);

    return {
      id: `seq_${context.goal.id}_${Date.now()}`,
      name: `行动序列 - ${context.goal.name}`,
      description: `为达成目标 "${context.goal.name}" 生成的行动序列`,
      goalId: context.goal.id,
      actions: sortedActions,
      totalDuration: this.calculateTotalDuration(sortedActions, dependencies),
      totalEffort: sortedActions.reduce((sum, a) => sum + a.estimatedEffort, 0),
      dependencies,
      milestones,
      status: 'planned',
    };
  }

  generateActions(context: SequenceGenerationContext): Action[] {
    const actions: Action[] = [];
    const subGoalType = context.goal.metadata.subGoalType;
    const preferences = GOAL_TYPE_ACTION_PREFERENCES[subGoalType] || this.getDefaultPreferences();

    const relevantEntities = this.filterRelevantEntities(context.entities, context.goal);
    
    for (const entity of relevantEntities.slice(0, 5)) {
      const entityActions = this.generateActionsForEntity(entity, preferences, context);
      actions.push(...entityActions);
    }

    const supportActions = this.generateSupportActions(context.goal, actions);
    actions.push(...supportActions);

    return actions;
  }

  private generateActionsForEntity(
    entity: OntologyObject,
    preferences: { actionType: ActionType; weight: number }[],
    context: SequenceGenerationContext
  ): Action[] {
    const actions: Action[] = [];
    const topPreferences = preferences.slice(0, 3);

    for (const pref of topPreferences) {
      const template = ACTION_TEMPLATES.find(t => t.type === pref.actionType);
      if (!template || !template.applicableEntityTypes.includes(entity.objectType)) {
        continue;
      }

      const action = this.createActionFromTemplate(template, entity, context);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  private createActionFromTemplate(
    template: ActionTemplate,
    entity: OntologyObject,
    context: SequenceGenerationContext
  ): Action | null {
    const parameters: Record<string, string> = {
      targetName: entity.name,
      purpose: context.goal.description,
      topic: context.goal.name,
      meetingName: `${context.goal.name} 会议`,
      participants: entity.name,
      eventName: `${context.goal.name} 学术活动`,
      subject: context.goal.name,
      recipients: entity.name,
      trainingName: `${context.goal.name} 培训`,
      trainees: entity.name,
      followUpItem: context.goal.name,
      reviewName: `${context.goal.name} 评审`,
      reportName: `${context.goal.name} 报告`,
    };

    const name = this.fillTemplate(template.nameTemplate, parameters);
    const description = this.fillTemplate(template.descriptionTemplate, parameters);

    return {
      id: `action_${entity.id}_${template.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: template.type,
      name,
      description,
      targetEntity: entity.id,
      targetEntityType: entity.objectType,
      priority: this.determinePriority(context.goal.priority),
      estimatedDuration: template.defaultDuration,
      estimatedEffort: template.defaultEffort,
      prerequisites: [],
      expectedOutcome: `推进 ${context.goal.name} 的实现`,
      risks: this.identifyActionRisks(template.type, entity),
      status: 'pending',
      metadata: {
        template: template.type,
        entityId: entity.id,
        goalId: context.goal.id,
      },
    };
  }

  private generateSupportActions(goal: SubGoal, existingActions: Action[]): Action[] {
    const supportActions: Action[] = [];

    supportActions.push({
      id: `action_${goal.id}_review_${Date.now()}`,
      type: 'review',
      name: `阶段性评审 - ${goal.name}`,
      description: `对 ${goal.name} 的进展进行评审`,
      priority: 'medium',
      estimatedDuration: 1,
      estimatedEffort: 2,
      prerequisites: existingActions.slice(0, 3).map(a => a.id),
      expectedOutcome: '评估进展并调整策略',
      risks: [],
      status: 'pending',
      metadata: { goalId: goal.id, type: 'support' },
    });

    supportActions.push({
      id: `action_${goal.id}_report_${Date.now()}`,
      type: 'report',
      name: `进展报告 - ${goal.name}`,
      description: `生成 ${goal.name} 的进展报告`,
      priority: 'low',
      estimatedDuration: 1,
      estimatedEffort: 2,
      prerequisites: [supportActions[0].id],
      expectedOutcome: '记录进展并汇报',
      risks: [],
      status: 'pending',
      metadata: { goalId: goal.id, type: 'support' },
    });

    return supportActions;
  }

  private filterRelevantEntities(entities: OntologyObject[], goal: SubGoal): OntologyObject[] {
    return entities.filter(e => {
      if (goal.metadata.subGoalType === 'acquisition' || goal.metadata.subGoalType === 'retention') {
        return e.objectType === ObjectType.Doctor || e.objectType === ObjectType.Hospital;
      }
      if (goal.metadata.subGoalType === 'training') {
        return e.objectType === ObjectType.SalesRep;
      }
      return true;
    });
  }

  private sortByPriority(actions: Action[]): Action[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...actions].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.estimatedEffort - b.estimatedEffort;
    });
  }

  private generateDependencies(actions: Action[]): ActionDependency[] {
    const dependencies: ActionDependency[] = [];

    for (let i = 1; i < actions.length; i++) {
      const current = actions[i];
      
      if (current.prerequisites.length > 0) {
        for (const prereqId of current.prerequisites) {
          dependencies.push({
            id: `dep_${prereqId}_${current.id}`,
            predecessorId: prereqId,
            successorId: current.id,
            type: 'finish_to_start',
            lag: 0,
          });
        }
      } else if (i > 0 && this.shouldDepend(actions[i - 1], current)) {
        dependencies.push({
          id: `dep_${actions[i - 1].id}_${current.id}`,
          predecessorId: actions[i - 1].id,
          successorId: current.id,
          type: 'finish_to_start',
          lag: 0,
        });
      }
    }

    return dependencies;
  }

  private shouldDepend(predecessor: Action, successor: Action): boolean {
    if (predecessor.targetEntity === successor.targetEntity) {
      return true;
    }
    if (predecessor.type === 'visit' && successor.type === 'follow_up') {
      return true;
    }
    if (predecessor.type === 'meeting' && successor.type === 'review') {
      return true;
    }
    return false;
  }

  private generateMilestones(actions: Action[], goal: SubGoal): Milestone[] {
    const milestones: Milestone[] = [];
    const totalEffort = actions.reduce((sum, a) => sum + a.estimatedEffort, 0);
    
    let accumulatedEffort = 0;
    const milestonePoints = [0.25, 0.5, 0.75, 1.0];
    
    for (const point of milestonePoints) {
      const targetEffort = totalEffort * point;
      let milestoneAction: Action | undefined;
      
      for (const action of actions) {
        accumulatedEffort += action.estimatedEffort;
        if (accumulatedEffort >= targetEffort) {
          milestoneAction = action;
          break;
        }
      }

      if (milestoneAction) {
        milestones.push({
          id: `milestone_${goal.id}_${point * 100}`,
          name: `${(point * 100).toFixed(0)}% 完成里程碑`,
          description: `完成 ${goal.name} 的 ${(point * 100).toFixed(0)}%`,
          targetDate: new Date(Date.now() + (point * goal.estimatedEffort * 7 * 24 * 60 * 60 * 1000)).toISOString(),
          status: 'pending',
          relatedActions: actions.filter(a => actions.indexOf(a) <= actions.indexOf(milestoneAction!)).map(a => a.id),
        });
      }
    }

    return milestones;
  }

  private calculateTotalDuration(actions: Action[], dependencies: ActionDependency[]): number {
    const criticalPath = this.findCriticalPath(actions, dependencies);
    return criticalPath.reduce((sum, a) => sum + a.estimatedDuration, 0);
  }

  private findCriticalPath(actions: Action[], dependencies: ActionDependency[]): Action[] {
    const actionMap = new Map(actions.map(a => [a.id, a]));
    const inDegree = new Map(actions.map(a => [a.id, 0]));
    
    for (const dep of dependencies) {
      const current = inDegree.get(dep.successorId) || 0;
      inDegree.set(dep.successorId, current + 1);
    }

    const startActions = actions.filter(a => inDegree.get(a.id) === 0);
    
    let maxPath: Action[] = [];
    let maxDuration = 0;

    for (const start of startActions) {
      const path = this.findLongestPath(start.id, actionMap, dependencies);
      const duration = path.reduce((sum, a) => sum + a.estimatedDuration, 0);
      if (duration > maxDuration) {
        maxDuration = duration;
        maxPath = path;
      }
    }

    return maxPath;
  }

  private findLongestPath(
    actionId: string,
    actionMap: Map<string, Action>,
    dependencies: ActionDependency[]
  ): Action[] {
    const action = actionMap.get(actionId);
    if (!action) return [];

    const successors = dependencies
      .filter(d => d.predecessorId === actionId)
      .map(d => d.successorId);

    if (successors.length === 0) {
      return [action];
    }

    let longestPath: Action[] = [];
    let maxDuration = 0;

    for (const successorId of successors) {
      const subPath = this.findLongestPath(successorId, actionMap, dependencies);
      const duration = subPath.reduce((sum, a) => sum + a.estimatedDuration, 0);
      if (duration > maxDuration) {
        maxDuration = duration;
        longestPath = subPath;
      }
    }

    return [action, ...longestPath];
  }

  private fillTemplate(template: string, parameters: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(parameters)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  private determinePriority(goalPriority: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
    return goalPriority;
  }

  private identifyActionRisks(actionType: ActionType, entity: OntologyObject): string[] {
    const risks: string[] = [];

    switch (actionType) {
      case 'visit':
        risks.push('客户时间冲突');
        risks.push('拜访效果不佳');
        break;
      case 'academic_event':
        risks.push('参会人数不足');
        risks.push('预算超支');
        break;
      case 'policy_negotiation':
        risks.push('谈判失败');
        risks.push('政策变化');
        break;
      case 'meeting':
        risks.push('参与者缺席');
        risks.push('议题偏离');
        break;
    }

    if (entity.status === 'critical') {
      risks.push('客户状态不稳定');
    }

    return risks;
  }

  private getDefaultPreferences(): { actionType: ActionType; weight: number }[] {
    return [
      { actionType: 'visit', weight: 0.3 },
      { actionType: 'call', weight: 0.25 },
      { actionType: 'meeting', weight: 0.2 },
      { actionType: 'follow_up', weight: 0.15 },
      { actionType: 'email', weight: 0.1 },
    ];
  }

  getActionTemplates(): ActionTemplate[] {
    return [...ACTION_TEMPLATES];
  }

  addActionTemplate(template: ActionTemplate): void {
    ACTION_TEMPLATES.push(template);
  }
}
