import {
  DecisionRecommendation,
  DecisionExecution,
  ExecutionStatus,
  ExecutedAction,
  ExecutionProgress,
  ExecutionIssue,
  ActualImpact,
  ImpactVariance,
  Lesson,
  DecisionFeedback,
  LearningResult,
  DecisionPattern,
  Heuristic,
} from './DecisionOntology';

// ============================================
// 决策执行追踪引擎
// ============================================

export class DecisionExecutionTracker {
  private executions: Map<string, DecisionExecution> = new Map();
  private executionHistory: DecisionExecution[] = [];

  /**
   * 记录决策执行
   */
  recordDecisionExecution(
    recommendation: DecisionRecommendation,
    executor: string
  ): DecisionExecution {
    const execution: DecisionExecution = {
      id: `exec_${Date.now()}`,
      decisionId: recommendation.scenario.id,
      recommendationId: recommendation.id,
      executor,
      executedAt: new Date().toISOString(),
      status: ExecutionStatus.PENDING,
      actions: recommendation.recommendedAlternative.actions.map(action => ({
        actionId: action.id,
        name: action.name,
        status: 'pending',
        notes: '',
      })),
      progress: {
        overall: 0,
        byAction: {},
        estimatedCompletion: this.calculateEstimatedCompletion(recommendation),
      },
      issues: [],
    };

    this.executions.set(execution.id, execution);
    this.executionHistory.push(execution);

    return execution;
  }

