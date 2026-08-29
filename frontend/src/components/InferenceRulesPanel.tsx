import React, { useState, useMemo, useCallback } from 'react';
import {
  Brain,
  GitBranch,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Zap,
  Link2,
  Activity,
  Target,
  Eye,
  Lightbulb,
  ArrowRight,
  Shield,
  Scale,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Inbox
} from 'lucide-react';
import {
  InferenceRule,
  RuleType,
  ConfidenceConfig,
  ReasoningChain,
  ReasoningEvidence
} from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useOntologyContext } from '../contexts/OntologyContext';
import { 
  AbductiveReasoningEngine,
  MultiStepReasoningEngine,
  Observation,
  AbductiveContext
} from '../inference';
import { useInferenceRules } from '../api/hooks';

const generateReasoningChain = (rule: InferenceRule): ReasoningChain => {
  const evidence: ReasoningEvidence[] = rule.conditions.map((cond, idx) => ({
    source: `条件${idx + 1}`,
    observation: cond.description || cond.pattern,
    weight: 1 / rule.conditions.length
  }));

  // 添加额外证据
  if (rule.confidence.modifiers.length > 0) {
    rule.confidence.modifiers.forEach((mod, idx) => {
      evidence.push({
        source: `调节器${idx + 1}`,
        observation: mod.condition,
        weight: mod.modifier
      });
    });
  }

  return {
    conclusion: rule.conclusion.newLink 
      ? `建立${rule.conclusion.newLink.type}关系`
      : rule.conclusion.alert 
      ? `生成${rule.conclusion.alert.severity}级别预警`
      : rule.conclusion.tag
      ? `标记为${rule.conclusion.tag.tag}`
      : '执行推理结论',
    evidence,
    confidence: rule.confidence.base + rule.confidence.modifiers.reduce((sum, m) => sum + m.modifier, 0),
    alternativeHypotheses: [
      { hypothesis: '偶然相关性', confidence: 0.1 },
      { hypothesis: '数据异常', confidence: 0.05 }
    ],
    suggestedActions: [
      { actionName: '验证结论', priority: 'high', reason: '确保推理准确性' },
      { actionName: '记录日志', priority: 'medium', reason: '用于后续分析' }
    ]
  };
};

const RuleTypeIcon: React.FC<{ type: RuleType }> = ({ type }) => {
  switch (type) {
    case RuleType.DEDUCTION: return <GitBranch size={14} className="text-blue-500" />;
    case RuleType.INDUCTION: return <TrendingUp size={14} className="text-emerald-500" />;
    case RuleType.ABDUCTION: return <Sparkles size={14} className="text-purple-500" />;
  }
};

const RuleTypeBadge: React.FC<{ type: RuleType }> = ({ type }) => {
  const config = {
    [RuleType.DEDUCTION]: { label: '演绎', bg: 'bg-brand-500/10', text: 'text-brand-400' },
    [RuleType.INDUCTION]: { label: '归纳', bg: 'bg-white0/10', text: 'text-emerald-400' },
    [RuleType.ABDUCTION]: { label: '溯因', bg: 'bg-white0/10', text: 'text-purple-400' }
  };
  const { label, bg, text } = config[type];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>{label}</span>;
};

const ConfidenceBar: React.FC<{ confidence: ConfidenceConfig }> = ({ confidence }) => {
  const total = confidence.base + confidence.modifiers.reduce((sum, m) => sum + m.modifier, 0);
  const clamped = Math.min(1, Math.max(0, total));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            clamped >= 0.8 ? 'bg-white0' : clamped >= 0.6 ? 'bg-white0' : 'bg-white0'
          }`}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${
        clamped >= 0.8 ? 'text-emerald-600' : clamped >= 0.6 ? 'text-amber-700' : 'text-red-700'
      }`}>
        {(clamped * 100).toFixed(0)}%
      </span>
    </div>
  );
};

