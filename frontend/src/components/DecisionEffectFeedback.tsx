import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionExecution, ExecutionStatus } from '../decision/DecisionOntology';

interface EffectMetric {
  name: string;
  expected: number;
  actual: number;
  unit: string;
  variance: number;
  status: 'exceeded' | 'met' | 'below';
}

interface DecisionEffectFeedbackProps {
  executions: DecisionExecution[];
}

const DecisionEffectFeedback: React.FC<DecisionEffectFeedbackProps> = ({ executions }) => {
  const [selectedExecution, setSelectedExecution] = useState<DecisionExecution | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const stats = useMemo(() => {
    const total = executions.length;
    const completed = executions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
    const inProgress = executions.filter(e => e.status === ExecutionStatus.IN_PROGRESS).length;
    const successRate = total > 0 ? completed / total : 0;
    
    const avgCompletion = executions.reduce((sum, e) => sum + e.progress.overall, 0) / (total || 1);
    
    return { total, completed, inProgress, successRate, avgCompletion };
  }, [executions]);

  const [effectMetrics, setEffectMetrics] = useState<Map<string, EffectMetric[]>>(new Map());

  const fetchEffectMetrics = useCallback(async (execution: DecisionExecution) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch(`/api/effects/${execution.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.metrics) {
          const metrics: EffectMetric[] = data.metrics.map((m: any) => ({
            name: m.name,
            expected: m.expected,
            actual: m.actual,
            unit: m.unit,
            variance: ((m.actual - m.expected) / m.expected) * 100,
            status: m.status,
          }));
          setEffectMetrics(prev => new Map(prev).set(execution.id, metrics));
        }
      }
    } catch {
      const fallback = generateFallbackMetrics(execution);
      setEffectMetrics(prev => new Map(prev).set(execution.id, fallback));
    }
  }, []);

  useEffect(() => {
    executions.forEach(exec => {
      if (!effectMetrics.has(exec.id)) {
        fetchEffectMetrics(exec);
      }
    });
  }, [executions, effectMetrics, fetchEffectMetrics]);

  const generateFallbackMetrics = (execution: DecisionExecution): EffectMetric[] => {
    const baseMetrics: EffectMetric[] = [
      { name: '销售增长', expected: 15, actual: 0, unit: '%', variance: 0, status: 'below' as const },
      { name: '客户满意度', expected: 85, actual: 0, unit: '%', variance: 0, status: 'below' as const },
      { name: '执行效率', expected: 100, actual: execution.progress.overall, unit: '%', variance: 0, status: execution.progress.overall >= 80 ? 'met' as const : 'below' as const },
      { name: '资源利用率', expected: 90, actual: 0, unit: '%', variance: 0, status: 'below' as const },
    ];
    return baseMetrics.map(m => ({ ...m, variance: m.expected > 0 ? ((m.actual - m.expected) / m.expected) * 100 : 0 }));
  };

  const getMetricsForExecution = (execution: DecisionExecution): EffectMetric[] => {
    return effectMetrics.get(execution.id) || generateFallbackMetrics(execution);
  };

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case ExecutionStatus.COMPLETED: return 'text-emerald-400 bg-white0/10';
      case ExecutionStatus.IN_PROGRESS: return 'text-brand-400 bg-brand-500/10';
      case ExecutionStatus.DELAYED: return 'text-amber-700 bg-white0/10';
      case ExecutionStatus.BLOCKED: return 'text-rose-700 bg-white';
      case ExecutionStatus.CANCELLED: return 'text-gray-800 bg-white/5';
      default: return 'text-gray-800 bg-white/5';
    }
  };

  const getStatusLabel = (status: ExecutionStatus) => {
    switch (status) {
      case ExecutionStatus.COMPLETED: return '已完成';
      case ExecutionStatus.IN_PROGRESS: return '进行中';
      case ExecutionStatus.DELAYED: return '延期';
      case ExecutionStatus.BLOCKED: return '阻塞';
      case ExecutionStatus.CANCELLED: return '已取消';
      case ExecutionStatus.PENDING: return '待执行';
      default: return status;
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 10) return 'text-green-600';
    if (variance >= -10) return 'text-gray-800';
    return 'text-red-700';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp size={14} className="text-green-500" />;
    if (variance < 0) return <TrendingDown size={14} className="text-red-500" />;
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white0/10 rounded-lg">
              <BarChart3 size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-700">决策效果追踪</h3>
              <p className="text-xs text-gray-800">预期 vs 实际效果对比分析</p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <RefreshCw size={16} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-800 mb-1">总决策数</div>
            <div className="text-xl font-bold text-gray-700">{stats.total}</div>
          </div>
          <div className="p-3 bg-white0/10 rounded-lg">
            <div className="text-xs text-emerald-400 mb-1">已完成</div>
            <div className="text-xl font-bold text-emerald-400">{stats.completed}</div>
          </div>
          <div className="p-3 bg-brand-500/10 rounded-lg">
            <div className="text-xs text-brand-400 mb-1">进行中</div>
            <div className="text-xl font-bold text-brand-400">{stats.inProgress}</div>
          </div>
          <div className="p-3 bg-white0/10 rounded-lg">
            <div className="text-xs text-purple-400 mb-1">成功率</div>
            <div className="text-xl font-bold text-purple-400">{(stats.successRate * 100).toFixed(0)}%</div>
          </div>
        </div>

        {executions.length === 0 ? (
          <div className="text-center py-8 text-gray-800">
            <Target size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无决策执行记录</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {executions.map((execution) => {
              const metrics = getMetricsForExecution(execution);
              const isSelected = selectedExecution?.id === execution.id;
              
              return (
                <motion.div
                  key={execution.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-lg overflow-hidden ${
                    isSelected ? 'border-purple-500/30 bg-white0/8' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div 
                    className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setSelectedExecution(isSelected ? null : execution);
                      setShowComparison(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(execution.status)}`}>
                          {execution.status === ExecutionStatus.COMPLETED ? (
                            <CheckCircle size={16} />
                          ) : execution.status === ExecutionStatus.BLOCKED ? (
                            <XCircle size={16} />
                          ) : (
                            <Clock size={16} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-700 text-sm">
                            决策 #{execution.decisionId.slice(-6)}
                          </div>
                          <div className="text-xs text-gray-800">
                            执行者: {execution.executor} · {new Date(execution.executedAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-700">{execution.progress.overall}%</div>
                          <div className="text-xs text-gray-800">完成度</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(execution.status)}`}>
                          {getStatusLabel(execution.status)}
                        </span>
                        {isSelected ? <ChevronDown size={16} className="text-gray-800" /> : <ChevronRight size={16} className="text-gray-800" />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100"
                      >
                        <div className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-800">效果对比</span>
                            <button
                              onClick={() => setShowComparison(!showComparison)}
                              className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                            >
                              <BarChart3 size={12} />
                              {showComparison ? '收起详情' : '查看详情'}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {metrics.map((metric, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-gray-100">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-800">{metric.name}</span>
                                  {getVarianceIcon(metric.variance)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <div className="text-xs text-gray-800">预期: {metric.expected}{metric.unit}</div>
                                    <div className="text-sm font-bold text-gray-700">实际: {metric.actual}{metric.unit}</div>
                                  </div>
                                  <div className={`text-xs font-medium ${getVarianceColor(metric.variance)}`}>
                                    {metric.variance > 0 ? '+' : ''}{metric.variance.toFixed(0)}%
                                  </div>
                                </div>
                                <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      metric.status === 'exceeded' ? 'bg-green-500' :
                                      metric.status === 'met' ? 'bg-white0' : 'bg-white0'
                                    }`}
                                    style={{ width: `${Math.min(100, (metric.actual / metric.expected) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {execution.issues.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-gray-800 mb-2 flex items-center gap-1">
                                <AlertTriangle size={12} className="text-yellow-500" />
                                执行问题 ({execution.issues.length})
                              </div>
                              <div className="space-y-1">
                                {execution.issues.slice(0, 3).map((issue) => (
                                  <div key={issue.id} className="flex items-center gap-2 p-2 bg-white0/8 rounded text-xs border border-amber-100">
                                    <span className={`w-2 h-2 rounded-full ${
                                      issue.severity === 'critical' ? 'bg-white0' :
                                      issue.severity === 'high' ? 'bg-orange-500' : 'bg-white0'
                                    }`} />
                                    <span className="text-gray-600">{issue.description}</span>
                                    {issue.resolvedAt && (
                                      <CheckCircle size={12} className="text-green-500 ml-auto" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button className="flex-1 px-3 py-2 bg-gray-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors flex items-center justify-center gap-1">
                              <Lightbulb size={12} />
                              查看优化建议
                            </button>
                            <button className="flex-1 px-3 py-2 bg-white/5 text-gray-600 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1">
                              <ArrowRight size={12} />
                              执行详情
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DecisionEffectFeedback;
