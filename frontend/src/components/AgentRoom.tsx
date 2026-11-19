import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Eye, Brain, ListChecks, Zap, RefreshCw, Play, Square, ShieldAlert, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import PageHeader from './PageHeader';
import MarkdownRenderer from './MarkdownRenderer';
import { Preset, WarRoomEvent, warRoomApi } from '../api/warRoom';

type StageId = 'perceive' | 'reason' | 'plan' | 'act' | 'reflect';
type StageState = 'idle' | 'running' | 'done';

const STAGES: { id: StageId; label: string; icon: React.ReactNode }[] = [
  { id: 'perceive', label: '感知', icon: <Eye size={16} /> },
  { id: 'reason', label: '推理', icon: <Brain size={16} /> },
  { id: 'plan', label: '规划', icon: <ListChecks size={16} /> },
  { id: 'act', label: '执行', icon: <Zap size={16} /> },
  { id: 'reflect', label: '反思', icon: <RefreshCw size={16} /> },
];

const EMPTY_STAGES: Record<StageId, StageState> = { perceive: 'idle', reason: 'idle', plan: 'idle', act: 'idle', reflect: 'idle' };

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  executed: { label: '已自动执行', cls: 'bg-health-50 text-health-700 ring-health-200', icon: <CheckCircle2 size={14} /> },
  pending: { label: '待审批', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: <Clock size={14} /> },
  blocked: { label: '被网关拦截', cls: 'bg-red-50 text-red-700 ring-red-200', icon: <ShieldAlert size={14} /> },
  failed: { label: '失败', cls: 'bg-gray-100 text-gray-600 ring-gray-200', icon: <XCircle size={14} /> },
};

interface RunState {
  running: boolean;
  stages: Record<StageId, StageState>;
  ms: Partial<Record<StageId, number>>;
  findings: any[];
  hiddenIds: string[];
  context: any | null;
  reasoning: string;
  reasonDone: any | null;
  steps: any[];
  results: Record<number, any>;
  reflect: string;
  done: any | null;
  error: string | null;
  mode: string;
}

const initialRun = (): RunState => ({
  running: false, stages: { ...EMPTY_STAGES }, ms: {}, findings: [], hiddenIds: [], context: null,
  reasoning: '', reasonDone: null, steps: [], results: {}, reflect: '', done: null, error: null, mode: '',
});

