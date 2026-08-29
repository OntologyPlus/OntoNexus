import React, { useState, useEffect } from 'react';
import { DecisionExecutionTracker as ExecutionTracker } from '../decision';
import {
  DecisionRecommendation,
  DecisionExecution,
  ExecutionStatus,
  ExecutedAction,
  ExecutionIssue,
} from '../decision';

interface DecisionExecutionTrackerProps {
  recommendation?: DecisionRecommendation;
  onViewEffect?: (executionId: string) => void;
}

export const DecisionExecutionTracker: React.FC<DecisionExecutionTrackerProps> = ({
  recommendation,
  onViewEffect,
}) => {
  const [tracker] = useState(() => new ExecutionTracker());
  const [executions, setExecutions] = useState<DecisionExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<DecisionExecution | null>(null);
  const [stats, setStats] = useState(tracker.getExecutionStats());

  useEffect(() => {
    setExecutions(tracker.getAllExecutions());
  }, [tracker]);

  const startExecution = () => {
    if (!recommendation) return;
    
    const execution = tracker.recordDecisionExecution(recommendation, '当前用户');
    setExecutions(tracker.getAllExecutions());
    setSelectedExecution(execution);
    setStats(tracker.getExecutionStats());
  };

  const updateActionStatus = (
    executionId: string,
    actionId: string,
    status: ExecutedAction['status']
  ) => {
    tracker.updateActionStatus(executionId, actionId, status);
    setExecutions(tracker.getAllExecutions());
    if (selectedExecution?.id === executionId) {
      setSelectedExecution(tracker.getExecution(executionId) || null);
    }
    setStats(tracker.getExecutionStats());
  };

  const getStatusColor = (status: ExecutionStatus) => {
    const colors: Record<ExecutionStatus, string> = {
      [ExecutionStatus.PENDING]: 'bg-white/5 text-gray-800',
      [ExecutionStatus.IN_PROGRESS]: 'bg-gray-100 text-blue-600',
      [ExecutionStatus.COMPLETED]: 'bg-green-100 text-green-600',
      [ExecutionStatus.DELAYED]: 'bg-gray-100 text-yellow-700',
      [ExecutionStatus.BLOCKED]: 'bg-gray-100 text-red-700',
      [ExecutionStatus.CANCELLED]: 'bg-white/5 text-gray-800',
    };
    return colors[status] || 'bg-white/5 text-gray-800';
  };

  const getActionStatusColor = (status: ExecutedAction['status']) => {
    const colors: Record<string, string> = {
      pending: 'bg-white/5 text-gray-800',
      in_progress: 'bg-gray-100 text-blue-600',
      completed: 'bg-green-100 text-green-600',
      failed: 'bg-gray-100 text-red-700',
    };
    return colors[status] || 'bg-white/5 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-700">决策执行追踪</h2>
        {recommendation && (
          <button
            onClick={startExecution}
            className="px-4 py-2 bg-white0 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            开始执行
          </button>
        )}
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="总执行数"
          value={stats.total}
          color="blue"
        />
        <StatCard
          title="已完成"
          value={stats.completed}
          color="green"
          subtitle={`${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(0) : 0}%`}
        />
        <StatCard
          title="成功率"
          value={`${(stats.successRate * 100).toFixed(0)}%`}
          color="purple"
        />
        <StatCard
          title="平均完成时间"
          value={`${stats.averageCompletionTime.toFixed(1)}天`}
          color="amber"
        />
      </div>

      {executions.length === 0 ? (
        <div className="text-center py-8 text-gray-800">
          暂无执行记录
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* 执行列表 */}
          <div className="col-span-1 space-y-3">
            <h3 className="font-medium text-gray-700 mb-3">执行列表</h3>
            {executions.map((execution) => (
              <div
                key={execution.id}
                onClick={() => setSelectedExecution(execution)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedExecution?.id === execution.id
                    ? 'bg-white border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="text-sm font-medium text-gray-700 truncate">
                    {execution.id.slice(0, 8)}...
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(execution.status)}`}>
                    {execution.status}
                  </span>
                </div>
                <div className="text-xs text-gray-800 mt-1">
                  {new Date(execution.executedAt).toLocaleDateString()}
                </div>
                <div className="mt-2">
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div
                      className="bg-white0 h-1.5 rounded-full transition-all"
                      style={{ width: `${execution.progress.overall}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-800 mt-1">
                    进度: {execution.progress.overall}%
                  </div>
                </div>
                {execution.status === ExecutionStatus.COMPLETED && onViewEffect && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewEffect(execution.id);
                    }}
                    className="mt-2 w-full px-2 py-1.5 bg-purple-500/10 text-purple-700 rounded text-xs font-medium hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    查看效果
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 执行详情 */}
          <div className="col-span-2">
            {selectedExecution ? (
              <ExecutionDetail
                execution={selectedExecution}
                onUpdateStatus={updateActionStatus}
                getActionStatusColor={getActionStatusColor}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-800">
                选择一个执行记录查看详情
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  color: 'blue' | 'green' | 'purple' | 'amber';
  subtitle?: string;
}> = ({ title, value, color, subtitle }) => {
  const colorClasses = {
    blue: 'bg-brand-500/10 border-brand-500/20',
    green: 'bg-white0/10 border-emerald-500/20',
    purple: 'bg-white0/10 border-purple-500/20',
    amber: 'bg-white0/10 border-amber-100',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-sm text-gray-800">{title}</div>
      <div className="text-2xl font-bold text-gray-700">{value}</div>
      {subtitle && <div className="text-xs text-gray-800">{subtitle}</div>}
    </div>
  );
};

const ExecutionDetail: React.FC<{
  execution: DecisionExecution;
  onUpdateStatus: (executionId: string, actionId: string, status: ExecutedAction['status']) => void;
  getActionStatusColor: (status: ExecutedAction['status']) => string;
}> = ({ execution, onUpdateStatus, getActionStatusColor }) => {
  return (
    <div className="space-y-4">
      {/* 执行头部信息 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-700">执行详情</h3>
            <p className="text-sm text-gray-800">ID: {execution.id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(execution.status)}`}>
            {execution.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <div>
            <span className="text-gray-800">执行人:</span>{' '}
            <span className="text-gray-600">{execution.executor}</span>
          </div>
          <div>
            <span className="text-gray-800">开始时间:</span>{' '}
            <span className="text-gray-600">
              {new Date(execution.executedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-800">整体进度</span>
          <span className="font-medium text-gray-700">{execution.progress.overall}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-white0 h-2 rounded-full transition-all"
            style={{ width: `${execution.progress.overall}%` }}
          />
        </div>
      </div>

      {/* 行动列表 */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">行动计划</h4>
        <div className="space-y-2">
          {execution.actions.map((action, index) => (
            <div key={action.actionId} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <span className="w-6 h-6 bg-white/10 text-gray-800 rounded-full flex items-center justify-center text-sm">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="font-medium text-gray-700">{action.name}</div>
                {action.notes && (
                  <div className="text-sm text-gray-800">{action.notes}</div>
                )}
              </div>
              <select
                value={action.status}
                onChange={(e) =>
                  onUpdateStatus(execution.id, action.actionId, e.target.value as ExecutedAction['status'])
                }
                className={`text-sm px-3 py-1 rounded border ${getActionStatusColor(action.status)}`}
              >
                <option value="pending">待开始</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 问题记录 */}
      {execution.issues.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-3">问题记录</h4>
          <div className="space-y-2">
            {execution.issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const IssueCard: React.FC<{ issue: ExecutionIssue }> = ({ issue }) => {
  const severityColors = {
    low: 'bg-white/5 text-gray-800',
    medium: 'bg-gray-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-gray-100 text-red-700',
  };

  return (
    <div className="bg-white border border-rose-500/20 rounded-lg p-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${severityColors[issue.severity]}`}>
              {issue.severity}
            </span>
            <span className="text-sm text-gray-800">{issue.type}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{issue.description}</p>
        </div>
      </div>
      {issue.resolution && (
        <div className="mt-2 text-sm text-green-600">
          解决方案: {issue.resolution}
        </div>
      )}
    </div>
  );
};

const getStatusColor = (status: ExecutionStatus): string => {
  const colors: Record<ExecutionStatus, string> = {
    [ExecutionStatus.PENDING]: 'bg-white/5 text-gray-800',
    [ExecutionStatus.IN_PROGRESS]: 'bg-gray-100 text-blue-600',
    [ExecutionStatus.COMPLETED]: 'bg-green-100 text-green-600',
    [ExecutionStatus.DELAYED]: 'bg-gray-100 text-yellow-700',
    [ExecutionStatus.BLOCKED]: 'bg-gray-100 text-red-700',
    [ExecutionStatus.CANCELLED]: 'bg-white/5 text-gray-800',
  };
  return colors[status] || 'bg-white/5 text-gray-800';
};

export default DecisionExecutionTracker;
