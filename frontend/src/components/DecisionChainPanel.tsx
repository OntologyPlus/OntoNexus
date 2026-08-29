import { useEffect, useState } from 'react';
import { GitBranch, Search, Shield, Link2 } from 'lucide-react';
import apiClient, { HUB_CHANGED_EVENT } from '../api/client';

interface DecisionItem {
  id: string;
  category: string;
  scenario: string;
  outcome: string;
  confidence: number;
  decisionMaker?: string;
  policyResult?: { passed?: boolean; violations?: any[] };
  evidenceIds?: string[];
  createdAt?: string;
}

export default function DecisionChainPanel() {
  const [items, setItems] = useState<DecisionItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [chain, setChain] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async (q?: string) => {
    try {
      setError('');
      const data = await apiClient.searchDecisions(q);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || '加载失败');
    }
  };

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(HUB_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(HUB_CHANGED_EVENT, onChange);
  }, []);

  const open = async (id: string) => {
    try {
      const [detail, ch, explained] = await Promise.all([
        apiClient.getDecision(id),
        apiClient.getDecisionChain(id),
        apiClient.explainDecision(id),
      ]);
      setSelected({ ...detail, explanation: explained });
      setChain(ch);
    } catch (e: any) {
      setError(e.message || '无法加载决策链');
    }
  };

  return (
    <div className="h-full overflow-auto p-6 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <GitBranch size={20} className="text-blue-600" />
            决策链
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            分析结论作为一等公民落库：Skill、父决策、因果边、政策门、证据 ID。
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(query)}
              placeholder="按场景检索先例…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
            />
          </div>
          <button
            onClick={() => load(query)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            检索
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 divide-y">
            {items.length === 0 && (
              <div className="p-6 text-sm text-slate-400">暂无决策记录。在 AI 助手中提问后会写入分析决策。</div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => open(item.id)}
                className="w-full text-left p-4 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{item.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.outcome === 'blocked' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {item.outcome}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.scenario}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {item.id} · {(item as any).metadata?.skill || item.category} · 置信度 {item.confidence}
                </p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            {!selected && <div className="text-sm text-slate-400">选择一条决策查看因果链与政策门。</div>}
            {selected && (
              <>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield size={16} className="text-blue-600" />
                  政策门 {selected.policyResult?.passed ? '通过' : '未通过 / 拦截'}
                </div>
                {selected.policyResult?.violations?.length > 0 && (
                  <ul className="text-xs text-red-600 list-disc pl-4">
                    {selected.policyResult.violations.map((v: any, i: number) => (
                      <li key={i}>{v.reason || v.policy_id}</li>
                    ))}
                  </ul>
                )}
                <div className="text-xs text-slate-600 whitespace-pre-wrap">{selected.reasoning}</div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Skill：{selected.metadata?.skill || '—'}</div>
                  <div>父决策：{selected.parentDecisionId || '无（本条为链起点）'}</div>
                  <div>证据 ID：{(selected.evidenceIds || []).join(', ') || '无'}</div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Link2 size={16} /> 因果祖先
                  </div>
                  {(chain?.nodes || []).map((n: any) => (
                    <div key={n.id} className="text-xs text-slate-600 py-1">
                      {n.id} · {n.outcome} · {n.category}
                    </div>
                  ))}
                  {(chain?.edges || []).map((e: any) => (
                    <div key={e.id} className="text-[11px] text-slate-400">
                      {e.sourceId} —{e.relation}→ {e.targetId}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
