import { ProactiveSuggestion, SuggestionType } from './ProactiveSuggestionGenerator';

export type ReminderType = 'urgent' | 'important' | 'routine' | 'predictive' | 'opportunity';

export type RecurrencePattern = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'none';

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  relatedEntity?: string;
  relatedEntityType?: string;
  dueDate: string;
  recurrence: RecurrencePattern;
  status: 'pending' | 'completed' | 'snoozed' | 'dismissed';
  createdAt: string;
  completedAt?: string;
  snoozedUntil?: string;
  metadata: Record<string, any>;
}

export interface SmartReminderConfig {
  maxActiveReminders: number;
  snoozeDurations: number[];
  priorityThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
}

export interface ReminderTemplate {
  type: ReminderType;
  titleTemplate: string;
  descriptionTemplate: string;
  defaultPriority: 'critical' | 'high' | 'medium' | 'low';
  defaultDueDays: number;
  triggers: ReminderTrigger[];
}

export interface ReminderTrigger {
  condition: string;
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface CompletionRecord {
  reminderId: string;
  completedAt: string;
  completedBy?: string;
  outcome: 'success' | 'partial' | 'failed' | 'skipped';
  notes?: string;
  followUpRequired: boolean;
}

const DEFAULT_CONFIG: SmartReminderConfig = {
  maxActiveReminders: 50,
  snoozeDurations: [15, 30, 60, 120, 1440],
  priorityThresholds: {
    critical: 95,
    high: 80,
    medium: 60,
  },
};

const REMINDER_TEMPLATES: ReminderTemplate[] = [
  {
    type: 'urgent',
    titleTemplate: '紧急: {title}',
    descriptionTemplate: '{description}',
    defaultPriority: 'critical',
    defaultDueDays: 1,
    triggers: [
      { condition: 'entity_status_critical', action: 'immediate_attention', priority: 'critical' },
      { condition: 'anomaly_detected', action: 'investigate', priority: 'high' },
    ],
  },
  {
    type: 'important',
    titleTemplate: '重要: {title}',
    descriptionTemplate: '{description}',
    defaultPriority: 'high',
    defaultDueDays: 3,
    triggers: [
      { condition: 'entity_status_warning', action: 'monitor', priority: 'high' },
      { condition: 'target_at_risk', action: 'review', priority: 'high' },
    ],
  },
  {
    type: 'routine',
    titleTemplate: '例行: {title}',
    descriptionTemplate: '{description}',
    defaultPriority: 'medium',
    defaultDueDays: 7,
    triggers: [
      { condition: 'scheduled_visit', action: 'prepare', priority: 'medium' },
      { condition: 'periodic_review', action: 'review', priority: 'medium' },
    ],
  },
  {
    type: 'predictive',
    titleTemplate: '预测提醒: {title}',
    descriptionTemplate: '{description}',
    defaultPriority: 'medium',
    defaultDueDays: 14,
    triggers: [
      { condition: 'trend_prediction', action: 'prepare', priority: 'medium' },
      { condition: 'seasonal_pattern', action: 'plan', priority: 'medium' },
    ],
  },
  {
    type: 'opportunity',
    titleTemplate: '机会提醒: {title}',
    descriptionTemplate: '{description}',
    defaultPriority: 'medium',
    defaultDueDays: 7,
    triggers: [
      { condition: 'growth_opportunity', action: 'capitalize', priority: 'medium' },
      { condition: 'market_shift', action: 'respond', priority: 'medium' },
    ],
  },
];

export class SmartReminderSystem {
  private reminders: Map<string, Reminder> = new Map();
  private completionRecords: CompletionRecord[] = [];
  private config: SmartReminderConfig;

