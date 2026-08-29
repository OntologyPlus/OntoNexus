import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Network, MessageSquare, Sparkles, ArrowRight, X, CheckCircle } from 'lucide-react';
import { COPY } from '../copy';

interface OnboardingGuideProps {
  onComplete: () => void;
  onNavigate: (tab: string) => void;
}

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onComplete, onNavigate }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: '先看这一案',
      subtitle: COPY.brief.kicker,
      content: (
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-brand-500/20">
            <LayoutDashboard className="text-brand-600" size={36} />
          </div>
          <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
            「今日战情」是一张签批单：不批会怎样、批准会怎样。区域经理当场签字，提交人不能自己批。
          </p>
          <button
            onClick={() => onNavigate('brief')}
            className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            去今日战情
            <ArrowRight size={14} />
          </button>
        </div>
      ),
    },
    {
      title: '问一句或看关系图',
      subtitle: '弄清为什么差，人怎么连在一起',
      content: (
        <div className="space-y-4 py-4">
          <button
            onClick={() => onNavigate('chat')}
            className="w-full flex items-start gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100 text-left hover:border-purple-300"
          >
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="text-white" size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">{COPY.nav.ask}</h4>
              <p className="text-xs text-gray-600 mt-1">先问为什么这块差，再试一种假设，再要可执行建议。</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate('ontology')}
            className="w-full flex items-start gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-left hover:border-emerald-300"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Network className="text-white" size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">{COPY.nav.graph}</h4>
              <p className="text-xs text-gray-600 mt-1">医生、医院、产品怎么连在一起，点开看中文类型。</p>
            </div>
          </button>
        </div>
      ),
    },
    {
      title: '看系统拦了什么、改了什么',
      subtitle: COPY.nav.groups.loop,
      content: (
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
            <CheckCircle className="text-white" size={36} />
          </div>
          <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
            签批在「今日战情」。系统核对关系、拦住自批、写入拜访，分别在「闭环」三页里，不是一句空话。
          </p>
          <button
            onClick={() => onNavigate('guard')}
            className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            去拦住了什么
            <ArrowRight size={14} />
          </button>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Sparkles size={14} />
            {COPY.product}
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
      >
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-8 bg-blue-500' : i < step ? 'w-4 bg-blue-300' : 'w-4 bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onComplete}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 pt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-gray-900">{currentStep.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{currentStep.subtitle}</p>
              {currentStep.content}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-6 pt-2 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              上一步
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              跳过
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              下一步
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-6 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              开始使用
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingGuide;
