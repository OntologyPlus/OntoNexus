import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { EnhancedScenario, ScenarioType, ScenarioParameter } from '../types';
import { TrendingUp, ArrowRight, Play, Users, AlertTriangle, Lightbulb, GitBranch, Target, BrainCircuit, Sparkles, Zap, BarChart3, GitCompare, AlertCircle, CheckCircle2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionScenario, DecisionDomain, DecisionType, TimeHorizon, SpatialScope, DecisionStatus } from '../decision/DecisionOntology';
import { DecisionRecommendationEngine } from '../decision/DecisionRecommendationEngine';
import { CounterfactualReasoningEngine, WhatIfScenario, CounterfactualResult, SensitivityResult, Alternative, ComparisonResult } from '../inference/CounterfactualReasoningEngine';
import { useScenarios } from '../api/hooks';
import { useOntologyContext } from '../contexts/OntologyContext';
import PageHeader from './PageHeader';

const SCENARIO_CATEGORIES = [
  { id: 'sales_strategy', name: '销售策略', icon: TrendingUp },
  { id: 'customer_management', name: '客户管理', icon: Users },
  { id: 'risk_response', name: '风险应对', icon: AlertTriangle },
];

// 决策推演步骤
interface DecisionStep {
  id: string;
  order: number;
  name: string;
  description: string;
  expectedOutcome: string;
  dependencies: string[];
  duration: number;
  responsible: string;
}

// 决策推演路径
interface DecisionPath {
  id: string;
  name: string;
  description: string;
  steps: DecisionStep[];
  totalDuration: number;
  successProbability: number;
  expectedRoi: number;
}

