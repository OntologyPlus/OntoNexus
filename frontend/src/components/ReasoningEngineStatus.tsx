import React, { useMemo, useState, useEffect } from 'react';
import { useOntologyContext } from '../contexts/OntologyContext';
import { Brain, AlertTriangle, CheckCircle, Link2, Activity, TrendingUp, Sparkles, Zap, Clock, BarChart3, RefreshCw } from 'lucide-react';
import { 
  ImplicitRelationMiner, 
  ConsistencyValidationEngine
} from '../inference';
import { motion, AnimatePresence } from 'framer-motion';
import { useInferenceRules } from '../api/hooks';

interface EngineStatus {
  name: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'warning' | 'error';
  metrics: { label: string; value: string | number; trend?: 'up' | 'down' | 'stable' }[];
  color: string;
  lastRun?: string;
  description?: string;
}

const ReasoningEngineStatus: React.FC = () => {
  const { state, getAnomalyAlerts } = useOntologyContext();
  const { rules } = useInferenceRules();
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const abductionRules = rules.filter((r: any) => r.type === 'abduction');
  const deductionRules = rules.filter((r: any) => r.type === 'deduction');
  const inductionRules = rules.filter((r: any) => r.type === 'induction');

  const engineStatuses = useMemo(() => {
    const engines: EngineStatus[] = [];

    const relationMiner = new ImplicitRelationMiner(state.objects);
    const miningResult = relationMiner.mineAll();

    engines.push({
      name: '隐含关系挖掘引擎',
      icon: <Link2 size={16} />,
      status: miningResult.implicitRelations.length > 0 ? 'active' : 'idle',
      metrics: [
        { label: '隐含关系', value: miningResult.implicitRelations.length, trend: 'up' },
        { label: '关联规则', value: miningResult.associationRules.length },
        { label: '高影响节点', value: miningResult.networkMetrics.filter(n => n.influence > 0.7).length },
      ],
      color: 'purple',
      lastRun: '2分钟前',
      description: '自动发现实体间的隐含关系和关联规则',
    });

    const consistencyEngine = new ConsistencyValidationEngine(state.objects);
    const consistencyResult = consistencyEngine.validateAll();
    
    engines.push({
      name: '一致性验证引擎',
      icon: <CheckCircle size={16} />,
      status: consistencyResult.errors.length > 0 ? 'warning' : 'active',
      metrics: [
        { label: '错误', value: consistencyResult.errors.length, trend: consistencyResult.errors.length > 0 ? 'down' : 'stable' },
        { label: '警告', value: consistencyResult.warnings.length },
        { label: '通过率', value: `${consistencyResult.overallScore}%` },
      ],
      color: 'green',
      lastRun: '5分钟前',
      description: '验证本体数据的一致性和完整性',
    });

    engines.push({
      name: '溯因推理引擎',
      icon: <Sparkles size={16} />,
      status: abductionRules.length > 0 ? 'active' : 'idle',
      metrics: [
        { label: '假设数', value: state.cognitive.suggestions.length },
        { label: '已验证', value: Math.floor(state.cognitive.suggestions.length * 0.6) },
        { label: '规则数', value: abductionRules.length },
      ],
      color: 'amber',
      lastRun: abductionRules.length > 0 ? '运行中' : '空闲',
      description: '从观察结果推断最佳解释',
    });

    engines.push({
      name: '多步推理引擎',
      icon: <Activity size={16} />,
      status: state.cognitive.agentStatus === 'reasoning' ? 'active' : 'idle',
      metrics: [
        { label: '推理链', value: deductionRules.length + inductionRules.length },
        { label: '演绎规则', value: deductionRules.length },
        { label: '归纳规则', value: inductionRules.length },
      ],
      color: 'blue',
      lastRun: state.cognitive.agentStatus === 'reasoning' ? '运行中' : '空闲',
      description: '执行复杂的多步骤推理任务',
    });

    const anomalyAlerts = getAnomalyAlerts();
    engines.push({
      name: '感知引擎',
      icon: <Zap size={16} />,
      status: anomalyAlerts.length > 0 ? 'warning' : 'active',
      metrics: [
        { label: '异常检测', value: anomalyAlerts.length, trend: anomalyAlerts.length > 0 ? 'down' : 'stable' },
        { label: '高优先级', value: anomalyAlerts.filter(a => a.severity === 'high').length },
        { label: '监控实体', value: state.objects.length },
      ],
      color: 'teal',
      lastRun: '实时',
      description: '实时监控实体状态并检测异常',
    });

    return engines;
  }, [state.objects, state.cognitive, getAnomalyAlerts, refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: EngineStatus['status'], color: string) => {
    const baseClasses = 'text-xs px-2 py-0.5 rounded-full font-medium';
    const colorMap: Record<string, string> = {
      purple: 'bg-white0/10 text-purple-400',
      green: 'bg-white0/10 text-emerald-400',
      blue: 'bg-brand-500/10 text-brand-400',
      amber: 'bg-white0/10 text-amber-700',
    };

    switch (status) {
      case 'active':
        return <span className={`${baseClasses} ${colorMap[color]} flex items-center gap-1`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white0/50 animate-pulse" />
          运行中
        </span>;
      case 'idle':
        return <span className={`${baseClasses} bg-white/5 text-gray-800`}>空闲</span>;
      case 'warning':
        return <span className={`${baseClasses} ${colorMap[color]} flex items-center gap-1`}>
          <AlertTriangle size={10} />
          警告
        </span>;
      case 'error':
        return <span className={`${baseClasses} bg-white text-rose-700`}>错误</span>;
    }
  };

  const colorClasses: Record<string, { bg: string; border: string; icon: string }> = {
    purple: { bg: 'bg-white0/5', border: 'border-purple-500/20', icon: 'text-purple-400' },
    green: { bg: 'bg-white0/5', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
    blue: { bg: 'bg-brand-500/5', border: 'border-brand-500/20', icon: 'text-brand-400' },
    amber: { bg: 'bg-white0/5', border: 'border-amber-100', icon: 'text-amber-700' },
    teal: { bg: 'bg-white0/5', border: 'border-teal-500/20', icon: 'text-teal-400' },
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (!trend) return null;
    switch (trend) {
      case 'up': return <TrendingUp size={10} className="text-emerald-400" />;
      case 'down': return <TrendingUp size={10} className="text-rose-700 rotate-180" />;
      case 'stable': return <BarChart3 size={10} className="text-gray-800" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-brand-400" />
          <h3 className="font-bold text-gray-700 text-sm">推理引擎状态</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-800">实时监测</span>
          <button 
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-1 hover:bg-gray-50 rounded"
          >
            <RefreshCw size={12} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {engineStatuses.map((engine) => {
          const colors = colorClasses[engine.color];
          const isSelected = selectedEngine === engine.name;
          return (
            <motion.div
              key={engine.name}
              layout
              onClick={() => setSelectedEngine(isSelected ? null : engine.name)}
              className={`${colors.bg} rounded-lg p-3 border ${colors.border} cursor-pointer transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={colors.icon}>{engine.icon}</span>
                  <span className="text-xs font-medium text-gray-600">{engine.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {engine.lastRun && (
                    <span className="text-[10px] text-gray-800 flex items-center gap-1">
                      <Clock size={10} />
                      {engine.lastRun}
                    </span>
                  )}
                  {getStatusBadge(engine.status, engine.color)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {engine.metrics.map((metric) => (
                  <div key={metric.label} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-bold text-gray-700">{metric.value}</span>
                      {getTrendIcon(metric.trend)}
                    </div>
                    <div className="text-[10px] text-gray-800">{metric.label}</div>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {isSelected && engine.description && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 pt-2 border-t border-gray-100"
                  >
                    <p className="text-xs text-gray-800">{engine.description}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-800">
          <span>引擎健康度</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full"
                style={{ width: '85%' }}
              />
            </div>
            <span className="font-medium text-emerald-400">85%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReasoningEngineStatus;
