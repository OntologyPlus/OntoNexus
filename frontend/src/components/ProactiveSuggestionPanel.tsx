import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, AlertTriangle, TrendingUp, Users, Target, 
  CheckCircle, XCircle, Clock, ChevronRight, Zap,
  Lightbulb, Shield
} from 'lucide-react';
import { OntologyObject } from '../types';
import { 
  ProactiveSuggestionGenerator,
  ProactiveSuggestion,
  SuggestionType
} from '../interaction';

interface ProactiveSuggestionPanelProps {
  entities: OntologyObject[];
  onSuggestionAccept?: (suggestion: ProactiveSuggestion) => void;
  onSuggestionDismiss?: (suggestionId: string) => void;
  maxDisplay?: number;
}

const ProactiveSuggestionPanel: React.FC<ProactiveSuggestionPanelProps> = ({
  entities,
  onSuggestionAccept,
  onSuggestionDismiss,
  maxDisplay = 10,
}) => {
  const [selectedType, setSelectedType] = useState<SuggestionType | 'all'>('all');
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const suggestionGenerator = useMemo(() => new ProactiveSuggestionGenerator(), []);

  const suggestions = useMemo(() => {
    const perceptions = entities.map(e => ({
      entityId: e.id,
      entityName: e.name,
      entityType: e.objectType,
      state: e.status === 'critical' ? 'critical' as const : 
             e.status === 'warning' ? 'warning' as const : 'normal' as const,
      anomalies: [],
      patterns: [],
      alerts: [],
      importance: { overall: 0.5, dimensions: { financial: 0.5, strategic: 0.5, relational: 0.5, risk: 0.5, growth: 0.5 }, factors: [], recommendation: '' },
      lastUpdated: new Date().toISOString(),
    }));

    const allSuggestions = suggestionGenerator.generateProactiveSuggestions(perceptions, entities);
    
    if (selectedType !== 'all') {
      return allSuggestions.filter(s => s.type === selectedType);
    }
    
    return allSuggestions.slice(0, maxDisplay);
  }, [entities, suggestionGenerator, selectedType, maxDisplay]);

  const getTypeIcon = (type: SuggestionType) => {
    switch (type) {
      case 'risk_alert': return <AlertTriangle className="text-rose-700" size={16} />;
      case 'churn_warning': return <Users className="text-orange-700" size={16} />;
      case 'loyalty_opportunity': return <Target className="text-emerald-400" size={16} />;
      case 'predictive_warning': return <Clock className="text-purple-400" size={16} />;
      case 'urgent_notification': return <Zap className="text-rose-700" size={16} />;
      case 'insight_notification': return <Lightbulb className="text-brand-400" size={16} />;
      case 'optimization_suggestion': return <TrendingUp className="text-teal-400" size={16} />;
      case 'resource_recommendation': return <Shield className="text-indigo-400" size={16} />;
      default: return <Bell className="text-gray-800" size={16} />;
    }
  };

  const getTypeLabel = (type: SuggestionType): string => {
    const labels: Record<SuggestionType, string> = {
      'risk_alert': '风险警报',
      'churn_warning': '流失预警',
      'loyalty_opportunity': '忠诚度机会',
      'predictive_warning': '预测性预警',
      'urgent_notification': '紧急通知',
      'insight_notification': '洞察通知',
      'optimization_suggestion': '优化建议',
      'resource_recommendation': '资源建议',
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-white text-rose-700 border-rose-500/20';
      case 'high': return 'bg-white text-orange-700 border-orange-500/20';
      case 'medium': return 'bg-brand-500/10 text-brand-400 border-brand-500/20';
      default: return 'bg-white/5 text-gray-800 border-gray-100';
    }
  };

  const getTypeColor = (type: SuggestionType) => {
    switch (type) {
      case 'risk_alert':
      case 'urgent_notification':
        return 'border-l-red-500 bg-rose-500/5';
      case 'churn_warning':
        return 'border-l-orange-500 bg-orange-500/5';
      case 'loyalty_opportunity':
        return 'border-l-green-500 bg-white0/5';
      case 'predictive_warning':
        return 'border-l-purple-500 bg-white0/5';
      default:
        return 'border-l-blue-500 bg-brand-500/5';
    }
  };

  const handleAccept = (suggestion: ProactiveSuggestion) => {
    onSuggestionAccept?.(suggestion);
  };

  const handleDismiss = (suggestionId: string) => {
    onSuggestionDismiss?.(suggestionId);
  };

  const typeStats = useMemo(() => {
    const stats: Record<SuggestionType, number> = {
      'risk_alert': 0,
      'churn_warning': 0,
      'loyalty_opportunity': 0,
      'predictive_warning': 0,
      'urgent_notification': 0,
      'insight_notification': 0,
      'optimization_suggestion': 0,
      'resource_recommendation': 0,
    };
    
    suggestions.forEach(s => {
      stats[s.type]++;
    });
    
    return stats;
  }, [suggestions]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white rounded-lg">
              <Zap className="text-orange-700" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-700">主动建议</h3>
              <p className="text-xs text-gray-800">AI主动发现的机会与风险</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-800">{suggestions.length} 条建议</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              selectedType === 'all'
                ? 'bg-brand-500 text-white'
                : 'bg-white/5 text-gray-800 hover:bg-white/10'
            }`}
          >
            全部
          </button>
          {(['risk_alert', 'churn_warning', 'loyalty_opportunity', 'predictive_warning'] as SuggestionType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedType === type
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              {getTypeIcon(type)}
              <span>{getTypeLabel(type)}</span>
              {typeStats[type] > 0 && (
                <span className="px-1 py-0.5 bg-white/20 rounded-full text-[10px]">
                  {typeStats[type]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-[450px] overflow-y-auto">
        <AnimatePresence>
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.03 }}
              className={`p-3 border-l-4 ${getTypeColor(suggestion.type)} hover:bg-gray-50 cursor-pointer`}
              onClick={() => setExpandedSuggestion(
                expandedSuggestion === suggestion.id ? null : suggestion.id
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    {getTypeIcon(suggestion.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-700 text-sm truncate">
                        {suggestion.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getPriorityColor(suggestion.priority)}`}>
                        {suggestion.priority === 'critical' ? '紧急' : 
                         suggestion.priority === 'high' ? '高' : 
                         suggestion.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-800 line-clamp-2">{suggestion.description}</p>
                    <div className="flex items-center space-x-3 mt-2 text-xs text-gray-800">
                      <span className="flex items-center space-x-1">
                        <Target size={10} />
                        <span>{suggestion.targetEntities.length} 实体</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle size={10} />
                        <span>置信度 {(suggestion.expectedImpact.confidence * 100).toFixed(0)}%</span>
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`text-gray-800 transition-transform ${
                    expandedSuggestion === suggestion.id ? 'rotate-90' : ''
                  }`}
                />
              </div>

              <AnimatePresence>
                {expandedSuggestion === suggestion.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      <div>
                        <div className="text-xs font-bold text-gray-800 uppercase mb-2">预期影响</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 bg-gray-50 rounded-lg text-center">
                            <div className="text-[10px] text-gray-800">当前值</div>
                            <div className="text-sm font-bold text-gray-700">
                              {suggestion.expectedImpact.currentValue.toFixed(1)}
                            </div>
                          </div>
                          <div className="p-2 bg-white0/10 rounded-lg text-center">
                            <div className="text-[10px] text-emerald-400">预测值</div>
                            <div className="text-sm font-bold text-emerald-400">
                              {suggestion.expectedImpact.projectedValue.toFixed(1)}
                            </div>
                          </div>
                          <div className="p-2 bg-brand-500/10 rounded-lg text-center">
                            <div className="text-[10px] text-brand-400">变化</div>
                            <div className={`text-sm font-bold ${
                              suggestion.expectedImpact.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-700'
                            }`}>
                              {suggestion.expectedImpact.changePercent >= 0 ? '+' : ''}
                              {suggestion.expectedImpact.changePercent.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {suggestion.suggestedActions.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-gray-800 uppercase mb-2">建议行动</div>
                          <div className="space-y-1.5">
                            {suggestion.suggestedActions.slice(0, 3).map((action, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center text-[10px] font-bold">
                                    {idx + 1}
                                  </div>
                                  <span className="text-xs text-gray-600">{action.name}</span>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  action.priority === 'high' ? 'bg-white text-rose-700' :
                                  action.priority === 'medium' ? 'bg-white text-orange-700' :
                                  'bg-white/5 text-gray-800'
                                }`}>
                                  {action.priority === 'high' ? '高' : action.priority === 'medium' ? '中' : '低'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-[10px] text-gray-800">
                          有效期至 {new Date(suggestion.validUntil).toLocaleDateString('zh-CN')}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(suggestion.id);
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs text-gray-800 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <XCircle size={12} />
                            <span>忽略</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(suggestion);
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
                          >
                            <CheckCircle size={12} />
                            <span>采纳</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {suggestions.length === 0 && (
          <div className="p-8 text-center text-gray-800">
            <Lightbulb size={32} className="mx-auto mb-2 text-gray-800" />
            <p className="text-sm">暂无主动建议</p>
            <p className="text-xs mt-1">系统正在持续监测中...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProactiveSuggestionPanel;