const Spark: React.FC<{ values: number[] }> = ({ values }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 80},${22 - ((v - min) / span) * 20}`).join(' ');
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" className="text-red-500">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const AgentRoom: React.FC<{ onTabChange?: (tab: string) => void }> = ({ onTabChange }) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [query, setQuery] = useState('');
  const [run, setRun] = useState<RunState>(initialRun);
  const [llm, setLlm] = useState<any | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    warRoomApi.presets().then(setPresets).catch(() => setPresets([]));
    warRoomApi.llmStatus().then(setLlm).catch(() => setLlm(null));
    return () => abortRef.current?.abort();
  }, []);

  const apply = useCallback((ev: WarRoomEvent) => {
    setRun((prev) => {
      const next: RunState = { ...prev };
      switch (ev.type) {
        case 'start':
          next.mode = ev.mode || '';
          break;
        case 'stage': {
          const id = ev.stage as StageId;
          if (id in next.stages) {
            next.stages = { ...next.stages, [id]: ev.status === 'start' ? 'running' : 'done' };
            if (ev.ms != null) next.ms = { ...next.ms, [id]: ev.ms };
          }
          break;
        }
        case 'perceive.finding':
          next.findings = [...next.findings, ev.finding];
          break;
        case 'perceive.done':
          next.hiddenIds = ev.hidden_ids || [];
          break;
        case 'context':
          next.context = ev;
          break;
        case 'reason.token':
          next.reasoning += ev.text || '';
          break;
        case 'reason.done':
          next.reasonDone = ev;
          if (ev.text) next.reasoning = ev.text;
          break;
        case 'plan.step':
          next.steps = [...next.steps, { ...ev.step, index: ev.index }];
          break;
        case 'act.result':
          next.results = { ...next.results, [ev.index]: ev };
          break;
        case 'reflect.done':
          next.reflect = ev.text || '';
          break;
        case 'error':
          next.error = ev.message || '运行出错';
          break;
        case 'done':
          next.done = ev;
          next.running = false;
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  const start = useCallback(async (q: string, replay?: string) => {
    const text = q.trim();
    if (!text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setQuery(text);
    setRun({ ...initialRun(), running: true });
    try {
      await warRoomApi.run(text, apply, { replay, signal: ctrl.signal });
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setRun((p) => ({ ...p, running: false, error: e?.message || '连接中断' }));
      }
    } finally {
      setRun((p) => ({ ...p, running: false }));
    }
  }, [apply]);

  const stop = () => {
    abortRef.current?.abort();
    setRun((p) => ({ ...p, running: false }));
  };

  const started = run.running || run.findings.length > 0 || run.done != null || run.error != null;
  const summary = run.done?.summary || {};
  const online = llm?.state === 'online';

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      <PageHeader
        icon={<Bot size={22} className="text-brand-600" />}
        title="AI 作战室"
        description="感知 → 推理 → 规划 → 执行 → 反思。AI 自己发现问题、自己出方案，所有写操作都必须过行动网关。"
        rightContent={
          <span className={clsx('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ring-1',
            online ? 'bg-health-50 text-health-700 ring-health-200' : 'bg-amber-50 text-amber-700 ring-amber-200')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', online ? 'bg-health-500' : 'bg-amber-500')} />
            {online ? `大模型在线${llm?.model ? ' · ' + llm.model : ''}` : '离线兜底模式'}
          </span>
        }
      />

      <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-4 mb-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button key={p.id} disabled={run.running}
              onClick={() => start(p.query || p.label)}
              title={p.hint}
              className="text-sm px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(query); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={run.running}
            placeholder="也可以直接对 AI 下指令，例如：帮我给诺欣妥这个产品安排一次拜访"
            className="flex-1 px-4 py-2.5 rounded-xl ring-1 ring-gray-200 focus:ring-brand-400 outline-none text-sm" />
          {run.running ? (
            <button type="button" onClick={stop} className="px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm flex items-center gap-1.5">
              <Square size={14} /> 停止
            </button>
          ) : (
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm flex items-center gap-1.5 hover:bg-brand-700">
              <Play size={14} /> 开始
            </button>
          )}
        </form>
      </div>

      {!started && (
        <div className="text-center text-gray-400 text-sm py-16">选一个问题，看 AI 如何自己完成一次完整的决策闭环。</div>
      )}

      {started && (
        <>
          <div className="flex items-center gap-2 mb-5">
            {STAGES.map((s, i) => {
              const st = run.stages[s.id];
              return (
                <React.Fragment key={s.id}>
                  <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ring-1 transition-colors',
                    st === 'done' && 'bg-health-50 text-health-700 ring-health-200',
                    st === 'running' && 'bg-brand-50 text-brand-700 ring-brand-300 animate-pulse',
                    st === 'idle' && 'bg-white text-gray-400 ring-gray-200')}>
                    {s.icon}{s.label}
                    {run.ms[s.id] != null && <span className="text-xs opacity-70">{((run.ms[s.id] as number) / 1000).toFixed(1)}s</span>}
                  </div>
                  {i < STAGES.length - 1 && <div className="w-4 h-px bg-gray-300" />}
                </React.Fragment>
              );
            })}
          </div>

          {run.error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm ring-1 ring-red-200">
              <AlertTriangle size={16} className="mt-0.5" /> {run.error}
            </div>
          )}

          {run.findings.length > 0 && (
            <section className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">① 感知：AI 自己巡视了数据</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {run.findings.map((f) => {
                  const hidden = run.hiddenIds.includes(f.id);
                  return (
                    <div key={f.id} className={clsx('rounded-xl p-3 ring-1 bg-white transition-all',
                      hidden ? 'ring-2 ring-red-400 shadow-md' : 'ring-gray-200')}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 text-sm">
                          {f.name}
                          {f.hospital && <span className="text-gray-400 font-normal"> · {f.hospital}</span>}
                        </div>
                        {f.kind === 'doctor' && <div className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">风险分 {f.score}</div>}
                      </div>
                      {hidden && (
                        <div className="mt-1 text-xs font-medium text-red-600">系统里仍显示“正常”，但数据已经在恶化 —— 未被标记的隐性风险</div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          {(f.reasons || []).map((r: string, i: number) => <li key={i}>• {r}</li>)}
                          {f.downstream_count > 0 && <li>• 影响 {f.downstream_count} 位医生：{(f.downstream || []).join('、')}</li>}
                        </ul>
                        {f.rx_series && <Spark values={f.rx_series} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {run.context && (
            <section className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">② 推理依据：喂给大模型的本体上下文（OAG）</h3>
              <div className="rounded-xl bg-white ring-1 ring-gray-200 p-3 text-xs text-gray-600 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(run.context.objects || []).map((o: any) => (
                    <span key={o.id} className="px-2 py-0.5 rounded bg-surface-100 text-gray-700">{o.name} <span className="text-gray-400">{o.type}</span></span>
                  ))}
                </div>
                {(run.context.derived_facts || []).length > 0 && (
                  <div>
                    <div className="font-medium text-gray-700 mb-1">逻辑引擎推导出的新事实（不在任何一张表里）</div>
                    <ul className="space-y-0.5">
                      {run.context.derived_facts.slice(0, 5).map((d: any, i: number) => (
                        <li key={i}><code className="text-brand-600">{d.fact}</code> <span className="text-gray-400">← {d.name || d.rule}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-gray-400">
                  硬规则 {(run.context.hard_rules || []).join(' / ') || '—'} ｜ 上下文 {run.context.token_estimate ?? '?'} / {run.context.token_budget} tokens
                </div>
              </div>
            </section>
          )}

          {run.reasoning && (
            <section className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                ③ 推理结论
                {run.reasonDone?.degraded && <span className="ml-2 text-xs font-normal text-amber-600">（离线兜底生成）</span>}
              </h3>
              <div className="rounded-xl bg-white ring-1 ring-gray-200 p-4">
                <MarkdownRenderer content={run.reasoning} />
                {run.reasonDone && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs flex flex-wrap gap-3 text-gray-500">
                    <span>引用对象：{(run.reasonDone.cited || []).map((c: any) => c.name || c).join('、') || '—'}</span>
                    <span className={run.reasonDone.verified?.ungrounded?.length ? 'text-amber-600' : 'text-health-600'}>
                      数字核验：{run.reasonDone.verified?.ungrounded?.length
                        ? `${run.reasonDone.verified.ungrounded.length} 个数字无依据`
                        : '全部可追溯到数据'}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {run.steps.length > 0 && (
            <section className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">④ 规划与执行：每一步都经过行动网关</h3>
              <div className="space-y-2">
                {run.steps.map((s) => {
                  const r = run.results[s.index];
                  const meta = r ? STATUS_META[r.status] || STATUS_META.failed : null;
                  const pre = s.pre_check || {};
                  return (
                    <div key={s.index} className="rounded-xl bg-white ring-1 ring-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {s.index + 1}. {s.label}{pre.object_name ? ` · ${pre.object_name}` : ''}
                          </div>
                          {s.rationale && <div className="text-xs text-gray-500 mt-0.5">{s.rationale}</div>}
                        </div>
                        {meta ? (
                          <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ring-1 whitespace-nowrap', meta.cls)}>
                            {meta.icon}{meta.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{pre.expected === 'blocked' ? '预检：将被拦截' : pre.expected === 'pending' ? '预检：需审批' : '等待执行'}</span>
                        )}
                      </div>
                      {r?.message && (
                        <div className={clsx('mt-2 text-xs rounded-lg px-2.5 py-1.5',
                          r.status === 'blocked' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600')}>
                          {r.rule && <b className="mr-1">{r.rule}</b>}{r.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {run.reflect && (
            <section className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">⑤ 反思</h3>
              <div className="rounded-xl bg-white ring-1 ring-gray-200 p-4"><MarkdownRenderer content={run.reflect} /></div>
            </section>
          )}

          {run.done && !run.done.refused && (
            <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-medical-600 text-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                本次运行共 {((run.done.ms || 0) / 1000).toFixed(1)} 秒：
                自动执行 <b>{summary.executed || 0}</b> · 待审批 <b>{summary.pending || 0}</b> · 被拦截 <b>{summary.blocked || 0}</b>
                {run.done.degraded && <span className="ml-2 opacity-80">（部分环节使用兜底）</span>}
              </div>
              <div className="flex gap-2">
                {(summary.pending || 0) > 0 && (
                  <button onClick={() => onTabChange?.('approve')} className="px-3 py-1.5 rounded-lg bg-white text-brand-700 text-sm font-medium">去审批</button>
                )}
                {(summary.blocked || 0) > 0 && (
                  <button onClick={() => onTabChange?.('guard')} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm">看拦截记录</button>
                )}
                <button onClick={() => onTabChange?.('written')} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm">看已改动</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentRoom;
