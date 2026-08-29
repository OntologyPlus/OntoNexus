import React from 'react';
import { AlertTriangle, Clock, UserPlus, Heart, AlertOctagon, UserX } from 'lucide-react';

interface LifecycleProgressProps {
  currentStage?: string;
  objectType?: string;
}

const STAGE_CONFIG = [
  { value: 'prospect', label: '潜在客户', icon: UserPlus, color: 'slate' },
  { value: 'developing', label: '开发中', icon: Clock, color: 'blue' },
  { value: 'mature', label: '成熟', icon: Heart, color: 'emerald' },
  { value: 'at_risk', label: '风险', icon: AlertTriangle, color: 'amber' },
  { value: 'churned', label: '流失', icon: UserX, color: 'rose' },
];

const LifecycleProgress: React.FC<LifecycleProgressProps> = ({ currentStage }) => {
  if (!currentStage) return null;

  const currentIndex = STAGE_CONFIG.findIndex(s => s.value === currentStage);
  if (currentIndex === -1) return null;

  const isRisk = currentStage === 'at_risk' || currentStage === 'churned';

  return (
    <div className={`rounded-xl p-4 ${isRisk ? 'bg-rose-50 border border-rose-200' : 'bg-gray-50 border border-gray-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-600">生命周期</span>
        {isRisk && (
          <span className="flex items-center gap-1 text-xs text-rose-600 font-medium">
            <AlertOctagon size={12} />
            需要关注
          </span>
        )}
      </div>
      <div className="flex items-center">
        {STAGE_CONFIG.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = stage.icon;

          return (
            <React.Fragment key={stage.value}>
              <div className="flex flex-col items-center" style={{ minWidth: 48 }}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isCurrent
                    ? isRisk ? 'bg-rose-500 text-white ring-2 ring-rose-200' : 'bg-blue-500 text-white ring-2 ring-blue-200'
                    : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  <Icon size={14} />
                </div>
                <span className={`text-[10px] mt-1 text-center leading-tight ${
                  isCurrent ? 'font-bold text-gray-800' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {stage.label}
                </span>
              </div>
              {index < STAGE_CONFIG.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${
                  index < currentIndex ? 'bg-emerald-400' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default LifecycleProgress;
