import React, { useEffect, useRef, useState } from 'react';
import { Scale, Play, Square, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import PageHeader from './PageHeader';
import MarkdownRenderer from './MarkdownRenderer';
import { Preset, WarRoomEvent, compareApi } from '../api/warRoom';

type Side = 'plain' | 'oag';

interface SideState {
  text: string;
  done: any | null;
}

const emptySide = (): SideState => ({ text: '', done: null });

const SideCard: React.FC<{ side: Side; state: SideState; running: boolean }> = ({ side, state, running }) => {
  const isOag = side === 'oag';
  const d = state.done;
  const ungrounded = d?.grounding?.ungrounded?.length || 0;
  return (
    <div className={clsx('rounded-2xl p-4 bg-white flex flex-col min-h-[320px]',
      isOag ? 'ring-2 ring-brand-400' : 'ring-1 ring-gray-200')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
          {isOag ? <Sparkles size={16} className="text-brand-600" /> : <Scale size={16} className="text-gray-400" />}
          {isOag ? '本体增强（OAG）' : '普通大模型'}
        </div>
        <span className="text-xs text-gray-400">{isOag ? '带着企业本体与硬规则作答' : '只有问题本身，没有企业数据'}</span>
      </div>

      <div className="flex-1 text-gray-800">
        {state.text ? <MarkdownRenderer content={state.text} /> : (
          <div className="text-sm text-gray-400">{running ? '等待首个字符…' : '尚未运行'}</div>
        )}
        {running && !d && <span className="inline-block w-1.5 h-4 bg-brand-500 animate-pulse align-middle ml-0.5" />}
      </div>

      {d && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-500">首字 <b className="text-gray-800">{d.first_token_ms != null ? `${(d.first_token_ms / 1000).toFixed(1)}s` : '—'}</b>
            ，总耗时 <b className="text-gray-800">{(d.ms / 1000).toFixed(1)}s</b></div>
          <div className={ungrounded ? 'text-amber-600' : 'text-health-600'}>
            数字核验：{d.error ? '—' : ungrounded ? `${ungrounded} 个数字无依据` : `${d.grounding?.checked ?? 0} 个数字均可追溯`}
          </div>
          <div className="col-span-2 text-gray-500">
            引用企业对象：{(d.cited || []).length ? (d.cited as any[]).map((c) => c.name).join('、') : '无'}
          </div>
          {d.error && <div className="col-span-2 text-red-600">调用失败：{d.error}</div>}
        </div>
      )}
    </div>
  );
};

const OagCompare: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [query, setQuery] = useState('');
  const [squeeze, setSqueeze] = useState(false);
  const [running, setRunning] = useState(false);
  const [context, setContext] = useState<any | null>(null);
  const [plain, setPlain] = useState<SideState>(emptySide());
  const [oag, setOag] = useState<SideState>(emptySide());
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    compareApi.presets().then(setPresets).catch(() => setPresets([]));
    return () => abortRef.current?.abort();
  }, []);

  const handle = (ev: WarRoomEvent) => {
    const setter = ev.side === 'plain' ? setPlain : setOag;
    switch (ev.type) {
      case 'context':
        setContext(ev);
        break;
      case 'token':
        setter((p) => ({ ...p, text: p.text + (ev.text || '') }));
        break;
      case 'side_done':
        setter((p) => ({ ...p, done: ev }));
        break;
      case 'error':
        setError(ev.message || '运行出错');
        break;
      default:
        break;
    }
  };

  const start = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setQuery(text);
    setRunning(true);
    setError(null);
    setContext(null);
    setPlain(emptySide());
    setOag(emptySide());
    try {
      await compareApi.run(text, squeeze, handle, ctrl.signal);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message || '连接中断');
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const refused = context?.refuse || oag.done?.refused;

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      <PageHeader
        icon={<Scale size={22} className="text-brand-600" />}
        title="OAG 对比"
        description="同一个问题、同一个大模型：一边什么都不给，一边给它企业本体、关系和硬规则。"
      />

      <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-4 mb-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button key={p.id} disabled={running} onClick={() => start(p.query || p.label)}
              className="text-sm px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              {p.label}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(query); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={running}
            placeholder="输入一个业务问题" className="flex-1 px-4 py-2.5 rounded-xl ring-1 ring-gray-200 focus:ring-brand-400 outline-none text-sm" />
          {running ? (
            <button type="button" onClick={stop} className="px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm flex items-center gap-1.5"><Square size={14} /> 停止</button>
          ) : (
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm flex items-center gap-1.5 hover:bg-brand-700"><Play size={14} /> 对比</button>
          )}
        </form>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-500 select-none">
          <input type="checkbox" checked={squeeze} onChange={(e) => setSqueeze(e.target.checked)} disabled={running} />
          演示“安全拒答”：人为压缩上下文预算，让硬规则放不下（仅用于演示，页面会明确标注）
        </label>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm ring-1 ring-red-200">
          <AlertTriangle size={16} className="mt-0.5" /> {error}
        </div>
      )}

      {context && (
        <div className="mb-4 rounded-xl bg-surface-50 ring-1 ring-gray-200 p-3 text-xs text-gray-600 flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="font-medium text-gray-800">OAG 上下文</span>
          <span>对象 {(context.objects || []).length} 个</span>
          <span>关系 {(context.edges || []).length} 条</span>
          <span>推导事实 {(context.derived_facts || []).length} 条</span>
          <span>硬规则 {(context.hard_rules || []).join(' / ') || '—'}</span>
          <span>{context.token_estimate ?? '?'} / {context.token_budget} tokens</span>
          {context.simulated_squeeze && <span className="text-amber-600">⚠ 演示：已人为压缩预算</span>}
        </div>
      )}

      {refused && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm ring-1 ring-amber-200">
          <ShieldCheck size={16} className="mt-0.5" />
          硬规则放不进上下文窗口，OAG 选择拒绝作答，而不是在没有合规约束的情况下给出建议。
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <SideCard side="plain" state={plain} running={running} />
        <SideCard side="oag" state={oag} running={running} />
      </div>
    </div>
  );
};

export default OagCompare;
