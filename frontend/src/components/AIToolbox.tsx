import React, { Suspense, lazy } from 'react';
import { Wrench } from 'lucide-react';
import PageHeader from './PageHeader';

const ReasoningEngineStatus = lazy(() => import('./ReasoningEngineStatus'));
const SmartReminderPanel = lazy(() => import('./SmartReminderPanel'));
const AgentStatusPanel = lazy(() => import('./AgentStatusPanel'));

const AIToolbox: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={<Wrench className="text-brand-400" size={22} />}
        title="AI 工具箱"
        description="推理引擎、智能提醒和 Agent 状态管理"
        detail="AI 工具箱集成了推理引擎状态监控、智能提醒管理和 Agent 运行状态。推理引擎负责执行演绎、归纳和溯因推理；智能提醒根据业务规则自动推送待办事项；Agent 负责自动执行业务流程。"
      />

      <div className="flex-1 overflow-auto space-y-4">
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        }>
          <ReasoningEngineStatus />
          <SmartReminderPanel />
          <AgentStatusPanel />
        </Suspense>
      </div>
    </div>
  );
};

export default AIToolbox;