const ScenarioSim: React.FC = () => {
  const { refreshData } = useOntologyContext();
  const [selectedScenario, setSelectedScenario] = useState<EnhancedScenario | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('sales_strategy');
  const [activeTab, setActiveTab] = useState<'simulation' | 'advanced'>('simulation');
  const [advancedMode, setAdvancedMode] = useState<'decision' | 'counterfactual'>('decision');
  const [generatedDecision, setGeneratedDecision] = useState<DecisionScenario | null>(null);
  const [selectedPath, setSelectedPath] = useState<DecisionPath | null>(null);
  const [showReasoningChain, setShowReasoningChain] = useState(false);
  const [decisionRecommendation, setDecisionRecommendation] = useState<any>(null);

  const [counterfactualEngine] = useState(() => new CounterfactualReasoningEngine());
  const [counterfactualResult, setCounterfactualResult] = useState<CounterfactualResult | null>(null);
  const [sensitivityResults, setSensitivityResults] = useState<SensitivityResult[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [counterfactualExplanation, setCounterfactualExplanation] = useState<string>('');
  const [keyAssumptions, setKeyAssumptions] = useState<string[]>([]);
  const [optimalIntervention, setOptimalIntervention] = useState<{
    parameter: string;
    reason: string;
    impactPerUnit: number;
  } | null>(null);

  const recommendationEngine = useMemo(() => new DecisionRecommendationEngine(), []);

  const { scenarios: apiScenarios } = useScenarios();

  const scenarios: EnhancedScenario[] = useMemo(() => 
    apiScenarios.map((s: any) => ({
      id: s.id,
      type: s.type as ScenarioType,
      name: s.name,
      description: s.description || '',
      category: s.category,
      parameters: (s.parameters || []).map((p: any) => ({
        name: p.name,
        type: p.type as ScenarioParameter['type'],
        label: p.label,
        defaultValue: p.defaultValue,
        options: p.options,
        min: p.min,
        max: p.max,
        step: p.step,
        required: p.required,
        description: p.description,
      })),
      forecastResult: s.forecastResult,
      comparisonWithBaseline: s.comparisonWithBaseline,
      relatedScenarios: s.relatedScenarios,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
    })),
    [apiScenarios]
  );

  const filteredScenarios = scenarios.filter(s =>
    !selectedCategory || s.category === selectedCategory
  );

  // 基于场景生成决策推演路径
  const generateDecisionPaths = (_scenario: EnhancedScenario): DecisionPath[] => {
    const basePaths: DecisionPath[] = [
      {
        id: 'path_aggressive',
        name: '积极进攻路径',
        description: '快速执行，高风险高回报',
        steps: [
          { id: 's1', order: 1, name: '资源调配', description: '立即调配所需资源', expectedOutcome: '资源到位', dependencies: [], duration: 3, responsible: '区域经理' },
          { id: 's2', order: 2, name: '快速执行', description: '加速执行关键动作', expectedOutcome: '初步见效', dependencies: ['s1'], duration: 7, responsible: '销售代表' },
          { id: 's3', order: 3, name: '效果评估', description: '评估执行效果', expectedOutcome: '达成目标', dependencies: ['s2'], duration: 5, responsible: '数据分析' },
        ],
        totalDuration: 15,
        successProbability: 0.75,
        expectedRoi: 2.5,
      },
      {
        id: 'path_conservative',
        name: '稳健保守路径',
        description: '循序渐进，低风险稳定回报',
        steps: [
          { id: 's1', order: 1, name: '充分准备', description: '详细规划和准备', expectedOutcome: '方案就绪', dependencies: [], duration: 7, responsible: '策略团队' },
          { id: 's2', order: 2, name: '试点验证', description: '小范围试点测试', expectedOutcome: '验证可行', dependencies: ['s1'], duration: 14, responsible: '试点团队' },
          { id: 's3', order: 3, name: '全面推广', description: '推广至全部范围', expectedOutcome: '全面覆盖', dependencies: ['s2'], duration: 21, responsible: '执行团队' },
          { id: 's4', order: 4, name: '持续优化', description: '根据反馈优化', expectedOutcome: '效果最大化', dependencies: ['s3'], duration: 14, responsible: '优化团队' },
        ],
        totalDuration: 56,
        successProbability: 0.9,
        expectedRoi: 1.8,
      },
      {
        id: 'path_balanced',
        name: '平衡优化路径',
        description: '平衡风险与收益，灵活调整',
        steps: [
          { id: 's1', order: 1, name: '快速启动', description: '快速启动核心动作', expectedOutcome: ' momentum建立', dependencies: [], duration: 5, responsible: '执行团队' },
          { id: 's2', order: 2, name: '动态调整', description: '根据反馈动态调整', expectedOutcome: '方向正确', dependencies: ['s1'], duration: 10, responsible: '管理团队' },
          { id: 's3', order: 3, name: '规模化', description: '规模化成功模式', expectedOutcome: '规模效应', dependencies: ['s2'], duration: 15, responsible: '扩展团队' },
        ],
        totalDuration: 30,
        successProbability: 0.82,
        expectedRoi: 2.1,
      },
    ];

    return basePaths;
  };

  // 将场景转换为决策场景
  const convertScenarioToDecision = (scenario: EnhancedScenario): DecisionScenario => {
    let domain = DecisionDomain.REVENUE;
    switch (scenario.category) {
      case 'customer_management':
        domain = DecisionDomain.CUSTOMER;
        break;
      case 'risk_response':
        domain = DecisionDomain.COMPLIANCE;
        break;
    }

    return {
      id: `decision_${scenario.id}`,
      name: `${scenario.name}决策`,
      description: scenario.description,
      context: {
        id: `ctx_${scenario.id}`,
        type: DecisionType.TACTICAL,
        domain,
        timeHorizon: TimeHorizon.MEDIUM_TERM,
        spatialScope: SpatialScope.TERRITORY,
        stakeholders: [],
        constraints: [],
        objectives: scenario.parameters.map((p, idx) => ({
          id: `obj_${idx}`,
          name: p.label,
          description: p.description || '',
          target: Number(p.max) || 100,
          current: Number(p.defaultValue) || 0,
          weight: 1 / scenario.parameters.length,
          priority: 'medium',
          metrics: [p.name],
        })),
        relatedEntities: [],
        historicalDecisions: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          urgency: 60,
          importance: 75,
          tags: [scenario.type, scenario.category],
        },
      },
      alternatives: [
        {
          id: 'alt1',
          name: '方案A',
          description: '标准执行方案',
          actions: [],
          expectedOutcomes: [],
          risks: [],
          resourceRequirements: [],
        },
        {
          id: 'alt2',
          name: '方案B',
          description: '优化执行方案',
          actions: [],
          expectedOutcomes: [],
          risks: [],
          resourceRequirements: [],
        },
      ],
      evaluationCriteria: [],
      confidence: 0.8,
      status: DecisionStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleGenerateDecision = () => {
    if (!selectedScenario) return;
    const decision = convertScenarioToDecision(selectedScenario);
    setGeneratedDecision(decision);
    const recommendation = recommendationEngine.generateRecommendation(decision);
    setDecisionRecommendation(recommendation);
    setActiveTab('advanced');
    setAdvancedMode('decision');
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = SCENARIO_CATEGORIES.find(c => c.id === categoryId);
    return category?.icon || TrendingUp;
  };

  const getCategoryColor = (categoryId: string) => {
    switch (categoryId) {
      case 'sales_strategy': return 'bg-white/5';
      case 'customer_management': return 'bg-white/5';
      case 'risk_response': return 'bg-white/5';
      default: return 'bg-white/5';
    }
  };

  const getScenarioTypeIcon = (type: ScenarioType) => {
    switch (type) {
      case ScenarioType.RESOURCE_REALLOCATION: return '🔄';
      case ScenarioType.PRODUCT_MIX_OPTIMIZATION: return '📊';
      case ScenarioType.PRICE_ADJUSTMENT: return '💰';
      case ScenarioType.CHANNEL_STRATEGY: return '📱';
      case ScenarioType.KOL_STRATEGY: return '🎓';
      case ScenarioType.CUSTOMER_CHURN_INTERVENTION: return '👥';
      case ScenarioType.NEW_CUSTOMER_DEVELOPMENT: return '🏥';
      case ScenarioType.COMPLIANCE_RISK_RESPONSE: return '🛡️';
      case ScenarioType.COMPETITOR_RESPONSE: return '⚔️';
      case ScenarioType.EMERGENCY_RESPONSE: return '🚨';
      default: return '📋';
    }
  };

  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<{
    success: boolean;
    message: string;
    actionId?: string;
  } | null>(null);

  const handleRunScenario = async () => {
    if (!selectedScenario) return;
    setScenarioRunning(true);
    setScenarioResult(null);
    try {
      const { default: apiClient } = await import('../api/client');
      const prompt = `应用场景: ${selectedScenario.name}\n描述: ${selectedScenario.description}\n参数: ${JSON.stringify(selectedScenario.parameters.map((p: any) => ({ name: p.label, value: p.defaultValue })))}`;
      await apiClient.invokeAgent(prompt);
      refreshData();
      setScenarioResult({
        success: true,
        message: '场景已应用，AI已生成行动方案。请到决策收件箱查看。',
      });
    } catch (err) {
      console.error(err);
      setScenarioResult({
        success: false,
        message: '场景应用失败，请检查后端服务状态',
      });
    } finally {
      setScenarioRunning(false);
    }
  };

  const decisionPaths = selectedScenario ? generateDecisionPaths(selectedScenario) : [];

  const runCounterfactualAnalysis = useCallback((scenario: EnhancedScenario) => {
    setIsAnalyzing(true);
    
    const whatIfScenario: WhatIfScenario = {
      id: `cf_${scenario.id}`,
      name: `${scenario.name} - 反事实分析`,
      description: scenario.description,
      intervention: {
        type: 'increase',
        targetEntity: scenario.id,
        targetProperty: scenario.parameters[0]?.name || 'sales_volume',
        value: 10,
        duration: 30,
      },
      baselineConditions: scenario.parameters.reduce((acc, p) => {
        acc[p.name] = Number(p.defaultValue) || 100;
        return acc;
      }, {} as Record<string, any>),
      assumptions: ['市场环境稳定', '竞争对手行为不变', '内部资源充足'],
    };

    const result = counterfactualEngine.whatIfAnalysis(whatIfScenario);
    setCounterfactualResult(result);

    const explanation = `如果将${scenario.parameters[0]?.label || '关键参数'}提升 ${whatIfScenario.intervention.value}%，预计${scenario.name}的核心指标将在 ${whatIfScenario.intervention.duration} 天内变化 ${result.predictedOutcome?.changePercent?.toFixed(1) || 'X'}%。根据历史数据分析，该干预措施与目标指标之间存在较强的相关性，系统基于 ${result.confidence > 0.8 ? '高置信度' : '中等置信度'} 模型预测此结果。`;
    setCounterfactualExplanation(explanation);

    const assumptions = [
      '市场环境保持稳定，无重大政策变化',
      '竞争对手行为模式不变',
      '内部资源供应充足，能够支持干预措施执行',
      ...whatIfScenario.assumptions,
    ];
    setKeyAssumptions(assumptions.slice(0, 5));

    const params: { name: string; currentValue: number; minValue: number; maxValue: number; step: number }[] = 
      scenario.parameters.slice(0, 3).map(p => ({
        name: p.name,
        currentValue: Number(p.defaultValue) || 50,
        minValue: Number(p.min) || 0,
        maxValue: Number(p.max) || 100,
        step: (Number(p.max) - Number(p.min)) / 10 || 10,
      }));
    
    const sensitivity = counterfactualEngine.sensitivityAnalysis(params);
    setSensitivityResults(sensitivity);

    if (sensitivity.length > 0) {
      const mostSensitive = sensitivity.reduce((a, b) => Math.abs(b.elasticity) > Math.abs(a.elasticity) ? b : a);
      setOptimalIntervention({
        parameter: mostSensitive.parameter,
        reason: `该参数弹性系数为 ${mostSensitive.elasticity.toFixed(2)}，单位投入带来的指标变化最大`,
        impactPerUnit: mostSensitive.elasticity,
      });
    }

    const alternatives: Alternative[] = [
      {
        id: 'baseline',
        name: '基准方案',
        description: '维持现状',
        interventions: [],
        expectedOutcome: result.predictedOutcome ? [result.predictedOutcome] : [],
        costs: [{ type: '运营成本', amount: 10000 }],
        risks: [{ description: '市场份额下降', probability: 0.3, impact: 0.5 }],
      },
      {
        id: 'aggressive',
        name: '积极方案',
        description: '大幅增加投入',
        interventions: [{ ...whatIfScenario.intervention, value: 30 }],
        expectedOutcome: result.predictedOutcome ? [{ ...result.predictedOutcome, changePercent: result.predictedOutcome.changePercent * 2 }] : [],
        costs: [{ type: '运营成本', amount: 30000 }],
        risks: [{ description: '资源紧张', probability: 0.4, impact: 0.6 }],
      },
      {
        id: 'moderate',
        name: '稳健方案',
        description: '适度增加投入',
        interventions: [{ ...whatIfScenario.intervention, value: 15 }],
        expectedOutcome: result.predictedOutcome ? [{ ...result.predictedOutcome, changePercent: result.predictedOutcome.changePercent * 1.3 }] : [],
        costs: [{ type: '运营成本', amount: 15000 }],
        risks: [{ description: '效果不明显', probability: 0.2, impact: 0.3 }],
      },
    ];

    const comparison = counterfactualEngine.compareAlternatives(alternatives);
    setComparisonResult(comparison);
    
    setIsAnalyzing(false);
  }, [counterfactualEngine]);

  useEffect(() => {
    if (selectedScenario && activeTab === 'advanced' && advancedMode === 'counterfactual') {
      runCounterfactualAnalysis(selectedScenario);
    }
  }, [selectedScenario, activeTab, advancedMode, runCounterfactualAnalysis]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader
        icon={<TrendingUp className="text-brand-400" size={22} />}
        title="场景推演"
        description="模拟业务决策的影响，推演不同执行路径"
        detail="选择一个业务场景，调整参数模拟不同决策对业务指标的影响。高级功能包括决策推演路径和反事实分析。"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {SCENARIO_CATEGORIES.map(category => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
            className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-300 ${
              selectedCategory === category.id
                ? 'bg-brand-500/15 border-brand-500/30 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/20'
                : 'bg-white border-gray-100 hover:border-brand-500/30 hover:shadow-md'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${getCategoryColor(category.id)}`}>
              {React.createElement(getCategoryIcon(category.id) as any, { size: 20, className: selectedCategory === category.id ? 'text-brand-400' : 'text-gray-800' })}
            </div>
            <div className={`text-sm font-bold ${selectedCategory === category.id ? 'text-brand-400' : 'text-gray-700'}`}>{category.name}</div>
            <div className={`text-xs ${selectedCategory === category.id ? 'text-brand-400/70' : 'text-gray-800'}`}>
              {scenarios.filter(s => s.category === category.id).length} 个场景
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* 左侧：场景列表 */}
        <div className="space-y-4 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">可用场景</h3>

          <div className="space-y-3">
            {filteredScenarios.map((scenario) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                  selectedScenario?.id === scenario.id 
                    ? 'border-brand-500/30 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/15 bg-brand-500/8' 
                    : 'border-gray-100'
                }`}
                onClick={() => {
                  setSelectedScenario(scenario);
                  setGeneratedDecision(null);
                  setSelectedPath(null);
                  setActiveTab('simulation');
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-gray-700 mb-1">{scenario.name}</div>
                    <p className="text-xs text-gray-800 mb-2">{scenario.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.parameters.slice(0, 3).map((param: ScenarioParameter) => (
                        <span key={param.name} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-800 border border-gray-100">
                          {param.label}: {String(param.defaultValue)}
                        </span>
                      ))}
                      {scenario.parameters.length > 3 && (
                        <span className="text-[10px] text-gray-800">+{scenario.parameters.length - 3} 更多</span>
                      )}
                    </div>
                  </div>
                  <span className="text-2xl">{getScenarioTypeIcon(scenario.type)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 右侧：模拟结果或决策推演 */}
        <div className="lg:col-span-2 space-y-4">
          {selectedScenario && (
            <>
              {/* 标签切换 */}
              <div className="flex space-x-2 border-b border-gray-100">
                <button
                  onClick={() => setActiveTab('simulation')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'simulation'
                      ? 'text-brand-400 border-b-2 border-brand-500'
                      : 'text-gray-800 hover:text-gray-600'
                  }`}
                >
                  <TrendingUp size={16} className="inline mr-1" />
                  场景模拟
                </button>
                <button
                  onClick={() => setActiveTab('advanced')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'advanced'
                      ? 'text-brand-400 border-b-2 border-brand-500'
                      : 'text-gray-800 hover:text-gray-600'
                  }`}
                >
                  <Zap size={16} className="inline mr-1" />
                  高级分析
                  {(generatedDecision || counterfactualResult) && (
                    <span className="ml-1 text-xs bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded-full">新</span>
                  )}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'simulation' ? (
                  <motion.div
                    key="simulation"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {selectedScenario.comparisonWithBaseline ? (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-xs text-gray-800 mb-1">当前预测</div>
                            <div className="text-xl font-bold text-gray-700 mb-1">
                              {selectedScenario.comparisonWithBaseline.baseline.forecastValue.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-800">
                              达成率: {selectedScenario.comparisonWithBaseline.baseline.achievementRate}%
                            </div>
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                              selectedScenario.comparisonWithBaseline.baseline.riskLevel === 'at_risk'
                                ? 'bg-white text-orange-700' : 'bg-white0/10 text-emerald-400'
                            }`}>
                              {selectedScenario.comparisonWithBaseline.baseline.riskLevel === 'at_risk' ? '风险' : '正常'}
                            </div>
                          </div>

                          <div className="p-3 bg-brand-500/5 rounded-lg border border-brand-500/20">
                            <div className="text-xs text-brand-400 mb-1">场景预测</div>
                            <div className="text-xl font-bold text-brand-400 mb-1">
                              {selectedScenario.comparisonWithBaseline.scenario.forecastValue.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-800">
                              达成率: {selectedScenario.comparisonWithBaseline.scenario.achievementRate}%
                            </div>
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                              selectedScenario.comparisonWithBaseline.scenario.riskLevel === 'on_track'
                                ? 'bg-white0/10 text-emerald-400' : 'bg-white text-orange-700'
                            }`}>
                              {selectedScenario.comparisonWithBaseline.scenario.riskLevel === 'on_track' ? '正常' : '风险'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-center p-3">
                          <div className={`text-4xl font-bold ${
                            selectedScenario.comparisonWithBaseline.delta > 0 ? 'text-emerald-400' : 'text-rose-700'
                          }`}>
                            {selectedScenario.comparisonWithBaseline.delta > 0 ? '+' : ''}{Math.abs(selectedScenario.comparisonWithBaseline.delta)}%
                          </div>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="text-sm font-medium text-gray-700 mb-1">{selectedScenario.comparisonWithBaseline.impactAnalysis}</div>
                        </div>

                        <div className="pt-3 border-t border-gray-100">
                          <button
                            onClick={handleGenerateDecision}
                            className="w-full py-3 bg-white/10 text-gray-600 rounded-lg font-medium hover:bg-gray-300 transition-all flex items-center justify-center gap-2"
                          >
                            <Lightbulb size={18} />
                            基于此场景生成决策推演
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-100 text-gray-800">
                        <TrendingUp size={48} className="mb-2 text-gray-800" />
                        <p className="text-sm">选择一个场景查看模拟结果</p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      {scenarioRunning ? (
                        <button
                          disabled
                          className="flex items-center space-x-2 px-4 py-3 bg-brand-500/50 text-white text-sm font-medium rounded-lg cursor-not-allowed"
                        >
                          <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2"></div>
                          <span>场景应用中...</span>
                        </button>
                      ) : scenarioResult ? (
                        <div className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium ${
                          scenarioResult.success 
                            ? 'bg-white0/10 text-gray-700 border border-emerald-500/20' 
                            : 'bg-white/10 text-gray-600 border border-rose-500/20'
                        }`}>
                          {scenarioResult.success ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <AlertCircle size={16} className="text-rose-700" />
                          )}
                          <span>{scenarioResult.message}</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleRunScenario}
                          className="flex items-center space-x-2 px-4 py-3 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
                        >
                          <Play size={16} className="mr-2" />
                          应用场景
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ) : activeTab === 'advanced' ? (
                  <motion.div
                    key="advanced"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg">
                      <button
                        onClick={() => setAdvancedMode('decision')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                          advancedMode === 'decision' ? 'bg-white shadow-sm text-brand-400' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <GitBranch size={14} className="inline mr-1" />
                        决策推演
                      </button>
                      <button
                        onClick={() => setAdvancedMode('counterfactual')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                          advancedMode === 'counterfactual' ? 'bg-white shadow-sm text-brand-400' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Zap size={14} className="inline mr-1" />
                        反事实分析
                      </button>
                    </div>

                    {advancedMode === 'decision' ? (
                      <>
                        {generatedDecision ? (
                          <>
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-2">
                                <BrainCircuit size={20} className="text-gray-800" />
                                <span className="font-semibold text-gray-700">{generatedDecision.name}</span>
                              </div>
                              <p className="text-sm text-gray-800">{generatedDecision.description}</p>
                              <div className="flex items-center gap-4 mt-3 text-xs">
                                <span className="text-gray-800">置信度: <span className="text-brand-400 font-medium">{(generatedDecision.confidence * 100).toFixed(0)}%</span></span>
                                <span className="text-gray-800">紧急度: <span className="text-orange-700 font-medium">{generatedDecision.context.metadata.urgency}/100</span></span>
                                <span className="text-gray-800">重要性: <span className="text-emerald-400 font-medium">{generatedDecision.context.metadata.importance}/100</span></span>
                              </div>
                            </div>

                            {decisionRecommendation && (
                              <div className="bg-gradient-to-r from-brand-500/10 to-purple-500/10 rounded-xl p-4 border border-brand-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                  <Sparkles size={18} className="text-purple-400" />
                                  <span className="font-semibold text-gray-700">AI 决策推荐</span>
                                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white0/10 text-emerald-400">
                                    置信度 {(decisionRecommendation.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>

                                <div className="bg-white rounded-lg p-3 mb-3">
                                  <div className="text-sm font-medium text-gray-700 mb-1">
                                    推荐方案: {decisionRecommendation.recommendedAlternative?.name}
                                  </div>
                                  <p className="text-xs text-gray-800">
                                    {decisionRecommendation.recommendedAlternative?.description}
                                  </p>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                  <div className="bg-white0/10 rounded p-2 text-center">
                                    <div className="text-xs text-emerald-400">预期收益</div>
                                    <div className="text-sm font-bold text-emerald-400">
                                      ¥{(decisionRecommendation.expectedImpact?.financial?.revenue / 10000 || 0).toFixed(0)}万
                                    </div>
                                  </div>
                                  <div className="bg-brand-500/10 rounded p-2 text-center">
                                    <div className="text-xs text-brand-400">ROI</div>
                                    <div className="text-sm font-bold text-brand-400">
                                      {(decisionRecommendation.expectedImpact?.financial?.roi || 0) * 100}%
                                    </div>
                                  </div>
                                  <div className="bg-white0/10 rounded p-2 text-center">
                                    <div className="text-xs text-purple-400">实施周期</div>
                                    <div className="text-sm font-bold text-purple-400">
                                      {(decisionRecommendation.implementationPlan || []).reduce((sum: number, s: any) => sum + (s.duration || 0), 0)}天
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div>
                              <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
                                <GitBranch size={16} />
                                选择执行路径
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {decisionPaths.map((path) => (
                                  <motion.div
                                    key={path.id}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setSelectedPath(path)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                      selectedPath?.id === path.id
                                        ? 'border-brand-500 bg-brand-500/5'
                                        : 'border-gray-100 bg-white hover:border-gray-100'
                                    }`}
                                  >
                                    <div className="font-medium text-gray-700 mb-1">{path.name}</div>
                                    <p className="text-xs text-gray-800 mb-3">{path.description}</p>
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-800">周期</span>
                                        <span className="font-medium">{path.totalDuration}天</span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-800">成功率</span>
                                        <span className={`font-medium ${path.successProbability >= 0.8 ? 'text-emerald-400' : 'text-amber-700'}`}>
                                          {(path.successProbability * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-800">预期ROI</span>
                                        <span className="font-medium text-emerald-400">{path.expectedRoi}x</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>

                            {selectedPath && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-white rounded-xl border border-gray-100 p-4"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold text-gray-700">{selectedPath.name} - 执行步骤</h4>
                                  <button
                                    onClick={() => setShowReasoningChain(!showReasoningChain)}
                                    className="text-xs text-brand-400 hover:underline"
                                  >
                                    {showReasoningChain ? '隐藏推理链' : '查看推理链'}
                                  </button>
                                </div>

                                <div className="relative">
                                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10"></div>

                                  <div className="space-y-4">
                                    {selectedPath.steps.map((step, index) => (
                                      <div key={step.id} className="relative pl-10">
                                        <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                          index === 0 ? 'bg-brand-500 border-brand-500' :
                                          index === selectedPath.steps.length - 1 ? 'bg-green-500 border-green-500' :
                                          'bg-white border-gray-100'
                                        }`}>
                                          <span className="text-[10px] text-gray-800 font-bold">{step.order}</span>
                                        </div>

                                        <div className="bg-gray-50 rounded-lg p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-gray-700">{step.name}</span>
                                            <span className="text-xs text-gray-800">{step.duration}天</span>
                                          </div>
                                          <p className="text-xs text-gray-800 mb-2">{step.description}</p>
                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-800">负责人:</span>
                                            <span className="text-gray-600">{step.responsible}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs mt-1">
                                            <span className="text-gray-800">预期成果:</span>
                                            <span className="text-emerald-400">{step.expectedOutcome}</span>
                                          </div>

                                          {showReasoningChain && (
                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                              <div className="text-[10px] text-gray-800">
                                                推理依据: 基于历史数据分析，此步骤对整体成功率贡献度为
                                                {((1 / selectedPath.steps.length) * 100).toFixed(0)}%
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedPath(null)}
                                    className="px-4 py-2 text-gray-800 hover:bg-gray-50 rounded-lg transition-colors text-sm"
                                  >
                                    重新选择
                                  </button>
                                  <button className="px-4 py-2 bg-white0 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm flex items-center gap-2">
                                    <Target size={16} />
                                    确认执行此路径
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-100 text-gray-800">
                            <GitBranch size={48} className="mb-2 text-gray-800" />
                            <p className="text-sm">先在"场景模拟"标签页生成决策推演</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {isAnalyzing ? (
                          <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-br from-purple-500/10 to-brand-500/10 rounded-xl border border-purple-500/20">
                            <div className="animate-spin w-12 h-12 border-4 border-purple-500/20 border-t-purple-600 rounded-full mb-4"></div>
                            <p className="text-sm text-purple-400 font-medium">正在进行反事实推理分析...</p>
                          </div>
                        ) : counterfactualResult ? (
                          <>
                            <div className="bg-gradient-to-r from-purple-500/10 to-brand-500/10 rounded-xl p-4 border border-purple-500/20">
                              <div className="flex items-center gap-2 mb-3">
                                <Zap size={18} className="text-purple-400" />
                                <span className="font-semibold text-gray-700">反事实推理结果</span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white0/10 text-purple-400">
                                  置信度 {(counterfactualResult.confidence * 100).toFixed(0)}%
                                </span>
                              </div>

                              {counterfactualExplanation && (
                                <div className="bg-white rounded-lg p-3 mb-4 border border-gray-100">
                                  <div className="flex items-start gap-2">
                                    <Lightbulb size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <div className="text-xs font-bold text-gray-800 uppercase mb-1">推理结论</div>
                                      <p className="text-sm text-gray-700 leading-relaxed">{counterfactualExplanation}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {optimalIntervention && (
                                <div className="bg-white rounded-lg p-3 mb-4 border border-emerald-500/20">
                                  <div className="flex items-start gap-2">
                                    <Target size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <div className="text-xs font-bold text-gray-800 uppercase mb-1">最优干预点</div>
                                      <div className="text-sm font-medium text-gray-700">{optimalIntervention.parameter}</div>
                                      <p className="text-xs text-gray-800 mt-0.5">{optimalIntervention.reason}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-xs px-2 py-0.5 rounded bg-white0/10 text-emerald-400 border border-emerald-500/20">
                                          弹性系数: {Math.abs(optimalIntervention.impactPerUnit).toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-white rounded-lg p-3 border border-gray-100">
                                  <div className="text-xs text-gray-800 mb-1">基准值</div>
                                  <div className="text-xl font-bold text-gray-700">
                                    {counterfactualResult.predictedOutcome.baselineValue.toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-purple-500/20">
                                  <div className="text-xs text-purple-400 mb-1">预测值</div>
                                  <div className="text-xl font-bold text-purple-400">
                                    {counterfactualResult.predictedOutcome.predictedValue.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-center p-3 bg-white rounded-lg mb-3">
                                <div className={`text-3xl font-bold ${
                                  counterfactualResult.predictedOutcome.changePercent > 0 ? 'text-emerald-400' : 'text-rose-700'
                                }`}>
                                  {counterfactualResult.predictedOutcome.changePercent > 0 ? '+' : ''}
                                  {counterfactualResult.predictedOutcome.changePercent.toFixed(1)}%
                                </div>
                              </div>

                              {keyAssumptions.length > 0 && (
                                <div className="bg-white rounded-lg p-3 mb-3">
                                  <div className="text-xs font-bold text-gray-800 uppercase mb-2">关键假设</div>
                                  <div className="space-y-1">
                                    {keyAssumptions.map((assumption, idx) => (
                                      <div key={idx} className="flex items-start gap-2 text-xs text-gray-800">
                                        <CheckCircle size={12} className="text-gray-800 mt-0.5 flex-shrink-0" />
                                        <span>{assumption}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {counterfactualResult.sideEffects.length > 0 && (
                                <div className="bg-white rounded-lg p-3">
                                  <div className="text-xs font-medium text-gray-800 mb-2">副作用分析</div>
                                  <div className="space-y-1">
                                    {counterfactualResult.sideEffects.slice(0, 3).map((effect, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        {effect.desirability === 'positive' ? (
                                          <CheckCircle2 size={12} className="text-green-500" />
                                        ) : effect.desirability === 'negative' ? (
                                          <AlertCircle size={12} className="text-red-500" />
                                        ) : (
                                          <AlertCircle size={12} className="text-gray-800" />
                                        )}
                                        <span className="text-gray-800">{effect.description}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {sensitivityResults.length > 0 && (
                              <div className="bg-white rounded-xl p-4 border border-gray-100">
                                <div className="flex items-center gap-2 mb-3">
                                  <BarChart3 size={16} className="text-brand-400" />
                                  <span className="font-semibold text-gray-700">敏感性分析</span>
                                </div>
                                <div className="space-y-3">
                                  {sensitivityResults.map((result, idx) => (
                                    <div key={idx} className="bg-gray-50 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">{result.parameter}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                          Math.abs(result.elasticity) > 1 
                                            ? 'bg-white text-orange-700' 
                                            : 'bg-white0/10 text-emerald-400'
                                        }`}>
                                          弹性: {result.elasticity.toFixed(2)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-800">{result.recommendation}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {comparisonResult && (
                              <div className="bg-white rounded-xl p-4 border border-gray-100">
                                <div className="flex items-center gap-2 mb-3">
                                  <GitCompare size={16} className="text-emerald-400" />
                                  <span className="font-semibold text-gray-700">方案对比</span>
                                </div>
                                <div className="bg-white0/10 rounded-lg p-3 mb-3 border border-emerald-500/20">
                                  <div className="text-xs text-emerald-400 mb-1">推荐方案</div>
                                  <div className="text-sm font-medium text-emerald-300">{comparisonResult.recommendation}</div>
                                </div>
                                <div className="space-y-2">
                                  {comparisonResult.alternatives.map((alt, idx) => (
                                    <div key={idx} className={`p-3 rounded-lg border ${
                                      comparisonResult.ranking[0] === alt.alternative.id
                                        ? 'bg-white0/8 border-emerald-500/20'
                                        : 'bg-gray-50 border-gray-100'
                                    }`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">{alt.alternative.name}</span>
                                        <span className={`text-xs font-medium ${
                                          alt.comparison.netBenefit > 0 ? 'text-emerald-400' : 'text-rose-700'
                                        }`}>
                                          净收益: {alt.comparison.netBenefit.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-800 mt-1">{alt.alternative.description}</div>
                                      {alt.comparison.advantages.length > 0 && (
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                          {alt.comparison.advantages.map((adv, i) => (
                                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white0/10 text-emerald-400">
                                              {adv}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <div className="text-xs font-medium text-gray-800 mb-2">分析局限性</div>
                              <div className="space-y-1">
                                {counterfactualResult.limitations.map((limitation, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-800">
                                    <AlertTriangle size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                                    <span>{limitation}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-100 text-gray-800">
                            <Zap size={48} className="mb-2 text-gray-800" />
                            <p className="text-sm">选择场景后自动进行反事实分析</p>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScenarioSim;
