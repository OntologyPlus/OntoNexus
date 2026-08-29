
import React, { useState } from 'react';
import { useOntologyContext } from '../contexts/OntologyContext';
import { Clock, User, TrendingUp, TrendingDown, Calendar, AlertTriangle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineEvent {
  id: string;
  type: 'visit' | 'prescription' | 'risk' | 'academic' | 'action';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const DoctorTimeline: React.FC<{ doctorId?: string }> = ({ doctorId }) => {
  const { getObjectById } = useOntologyContext();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(doctorId || null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const doctors = [
    { id: 'd1', name: '张主任' },
    { id: 'd2', name: '李教授' },
    { id: 'd3', name: '王主治' },
  ];

  const selectedDoctor = selectedDoctorId ? getObjectById(selectedDoctorId) : null;

  const timelineEvents: TimelineEvent[] = selectedDoctor ? [
    {
      id: 'evt1',
      type: 'visit',
      title: '完成学术拜访',
      description: '与张主任深入沟通了近期处方量下降的原因，主要是因为竞品在科室举办了学术活动。',
      timestamp: '2026-03-18 15:00',
      metadata: {
        visitType: '学术拜访',
        complianceScore: 95,
        effectivenessScore: 88,
        nextSteps: ['准备竞品对比资料', '安排科室会'],
      },
    },
    {
      id: 'evt2',
      type: 'prescription',
      title: '处方量下降',
      description: '诺欣妥处方量从120下降至72，降幅40%',
      timestamp: '2026-03-01 08:00',
      metadata: {
        product: '诺欣妥',
        before: 120,
        after: 72,
        change: '-40%',
      },
    },
    {
      id: 'evt3',
      type: 'risk',
      title: '标记为流失风险',
      description: '系统自动标记为流失风险客户，原因：处方量持续下降+竞品活动',
      timestamp: '2026-03-18 08:00',
      metadata: {
        riskLevel: 'high',
        reason: '处方量下降40%，竞品渗透',
        assignedAgent: 'AtRiskAgent',
      },
    },
    {
      id: 'evt4',
      type: 'academic',
      title: '发表学术论文',
      description: '李教授发表了关于帕金森治疗的最新研究论文',
      timestamp: '2026-03-08 00:00',
      metadata: {
        journal: '中华神经科杂志',
        topic: '帕金森治疗进展',
      },
    },
    {
      id: 'evt5',
      type: 'action',
      title: '恢复计划已生成',
      description: '为张主任生成了流失挽回计划，包含3个待执行动作',
      timestamp: '2026-03-18 08:05',
      metadata: {
        planId: 'rp1',
        actions: ['安排拜访', '准备学术资料', '邀请参加学术活动'],
      },
    },
    {
      id: 'evt6',
      type: 'visit',
      title: '上一次拜访',
      description: '拜访顺利完成，医生态度有所改善',
      timestamp: '2026-02-01 14:00',
      metadata: {
        visitType: '例行拜访',
        duration: '30分钟',
      },
    },
  ] : [];

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'visit': return <Calendar className="text-blue-500" size={16} />;
      case 'prescription': return <TrendingDown className="text-red-500" size={16} />;
      case 'risk': return <AlertTriangle className="text-orange-500" size={16} />;
      case 'academic': return <FileText className="text-purple-500" size={16} />;
      case 'action': return <Clock className="text-teal-500" size={16} />;
      default: return <Clock className="text-gray-800" size={16} />;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'visit': return 'border-l-blue-500';
      case 'prescription': return 'border-l-red-500';
      case 'risk': return 'border-l-orange-500';
      case 'academic': return 'border-l-purple-500';
      case 'action': return 'border-l-teal-500';
      default: return 'border-l-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-700 flex items-center">
          <Clock className="mr-2 text-brand-600" size={20} />
          客户时间轴
        </h2>
        <p className="text-gray-800 text-sm mt-1">查看医生的完整交互历史和预测性分析</p>
      </div>

      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <select
          value={selectedDoctorId || ''}
          onChange={(e) => setSelectedDoctorId(e.target.value || null)}
          className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
        >
          <option value="">选择医生...</option>
          {doctors.map(doc => (
            <option key={doc.id} value={doc.id}>{doc.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedDoctor ? (
          <div className="space-y-0">
            <div className="relative pl-6 border-l-2 border-gray-100">
              {timelineEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative mb-4 border-l-4 ${getEventColor(event.type)} pl-4`}
                >
                  <div className="absolute -left-[17px] top-0 w-3 h-3 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      event.type === 'visit' ? 'bg-white0' :
                      event.type === 'prescription' ? 'bg-white0' :
                      event.type === 'risk' ? 'bg-orange-500' :
                      event.type === 'academic' ? 'bg-white0' :
                      'bg-white0'
                    }`}></div>
                  </div>

                  <div
                    className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors border border-gray-100"
                    onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        {getEventIcon(event.type)}
                        <span className="text-xs text-gray-800">{event.timestamp}</span>
                      </div>
                      {expandedEvent === event.id ? (
                        <ChevronDown size={14} className="text-gray-800" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-800" />
                      )}
                    </div>
                    <h4 className="font-medium text-gray-700 mt-1">{event.title}</h4>
                    <p className="text-xs text-gray-800 mt-1 line-clamp-2">{event.description}</p>
                  </div>

                  <AnimatePresence>
                    {expandedEvent === event.id && event.metadata && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 p-3 bg-white rounded-lg border border-gray-100 shadow-sm"
                      >
                        <div className="text-xs text-gray-800 uppercase font-bold mb-2">详细信息</div>
                        <div className="space-y-2">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-gray-800 capitalize">{key}</span>
                              <span className="text-gray-700 font-medium">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 glass-card border-l-4 border-brand-500 rounded-xl hover:shadow-glow transition-all">
              <h4 className="font-bold text-gray-700 mb-2 flex items-center">
                <TrendingUp className="mr-2 text-brand-600" size={16} />
                下一个最佳行动
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">安排拜访</span>
                  <span className="text-xs px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded">优先级：高</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">准备竞品对比资料</span>
                  <span className="text-xs px-2 py-0.5 bg-white0/10 text-amber-700 rounded">优先级：中</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-800">
            <User size={48} className="mb-2 text-gray-800" />
            <p className="text-sm">请选择一位医生查看其时间轴</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorTimeline;