  constructor(config?: Partial<SmartReminderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  generateReminders(state: {
    entities: { id: string; name: string; type: string; status?: string }[];
    suggestions: ProactiveSuggestion[];
    predictions: { type: string; probability: number; entityId?: string }[];
  }): Reminder[] {
    const reminders: Reminder[] = [];
    const timestamp = new Date().toISOString();

    for (const entity of state.entities) {
      if (entity.status === 'critical') {
        reminders.push(this.createEntityReminder(entity, 'urgent', timestamp));
      } else if (entity.status === 'warning') {
        reminders.push(this.createEntityReminder(entity, 'important', timestamp));
      }
    }

    for (const suggestion of state.suggestions) {
      if (suggestion.priority === 'critical' || suggestion.priority === 'high') {
        reminders.push(this.createSuggestionReminder(suggestion, timestamp));
      }
    }

    for (const prediction of state.predictions) {
      if (prediction.probability > 0.7) {
        reminders.push(this.createPredictiveReminder(prediction, timestamp));
      }
    }

    return this.prioritizeAndLimit(reminders);
  }

  scheduleRecurringReminder(reminder: Reminder, pattern: RecurrencePattern): Reminder {
    const nextDue = this.calculateNextDueDate(reminder.dueDate, pattern);
    
    const recurringReminder: Reminder = {
      ...reminder,
      id: `reminder_recur_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recurrence: pattern,
      dueDate: nextDue,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.reminders.set(recurringReminder.id, recurringReminder);
    return recurringReminder;
  }

  getDueReminders(): Reminder[] {
    const now = new Date();
    
    return Array.from(this.reminders.values())
      .filter(r => r.status === 'pending' && new Date(r.dueDate) <= now)
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  getUpcomingReminders(withinDays: number = 7): Reminder[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    
    return Array.from(this.reminders.values())
      .filter(r => {
        const dueDate = new Date(r.dueDate);
        return r.status === 'pending' && dueDate > now && dueDate <= futureDate;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  trackCompletion(reminderId: string, outcome: CompletionRecord['outcome'], notes?: string): CompletionRecord {
    const reminder = this.reminders.get(reminderId);
    
    const record: CompletionRecord = {
      reminderId,
      completedAt: new Date().toISOString(),
      outcome,
      notes,
      followUpRequired: outcome === 'partial' || outcome === 'failed',
    };

    this.completionRecords.push(record);

    if (reminder) {
      reminder.status = 'completed';
      reminder.completedAt = record.completedAt;
      this.reminders.set(reminderId, reminder);

      if (reminder.recurrence !== 'none') {
        this.scheduleRecurringReminder(reminder, reminder.recurrence);
      }
    }

    return record;
  }

  snoozeReminder(reminderId: string, durationMinutes: number): Reminder | null {
    const reminder = this.reminders.get(reminderId);
    if (!reminder) return null;

    const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    
    reminder.status = 'snoozed';
    reminder.snoozedUntil = snoozedUntil.toISOString();
    this.reminders.set(reminderId, reminder);

    return reminder;
  }

  dismissReminder(reminderId: string): boolean {
    const reminder = this.reminders.get(reminderId);
    if (!reminder) return false;

    reminder.status = 'dismissed';
    this.reminders.set(reminderId, reminder);
    return true;
  }

  getRemindersByType(type: ReminderType): Reminder[] {
    return Array.from(this.reminders.values())
      .filter(r => r.type === type && r.status === 'pending');
  }

  getRemindersByEntity(entityId: string): Reminder[] {
    return Array.from(this.reminders.values())
      .filter(r => r.relatedEntity === entityId && r.status === 'pending');
  }

  getCompletionStats(): {
    total: number;
    completed: number;
    successRate: number;
    byType: Record<ReminderType, { total: number; completed: number }>;
  } {
    const total = this.completionRecords.length;
    const completed = this.completionRecords.filter(r => r.outcome === 'success').length;
    
    const byType: Record<ReminderType, { total: number; completed: number }> = {
      urgent: { total: 0, completed: 0 },
      important: { total: 0, completed: 0 },
      routine: { total: 0, completed: 0 },
      predictive: { total: 0, completed: 0 },
      opportunity: { total: 0, completed: 0 },
    };

    for (const record of this.completionRecords) {
      const reminder = this.reminders.get(record.reminderId);
      if (reminder) {
        byType[reminder.type].total++;
        if (record.outcome === 'success') {
          byType[reminder.type].completed++;
        }
      }
    }

    return {
      total,
      completed,
      successRate: total > 0 ? completed / total : 0,
      byType,
    };
  }

  private createEntityReminder(
    entity: { id: string; name: string; type: string; status?: string },
    type: ReminderType,
    timestamp: string
  ): Reminder {
    const template = REMINDER_TEMPLATES.find(t => t.type === type) || REMINDER_TEMPLATES[0];
    
    return {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: `${entity.name} 需要关注`,
      description: `${entity.name} 当前状态为 ${entity.status || '异常'}，需要及时处理`,
      priority: entity.status === 'critical' ? 'critical' : 'high',
      relatedEntity: entity.id,
      relatedEntityType: entity.type,
      dueDate: new Date(Date.now() + template.defaultDueDays * 24 * 60 * 60 * 1000).toISOString(),
      recurrence: 'none',
      status: 'pending',
      createdAt: timestamp,
      metadata: { entityStatus: entity.status },
    };
  }

  private createSuggestionReminder(suggestion: ProactiveSuggestion, timestamp: string): Reminder {
    const type = this.mapSuggestionTypeToReminderType(suggestion.type);
    const template = REMINDER_TEMPLATES.find(t => t.type === type) || REMINDER_TEMPLATES[0];
    
    return {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority === 'critical' ? 'critical' : 
                suggestion.priority === 'high' ? 'high' : 'medium',
      relatedEntity: suggestion.targetEntities[0],
      dueDate: new Date(Date.now() + template.defaultDueDays * 24 * 60 * 60 * 1000).toISOString(),
      recurrence: 'none',
      status: 'pending',
      createdAt: timestamp,
      metadata: { suggestionId: suggestion.id },
    };
  }

  private createPredictiveReminder(
    prediction: { type: string; probability: number; entityId?: string },
    timestamp: string
  ): Reminder {
    return {
      id: `reminder_pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'predictive',
      title: `预测: ${prediction.type} 风险`,
      description: `预测 ${prediction.type} 类型风险，概率 ${(prediction.probability * 100).toFixed(0)}%`,
      priority: prediction.probability > 0.8 ? 'high' : 'medium',
      relatedEntity: prediction.entityId,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      recurrence: 'none',
      status: 'pending',
      createdAt: timestamp,
      metadata: { predictionType: prediction.type, probability: prediction.probability },
    };
  }

  private mapSuggestionTypeToReminderType(suggestionType: SuggestionType): ReminderType {
    const mapping: Record<SuggestionType, ReminderType> = {
      risk_alert: 'urgent',
      churn_warning: 'urgent',
      loyalty_opportunity: 'opportunity',
      predictive_warning: 'predictive',
      urgent_notification: 'urgent',
      insight_notification: 'important',
      optimization_suggestion: 'important',
      resource_recommendation: 'important',
    };
    return mapping[suggestionType] || 'important';
  }

  private calculateNextDueDate(currentDue: string, pattern: RecurrencePattern): string {
    const current = new Date(currentDue);
    
    switch (pattern) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'biweekly':
        current.setDate(current.getDate() + 14);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        current.setDate(current.getDate() + 7);
    }

    return current.toISOString();
  }

  private prioritizeAndLimit(reminders: Reminder[]): Reminder[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return reminders
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, this.config.maxActiveReminders);
  }
}
