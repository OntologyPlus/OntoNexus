import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Brain, Activity, Database, TrendingUp, 
  Pause, Play, RefreshCw, ChevronUp, ChevronDown,
  Cpu, Zap, Target, Clock, BookOpen, Lightbulb, Star, History
} from 'lucide-react';
import { 
  CognitiveAgent,
  AgentState,
  MemoryType
} from '../agent';
import { useAgentStatus } from '../api/hooks';

interface RecentKnowledge {
  id: string;
  title: string;
  type: 'pattern' | 'insight' | 'rule';
  importance: number;
  learnedAt: string;
}

interface LearningActivity {
  id: string;
  description: string;
  type: 'experience' | 'knowledge' | 'optimization';
  timestamp: string;
}

interface AgentStatusPanelProps {
  agent?: CognitiveAgent;
  onAgentStart?: () => void;
  onAgentPause?: () => void;
  onAgentReset?: () => void;
}

const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({
  agent,
  onAgentStart,
  onAgentPause,
  onAgentReset,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const { agents } = useAgentStatus();

  const agentStateFromApi: AgentState = useMemo(() => {
    const agentData = agents[0];
    return {
      id: agentData?.id || 'agent_001',
      name: agentData?.agentName || 'OntoNexus Agent',
      status: agentData?.status || 'idle',
      lastActivity: agentData?.lastRun || new Date().toISOString(),
    };
  }, [agents]);

  useEffect(() => {
    if (agent) {
      setAgentState(agent.getState());
    } else {
      setAgentState(agentStateFromApi);
    }
  }, [agent, agentStateFromApi]);

  const memoryStats = useMemo(() => {
    const agentData = agents[0];
    const ms = agentData?.memoryStats;
    return {
      total: ms?.total || 0,
      byType: {
        [MemoryType.SHORT_TERM]: 5,
        [MemoryType.LONG_TERM]: ms?.semantic || 0,
        [MemoryType.WORKING]: 3,
        [MemoryType.EPISODIC]: ms?.episodic || 0,
        [MemoryType.SEMANTIC]: ms?.semantic || 0,
      },
      averageImportance: 0.72,
    };
  }, [agents]);

  const learningStats = useMemo(() => {
    const agentData = agents[0];
    const ls = agentData?.learningStats;
    return {
      totalExperiences: ls?.totalExperiences || 0,
      knowledgeItems: ls?.knowledgeItems || 0,
      successRate: ls?.successRate || 0,
      lastLearning: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    };
  }, [agents]);

  const recentKnowledge: RecentKnowledge[] = useMemo(() => {
    return [
      { id: 'k1', title: '医生偏好模式：张医生更倾向于学术推广', type: 'pattern', importance: 0.92, learnedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
      { id: 'k2', title: 'Q1 季度华东区销售增长率下降 15%', type: 'insight', importance: 0.85, learnedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
      { id: 'k3', title: '合规规则更新：会议场地费用不得超过 ¥2000', type: 'rule', importance: 0.98, learnedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
      { id: 'k4', title: '产品关联：A 产品与 B 产品常被联合推荐', type: 'pattern', importance: 0.78, learnedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'k5', title: '季节性洞察：冬季感冒药需求增加 30%', type: 'insight', importance: 0.82, learnedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    ];
  }, []);

  const learningTimeline: LearningActivity[] = useMemo(() => {
    return [
      { id: 'l1', description: '从 23 次成功决策中提炼出新的执行模式', type: 'experience', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { id: 'l2', description: '更新合规知识库，新增 3 条费用管控规则', type: 'knowledge', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
      { id: 'l3', description: '优化推理引擎权重，准确率提升 8%', type: 'optimization', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'l4', description: '学习到 5 个新的医生行为特征', type: 'knowledge', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'l5', description: '从失败案例中识别出 2 个风险预警信号', type: 'experience', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { id: 'l6', description: '调整决策策略，资源分配效率提升 12%', type: 'optimization', timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() },
    ];
  }, []);

  const getKnowledgeTypeLabel = (type: RecentKnowledge['type']): string => {
    const labels = { pattern: '模式', insight: '洞察', rule: '规则' };
    return labels[type];
  };

  const getKnowledgeTypeColor = (type: RecentKnowledge['type']): string => {
    const colors = {
      pattern: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
      insight: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      rule: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    };
    return colors[type];
  };

  const getLearningActivityIcon = (type: LearningActivity['type']) => {
    switch (type) {
      case 'experience': return <Star size={12} className="text-amber-700" />;
      case 'knowledge': return <BookOpen size={12} className="text-brand-500" />;
      case 'optimization': return <Lightbulb size={12} className="text-green-600" />;
    }
  };

  const getLearningActivityLabel = (type: LearningActivity['type']): string => {
    const labels = { experience: '经验', knowledge: '知识', optimization: '优化' };
    return labels[type];
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  const getStatusColor = (status: AgentState['status']) => {
    switch (status) {
      case 'idle': return 'bg-white/5 text-gray-800';
      case 'perceiving': return 'bg-brand-500/10 text-brand-400';
      case 'reasoning': return 'bg-white0/10 text-purple-400';
      case 'planning': return 'bg-white text-orange-700';
      case 'executing': return 'bg-white0/10 text-emerald-400';
      case 'learning': return 'bg-white0/10 text-teal-400';
      default: return 'bg-white/5 text-gray-800';
    }
  };

  const getStatusIcon = (status: AgentState['status']) => {
    switch (status) {
      case 'idle': return <Pause size={12} />;
      case 'perceiving': return <Activity size={12} />;
      case 'reasoning': return <Brain size={12} />;
      case 'planning': return <Target size={12} />;
      case 'executing': return <Zap size={12} />;
      case 'learning': return <TrendingUp size={12} />;
      default: return <Activity size={12} />;
    }
  };

  const getStatusLabel = (status: AgentState['status']): string => {
    const labels: Record<AgentState['status'], string> = {
      'idle': '空闲',
      'perceiving': '感知中',
      'reasoning': '推理中',
      'planning': '规划中',
      'executing': '执行中',
      'learning': '学习中',
    };
    return labels[status] || status;
  };

  const getMemoryTypeLabel = (type: MemoryType): string => {
    const labels: Record<MemoryType, string> = {
      [MemoryType.SHORT_TERM]: '短期记忆',
      [MemoryType.LONG_TERM]: '长期记忆',
      [MemoryType.WORKING]: '工作记忆',
      [MemoryType.EPISODIC]: '情景记忆',
      [MemoryType.SEMANTIC]: '语义记忆',
    };
    return labels[type] || type;
  };

  const getMemoryTypeColor = (type: MemoryType) => {
    switch (type) {
      case MemoryType.SHORT_TERM: return 'bg-white0';
      case MemoryType.LONG_TERM: return 'bg-green-500';
      case MemoryType.WORKING: return 'bg-orange-500';
      case MemoryType.EPISODIC: return 'bg-white0';
      case MemoryType.SEMANTIC: return 'bg-white0';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-brand-500/20">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="p-2.5 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-xl shadow-sm shadow-brand-500/30">
                <Bot className="text-white" size={20} />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                agentState?.status === 'idle' ? 'bg-slate-400' :
                agentState?.status === 'executing' ? 'bg-white0 animate-pulse' :
                'bg-brand-500 animate-pulse'
              }`} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-900">{agentState?.name || 'AI Agent'}</span>
                <span className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(agentState?.status || 'idle')}`}>
                  {getStatusIcon(agentState?.status || 'idle')}
                  <span>{getStatusLabel(agentState?.status || 'idle')}</span>
                </span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-800 mt-1">
                <span className="flex items-center space-x-1">
                  <Database size={12} />
                  <span>{memoryStats.total} 记忆</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Brain size={12} />
                  <span>{learningStats.knowledgeItems} 知识</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAgentStart?.();
              }}
              className="p-2 text-emerald-400 hover:bg-white0/10 rounded-xl transition-colors"
              title="启动"
            >
              <Play size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAgentPause?.();
              }}
              className="p-2 text-amber-700 hover:bg-white0/10 rounded-xl transition-colors"
              title="暂停"
            >
              <Pause size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAgentReset?.();
              }}
              className="p-2 text-gray-800 hover:bg-gray-50 rounded-xl transition-colors"
              title="重置"
            >
              <RefreshCw size={18} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <div className="p-1 text-gray-800">
            {expanded ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronUp size={20} />
            )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-gray-100 space-y-6 bg-gray-50/50">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-1.5 tracking-wider">
                    <Database size={16} className="text-brand-500" />
                    记忆系统
                  </h4>
                  <span className="text-xs font-medium text-gray-800 bg-white px-2 py-1 rounded-md border border-gray-100">
                    平均重要性 {(memoryStats.averageImportance * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(memoryStats.byType).map(([type, count]) => (
                    <div key={type} className="text-center group">
                      <div className="relative h-16 bg-white rounded-xl overflow-hidden mb-2 border border-gray-100 shadow-sm group-hover:border-brand-500/20 transition-colors">
                        <div 
                          className={`absolute bottom-0 left-0 right-0 ${getMemoryTypeColor(type as MemoryType)} opacity-80 transition-all duration-500`}
                          style={{ height: `${(count / memoryStats.total) * 100}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-600">{count}</span>
                        </div>
                      </div>
                      <div className="text-[10px] font-medium text-gray-800 truncate">
                        {getMemoryTypeLabel(type as MemoryType).replace('记忆', '')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-1.5 tracking-wider">
                    <TrendingUp size={16} className="text-brand-500" />
                    学习进度
                  </h4>
                  <span className="text-xs font-medium text-emerald-400 bg-white0/10 px-2 py-1 rounded-md border border-emerald-500/20">
                    成功率 {(learningStats.successRate * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white border border-gray-100 rounded-xl text-center shadow-sm">
                    <div className="text-xl font-bold text-gray-700">{learningStats.totalExperiences}</div>
                    <div className="text-xs font-medium text-gray-800 mt-1">经验总数</div>
                  </div>
                  <div className="p-3 bg-white border border-gray-100 rounded-xl text-center shadow-sm">
                    <div className="text-xl font-bold text-gray-700">{learningStats.knowledgeItems}</div>
                    <div className="text-xs font-medium text-gray-800 mt-1">知识条目</div>
                  </div>
                  <div className="p-3 bg-white0/10 border border-emerald-500/20 rounded-xl text-center shadow-sm">
                    <div className="text-xl font-bold text-emerald-400">
                      {(learningStats.successRate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs font-medium text-emerald-400/70 mt-1">成功率</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-medium text-gray-800 bg-white px-3 py-2 rounded-lg border border-gray-100 shadow-sm">
                  <span className="flex items-center space-x-1.5">
                    <Clock size={14} className="text-brand-400" />
                    <span>上次学习: {new Date(learningStats.lastLearning).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-1.5 tracking-wider">
                    <Cpu size={16} className="text-brand-500" />
                    认知能力
                  </h4>
                </div>

                <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium">感知能力</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white0 rounded-full" style={{ width: '85%' }} />
                      </div>
                      <span className="text-gray-700 font-bold w-9 text-right">85%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium">推理能力</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white0 rounded-full" style={{ width: '78%' }} />
                      </div>
                      <span className="text-gray-700 font-bold w-9 text-right">78%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium">规划能力</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: '72%' }} />
                      </div>
                      <span className="text-gray-700 font-bold w-9 text-right">72%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium">学习能力</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white0 rounded-full" style={{ width: '68%' }} />
                      </div>
                      <span className="text-gray-700 font-bold w-9 text-right">68%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-1.5 tracking-wider">
                    <BookOpen size={16} className="text-brand-500" />
                    记忆摘要
                  </h4>
                  <span className="text-xs font-medium text-gray-800 bg-white px-2 py-1 rounded-md border border-gray-100">
                    最近 {recentKnowledge.length} 条
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentKnowledge.map((knowledge) => (
                    <motion.div
                      key={knowledge.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-brand-500/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-gray-700 font-medium">{knowledge.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-xs border ${getKnowledgeTypeColor(knowledge.type)}`}>
                              {getKnowledgeTypeLabel(knowledge.type)}
                            </span>
                            <span className="text-xs text-gray-800">
                              重要性 {(knowledge.importance * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-800 whitespace-nowrap">
                          {formatTimeAgo(knowledge.learnedAt)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-1.5 tracking-wider">
                    <History size={16} className="text-brand-500" />
                    学习轨迹
                  </h4>
                  <span className="text-xs font-medium text-gray-800 bg-white px-2 py-1 rounded-md border border-gray-100">
                    近 7 天
                  </span>
                </div>

                <div className="relative pl-4 border-l-2 border-gray-100 space-y-3 max-h-56 overflow-y-auto">
                  {learningTimeline.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative"
                    >
                      <div className="absolute -left-6 top-1">
                        <div className="w-8 h-8 bg-white rounded-full border-2 border-gray-100 flex items-center justify-center shadow-sm">
                          {getLearningActivityIcon(activity.type)}
                        </div>
                      </div>
                      <div className="pl-4 pb-2">
                        <p className="text-sm text-gray-700">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-800">
                            {formatTimeAgo(activity.timestamp)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-50 text-gray-600 border border-gray-100">
                            {getLearningActivityLabel(activity.type)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentStatusPanel;
