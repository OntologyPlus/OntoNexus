import React, { useState } from 'react';
import { DecisionRecommendationEngine } from '../decision';
import {
  DecisionScenario,
  DecisionRecommendation as DecisionRecommendationType,
  Explanation,
  ImpactAssessment,
} from '../decision';

interface DecisionRecommendationProps {
  scenario: DecisionScenario;
}

export const DecisionRecommendation: React.FC<DecisionRecommendationProps> = ({ scenario }) => {
  const [recommendation, setRecommendation] = useState<DecisionRecommendationType | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'impact' | 'plan' | 'reasoning'>('overview');

  const engine = new DecisionRecommendationEngine();

  const generateRecommendation = () => {
    setLoading(true);
    const rec = engine.generateRecommendation(scenario);
    setRecommendation(rec);
    const expl = engine.explainRecommendation(rec);
    setExplanation(expl);
    setLoading(false);
  };

  if (!recommendation) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-4">决策推荐</h2>
        <div className="text-center py-8">
          <p className="text-gray-800 mb-4">基于当前场景生成智能推荐</p>
          <button
            onClick={generateRecommendation}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '生成中...' : '生成推荐'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-700">决策推荐</h2>
          <p className="text-sm text-gray-800 mt-1">
            生成时间: {new Date(recommendation.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800">置信度:</span>
          <span className={`text-lg font-bold ${
            recommendation.confidence >= 0.8 ? 'text-green-600' :
            recommendation.confidence >= 0.6 ? 'text-yellow-700' : 'text-red-700'
          }`}>
            {(recommendation.confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 推荐方案概览 */}
      <div className="bg-brand-500/8 border border-brand-500/20 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-brand-400 mb-2">
          推荐方案: {recommendation.recommendedAlternative.name}
        </h3>
        <p className="text-brand-400/80">{recommendation.recommendedAlternative.description}</p>
      </div>

      {/* Tab 导航 */}
      <div className="flex border-b border-gray-100 mb-4">
        {[
          { id: 'overview', label: '概览' },
          { id: 'impact', label: '影响评估' },
          { id: 'plan', label: '实施计划' },
          { id: 'reasoning', label: '推理过程' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-gray-800 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="min-h-[300px]">
        {activeTab === 'overview' && (
          <OverviewTab alternative={recommendation.recommendedAlternative} />
        )}
        {activeTab === 'impact' && (
          <ImpactTab impact={recommendation.expectedImpact} />
        )}
        {activeTab === 'plan' && (
          <PlanTab steps={recommendation.implementationPlan} />
        )}
        {activeTab === 'reasoning' && explanation && (
          <ReasoningTab explanation={explanation} />
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
        <button className="px-4 py-2 bg-white0 text-white rounded-lg hover:bg-emerald-600 transition-colors">
          采纳推荐
        </button>
        <button className="px-4 py-2 bg-white/10 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors">
          查看其他方案
        </button>
        <button
          onClick={generateRecommendation}
          className="px-4 py-2 border border-brand-500 text-brand-400 rounded-lg hover:bg-brand-500/10 transition-colors"
        >
          重新生成
        </button>
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ alternative: DecisionRecommendationType['recommendedAlternative'] }> = ({ alternative }) => {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-700 mb-2">行动计划</h4>
        <div className="space-y-2">
          {alternative.actions.map((action, index) => (
            <div key={action.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
              <span className="w-6 h-6 bg-brand-500/10 text-brand-400 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="font-medium text-gray-700">{action.name}</div>
                <div className="text-sm text-gray-800">{action.description}</div>
                <div className="text-xs text-gray-800 mt-1">时间线: {action.timeline}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {alternative.risks.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">主要风险</h4>
          <div className="space-y-2">
            {alternative.risks.slice(0, 3).map((risk) => (
              <div key={risk.id} className="bg-white border border-rose-500/20 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="text-rose-700 text-sm">{risk.description}</span>
                  <span className="text-xs text-rose-700 bg-gray-100 px-2 py-1 rounded">
                    风险值: {(risk.probability * risk.impact).toFixed(1)}
                  </span>
                </div>
                {risk.mitigation.length > 0 && (
                  <div className="mt-2 text-xs text-rose-700/80">
                    缓解措施: {risk.mitigation.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ImpactTab: React.FC<{ impact: ImpactAssessment }> = ({ impact }) => {
  return (
    <div className="space-y-6">
      {/* 财务影响 */}
      <div className="bg-white0/10 border border-emerald-500/20 rounded-lg p-4">
        <h4 className="font-semibold text-emerald-400 mb-3">财务影响</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-emerald-500">预期收入</div>
            <div className="text-2xl font-bold text-emerald-400">
              ¥{impact.financial.revenue.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-emerald-500">实施成本</div>
            <div className="text-2xl font-bold text-rose-700">
              ¥{impact.financial.cost.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-emerald-500">ROI</div>
            <div className="text-2xl font-bold text-emerald-400">
              {(impact.financial.roi * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-emerald-500">回收期</div>
            <div className="text-2xl font-bold text-emerald-400">
              {impact.financial.paybackPeriod}个月
            </div>
          </div>
        </div>
      </div>

      {/* 运营影响 */}
      <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-4">
        <h4 className="font-semibold text-brand-400 mb-3">运营影响</h4>
        <div className="grid grid-cols-2 gap-4">
          <ImpactMetric label="效率提升" value={impact.operational.efficiency} />
          <ImpactMetric label="质量改善" value={impact.operational.quality} />
          <ImpactMetric label="速度提升" value={impact.operational.speed} />
          <ImpactMetric label="资源利用率" value={impact.operational.resourceUtilization} />
        </div>
      </div>

      {/* 战略影响 */}
      <div className="bg-white0/10 border border-purple-500/20 rounded-lg p-4">
        <h4 className="font-semibold text-purple-400 mb-3">战略影响</h4>
        <div className="grid grid-cols-2 gap-4">
          <ImpactMetric label="市场地位" value={impact.strategic.marketPosition} />
          <ImpactMetric label="竞争优势" value={impact.strategic.competitiveAdvantage} />
          <ImpactMetric label="能力建设" value={impact.strategic.capabilityBuilding} />
          <ImpactMetric label="战略一致性" value={impact.strategic.alignment} />
        </div>
      </div>

      {/* 风险影响 */}
      <div className="bg-white0/10 border border-amber-100 rounded-lg p-4">
        <h4 className="font-semibold text-amber-700 mb-3">风险评估</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm text-amber-500">整体风险水平</div>
            <div className="w-full bg-white0/20 rounded-full h-2 mt-1">
              <div
                className="bg-white0 h-2 rounded-full"
                style={{ width: `${Math.min(100, impact.risk.overallRisk)}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700">
            {impact.risk.overallRisk.toFixed(1)}
          </div>
        </div>
        <div className="mt-2 text-sm text-amber-500">
          缓解措施有效性: {(impact.risk.mitigationEffectiveness * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

const ImpactMetric: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const percentage = (value * 100).toFixed(0);
  const color = value > 0.1 ? 'text-green-600' : value > 0 ? 'text-yellow-700' : 'text-gray-800';
  
  return (
    <div>
      <div className="text-sm text-gray-800">{label}</div>
      <div className={`text-xl font-bold ${color}`}>
        {value > 0 ? '+' : ''}{percentage}%
      </div>
    </div>
  );
};

const PlanTab: React.FC<{ steps: DecisionRecommendationType['implementationPlan'] }> = ({ steps }) => {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="border border-gray-100 bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center font-medium flex-shrink-0">
              {step.step}
            </span>
            <div className="flex-1">
              <h4 className="font-medium text-gray-700">{step.name}</h4>
              <p className="text-sm text-gray-800 mt-1">{step.description}</p>
              
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-gray-800">
                  持续时间: <span className="text-gray-600">{step.duration}天</span>
                </span>
                <span className="text-gray-800">
                  负责人: <span className="text-gray-600">{step.responsible}</span>
                </span>
              </div>

              {step.milestones.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-600 mb-2">里程碑</div>
                  <div className="space-y-2">
                    {step.milestones.map((milestone, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600">{milestone.name}</span>
                        <span className="text-gray-800 text-xs">
                          ({new Date(milestone.targetDate).toLocaleDateString()})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step.dependencies.length > 0 && (
                <div className="mt-3 text-sm">
                  <span className="text-gray-800">依赖步骤: </span>
                  <span className="text-gray-600">{step.dependencies.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ReasoningTab: React.FC<{ explanation: Explanation }> = ({ explanation }) => {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">推理总结</h4>
        <p className="text-gray-600">{explanation.summary}</p>
      </div>

      <div>
        <h4 className="font-medium text-gray-700 mb-3">推理步骤</h4>
        <div className="space-y-3">
          {explanation.reasoning.map((step, index) => (
            <div key={index} className="border-l-4 border-brand-500 pl-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-brand-400">步骤 {step.step}</span>
                <span className="text-xs text-gray-800">
                  置信度: {(step.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-sm text-gray-700 font-medium">{step.description}</div>
              <div className="text-sm text-gray-800 mt-1">
                <span className="text-gray-800">前提:</span> {step.premise}
              </div>
              <div className="text-sm text-gray-800">
                <span className="text-gray-800">结论:</span> {step.conclusion}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-700 mb-3">证据支持</h4>
        <div className="space-y-2">
          {explanation.evidence.map((evidence, index) => (
            <div key={index} className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-brand-400 uppercase">{evidence.type}</span>
                <span className="text-xs text-gray-800">{evidence.source}</span>
              </div>
              <div className="text-sm text-gray-600">{evidence.content}</div>
              <div className="text-xs text-gray-800 mt-1">
                可信度: {(evidence.reliability * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DecisionRecommendation;