  /**
   * 计算预计完成时间
   */
  private calculateEstimatedCompletion(recommendation: DecisionRecommendation): string {
    const totalDuration = recommendation.implementationPlan.reduce(
      (sum, step) => sum + step.duration,
      0
    );
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + totalDuration);
    return estimatedDate.toISOString();
  }

  /**
   * 追踪执行进度
   */
  trackExecutionProgress(executionId: string): ExecutionProgress | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    return execution.progress;
  }

  /**
   * 更新行动状态
   */
  updateActionStatus(
    executionId: string,
    actionId: string,
    status: ExecutedAction['status'],
    notes?: string
  ): boolean {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    const action = execution.actions.find(a => a.actionId === actionId);
    if (!action) return false;

    action.status = status;

    if (status === 'in_progress' && !action.startedAt) {
      action.startedAt = new Date().toISOString();
    }

    if (status === 'completed' && !action.completedAt) {
      action.completedAt = new Date().toISOString();
    }

    if (notes) {
      action.notes = notes;
    }

    // 更新进度
    this.updateProgress(execution);

    return true;
  }

  /**
   * 更新整体进度
   */
  private updateProgress(execution: DecisionExecution): void {
    const completedActions = execution.actions.filter(a => a.status === 'completed').length;
    const totalActions = execution.actions.length;

    execution.progress.overall = totalActions > 0
      ? Math.round((completedActions / totalActions) * 100)
      : 0;

    // 更新每个行动的进度
    execution.actions.forEach(action => {
      execution.progress.byAction[action.actionId] =
        action.status === 'completed' ? 100 :
        action.status === 'in_progress' ? 50 :
        action.status === 'failed' ? 0 : 0;
    });

    // 更新整体状态
    if (execution.progress.overall === 100) {
      execution.status = ExecutionStatus.COMPLETED;
    } else if (execution.progress.overall > 0) {
      execution.status = ExecutionStatus.IN_PROGRESS;
    }
  }

  /**
   * 记录执行问题
   */
  recordIssue(
    executionId: string,
    issue: Omit<ExecutionIssue, 'id' | 'reportedAt'>
  ): ExecutionIssue | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    const newIssue: ExecutionIssue = {
      id: `issue_${Date.now()}`,
      ...issue,
      reportedAt: new Date().toISOString(),
    };

    execution.issues.push(newIssue);

    // 如果有严重问题，更新状态
    if (issue.severity === 'critical') {
      execution.status = ExecutionStatus.BLOCKED;
    } else if (issue.severity === 'high') {
      execution.status = ExecutionStatus.DELAYED;
    }

    return newIssue;
  }

  /**
   * 解决问题
   */
  resolveIssue(
    executionId: string,
    issueId: string,
    resolution: string
  ): boolean {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    const issue = execution.issues.find(i => i.id === issueId);
    if (!issue) return false;

    issue.resolvedAt = new Date().toISOString();
    issue.resolution = resolution;

    // 检查是否所有严重问题都已解决
    const hasCriticalIssues = execution.issues.some(
      i => i.severity === 'critical' && !i.resolvedAt
    );

    if (!hasCriticalIssues && execution.status === ExecutionStatus.BLOCKED) {
      execution.status = ExecutionStatus.IN_PROGRESS;
    }

    return true;
  }

  /**
   * 评估实际效果
   */
  evaluateActualImpact(
    executionId: string,
    actualMetrics: {
      financial: { revenue: number; cost: number };
      operational: { efficiency: number; quality: number };
      strategic: { marketPosition: number; competitiveAdvantage: number };
    }
  ): ActualImpact | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    // 这里应该与预期效果对比，计算差异
    const variance: ImpactVariance = {
      financial: 0,
      operational: 0,
      strategic: 0,
      explanations: [],
    };

    return {
      financial: {
        revenue: actualMetrics.financial.revenue,
        cost: actualMetrics.financial.cost,
        roi: actualMetrics.financial.revenue > 0
          ? (actualMetrics.financial.revenue - actualMetrics.financial.cost) / actualMetrics.financial.cost
          : 0,
        paybackPeriod: 0,
        npv: 0,
      },
      operational: {
        efficiency: actualMetrics.operational.efficiency,
        quality: actualMetrics.operational.quality,
        speed: 0,
        resourceUtilization: 0,
      },
      strategic: {
        marketPosition: actualMetrics.strategic.marketPosition,
        competitiveAdvantage: actualMetrics.strategic.competitiveAdvantage,
        capabilityBuilding: 0,
        alignment: 0,
      },
      variance,
    };
  }

  /**
   * 提取经验教训
   */
  extractLessons(executionId: string): Lesson[] {
    const execution = this.executions.get(executionId);
    if (!execution) return [];

    const lessons: Lesson[] = [];

    // 从问题中提取教训
    execution.issues.forEach(issue => {
      lessons.push({
        id: `lesson_${Date.now()}_${issue.id}`,
        category: 'execution',
        description: `执行中遇到${issue.type}问题: ${issue.description}`,
        recommendations: issue.resolution ? [issue.resolution] : ['需要制定预防措施'],
        applicability: [execution.decisionId],
      });
    });

    // 从行动结果中提取教训
    execution.actions.forEach(action => {
      if (action.status === 'failed') {
        lessons.push({
          id: `lesson_${Date.now()}_${action.actionId}`,
          category: 'process',
          description: `行动"${action.name}"执行失败: ${action.notes}`,
          recommendations: ['改进执行流程', '加强资源保障'],
          applicability: [execution.decisionId],
        });
      }
    });

    return lessons;
  }

  /**
   * 添加反馈
   */
  addFeedback(
    executionId: string,
    feedback: Omit<DecisionFeedback, 'id' | 'providedAt'>
  ): DecisionFeedback | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    // 注意：DecisionExecution 接口中没有 feedback 字段，这里我们返回反馈对象
    // 实际应用中可能需要扩展 DecisionExecution 接口
    return {
      id: `feedback_${Date.now()}`,
      ...feedback,
      providedAt: new Date().toISOString(),
    };
  }

  /**
   * 学习反馈
   */
  learnFromOutcome(
    executionId: string,
    actualImpact: ActualImpact
  ): LearningResult {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return {
        patterns: [],
        improvedHeuristics: [],
        modelUpdates: [],
      };
    }

    const patterns: DecisionPattern[] = [];
    const heuristics: Heuristic[] = [];
    const modelUpdates: { component: string; change: string; reason: string; impact: string }[] = [];

    // 分析成功/失败模式
    const success = execution.progress.overall >= 80 && execution.issues.length === 0;

    if (success) {
      patterns.push({
        id: `pattern_${Date.now()}`,
        name: '成功执行模式',
        condition: `决策类型: ${execution.decisionId}`,
        action: '按计划执行',
        successRate: 0.9,
        confidence: 0.8,
      });
    }

    // 从问题中学习启发式规则
    execution.issues.forEach(issue => {
      heuristics.push({
        id: `heuristic_${Date.now()}_${issue.id}`,
        name: `${issue.type}风险预警`,
        rule: `IF 存在${issue.type}风险 THEN 提前准备应急预案`,
        applicability: [execution.decisionId],
        effectiveness: 0.7,
      });
    });

    // 建议模型更新
    if (actualImpact.variance.financial > 0.2) {
      modelUpdates.push({
        component: '财务预测模型',
        change: '调整预测参数',
        reason: '实际财务表现与预测差异较大',
        impact: '提高预测准确性',
      });
    }

    return {
      patterns,
      improvedHeuristics: heuristics,
      modelUpdates,
    };
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(): {
    total: number;
    completed: number;
    inProgress: number;
    delayed: number;
    blocked: number;
    cancelled: number;
    averageCompletionTime: number;
    successRate: number;
  } {
    const total = this.executionHistory.length;
    const completed = this.executionHistory.filter(e => e.status === ExecutionStatus.COMPLETED).length;
    const inProgress = this.executionHistory.filter(e => e.status === ExecutionStatus.IN_PROGRESS).length;
    const delayed = this.executionHistory.filter(e => e.status === ExecutionStatus.DELAYED).length;
    const blocked = this.executionHistory.filter(e => e.status === ExecutionStatus.BLOCKED).length;
    const cancelled = this.executionHistory.filter(e => e.status === ExecutionStatus.CANCELLED).length;

    // 计算平均完成时间
    const completedExecutions = this.executionHistory.filter(
      e => e.status === ExecutionStatus.COMPLETED && e.progress.actualCompletion
    );

    const averageCompletionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const start = new Date(e.executedAt).getTime();
          const end = new Date(e.progress.actualCompletion!).getTime();
          return sum + (end - start);
        }, 0) / completedExecutions.length / (1000 * 60 * 60 * 24) // 转换为天
      : 0;

    // 计算成功率（无严重问题且完成度>=80%）
    const successful = this.executionHistory.filter(e => {
      const noCriticalIssues = !e.issues.some(i => i.severity === 'critical');
      const highCompletion = e.progress.overall >= 80;
      return noCriticalIssues && highCompletion;
    }).length;

    return {
      total,
      completed,
      inProgress,
      delayed,
      blocked,
      cancelled,
      averageCompletionTime,
      successRate: total > 0 ? successful / total : 0,
    };
  }

  /**
   * 获取执行详情
   */
  getExecution(executionId: string): DecisionExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * 获取所有执行记录
   */
  getAllExecutions(): DecisionExecution[] {
    return [...this.executionHistory];
  }

  /**
   * 获取按决策ID筛选的执行记录
   */
  getExecutionsByDecision(decisionId: string): DecisionExecution[] {
    return this.executionHistory.filter(e => e.decisionId === decisionId);
  }

  /**
   * 获取按执行者筛选的执行记录
   */
  getExecutionsByExecutor(executor: string): DecisionExecution[] {
    return this.executionHistory.filter(e => e.executor === executor);
  }

  /**
   * 取消执行
   */
  cancelExecution(executionId: string, reason: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    if (execution.status === ExecutionStatus.COMPLETED) {
      return false; // 已完成的不能取消
    }

    execution.status = ExecutionStatus.CANCELLED;

    // 记录取消原因作为问题
    execution.issues.push({
      id: `cancel_${Date.now()}`,
      type: 'other',
      description: `执行被取消: ${reason}`,
      severity: 'medium',
      reportedAt: new Date().toISOString(),
    });

    return true;
  }
}
