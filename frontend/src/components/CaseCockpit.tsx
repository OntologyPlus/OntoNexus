import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, ChevronRight, ClipboardList, Gauge, Lightbulb, PlayCircle } from 'lucide-react';
import PageHeader from './PageHeader';
import apiClient from '../api/client';

const statusText: Record<string, string> = {
  open: '进行中', closed: '已结案', pending: '待审批', approved: '已批准',
  executed: '已执行', rejected: '已退回', failed: '执行失败', observing: '观察中', met: '已达标',
};

function label(value?: string) {
  return statusText[value || ''] || value || '—';
}

function format(value?: string) {
  if (!value) return '刚刚';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CaseCockpit: React.FC = () => {
  const cases = useQuery({ queryKey: ['decision-cases'], queryFn: () => apiClient.getDecisionCases() });
  const [caseId, setCaseId] = useState('');
  // Case IDs are namespaced by the API. Ignore stale/cross-page query-cache data
  // rather than issuing a timeline request for an event or decision ID.
  const validCases = (cases.data || []).filter((item: any) => typeof item?.id === 'string' && item.id.startsWith('case_'));

  useEffect(() => {
    if (!validCases.length) return;
    if (!validCases.some((item: any) => item.id === caseId)) setCaseId(validCases[0].id);
  }, [caseId, validCases]);

  const timeline = useQuery({
    queryKey: ['case-timeline', caseId],
    queryFn: () => apiClient.getCaseTimeline(caseId),
    enabled: caseId.startsWith('case_'),
  });
  const data = timeline.data;
  const current = data?.case;
  const effect = data?.effects?.[0];
  const progress = effect?.target && effect?.actual != null ? Math.min(100, Math.round((effect.actual / effect.target) * 100)) : 0;

  return (
    <div className="h-full flex flex-col max-w-[1180px] mx-auto w-full px-4">
      <PageHeader icon={<ClipboardList className="text-brand-400" size={22} />} title="案件驾驶舱" description="从风险发现到业务效果，一屏掌握决策闭环。" />
      {cases.isLoading ? <div className="text-sm text-gray-500">正在加载案件…</div> : null}
      {cases.isError ? <div className="text-sm text-rose-600">案件加载失败，请稍后重试。</div> : null}
      {!cases.isLoading && !validCases.length ? <div className="bg-white rounded-2xl p-6 text-sm text-gray-500">暂无案件。创建案件后，系统会在这里汇总决策、动作和效果。</div> : null}
      {validCases.length ? <div className="flex flex-col lg:flex-row gap-4 min-h-0 pb-8">
        <aside className="lg:w-72 shrink-0 bg-white rounded-2xl shadow-sm p-3 space-y-2 overflow-y-auto max-h-[220px] lg:max-h-none">
          <div className="text-xs font-semibold text-gray-500 px-2 py-1">业务案件</div>
          {validCases.map((item: any) => <button key={item.id} type="button" onClick={() => setCaseId(item.id)} className={`w-full text-left rounded-xl p-3 transition-colors ${caseId === item.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50 border border-transparent'}`}>
            <div className="flex justify-between gap-2"><span className="font-medium text-sm text-gray-900">{item.title}</span><ChevronRight size={16} className="text-gray-400 shrink-0" /></div>
            <div className="mt-2 flex gap-2 text-[11px]"><span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{label(item.status)}</span><span className="text-gray-500">{item.priority === 'high' ? '高优先级' : '常规'}</span></div>
          </button>)}
        </aside>
        <section className="flex-1 min-w-0 overflow-y-auto space-y-4">
          {timeline.isLoading ? <div className="text-sm text-gray-500">正在组装业务链路…</div> : null}
          {current ? <>
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs text-slate-300">当前经营议题</div><h2 className="text-2xl font-semibold mt-1">{current.title}</h2><p className="text-sm text-slate-300 mt-2 max-w-2xl">{current.description}</p></div><span className="px-3 py-1 rounded-full text-xs bg-amber-400/20 text-amber-200 border border-amber-300/30">{label(current.status)} · {current.priority === 'high' ? '高优先级' : '常规'}</span></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6"><Kpi label="决策依据" value={`${data.decisions?.length || 0} 条`} /><Kpi label="动作进度" value={`${data.actions?.length || 0} 项`} /><Kpi label="执行记录" value={`${data.executions?.length || 0} 次`} /><Kpi label="效果状态" value={label(effect?.status)} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel title="为什么现在要处理" icon={<Lightbulb size={16} className="text-amber-600" />}>
                {(data.decisions || []).map((item: any) => <div key={item.id} className="text-sm text-gray-700"><div className="font-medium">{item.scenario}</div><div className="text-xs text-gray-500 mt-2">置信度 {Math.round((item.confidence || 0) * 100)}% · {format(item.createdAt)}</div></div>)}
                {!data.decisions?.length ? <span className="text-sm text-gray-400">尚未沉淀决策依据</span> : null}
              </Panel>
              <Panel title="采取了什么行动" icon={<PlayCircle size={16} className="text-brand-600" />}>
                <div className="space-y-3">{(data.actions || []).map((item: any) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-gray-700">{item.action_type || item.id}</span><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{label(item.status)}</span></div>)}{!data.actions?.length ? <span className="text-sm text-gray-400">暂无关联动作</span> : null}</div>
              </Panel>
            </div>
            <Panel title="效果观察" icon={<Gauge size={16} className="text-emerald-600" />}>
              {effect ? <div><div className="flex items-end justify-between gap-4"><div><div className="text-sm font-medium text-gray-800">{effect.metric}</div><div className="text-xs text-gray-500 mt-1">基线 {effect.baseline ?? '—'} · 目标 {effect.target ?? '—'}{effect.unit || ''}</div></div><div className="text-right"><div className="text-2xl font-semibold text-emerald-700">{effect.actual ?? '—'}{effect.unit || ''}</div><div className="text-xs text-gray-500">当前达成 {progress}%</div></div></div><div className="h-2 rounded-full bg-slate-100 mt-4 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} /></div><p className="text-xs text-gray-500 mt-3">{effect.status === 'observing' ? '正在观察动作后的业务变化，达到目标后将自动形成可复用经验。' : `效果${label(effect.status)}。`}</p></div> : <span className="text-sm text-gray-400">尚未设置效果观察指标</span>}
            </Panel>
            <Panel title="闭环时间线" icon={<Activity size={16} className="text-violet-600" />}>
              <div className="space-y-3">{[...(data.decisions || []).map((item: any) => ({ type: '决策', text: item.scenario, at: item.createdAt })), ...(data.actions || []).map((item: any) => ({ type: '动作', text: `${item.action_type || '业务动作'} · ${label(item.status)}`, at: undefined })), ...(data.effects || []).map((item: any) => ({ type: '效果', text: `${item.metric} · ${label(item.status)}`, at: item.observed_at }))].map((item: any, index: number) => <div key={`${item.type}-${index}`} className="flex gap-3"><CheckCircle2 size={16} className="text-brand-500 shrink-0 mt-0.5" /><div><div className="text-xs text-brand-700 font-medium">{item.type}</div><div className="text-sm text-gray-700">{item.text}</div><div className="text-[11px] text-gray-400 mt-1">{format(item.at)}</div></div></div>)}</div>
            </Panel>
          </> : null}
        </section>
      </div> : null}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl bg-white/10 border border-white/10 p-3"><div className="text-[11px] text-slate-300">{label}</div><div className="text-lg font-semibold mt-1">{value}</div></div>;
const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => <div className="bg-white rounded-2xl shadow-sm p-5"><div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">{icon}{title}</div>{children}</div>;

export default CaseCockpit;
