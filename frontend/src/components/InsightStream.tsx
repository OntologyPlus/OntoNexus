import React, { useState, useEffect } from 'react';
import { useOntologyContext } from '../contexts/OntologyContext';
import { AlertTriangle, TrendingUp, Link2, Zap, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Insight, InsightType } from '../types';

interface InsightStreamProps {
  onInsightClick?: (insight: Insight) => void;
  maxItems?: number;
}

const InsightStream: React.FC<InsightStreamProps> = ({ onInsightClick, maxItems = 5 }) => {
  const { state } = useOntologyContext();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    const generatedInsights = generateInsights();
    setInsights(generatedInsights.slice(0, maxItems));
  }, [state.objects, maxItems]);

  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    const atRiskDoctors = state.objects.filter(obj =>
      obj.objectType === 'Doctor' && obj.status === 'critical'
    );

    if (atRiskDoctors.length > 0) {
      insights.push({
        id: 'insight_risk_1',
        type: 'risk',
        title: `${atRiskDoctors[0]?.name || '关键客户'}处方量异常下降`,
        description: '检测到处方量持续下降趋势，需要立即关注',
        reasoningChain: {
          conclusion: '客户流失风险需要立即干预',
          evidence: [
            { source: '处方数据', observation: '处方量下降超过20%', weight: 0.9 },
            { source: '行为分析', observation: '拜访频率不足', weight: 0.7 },
          ],
          confidence: 0.92,
          alternativeHypotheses: [],
          suggestedActions: [
            { actionName: '安排紧急拜访', priority: 'high', reason: '直接沟通了解问题' },
          ],
        },
        confidence: 0.92,
        impact: {
          entities: atRiskDoctors.slice(0, 3).map(d => d.id),
          metrics: [{ name: '预计销售损失', change: -15 }],
        },
        suggestedActions: [],
        createdAt: new Date(),
        status: 'new',
      });
    }

    const lowPerformingReps = state.objects.filter(obj =>
      obj.objectType === 'SalesRep' && obj.properties.achievementRate < 80
    );

    if (lowPerformingReps.length > 0) {
      insights.push({
        id: 'insight_opp_1',
        type: 'opportunity',
        title: '销售代表效能优化机会',
        description: '发现资源优化空间，可提升整体业绩',
        reasoningChain: {
          conclusion: '资源重新分配可提升整体业绩',
          evidence: [
            { source: '业绩数据', observation: '部分代表管理区域过多', weight: 0.85 },
          ],
          confidence: 0.78,
          alternativeHypotheses: [],
          suggestedActions: [
            { actionName: '重新分配区域', priority: 'high', reason: '优化资源配置' },
          ],
        },
        confidence: 0.78,
        impact: {
          entities: lowPerformingReps.map(r => r.id),
          metrics: [{ name: '预计业绩提升', change: 12 }],
        },
        suggestedActions: [],
        createdAt: new Date(Date.now() - 3600000),
        status: 'new',
      });
    }

    insights.push({
      id: 'insight_trend_1',
      type: 'trend',
      title: '竞品活动加剧趋势',
      description: '检测到竞品在核心医院的学术活动频率上升',
      reasoningChain: {
        conclusion: '竞品威胁正在增加',
        evidence: [
          { source: '市场情报', observation: '竞品学术活动增加35%', weight: 0.8 },
        ],
        confidence: 0.75,
        alternativeHypotheses: [],
        suggestedActions: [
          { actionName: '加强KOL维护', priority: 'high', reason: '巩固学术影响力' },
        ],
      },
      confidence: 0.75,
      impact: {
        entities: [],
        metrics: [{ name: '市场份额风险', change: -5 }],
      },
      suggestedActions: [],
      createdAt: new Date(Date.now() - 7200000),
      status: 'viewed',
    });

    insights.push({
      id: 'insight_rel_1',
      type: 'relationship',
      title: '隐藏KOL影响力网络发现',
      description: '发现张主任与多位区域专家存在强关联',
      reasoningChain: {
        conclusion: '张主任是关键影响节点',
        evidence: [
          { source: '关系图谱', observation: '与5位区域专家有学术合作', weight: 0.85 },
        ],
        confidence: 0.88,
        alternativeHypotheses: [],
        suggestedActions: [
          { actionName: '升级KOL等级', priority: 'high', reason: '提升资源投入' },
        ],
      },
      confidence: 0.88,
      impact: {
        entities: ['d1'],
        metrics: [{ name: '影响力覆盖', change: 25 }],
      },
      suggestedActions: [],
      createdAt: new Date(Date.now() - 86400000),
      status: 'acted',
    });

    return insights.sort((a, b) => b.confidence - a.confidence);
  };

  const getTypeIcon = (type: InsightType) => {
    switch (type) {
      case 'risk': return <AlertTriangle className="text-red-500" size={16} />;
      case 'opportunity': return <TrendingUp className="text-green-500" size={16} />;
      case 'anomaly': return <AlertTriangle className="text-orange-500" size={16} />;
      case 'trend': return <TrendingUp className="text-blue-500" size={16} />;
      case 'relationship': return <Link2 className="text-purple-500" size={16} />;
    }
  };

  const getTypeColor = (type: InsightType) => {
    switch (type) {
      case 'risk': return 'border-l-red-500 bg-rose-500/5';
      case 'opportunity': return 'border-l-green-500 bg-white0/5';
      case 'anomaly': return 'border-l-orange-500 bg-orange-500/5';
      case 'trend': return 'border-l-blue-500 bg-brand-500/5';
      case 'relationship': return 'border-l-purple-500 bg-white0/5';
    }
  };

  const getPriorityColor = (confidence: number) => {
    if (confidence >= 0.85) return 'bg-white0';
    if (confidence >= 0.7) return 'bg-orange-500';
    return 'bg-white0';
  };

  const handleRefresh = () => {
    setIsThinking(true);
    setTimeout(() => {
      const newInsights = generateInsights();
      setInsights(newInsights.slice(0, maxItems));
      setIsThinking(false);
    }, 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center space-x-2">
          <Sparkles size={18} className="text-brand-400" />
          <span className="font-bold text-gray-700">AI 洞察流</span>
          <span className="text-xs text-gray-800">实时发现</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isThinking}
          className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <Zap size={16} className={`${isThinking ? 'text-brand-400 animate-pulse' : 'text-gray-800'}`} />
        </button>
      </div>

      <div className="divide-y divide-white/5">
        <AnimatePresence>
          {insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onInsightClick?.(insight)}
              className={`p-3 cursor-pointer hover:bg-gray-50 transition-all border-l-4 ${getTypeColor(insight.type)}`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(insight.type)}
                  <span className="text-sm font-medium text-gray-700">{insight.title}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(insight.confidence)}`} />
                  <span className="text-xs text-gray-800">{(insight.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-800 mb-2 line-clamp-1">{insight.description}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1 text-xs text-gray-800">
                  <Clock size={12} />
                  <span>
                    {insight.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-brand-400">
                  <span>查看详情</span>
                  <ChevronRight size={12} />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {isThinking && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="flex items-center space-x-2 text-brand-400">
            <Sparkles size={20} className="animate-pulse" />
            <span className="text-sm">AI 正在分析本体数据...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightStream;
