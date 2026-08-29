import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Clock, CheckCircle, XCircle, AlertTriangle, 
  TrendingUp, Calendar, Repeat, Plus,
  Pause, AlertCircle, Zap
} from 'lucide-react';
import { 
  SmartReminderSystem, 
  Reminder, 
  ReminderType, 
  RecurrencePattern 
} from '../interaction';
import { useReminders } from '../api/hooks';

interface SmartReminderPanelProps {
  onReminderComplete?: (reminderId: string, outcome: 'success' | 'partial' | 'failed') => void;
  onReminderSnooze?: (reminderId: string, durationMinutes: number) => void;
  onReminderCreate?: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'status'>) => void;
}

const SmartReminderPanel: React.FC<SmartReminderPanelProps> = ({
  onReminderComplete,
  onReminderSnooze,
  onReminderCreate,
}) => {
  const [selectedType, setSelectedType] = useState<ReminderType | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    type: 'routine' as ReminderType,
    priority: 'medium' as 'critical' | 'high' | 'medium' | 'low',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    recurrence: 'none' as RecurrencePattern,
  });

  const reminderSystem = useMemo(() => new SmartReminderSystem(), []);

  const { reminders: apiReminders } = useReminders('default_user');

  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const mapped: Reminder[] = apiReminders.map((r: any) => ({
      id: r.id,
      type: (r.type || 'routine') as ReminderType,
      title: r.title,
      description: r.description || '',
      priority: (r.priority || 'medium') as Reminder['priority'],
      relatedEntity: r.entityId,
      relatedEntityType: undefined,
      dueDate: r.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      recurrence: 'none' as RecurrencePattern,
      status: (r.status === 'active' ? 'pending' : r.status) as Reminder['status'],
      createdAt: new Date().toISOString(),
      metadata: {},
    }));
    setReminders(mapped);
  }, [apiReminders]);

  const filteredReminders = useMemo(() => {
    let filtered = reminders.filter(r => r.status === 'pending');
    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.type === selectedType);
    }
    return filtered.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [reminders, selectedType]);

  const dueReminders = useMemo(() => {
    const now = new Date();
    return reminders.filter(r => 
      r.status === 'pending' && new Date(r.dueDate) <= now
    );
  }, [reminders]);

  const completionStats = useMemo(() => {
    return reminderSystem.getCompletionStats();
  }, [reminderSystem, reminders]);

  const getTypeIcon = (type: ReminderType) => {
    switch (type) {
      case 'urgent': return <Zap className="text-red-500" size={14} />;
      case 'important': return <AlertTriangle className="text-orange-500" size={14} />;
      case 'routine': return <Calendar className="text-blue-500" size={14} />;
      case 'predictive': return <TrendingUp className="text-purple-500" size={14} />;
      case 'opportunity': return <TrendingUp className="text-green-500" size={14} />;
      default: return <Bell className="text-gray-800" size={14} />;
    }
  };

  const getTypeLabel = (type: ReminderType): string => {
    const labels: Record<ReminderType, string> = {
      'urgent': '紧急',
      'important': '重要',
      'routine': '例行',
      'predictive': '预测性',
      'opportunity': '机会',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: ReminderType) => {
    switch (type) {
      case 'urgent': return 'bg-rose-500/8 border-l-rose-500';
      case 'important': return 'bg-orange-500/8 border-l-orange-500';
      case 'routine': return 'bg-brand-500/5 border-l-brand-500';
      case 'predictive': return 'bg-white0/8 border-l-purple-500';
      case 'opportunity': return 'bg-white0/8 border-l-emerald-500';
      default: return 'bg-gray-50 border-l-slate-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-white text-rose-700';
      case 'high': return 'bg-white text-orange-700';
      case 'medium': return 'bg-brand-500/10 text-brand-400';
      default: return 'bg-white/5 text-gray-800';
    }
  };

  const getRecurrenceLabel = (pattern: RecurrencePattern): string => {
    const labels: Record<RecurrencePattern, string> = {
      'none': '单次',
      'daily': '每天',
      'weekly': '每周',
      'biweekly': '每两周',
      'monthly': '每月',
    };
    return labels[pattern] || pattern;
  };

  const formatDueTime = (dueDate: string): string => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - now.getTime();
    
    if (diff < 0) return '已过期';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟后`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时后`;
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天后`;
    return due.toLocaleDateString('zh-CN');
  };

  const handleComplete = (reminderId: string, outcome: 'success' | 'partial' | 'failed') => {
    reminderSystem.trackCompletion(reminderId, outcome);
    setReminders(prev => prev.map(r => 
      r.id === reminderId ? { ...r, status: 'completed' } : r
    ));
    onReminderComplete?.(reminderId, outcome);
  };

  const handleSnooze = (reminderId: string, durationMinutes: number) => {
    reminderSystem.snoozeReminder(reminderId, durationMinutes);
    setReminders(prev => prev.map(r => 
      r.id === reminderId ? { 
        ...r, 
        status: 'snoozed',
        snoozedUntil: new Date(Date.now() + durationMinutes * 60000).toISOString()
      } : r
    ));
    onReminderSnooze?.(reminderId, durationMinutes);
  };

  const handleCreate = () => {
    const reminder: Reminder = {
      id: `reminder_${Date.now()}`,
      ...newReminder,
      dueDate: new Date(newReminder.dueDate).toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      metadata: {},
    };
    
    setReminders(prev => [...prev, reminder]);
    onReminderCreate?.(reminder);
    setShowCreateModal(false);
    setNewReminder({
      title: '',
      description: '',
      type: 'routine',
      priority: 'medium',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      recurrence: 'none',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white0/10 rounded-lg relative">
              <Bell className="text-indigo-400" size={18} />
              {dueReminders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white0 text-white text-[10px] rounded-full flex items-center justify-center">
                  {dueReminders.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-700">智能提醒</h3>
              <p className="text-xs text-gray-800">AI驱动的任务管理</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-brand-400 bg-brand-500/10 rounded-lg hover:bg-brand-500/15 transition-colors"
          >
            <Plus size={12} />
            <span>新建</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['all', 'urgent', 'important', 'routine', 'predictive', 'opportunity'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedType === type
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/5 text-gray-800 hover:bg-white/10'
              }`}
            >
              {type !== 'all' && getTypeIcon(type)}
              <span>{type === 'all' ? '全部' : getTypeLabel(type)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {filteredReminders.map((reminder, index) => (
            <motion.div
              key={reminder.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.03 }}
              className={`p-3 border-l-4 ${getTypeColor(reminder.type)} hover:bg-gray-50`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    {getTypeIcon(reminder.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-0.5">
                      <span className="font-medium text-gray-700 text-sm truncate">
                        {reminder.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityColor(reminder.priority)}`}>
                        {reminder.priority === 'critical' ? '紧急' : 
                         reminder.priority === 'high' ? '高' : 
                         reminder.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-800 line-clamp-1">{reminder.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-xs text-gray-800">
                  <span className="flex items-center space-x-1">
                    <Clock size={10} />
                    <span className={
                      new Date(reminder.dueDate) < new Date() ? 'text-red-500 font-medium' : ''
                    }>
                      {formatDueTime(reminder.dueDate)}
                    </span>
                  </span>
                  {reminder.recurrence !== 'none' && (
                    <span className="flex items-center space-x-1">
                      <Repeat size={10} />
                      <span>{getRecurrenceLabel(reminder.recurrence)}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleSnooze(reminder.id, 60)}
                    className="p-1 text-gray-800 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                    title="延后1小时"
                  >
                    <Pause size={12} />
                  </button>
                  <button
                    onClick={() => handleComplete(reminder.id, 'success')}
                    className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-white0/10 rounded transition-colors"
                    title="完成"
                  >
                    <CheckCircle size={12} />
                  </button>
                  <button
                    onClick={() => handleComplete(reminder.id, 'failed')}
                    className="p-1 text-gray-800 hover:text-rose-700 hover:bg-white rounded transition-colors"
                    title="取消"
                  >
                    <XCircle size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredReminders.length === 0 && (
          <div className="p-8 text-center text-gray-800">
            <CheckCircle size={32} className="mx-auto mb-2 text-green-300" />
            <p className="text-sm">暂无待办提醒</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 text-gray-800">
            <span>已完成: {completionStats.completed}</span>
            <span>成功率: {(completionStats.successRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center space-x-1 text-gray-800">
            <AlertCircle size={10} />
            <span>{dueReminders.length} 项已到期</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-50/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700">新建提醒</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-gray-50 rounded transition-colors"
                >
                  <XCircle size={18} className="text-gray-800" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">标题</label>
                  <input
                    type="text"
                    value={newReminder.title}
                    onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder="提醒标题"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">描述</label>
                  <textarea
                    value={newReminder.description}
                    onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                    rows={2}
                    placeholder="提醒描述"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">类型</label>
                    <select
                      value={newReminder.type}
                      onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value as ReminderType })}
                      className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="routine">例行</option>
                      <option value="important">重要</option>
                      <option value="urgent">紧急</option>
                      <option value="predictive">预测性</option>
                      <option value="opportunity">机会</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">优先级</label>
                    <select
                      value={newReminder.priority}
                      onChange={(e) => setNewReminder({ ...newReminder, priority: e.target.value as 'critical' | 'high' | 'medium' | 'low' })}
                      className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">截止日期</label>
                    <input
                      type="date"
                      value={newReminder.dueDate}
                      onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">重复</label>
                    <select
                      value={newReminder.recurrence}
                      onChange={(e) => setNewReminder({ ...newReminder, recurrence: e.target.value as RecurrencePattern })}
                      className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="none">单次</option>
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                      <option value="biweekly">每两周</option>
                      <option value="monthly">每月</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm text-gray-800 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newReminder.title}
                    className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    创建
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartReminderPanel;
