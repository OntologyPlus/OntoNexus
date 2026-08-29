import React from 'react';
import { OntologyEvent } from '../../types';
import { Clock, AlertTriangle, CheckCircle, Activity, User, FileText } from 'lucide-react';

interface EventTimelineProps {
  events: OntologyEvent[];
  maxDisplay?: number;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  visit: { icon: User, color: 'blue', label: '拜访' },
  compliance: { icon: AlertTriangle, color: 'rose', label: '合规' },
  alert: { icon: AlertTriangle, color: 'amber', label: '告警' },
  action: { icon: Activity, color: 'emerald', label: '动作' },
  note: { icon: FileText, color: 'slate', label: '备注' },
  status_change: { icon: CheckCircle, color: 'purple', label: '状态变更' },
};

const EventTimeline: React.FC<EventTimelineProps> = ({ events, maxDisplay = 10 }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-4">
        <Clock size={24} className="mx-auto text-gray-300 mb-1" />
        <p className="text-xs text-gray-400">暂无事件记录</p>
      </div>
    );
  }

  const displayEvents = events.slice(0, maxDisplay);

  const getEventConfig = (eventType: string) => {
    return EVENT_TYPE_CONFIG[eventType] || { icon: Clock, color: 'gray', label: eventType };
  };

  const colorClasses: Record<string, { dot: string; bg: string; text: string; border: string }> = {
    blue: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    rose: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    amber: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    purple: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    slate: { dot: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    gray: { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 mb-3">事件记录</h4>
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
        <div className="space-y-3">
          {displayEvents.map((event, index) => {
            const config = getEventConfig(event.eventType);
            const colors = colorClasses[config.color] || colorClasses.gray;

            return (
              <div key={event.id || index} className="relative pl-8">
                <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full ${colors.dot} ring-2 ring-white`} />
                <div className={`p-2.5 rounded-lg ${colors.bg} border ${colors.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors.text} ${colors.bg} border ${colors.border}`}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{event.timestamp}</span>
                  </div>
                  <p className="text-xs text-gray-700">{event.description || event.eventType}</p>
                  {event.relatedObjectName && (
                    <p className="text-[10px] text-gray-400 mt-1">关联: {event.relatedObjectName}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {events.length > maxDisplay && (
        <p className="text-xs text-gray-400 mt-2 text-center">还有 {events.length - maxDisplay} 条事件</p>
      )}
    </div>
  );
};

export default EventTimeline;
