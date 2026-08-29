import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, AlertTriangle, TrendingUp, TrendingDown, 
  Minus, Eye, BarChart3, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle
} from 'lucide-react';
import { OntologyObject } from '../types';
import { 
  PerceptionEngine, 
  EntityState,
  AnomalyType 
} from '../perception';

interface EntityPerceptionPanelProps {
  entities: OntologyObject[];
  onEntityClick?: (entityId: string) => void;
  maxDisplay?: number;
}

const EntityPerceptionPanel: React.FC<EntityPerceptionPanelProps> = ({
  entities,
  onEntityClick,
  maxDisplay = 10,
}) => {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | EntityState>('all');
  
  const perceptionEngine = useMemo(() => new PerceptionEngine(), []);
  
  const perceptions = useMemo(() => {
    return perceptionEngine.perceiveAll(entities);
  }, [entities, perceptionEngine]);

  const filteredEntities = useMemo(() => {
    let filtered = perceptions.entities;
    if (filter !== 'all') {
      filtered = filtered.filter(p => p.state === filter);
    }
    return filtered
      .sort((a, b) => {
        const stateOrder = { critical: 0, warning: 1, normal: 2 };
        return stateOrder[a.state] - stateOrder[b.state];
      })
      .slice(0, maxDisplay);
  }, [perceptions, filter, maxDisplay]);

  const getStateIcon = (state: EntityState) => {
    switch (state) {
      case 'critical': return <AlertTriangle className="text-rose-700" size={16} />;
      case 'warning': return <AlertCircle className="text-orange-700" size={16} />;
      default: return <CheckCircle className="text-emerald-400" size={16} />;
    }
  };

  const getStateColor = (state: EntityState) => {
    switch (state) {
      case 'critical': return 'bg-rose-500/5 border-rose-500/20';
      case 'warning': return 'bg-orange-500/5 border-orange-500/20';
      default: return 'bg-white0/5 border-emerald-500/20';
    }
  };

  const getAnomalyIcon = (type: AnomalyType) => {
    switch (type) {
      case AnomalyType.SUDDEN_DROP: return <TrendingDown className="text-rose-700" size={14} />;
      case AnomalyType.SUDDEN_RISE: return <TrendingUp className="text-emerald-400" size={14} />;
      case AnomalyType.TREND_REVERSAL: return <Activity className="text-purple-400" size={14} />;
      case AnomalyType.VOLATILITY_SPIKE: return <BarChart3 className="text-orange-700" size={14} />;
      default: return <AlertTriangle className="text-gray-800" size={14} />;
    }
  };

  const getAnomalyLabel = (type: AnomalyType): string => {
    const labels: Record<AnomalyType, string> = {
      [AnomalyType.SUDDEN_DROP]: '突然下降',
      [AnomalyType.SUDDEN_RISE]: '突然上升',
      [AnomalyType.TREND_REVERSAL]: '趋势反转',
      [AnomalyType.VOLATILITY_SPIKE]: '波动激增',
      [AnomalyType.PATTERN_BREAK]: '模式打破',
      [AnomalyType.OUTLIER]: '离群值',
    };
    return labels[type] || type;
  };

  const getPatternIcon = (patternType: string) => {
    switch (patternType) {
      case 'growing': return <TrendingUp className="text-emerald-400" size={14} />;
      case 'declining': return <TrendingDown className="text-rose-700" size={14} />;
      case 'stable': return <Minus className="text-blue-500" size={14} />;
      default: return <Activity className="text-gray-800" size={14} />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white0/10 rounded-lg">
              <Eye className="text-purple-400" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-700">实体感知</h3>
              <p className="text-xs text-gray-800">AI驱动的实时状态监测</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="flex items-center space-x-1 px-2 py-1 bg-white text-rose-700 rounded-full">
              <AlertTriangle size={12} />
              <span>{perceptions.summary.criticalCount}</span>
            </span>
            <span className="flex items-center space-x-1 px-2 py-1 bg-white text-orange-700 rounded-full">
              <AlertCircle size={12} />
              <span>{perceptions.summary.warningCount}</span>
            </span>
          </div>
        </div>

        <div className="flex space-x-2">
          {(['all', 'critical', 'warning', 'normal'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === f
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              {f === 'all' ? '全部' : f === 'critical' ? '危急' : f === 'warning' ? '警告' : '正常'}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {filteredEntities.map((perception, index) => (
            <motion.div
              key={perception.entityId}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: index * 0.05 }}
              className="p-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => onEntityClick?.(perception.entityId)}
            >
              <div 
                className="flex items-center justify-between"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedEntity(expandedEntity === perception.entityId ? null : perception.entityId);
                }}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-1.5 rounded-lg border ${getStateColor(perception.state)}`}>
                    {getStateIcon(perception.state)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-700 text-sm">{perception.entityName}</div>
                    <div className="text-xs text-gray-800">
                      {perception.entityType} · 重要性 {(perception.importance.overall * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {perception.anomalies.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-white text-rose-700 rounded-full">
                      {perception.anomalies.length} 异常
                    </span>
                  )}
                  {expandedEntity === perception.entityId ? (
                    <ChevronUp size={16} className="text-gray-800" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-800" />
                  )}
                </div>
              </div>

              <AnimatePresence>
                {expandedEntity === perception.entityId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      {perception.anomalies.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-gray-800 uppercase mb-2">异常检测</div>
                          <div className="space-y-1.5">
                            {perception.anomalies.slice(0, 3).map((anomaly, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs"
                              >
                                <div className="flex items-center space-x-2">
                                  {getAnomalyIcon(anomaly.type)}
                                  <span className="text-gray-600">{getAnomalyLabel(anomaly.type)}</span>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded ${
                                  anomaly.severity === 'high' ? 'bg-white text-rose-700' :
                                  anomaly.severity === 'medium' ? 'bg-white text-orange-700' :
                                  'bg-white/5 text-gray-800'
                                }`}>
                                  {(anomaly.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {perception.patterns.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-gray-800 uppercase mb-2">模式识别</div>
                          <div className="flex flex-wrap gap-1.5">
                            {perception.patterns.slice(0, 4).map((pattern, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center space-x-1 px-2 py-1 bg-brand-500/8 rounded-lg text-xs border border-brand-500/10"
                              >
                                {getPatternIcon(pattern.type)}
                                <span className="text-gray-600">{pattern.description.substring(0, 20)}...</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {perception.alerts.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-gray-800 uppercase mb-2">主动警报</div>
                          <div className="space-y-1.5">
                            {perception.alerts.slice(0, 2).map((alert, idx) => (
                              <div 
                                key={idx}
                                className={`p-2 rounded-lg text-xs ${
                                  alert.severity === 'critical' ? 'bg-rose-500/8 border border-rose-500/20' :
                                  alert.severity === 'high' ? 'bg-orange-500/8 border border-orange-500/20' :
                                  'bg-brand-500/8 border border-brand-500/20'
                                }`}
                              >
                                <div className="font-medium text-gray-700">{alert.title}</div>
                                <div className="text-gray-800 mt-0.5">{alert.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-bold text-gray-800 uppercase mb-2">重要性评分</div>
                        <div className="grid grid-cols-5 gap-1">
                          {Object.entries(perception.importance.dimensions).map(([key, value]) => (
                            <div key={key} className="text-center">
                              <div className="text-[10px] text-gray-800 mb-0.5">
                                {key === 'financial' ? '财务' :
                                 key === 'strategic' ? '战略' :
                                 key === 'relational' ? '关系' :
                                 key === 'risk' ? '风险' : '增长'}
                              </div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-brand-500 rounded-full"
                                  style={{ width: `${value * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredEntities.length === 0 && (
          <div className="p-8 text-center text-gray-800">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-300" />
            <p className="text-sm">没有需要关注的实体</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityPerceptionPanel;