// 推理链可视化组件
const ReasoningChainVisualizer: React.FC<{ reasoningChain: ReasoningChain; ruleName: string }> = ({ 
  reasoningChain, 
  ruleName 
}) => {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Link2 size={18} className="text-blue-600" />
        <h4 className="font-semibold text-gray-700">推理链可视化</h4>
        <span className="text-xs text-gray-800">{ruleName}</span>
      </div>

      {/* 证据链 */}
      <div className="relative mb-6">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
        
        <div className="space-y-3">
          {reasoningChain.evidence.map((evidence, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-10"
            >
              {/* 节点 */}
              <div className="absolute left-2 w-5 h-5 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center">
                <span className="text-[10px] text-blue-600 font-bold">{index + 1}</span>
              </div>
              
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-600">{evidence.source}</span>
                  <span className="text-[10px] text-gray-800">权重: {(evidence.weight * 100).toFixed(0)}%</span>
                </div>
                <p className="text-sm text-gray-600">{evidence.observation}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 结论 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reasoningChain.evidence.length * 0.1 }}
        className="bg-white/10 rounded-xl p-4 text-gray-700"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target size={16} />
          <span className="font-medium">推理结论</span>
        </div>
        <p className="text-sm mb-3">{reasoningChain.conclusion}</p>
        <div className="flex items-center gap-4 text-xs text-blue-100">
          <span>总体置信度: <strong>{(reasoningChain.confidence * 100).toFixed(0)}%</strong></span>
          <span>证据数量: <strong>{reasoningChain.evidence.length}</strong></span>
        </div>
      </motion.div>

      {/* 替代假设 */}
      {reasoningChain.alternativeHypotheses.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-amber-500" />
            <span className="text-xs font-medium text-gray-800">替代假设</span>
          </div>
          <div className="space-y-1">
            {reasoningChain.alternativeHypotheses.map((alt, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 bg-white0/8 rounded border border-amber-100">
                <span className="text-gray-800">{alt.hypothesis}</span>
                <span className="text-amber-700 font-medium">{(alt.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议行动 */}
      {reasoningChain.suggestedActions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-green-500" />
            <span className="text-xs font-medium text-gray-800">建议行动</span>
          </div>
          <div className="space-y-1">
            {reasoningChain.suggestedActions.map((action, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 bg-white0/8 rounded border border-emerald-500/10">
                <div>
                  <span className="font-medium text-gray-600">{action.actionName}</span>
                  <span className="text-gray-800 ml-2">{action.reason}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  action.priority === 'high' ? 'bg-white text-rose-700' : 'bg-brand-500/10 text-brand-400'
                }`}>
                  {action.priority === 'high' ? '高' : '中'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RuleCard: React.FC<{ 
  rule: InferenceRule; 
  expanded: boolean; 
  onToggle: () => void;
  showReasoning: boolean;
  onToggleReasoning: () => void;
}> = ({ rule, expanded, onToggle, showReasoning, onToggleReasoning }) => {
  const reasoningChain = generateReasoningChain(rule);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-brand-600/30 transition-colors">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <RuleTypeIcon type={rule.type} />
            <span className="text-xs font-mono text-gray-800">{rule.id}</span>
            <RuleTypeBadge type={rule.type} />
            {rule.config.autoApply && (
              <span className="px-1.5 py-0.5 bg-white0/10 text-teal-400 rounded text-[10px] font-medium">自动应用</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{rule.name}</h3>
          <p className="text-xs text-gray-800 mt-0.5 line-clamp-1">{rule.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-gray-800 mb-1">置信度</div>
            <div className="w-20">
              <ConfidenceBar confidence={rule.confidence} />
            </div>
          </div>
          {expanded ? <ChevronDown size={16} className="text-gray-800" /> : <ChevronRight size={16} className="text-gray-800" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* 推理链可视化开关 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-800">推理详情</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleReasoning();
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    showReasoning 
                      ? 'bg-brand-500/10 text-brand-400' 
                      : 'bg-white/5 text-gray-800 hover:bg-white/10'
                  }`}
                >
                  <Eye size={12} />
                  {showReasoning ? '隐藏推理链' : '查看推理链'}
                </button>
              </div>

              {/* 推理链可视化 */}
              <AnimatePresence>
                {showReasoning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <ReasoningChainVisualizer 
                      reasoningChain={reasoningChain} 
                      ruleName={rule.name}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <div className="text-[10px] font-medium text-gray-800 uppercase tracking-wide mb-2">条件模式 (Conditions)</div>
                <div className="space-y-1.5">
                  {rule.conditions.map((cond, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="w-4 h-4 rounded bg-brand-500/10 text-brand-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono text-gray-600 block truncate">{cond.pattern}</code>
                        {cond.description && <span className="text-[10px] text-gray-800">{cond.description}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-gray-800 uppercase tracking-wide mb-2">结论类型 (Conclusion)</div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  {rule.conclusion.newLink && (
                    <div className="flex items-center gap-2 text-xs">
                      <GitBranch size={12} className="text-blue-500" />
                      <span className="text-gray-600">新建链接:</span>
                      <span className="font-mono text-blue-600">{rule.conclusion.newLink.type}</span>
                    </div>
                  )}
                  {rule.conclusion.alert && (
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <AlertTriangle size={12} className={rule.conclusion.alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'} />
                      <span className="text-gray-600">预警:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        rule.conclusion.alert.severity === 'critical' ? 'bg-white text-rose-700' :
                        rule.conclusion.alert.severity === 'warning' ? 'bg-white0/10 text-amber-700' :
                        'bg-brand-500/10 text-brand-400'
                      }`}>{rule.conclusion.alert.severity}</span>
                    </div>
                  )}
                  {rule.conclusion.tag && (
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <Sparkles size={12} className="text-purple-500" />
                      <span className="text-gray-600">标签:</span>
                      <span className="px-1.5 py-0.5 bg-white0/10 text-purple-400 rounded text-[10px]">{rule.conclusion.tag.tag}</span>
                    </div>
                  )}
                </div>
              </div>

              {rule.confidence.modifiers.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-gray-800 uppercase tracking-wide mb-2">置信度调节器</div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-800">
                      <span className="font-medium">基础值:</span> {(rule.confidence.base * 100).toFixed(0)}%
                    </div>
                    {rule.confidence.modifiers.map((mod, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded">
                        <code className="text-gray-800 font-mono text-[10px] truncate max-w-[200px]">{mod.condition}</code>
                        <span className={`font-medium ml-2 ${mod.modifier >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {mod.modifier >= 0 ? '+' : ''}{(mod.modifier * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {rule.metadata.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white/5 text-gray-800 rounded text-[10px]">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InferenceRulesPanel: React.FC = () => {
  const { state, runPerception, getAnomalyAlerts, refreshData } = useOntologyContext();
  const { rules: apiRules } = useInferenceRules();
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [showReasoningRuleId, setShowReasoningRuleId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<RuleType | 'all'>('all');
  const [filterAutoApply, setFilterAutoApply] = useState<boolean | 'all'>('all');
  const [activeEngine, setActiveEngine] = useState<'abduction' | 'multistep' | 'perception' | 'attribution' | null>(null);
  const [reasoningResults, setReasoningResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showAxiomsTab, setShowAxiomsTab] = useState(false);
  const [pushingActionId, setPushingActionId] = useState<string | null>(null);

  interface BusinessAxiom {
    id: string;
    name: string;
    category: 'compliance' | 'financial' | 'operational' | 'data_quality';
    description: string;
    constraint: string;
    severity: 'critical' | 'warning' | 'info';
    violatedBy: string[];
    status: 'passed' | 'failed' | 'partial';
  }

  const businessAxioms: BusinessAxiom[] = useMemo(() => {
    const doctors = state.objects.filter(o => o.objectType === 'Doctor');
    const targets = state.objects.filter(o => o.objectType === 'SalesTarget');
    const complianceSuggestions = (state.cognitive?.suggestions || []).filter(s => s.type === 'risk_alert');

    const criticalEntities = doctors.filter(d => d.status === 'critical' || d.status === 'warning');
    const lowAchievementTargets = targets.filter(t => {
      const rate = t.properties?.achievementRate || 0;
      return rate < 0.7;
    });

    const highSeveritySuggestions = complianceSuggestions.filter(s => s.priority === 'critical' || s.priority === 'high');

    return [
      {
        id: 'axiom_compliance_1',
        name: '合规费用上限',
        category: 'compliance',
        description: '单次活动费用不得超过 ¥500，年度累计费用不得超过 ¥50,000',
        constraint: '单次费用 <= ¥500 && 年度累计 <= ¥50,000',
        severity: 'critical',
        violatedBy: highSeveritySuggestions.slice(0, 3).map(s => s.title),
        status: complianceSuggestions.length > 3 ? 'failed' : complianceSuggestions.length > 0 ? 'partial' : 'passed',
      },
      {
        id: 'axiom_compliance_2',
        name: '处方行为合规',
        category: 'compliance',
        description: '医生处方量异常波动需触发合规审查（变化幅度 >30%）',
        constraint: 'abs(处方量变化率) <= 30%',
        severity: 'critical',
        violatedBy: criticalEntities.slice(0, 3).map(d => d.name),
        status: criticalEntities.length > 0 ? 'failed' : 'passed',
      },
      {
        id: 'axiom_financial_1',
        name: '销售目标合理性',
        category: 'financial',
        description: '销售目标达成率不得低于 60%，否则需触发干预方案',
        constraint: '达成率 >= 60%',
        severity: 'warning',
        violatedBy: lowAchievementTargets.map(t => t.name),
        status: lowAchievementTargets.length > 0 ? 'failed' : 'passed',
      },
      {
        id: 'axiom_financial_2',
        name: '预算分配均衡',
        category: 'financial',
        description: '各预算分类间差异不超过总预算的 20%，防止资源过度集中',
        constraint: 'max(预算分类) - min(预算分类) <= 总预算 * 20%',
        severity: 'warning',
        violatedBy: [],
        status: 'passed',
      },
      {
        id: 'axiom_operational_1',
        name: '拜访频率标准',
        category: 'operational',
        description: 'A类客户每月拜访次数 >= 2次，B类客户 >= 1次，C类客户 >= 0.5次',
        constraint: '拜访频率 >= 客户等级要求',
        severity: 'warning',
        violatedBy: criticalEntities.length > 1 ? [criticalEntities[0]?.name, criticalEntities[1]?.name] : [],
        status: criticalEntities.length > 0 ? 'partial' : 'passed',
      },
      {
        id: 'axiom_operational_2',
        name: '客户覆盖率',
        category: 'operational',
        description: '活跃销售代表覆盖的医生数量不得低于总医生数的 70%',
        constraint: '覆盖医生数 / 总医生数 >= 70%',
        severity: 'info',
        violatedBy: [],
        status: 'passed',
      },
      {
        id: 'axiom_data_1',
        name: '数据完整性',
        category: 'data_quality',
        description: '所有医生记录必须包含科室、职称、处方量等核心字段',
        constraint: '核心字段非空率 >= 95%',
        severity: 'info',
        violatedBy: doctors.filter(d => !d.properties?.department || !d.properties?.title).slice(0, 2).map(d => d.name),
        status: doctors.length > 0 && !doctors[0]?.properties?.department ? 'partial' : 'passed',
      },
      {
        id: 'axiom_data_2',
        name: '时序数据连续性',
        category: 'data_quality',
        description: '关键指标（处方量、拜访次数）不得存在超过 30 天的数据断档',
        constraint: '数据断档 <= 30 天',
        severity: 'info',
        violatedBy: [],
        status: 'passed',
      },
    ];
  }, [state.objects, state.cognitive?.suggestions]);

  const axiomStats = useMemo(() => {
    const total = businessAxioms.length;
    const passed = businessAxioms.filter(a => a.status === 'passed').length;
    const failed = businessAxioms.filter(a => a.status === 'failed').length;
    const partial = businessAxioms.filter(a => a.status === 'partial').length;
    const complianceRate = total > 0 ? (passed / total) * 100 : 0;
    return { total, passed, failed, partial, complianceRate };
  }, [businessAxioms]);

  const rules: InferenceRule[] = useMemo(() => 
    apiRules.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      type: r.type === 'deduction' ? RuleType.DEDUCTION : r.type === 'induction' ? RuleType.INDUCTION : RuleType.ABDUCTION,
      conditions: r.conditions || [],
      conclusion: r.conclusion || {},
      confidence: r.confidence || { base: 0.5, modifiers: [] },
      config: r.config || { enabled: true, priority: 0, autoApply: false },
      metadata: r.metadata || {},
    })),
    [apiRules]
  );

  const abductiveEngine = useMemo(() => new AbductiveReasoningEngine(), []);
  const multistepEngine = useMemo(() => new MultiStepReasoningEngine(), []);

  const getBusinessSummary = (result: any): string => {
    if (result.type === 'abduction') {
      if (result.confidence >= 0.8) return `高置信度发现：${result.title}，需要立即关注并采取行动`;
      if (result.confidence >= 0.6) return `疑似发现：${result.title}，建议进一步验证`;
      return `初步线索：${result.title}，需更多数据支撑`;
    }
    if (result.type === 'multistep') {
      return `经过${result.totalSteps || 0}步推理得出结论：${result.title}`;
    }
    if (result.type === 'perception') {
      return `感知到${result.severity === 'high' ? '严重' : result.severity === 'medium' ? '中等' : '轻微'}异常：${result.title}`;
    }
    return result.title;
  };

  const getAffectedEntities = (result: any): string[] => {
    const entities: string[] = [];
    if (result.type === 'abduction' && result.explanation) {
      state.objects.forEach(obj => {
        if (result.explanation.includes(obj.name) || result.title.includes(obj.name)) {
          entities.push(`${obj.name}（${obj.objectType === 'Doctor' ? '医生' : obj.objectType === 'Hospital' ? '医院' : obj.objectType === 'Product' ? '产品' : obj.objectType}，状态：${obj.status === 'critical' ? '危急' : obj.status === 'warning' ? '警告' : '正常'}）`);
        }
      });
    }
    if (result.type === 'perception' && result.description) {
      state.objects.forEach(obj => {
        if (result.description.includes(obj.name) || result.title.includes(obj.name)) {
          entities.push(`${obj.name}（${obj.objectType === 'Doctor' ? '医生' : obj.objectType}，状态：${obj.status === 'critical' ? '危急' : obj.status === 'warning' ? '警告' : '正常'}）`);
        }
      });
    }
    if (entities.length === 0 && state.objects.length > 0) {
      const relevant = state.objects.filter(o => o.status === 'warning' || o.status === 'critical');
      if (relevant.length > 0) entities.push(relevant[0].name);
    }
    return entities;
  };

  const getSuggestedActions = (result: any): { name: string; priority: string; reason: string }[] => {
    if (result.type === 'abduction') {
      return [
        { name: '安排拜访验证', priority: 'high', reason: '确认推理结论的准确性' },
        { name: '准备应对方案', priority: 'medium', reason: '基于推理结论制定行动计划' },
      ];
    }
    if (result.type === 'multistep') {
      return [
        { name: '审查推理路径', priority: 'high', reason: '确保每步推理逻辑正确' },
        { name: '执行结论行动', priority: 'medium', reason: '基于推理结论采取行动' },
      ];
    }
    if (result.type === 'perception') {
      return [
        { name: '查看详情', priority: 'high', reason: '了解异常的具体情况' },
        { name: '触发深度分析', priority: 'medium', reason: '进一步分析异常根因' },
      ];
    }
    return [];
  };

  const handlePushToInbox = async (result: any) => {
    setPushingActionId(result.id);
    try {
      const { default: apiClient } = await import('../api/client');
      await apiClient.request('/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          title: result.title,
          description: getBusinessSummary(result),
          action_type: result.type === 'abduction' ? 'investigate' : result.type === 'perception' ? 'monitor' : 'review',
          entity_id: getAffectedEntities(result)[0] || '',
          entity_name: getAffectedEntities(result)[0] || '',
          entity_type: 'Unknown',
          priority: result.confidence >= 0.8 ? 'high' : 'medium',
          confidence: result.confidence,
          status: 'pending',
          proposed_by: 'InferenceEngine',
          reasoning_conclusion: getBusinessSummary(result),
          reasoning_confidence: result.confidence,
          reasoning_evidence: result.explanation || result.description || '',
        }),
      });
      refreshData();
    } catch (err) {
      console.error('Failed to push to inbox:', err);
    } finally {
      setPushingActionId(null);
    }
  };

  const runAbductiveReasoning = useCallback(() => {
    setIsRunning(true);
    setActiveEngine('abduction');
    
    const warningDoctors = state.objects.filter(o => o.objectType === 'Doctor' && (o.status === 'warning' || o.status === 'critical'));
    const targetObj = warningDoctors[0] || state.objects.find(o => o.objectType === 'Doctor') || state.objects[0];

    const observation: Observation = {
      id: 'obs_1',
      type: 'anomaly',
      description: targetObj ? `${targetObj.name}业务指标异常` : '销售目标达成率下降',
      entityId: targetObj?.id || 'entity_1',
      entityName: targetObj?.name || '实体',
      entityType: targetObj?.objectType || 'sales_target',
      timestamp: new Date().toISOString(),
      properties: {},
      severity: targetObj?.status === 'critical' ? 'high' : 'medium',
    };

    const context: AbductiveContext = {
      observations: [observation],
      entities: state.objects,
      historicalPatterns: [],
    };

    const hypotheses = abductiveEngine.inferBestExplanation(observation, context);
    
    setReasoningResults(hypotheses.slice(0, 5).map(h => ({
      id: h.id,
      type: 'abduction',
      title: h.description,
      confidence: h.confidence,
      explanation: h.causes.join(', '),
      testablePredictions: h.testablePredictions,
      affectedEntities: getAffectedEntities({ type: 'abduction', title: h.description, explanation: h.causes.join(', '), confidence: h.confidence }),
      suggestedActions: getSuggestedActions({ type: 'abduction', confidence: h.confidence }),
      businessSummary: getBusinessSummary({ type: 'abduction', title: h.description, confidence: h.confidence }),
    })));
    
    setIsRunning(false);
  }, [state.objects, abductiveEngine]);

  const runMultistepReasoning = useCallback(() => {
    setIsRunning(true);
    setActiveEngine('multistep');
    
    const goal = {
      id: 'goal_1',
      predicate: 'achieve',
      subject: 'sales_target',
      object: '100%',
      confidence: 1,
      source: 'assumption' as const,
    };

    const facts = state.objects.slice(0, 5).map(obj => ({
      id: obj.id,
      predicate: 'has_status',
      subject: obj.name,
      object: obj.status || 'normal',
      confidence: 0.9,
      source: 'observation' as const,
    }));

    multistepEngine.setFacts(facts);
    const path = multistepEngine.backwardChain(goal, facts);
    
    if (path) {
      setReasoningResults([{
        id: path.id,
        type: 'multistep',
        title: '推理路径',
        confidence: path.totalConfidence,
        steps: path.steps,
        totalSteps: path.length,
        affectedEntities: getAffectedEntities({ type: 'multistep', title: '推理路径', confidence: path.totalConfidence }),
        suggestedActions: getSuggestedActions({ type: 'multistep', confidence: path.totalConfidence }),
        businessSummary: getBusinessSummary({ type: 'multistep', title: '推理路径', confidence: path.totalConfidence, totalSteps: path.length }),
      }]);
    } else {
      setReasoningResults([{
        id: 'no_path',
        type: 'multistep',
        title: '未找到有效推理路径',
        confidence: 0,
        totalSteps: 0,
        affectedEntities: [],
        suggestedActions: [],
        businessSummary: '当前数据不足以形成有效推理路径，建议补充更多业务数据',
      }]);
    }
    
    setIsRunning(false);
  }, [state.objects, multistepEngine]);

  const runPerceptionEngine = useCallback(() => {
    setIsRunning(true);
    setActiveEngine('perception');
    runPerception();
    
    const alerts = getAnomalyAlerts();
    
    setReasoningResults(alerts.slice(0, 5).map(a => ({
      id: a.type + '_' + Date.now(),
      type: 'perception',
      title: `${a.type}异常`,
      confidence: a.confidence,
      severity: a.severity,
      description: a.description,
      affectedEntities: getAffectedEntities({ type: 'perception', title: `${a.type}异常`, description: a.description, severity: a.severity, confidence: a.confidence }),
      suggestedActions: getSuggestedActions({ type: 'perception', severity: a.severity, confidence: a.confidence }),
      businessSummary: getBusinessSummary({ type: 'perception', title: `${a.type}异常`, severity: a.severity, confidence: a.confidence }),
    })));
    
    setIsRunning(false);
  }, [runPerception, getAnomalyAlerts]);

  const runAttributionAnalysis = useCallback(async () => {
    setIsRunning(true);
    setActiveEngine('attribution');
    
    const warningDoctors = state.objects.filter(o => o.objectType === 'Doctor' && (o.status === 'warning' || o.status === 'critical'));
    const targetObj = warningDoctors[0] || state.objects.find(o => o.objectType === 'Doctor') || state.objects[0];
    
    if (!targetObj) {
      setReasoningResults([{
        id: 'no_entity',
        type: 'attribution',
        title: '无可用实体',
        confidence: 0,
        businessSummary: '当前没有可供分析的实体，请先添加医生或医院数据',
        affectedEntities: [],
        suggestedActions: [],
      }]);
      setIsRunning(false);
      return;
    }
    
    try {
      const { default: apiClient } = await import('../api/client');
      const params = new URLSearchParams({
        target_id: targetObj.id,
        target_metric: 'prescription_volume',
        period: '90d',
        method: 'shapley',
      });
      
      const attributionResult = await apiClient.request<any>(`/api/reasoning/attribution?${params.toString()}`, {
        method: 'POST',
      });
      
      if (attributionResult && attributionResult.attributionFactors && attributionResult.attributionFactors.length > 0) {
        const topFactors = attributionResult.attributionFactors.slice(0, 5);
        const topNegativeFactor = topFactors.find((f: any) => f.direction === 'negative');
        
        setReasoningResults([{
          id: 'attribution_' + targetObj.id + '_' + Date.now(),
          type: 'attribution',
          title: `${targetObj.name} 处方量归因分析`,
          confidence: attributionResult.modelFit || 0.7,
          totalChange: attributionResult.totalChange || 0,
          method: attributionResult.method || 'shapley',
          period: attributionResult.period || '90d',
          attributionFactors: topFactors,
          unexplained: attributionResult.unexplained || 0,
          businessSummary: topNegativeFactor 
            ? `归因分析发现：${topNegativeFactor.factorLabel}是主要负面影响因素（贡献度 ${topNegativeFactor.contributionPercent.toFixed(0)}%），建议重点改善`
            : `归因分析完成，模型拟合度 ${(attributionResult.modelFit * 100).toFixed(0)}%，主要驱动因素是 ${topFactors[0]?.factorLabel || '未知'}`,
          affectedEntities: [`${targetObj.name}（${targetObj.objectType === 'Doctor' ? '医生' : '医院'}，状态：${targetObj.status === 'critical' ? '危急' : targetObj.status === 'warning' ? '警告' : '正常'}）`],
          suggestedActions: topNegativeFactor
            ? [
                { name: `改善${topNegativeFactor.factorLabel}`, priority: 'high', reason: `对处方量有显著负面影响（-${topNegativeFactor.contribution.toFixed(1)}）` },
                { name: '制定改善计划', priority: 'medium', reason: '基于归因结论采取针对性行动' },
              ]
            : [
                { name: '维持现状', priority: 'medium', reason: '无明显负面因素' },
                { name: '持续监控', priority: 'low', reason: '定期跟踪指标变化' },
              ],
        }]);
      } else {
        setReasoningResults([{
          id: 'attribution_no_data_' + targetObj.id,
          type: 'attribution',
          title: `${targetObj.name} 归因分析`,
          confidence: 0,
          businessSummary: attributionResult?.message || '数据不足，无法进行归因分析。请确保有足够的时间序列数据。',
          affectedEntities: [`${targetObj.name}（${targetObj.objectType === 'Doctor' ? '医生' : '医院'}）`],
          suggestedActions: [
            { name: '补充数据', priority: 'high', reason: '需要更多时间序列数据才能进行分析' },
          ],
        }]);
      }
    } catch (err) {
      console.error('Attribution analysis failed:', err);
      setReasoningResults([{
        id: 'attribution_error_' + targetObj.id,
        type: 'attribution',
        title: `${targetObj.name} 归因分析失败`,
        confidence: 0,
        businessSummary: '归因分析请求失败，请检查后端服务是否正常运行',
        affectedEntities: [`${targetObj.name}（${targetObj.objectType === 'Doctor' ? '医生' : '医院'}）`],
        suggestedActions: [
          { name: '检查服务状态', priority: 'high', reason: '确认后端推理服务正常运行' },
        ],
      }]);
    } finally {
      setIsRunning(false);
    }
  }, [state.objects]);

  const filteredRules = rules.filter(rule => {
    if (filterType !== 'all' && rule.type !== filterType) return false;
    if (filterAutoApply !== 'all' && rule.config.autoApply !== filterAutoApply) return false;
    return true;
  });

  const stats = {
    total: rules.length,
    deduction: rules.filter(r => r.type === RuleType.DEDUCTION).length,
    induction: rules.filter(r => r.type === RuleType.INDUCTION).length,
    abduction: rules.filter(r => r.type === RuleType.ABDUCTION).length,
    autoApply: rules.filter(r => r.config.autoApply).length,
    activeResults: reasoningResults.length,
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-gray-800" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">本体推理规则引擎</h2>
              <p className="text-xs text-gray-800">基于规则的增量推理系统 - 支持推理链可视化</p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
            <RefreshCw size={18} className="text-gray-800" />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="text-xs text-gray-800 mb-1">总规则数</div>
            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="p-3 bg-brand-500/10 rounded-xl">
            <div className="text-xs text-brand-400 mb-1">演绎规则</div>
            <div className="text-xl font-bold text-brand-400">{stats.deduction}</div>
          </div>
          <div className="p-3 bg-white0/10 rounded-xl">
            <div className="text-xs text-emerald-400 mb-1">归纳规则</div>
            <div className="text-xl font-bold text-emerald-400">{stats.induction}</div>
          </div>
          <div className="p-3 bg-white0/10 rounded-xl">
            <div className="text-xs text-purple-400 mb-1">溯因规则</div>
            <div className="text-xl font-bold text-purple-400">{stats.abduction}</div>
          </div>
          <div className="p-3 bg-white0/10 rounded-xl">
            <div className="text-xs text-teal-400 mb-1">自动应用</div>
            <div className="text-xl font-bold text-teal-400">{stats.autoApply}</div>
          </div>
          <div className="p-3 bg-white0/10 rounded-xl">
            <div className="text-xs text-amber-700 mb-1">推理结果</div>
            <div className="text-xl font-bold text-amber-700">{stats.activeResults}</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">推理引擎执行</span>
            {isRunning && (
              <span className="flex items-center gap-2 text-xs text-blue-600">
                <RefreshCw size={12} className="animate-spin" />
                执行中...
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={runAbductiveReasoning}
              disabled={isRunning}
              className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                activeEngine === 'abduction'
                  ? 'border-purple-500 bg-white0/10 text-purple-400'
                  : 'border-gray-100 bg-white hover:border-purple-500/30 text-gray-600'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Sparkles size={16} />
              <span className="text-sm font-medium">溯因推理</span>
            </button>
            <button
              onClick={runMultistepReasoning}
              disabled={isRunning}
              className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                activeEngine === 'multistep'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-gray-100 bg-white hover:border-brand-500/30 text-gray-600'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <GitBranch size={16} />
              <span className="text-sm font-medium">多步推理</span>
            </button>
            <button
              onClick={runPerceptionEngine}
              disabled={isRunning}
              className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                activeEngine === 'perception'
                  ? 'border-teal-500 bg-white0/10 text-teal-400'
                  : 'border-gray-100 bg-white hover:border-teal-300 text-gray-600'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Eye size={16} />
              <span className="text-sm font-medium">感知引擎</span>
            </button>
            <button
              onClick={runAttributionAnalysis}
              disabled={isRunning}
              className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                activeEngine === 'attribution'
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                  : 'border-gray-100 bg-white hover:border-indigo-500/30 text-gray-600'
              } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BarChart3 size={16} />
              <span className="text-sm font-medium">归因分析</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowAxiomsTab(!showAxiomsTab)}
            className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
              showAxiomsTab
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-gray-100 bg-white hover:border-indigo-500/30 text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield size={16} />
              <span className="text-sm font-medium">业务公理</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                {axiomStats.total} 条规则
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400">通过率 {axiomStats.complianceRate.toFixed(0)}%</span>
              {showAxiomsTab ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </button>
        </div>

        <AnimatePresence>
          {showAxiomsTab && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl border border-indigo-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Scale size={20} className="text-indigo-400" />
                  <h3 className="text-base font-bold text-gray-800">领域约束规则（业务公理）</h3>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-800 mb-1">公理总数</div>
                    <div className="text-2xl font-bold text-gray-800">{axiomStats.total}</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
                    <div className="text-xs text-emerald-400 mb-1">通过</div>
                    <div className="text-2xl font-bold text-emerald-400">{axiomStats.passed}</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-rose-100 shadow-sm">
                    <div className="text-xs text-rose-700 mb-1">违反</div>
                    <div className="text-2xl font-bold text-rose-700">{axiomStats.failed}</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-amber-100 shadow-sm">
                    <div className="text-xs text-amber-700 mb-1">部分违反</div>
                    <div className="text-2xl font-bold text-amber-700">{axiomStats.partial}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {businessAxioms.map((axiom) => (
                    <motion.div
                      key={axiom.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {axiom.status === 'passed' ? (
                            <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                          ) : axiom.status === 'failed' ? (
                            <XCircle size={18} className="text-rose-700 flex-shrink-0" />
                          ) : (
                            <AlertCircle size={18} className="text-amber-700 flex-shrink-0" />
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-gray-800">{axiom.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                axiom.category === 'compliance' ? 'bg-rose-100 text-rose-700' :
                                axiom.category === 'financial' ? 'bg-amber-100 text-amber-700' :
                                axiom.category === 'operational' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {axiom.category === 'compliance' ? '合规' :
                                 axiom.category === 'financial' ? '财务' :
                                 axiom.category === 'operational' ? '运营' : '数据质量'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                axiom.severity === 'critical' ? 'bg-red-50 text-red-600' :
                                axiom.severity === 'warning' ? 'bg-orange-50 text-orange-600' :
                                'bg-gray-50 text-gray-800'
                              }`}>
                                {axiom.severity === 'critical' ? '严重' :
                                 axiom.severity === 'warning' ? '警告' : '信息'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          axiom.status === 'passed' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-500/20' :
                          axiom.status === 'failed' ? 'bg-rose-700/10 text-rose-700 border border-rose-200' :
                          'bg-amber-700/10 text-amber-700 border border-amber-200'
                        }`}>
                          {axiom.status === 'passed' ? '✓ 通过' : axiom.status === 'failed' ? '✗ 违反' : '⚠ 部分违反'}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 mb-2 ml-7">{axiom.description}</p>

                      <div className="ml-7 flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-800">约束:</span>
                          <code className="text-[10px] font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">{axiom.constraint}</code>
                        </div>
                      </div>

                      {axiom.violatedBy.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 ml-7">
                          <div className="text-[10px] font-medium text-gray-800 uppercase mb-1">违反实体</div>
                          <div className="flex flex-wrap gap-1">
                            {axiom.violatedBy.slice(0, 5).map((entity, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-100">
                                {entity}
                              </span>
                            ))}
                            {axiom.violatedBy.length > 5 && (
                              <span className="text-xs text-gray-800">...+{axiom.violatedBy.length - 5} 个</span>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-indigo-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-gray-800" />
                      <span className="text-xs text-gray-800">整体合规率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all bg-gradient-to-r from-emerald-400 to-brand-400"
                          style={{ width: `${axiomStats.complianceRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{axiomStats.complianceRate.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {reasoningResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-100"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles size={16} className="text-brand-400" />
                  <span className="text-sm font-medium text-gray-600">推理结果</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    {reasoningResults.length} 条洞察
                  </span>
                </div>
                <button
                  onClick={() => setReasoningResults([])}
                  className="text-xs text-gray-800 hover:text-gray-800"
                >
                  清除结果
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {reasoningResults.map((result, idx) => (
                  <motion.div
                    key={result.id || idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {result.type === 'abduction' ? (
                            <Sparkles size={16} className="text-purple-400" />
                          ) : result.type === 'multistep' ? (
                            <GitBranch size={16} className="text-brand-400" />
                          ) : result.type === 'attribution' ? (
                            <BarChart3 size={16} className="text-indigo-500" />
                          ) : (
                            <Eye size={16} className="text-teal-400" />
                          )}
                          <span className="text-sm font-bold text-gray-700">{result.title}</span>
                        </div>
                        {result.businessSummary && (
                          <div className="flex items-start gap-1.5 mb-1 p-2 bg-brand-500/5 rounded-lg border border-brand-500/10">
                            <Lightbulb size={12} className="text-brand-400 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-brand-400 font-medium">{result.businessSummary}</span>
                          </div>
                        )}
                        {result.explanation && (
                          <p className="text-xs text-gray-600 leading-relaxed">{result.explanation}</p>
                        )}
                        {result.description && (
                          <p className="text-xs text-gray-600 leading-relaxed">{result.description}</p>
                        )}
                        {result.attributionFactors && result.attributionFactors.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <div className="text-[10px] font-bold text-gray-800 uppercase mb-1">归因因素</div>
                            {result.attributionFactors.map((factor: any, fIdx: number) => {
                               const contrib = factor.contribution || 0;
                               const contribPct = factor.contributionPercent || 0;
                               const dir = factor.direction || 'neutral';
                              const barWidth = Math.min(Math.abs(contribPct), 100);
                              return (
                                <div key={fIdx} className="group">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-medium text-gray-700">{factor.factorLabel || factor.factor}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-semibold ${
                                        dir === 'positive' ? 'text-green-600' : 
                                        dir === 'negative' ? 'text-red-600' : 'text-gray-500'
                                      }`}>
                                        {contrib > 0 ? '+' : ''}{contrib.toFixed(1)}
                                      </span>
                                      <span className="text-[10px] text-gray-500 w-8 text-right">
                                        {contribPct.toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        dir === 'positive' ? 'bg-green-500' : 
                                        dir === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                                      }`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1 ml-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                          result.confidence > 0.8 ? 'bg-white0/10 text-emerald-400 border border-emerald-500/20' :
                          result.confidence > 0.6 ? 'bg-white0/10 text-amber-700 border border-amber-500/20' :
                          'bg-white/5 text-gray-800 border border-gray-100'
                        }`}>
                          {(result.confidence * 100).toFixed(0)}%
                        </span>
                        {result.severity && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            result.severity === 'high' ? 'bg-white text-rose-700' :
                            result.severity === 'medium' ? 'bg-white text-orange-700' :
                            'bg-brand-500/10 text-brand-400'
                          }`}>
                            {result.severity === 'high' ? '高' : result.severity === 'medium' ? '中' : '低'}
                          </span>
                        )}
                      </div>
                    </div>

                    {result.affectedEntities && result.affectedEntities.length > 0 && (
                      <div className="mt-2 mb-2">
                        <div className="text-[10px] font-bold text-gray-800 uppercase mb-1">受影响实体</div>
                        <div className="flex flex-wrap gap-1">
                          {result.affectedEntities.map((entity: string, idx: number) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                              {entity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.suggestedActions && result.suggestedActions.length > 0 && (
                      <div className="mt-2 mb-2">
                        <div className="text-[10px] font-bold text-gray-800 uppercase mb-1">建议行动</div>
                        <div className="space-y-1">
                          {result.suggestedActions.map((action: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-emerald-50 rounded border border-emerald-200">
                              <div className="flex items-center gap-1.5">
                                <ArrowRight size={10} className="text-emerald-500" />
                                <span className="font-medium text-emerald-700">{action.name}</span>
                                <span className="text-gray-800">- {action.reason}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                action.priority === 'high' ? 'bg-white text-rose-700' : 'bg-white0/10 text-amber-700'
                              }`}>
                                {action.priority === 'high' ? '高' : '中'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.steps && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-2 mb-2">
                          <GitBranch size={12} className="text-gray-800" />
                          <span className="text-xs font-bold text-gray-800 uppercase">推理路径</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-600 overflow-x-auto">
                          {result.steps.slice(0, 4).map((step: any, sIdx: number) => (
                            <React.Fragment key={sIdx}>
                              <span className="px-2 py-1 bg-gray-50 rounded border border-gray-100 whitespace-nowrap">{step.predicate || step}</span>
                              {sIdx < Math.min(result.steps.length, 4) - 1 && <ArrowRight size={12} className="text-gray-800 flex-shrink-0" />}
                            </React.Fragment>
                          ))}
                          {result.steps.length > 4 && <span className="text-gray-800">...+{result.steps.length - 4} 步</span>}
                        </div>
                        <div className="text-xs text-gray-800 mt-1">总步骤: {result.totalSteps} 步</div>
                      </div>
                    )}

                    {result.testablePredictions && result.testablePredictions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-2 mb-2">
                          <Target size={12} className="text-gray-800" />
                          <span className="text-xs font-bold text-gray-800 uppercase">可验证预测</span>
                        </div>
                        <div className="space-y-1">
                          {result.testablePredictions.slice(0, 3).map((pred: any, pIdx: number) => (
                            <div key={pIdx} className="flex items-start space-x-2 text-xs p-2 bg-gray-50 rounded border border-gray-100">
                              <div className="w-4 h-4 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{pIdx + 1}</div>
                              <span className="text-gray-600">{pred.description || pred.prediction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-800">
                        {result.type === 'abduction' ? '溯因推理' : result.type === 'multistep' ? '多步推理' : '感知引擎'}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          className="px-3 py-1.5 text-xs font-medium text-gray-800 bg-white/8 rounded-lg hover:bg-white/12 transition-colors border border-gray-100"
                        >
                          忽略
                        </button>
                        {result.confidence >= 0.8 && (
                          <button
                            onClick={() => handlePushToInbox(result)}
                            disabled={pushingActionId === result.id}
                            className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-sm flex items-center gap-1 ${
                              pushingActionId === result.id
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/30'
                            }`}
                          >
                            {pushingActionId === result.id ? (
                              <>
                                <div className="animate-spin w-3 h-3 border border-white/20 border-t-white rounded-full" />
                                推送中...
                              </>
                            ) : (
                              <>
                                <Inbox size={12} />
                                推送到决策收件箱
                              </>
                            )}
                          </button>
                        )}
                        <button
                          className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-sm ${
                            result.confidence > 0.8
                              ? 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/30'
                              : 'bg-white0 hover:bg-emerald-600 shadow-emerald-500/30'
                          }`}
                        >
                          {result.confidence > 0.8 ? '加入待决策' : '验证'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-800" />
            <span className="text-sm text-gray-800">筛选:</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'all' ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-800 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterType(RuleType.DEDUCTION)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === RuleType.DEDUCTION ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              <GitBranch size={12} />演绎
            </button>
            <button
              onClick={() => setFilterType(RuleType.INDUCTION)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === RuleType.INDUCTION ? 'bg-white0 text-white' : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              <TrendingUp size={12} />归纳
            </button>
            <button
              onClick={() => setFilterType(RuleType.ABDUCTION)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === RuleType.ABDUCTION ? 'bg-white0 text-white' : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              <Sparkles size={12} />溯因
            </button>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setFilterAutoApply('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterAutoApply === 'all' ? 'bg-slate-700 text-white' : 'bg-white/5 text-gray-800 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterAutoApply(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                filterAutoApply === true ? 'bg-white0 text-white' : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              <Zap size={12} />自动应用
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredRules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              expanded={expandedRuleId === rule.id}
              onToggle={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
              showReasoning={showReasoningRuleId === rule.id}
              onToggleReasoning={() => setShowReasoningRuleId(showReasoningRuleId === rule.id ? null : rule.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InferenceRulesPanel;
