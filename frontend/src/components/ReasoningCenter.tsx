import React, { useState, Suspense, lazy } from 'react';
import { Sparkles, Brain } from 'lucide-react';
import PageHeader from './PageHeader';

const InsightEngine = lazy(() => import('./InsightEngine'));
const InferenceRulesPanel = lazy(() => import('./InferenceRulesPanel'));

const ReasoningCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'insights' | 'rules'>('insights');

  const tabs = [
    { id: 'insights' as const, label: '洞察', icon: Sparkles, description: 'AI 自动发现的业务洞察和智能推荐' },
    { id: 'rules' as const, label: '规则', icon: Brain, description: '推理规则引擎和业务公理管理' },
  ];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={<Brain className="text-brand-400" size={22} />}
        title="推理中心"
        description="查看 AI 推理规则、运行推理引擎、管理业务公理"
        detail="推理中心整合了智能洞察和推理规则两大功能。洞察功能自动发现业务中的风险、机会和异常模式；规则功能管理 AI 的推理逻辑，包括演绎、归纳和溯因推理。"
      />

      <div className="flex space-x-1 bg-gray-50 p-1 rounded-xl mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-brand-400 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        }>
          {activeTab === 'insights' ? <InsightEngine /> : <InferenceRulesPanel />}
        </Suspense>
      </div>
    </div>
  );
};

export default ReasoningCenter;
