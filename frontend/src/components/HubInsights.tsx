import React, { useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import PageHeader from './PageHeader';
import { COPY, claimText, humanizeMissing, stripSystemJargon } from '../copy';
import { objectName, useHubOverview } from '../hooks/useHubOverview';

interface ChainItem {
  claim?: string;
  object_id?: string;
  signal?: string;
}

const HubInsights: React.FC = () => {
  const { overview, loading, error } = useHubOverview();
  const [openId, setOpenId] = useState<string | null>(null);
  const chain = overview?.latest_attribution?.insight_chain || {};
  const nameOf = (id: string) => objectName(overview, id) || id;

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<Sparkles className="text-brand-400" size={22} />}
        title={COPY.why.title}
        description={COPY.why.description}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="space-y-4 overflow-y-auto pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-4">{COPY.why.gap}</h3>
            {!overview?.latest_attribution ? (
              <p className="text-sm text-gray-600">{COPY.why.empty}</p>
            ) : (
              <div className="space-y-0">
                <Layer title={COPY.why.root} items={chain.root} accent="rose" />
                <div className="h-4 w-px bg-gray-200 ml-3" />
                <Layer title={COPY.why.mid} items={chain.intermediate} accent="amber" />
                <div className="h-4 w-px bg-gray-200 ml-3" />
                <Layer title={COPY.why.surface} items={chain.surface} accent="slate" />
              </div>
            )}
          </div>
          {(overview?.latest_attribution?.missing_signals || []).length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-amber-900 mb-1">{COPY.why.missing}</h3>
              <p className="text-sm text-amber-800">
                {(overview.latest_attribution.missing_signals as string[]).map((s) => humanizeMissing(s, nameOf)).join('；')}
              </p>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-600" />
              {COPY.why.related}
            </h3>
            <div className="space-y-2">
              {(overview?.decisions || []).slice(0, 3).map((d: any) => (
                <button
                  key={d.id}
                  type="button"
                  className="w-full text-left text-sm text-gray-700 border-b border-gray-50 py-2"
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                >
                  <span>{stripSystemJargon(d.scenario || d.reasoning || '一次判断')}</span>
                  {openId === d.id && (
                    <p className="text-xs text-gray-500 mt-2">
                      {d.parentDecisionId ? COPY.why.fromPrior : '这是一次独立判断。'}
                    </p>
                  )}
                </button>
              ))}
              {(overview?.decisions || []).length === 0 && (
                <p className="text-xs text-gray-400">问过「为什么这块差」之后，最近的判断会出现在这里。</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Layer: React.FC<{ title: string; items?: Array<string | ChainItem>; accent: 'rose' | 'amber' | 'slate' }> = ({ title, items, accent }) => {
  const color = accent === 'rose' ? 'border-rose-300 bg-rose-50' : accent === 'amber' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50';
  const label = accent === 'rose' ? 'text-rose-700' : accent === 'amber' ? 'text-amber-700' : 'text-slate-600';
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className={`text-xs font-semibold mb-2 ${label}`}>{title}</div>
      {(items || []).length === 0 ? (
        <div className="text-xs text-gray-400">暂无</div>
      ) : (
        <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
          {items!.map((item, idx) => <li key={idx}>{claimText(item)}</li>)}
        </ul>
      )}
    </div>
  );
};

export default HubInsights;
