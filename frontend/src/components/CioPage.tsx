import React, { useEffect, useState } from 'react';
import { ShieldCheck, Link2, Cpu, ListChecks } from 'lucide-react';
import { clsx } from 'clsx';
import PageHeader from './PageHeader';
import { getJson } from '../api/warRoom';

const RISK_CLS: Record<string, string> = {
  R0: 'bg-gray-100 text-gray-600',
  R1: 'bg-health-50 text-health-700',
  R2: 'bg-amber-50 text-amber-700',
  R3: 'bg-orange-50 text-orange-700',
  R4: 'bg-red-50 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待审批', approved: '已批准', executed: '已执行', rejected: '已退回', failed: '失败',
};

const CioPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    getJson<any>('/api/cio/overview').then(setData).catch((e) => setError(e?.message || '加载失败'));
  };
  useEffect(load, []);

  if (error) return <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-500">加载中…</div>;

  const chain = data.audit?.chain || {};
  const llm = data.llm || {};
  const statuses: Record<string, number> = data.proposals?.by_status || {};

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      <PageHeader
        icon={<ShieldCheck size={22} className="text-brand-600" />}
        title="治理与可信"
        description="AI 能做什么、不能做什么、做过什么，以及怎么证明没被改过。"
        rightContent={<button onClick={load} className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-gray-200 hover:bg-gray-50">重新校验</button>}
      />

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        <div className={clsx('rounded-2xl p-4 ring-1', chain.valid ? 'bg-health-50 ring-health-200' : 'bg-red-50 ring-red-200')}>
          <div className="flex items-center gap-2 text-sm font-medium"><Link2 size={16} /> 审计链校验</div>
          <div className={clsx('text-2xl font-semibold mt-2', chain.valid ? 'text-health-700' : 'text-red-700')}>
            {chain.valid ? '完整，未被篡改' : '发现异常'}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            已链接 {chain.count ?? 0} 条记录（SHA-256 哈希链）
            {!chain.valid && chain.broken_at && <span className="text-red-700"> · 断点 {chain.broken_at}</span>}
          </div>
        </div>
        <div className="rounded-2xl p-4 ring-1 ring-gray-200 bg-white">
          <div className="flex items-center gap-2 text-sm font-medium"><ListChecks size={16} /> 动作提案</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
            {Object.keys(statuses).length === 0 && <span className="text-gray-400">暂无</span>}
            {Object.entries(statuses).map(([k, n]) => (
              <span key={k} className="text-gray-700">{STATUS_LABEL[k] || k} <b>{n}</b></span>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2">其中由 AI 提交 {data.proposals?.by_ai_agent ?? 0} 条，均经过同一网关</div>
        </div>
        <div className="rounded-2xl p-4 ring-1 ring-gray-200 bg-white">
          <div className="flex items-center gap-2 text-sm font-medium"><Cpu size={16} /> 大模型接入</div>
          <div className="text-sm mt-2 text-gray-800">{llm.configured ? (llm.model || '已配置') : '未配置（使用确定性兜底）'}</div>
          <div className="text-xs text-gray-500 mt-1">OpenAI 兼容接口；超时与重试有上限，失败自动降级</div>
        </div>
      </div>

      <section className="rounded-2xl bg-white ring-1 ring-gray-200 p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">我们对 AI 的约束</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          {(data.guarantees || []).map((g: string, i: number) => <li key={i}>• {g}</li>)}
        </ul>
      </section>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <section className="rounded-2xl bg-white ring-1 ring-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">四条硬规则（代码强制，非提示词）</h3>
          <div className="space-y-2">
            {(data.hard_rules || []).map((r: any) => (
              <div key={r.id} className="text-sm">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 mr-2">{r.id}</span>
                <b className="text-gray-900">{r.title}</b>
                <div className="text-xs text-gray-500 mt-0.5 ml-1">{r.desc}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white ring-1 ring-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">最近的审计记录</h3>
          <div className="space-y-1.5">
            {(data.audit?.recent || []).map((r: any) => (
              <div key={r.id} className="text-xs flex items-center justify-between gap-2">
                <span className="text-gray-800 truncate">{r.action}{r.entity_id ? ` · ${r.entity_id}` : ''}</span>
                <span className="font-mono text-gray-400 whitespace-nowrap">{r.prev} → {r.hash}</span>
              </div>
            ))}
            {(data.audit?.recent || []).length === 0 && <div className="text-xs text-gray-400">暂无记录</div>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white ring-1 ring-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">动作契约：每个动作的风险等级与是否需审批</h3>
        <div className="flex flex-wrap gap-2">
          {(data.contracts || []).map((c: any) => (
            <span key={c.action} className={clsx('text-xs px-2 py-1 rounded-lg', RISK_CLS[c.risk] || 'bg-gray-100 text-gray-600')}>
              {c.action} · {c.risk}{c.requires_approval ? ' · 需审批' : ''}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CioPage;
