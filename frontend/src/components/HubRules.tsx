import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Shield, AlertTriangle } from 'lucide-react';
import PageHeader from './PageHeader';
import apiClient from '../api/client';
import { COPY, humanizeFact } from '../copy';
import { useOntologyContext } from '../contexts/OntologyContext';

const HubRules: React.FC = () => {
  const [logic, setLogic] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { state } = useOntologyContext();
  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const obj of state.objects || []) {
      map[obj.id] = obj.name || obj.id;
    }
    return (id: string) => map[id] || id;
  }, [state.objects]);

  useEffect(() => {
    apiClient.getHubLogic()
      .then(setLogic)
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const snapshot = logic?.snapshot || {};
  const facts = logic?.derived_facts || [];
  const trace = logic?.logic_trace || [];
  const rules = logic?.rules || [];

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<Brain className="text-brand-400" size={22} />}
        title={COPY.system.title}
        description={COPY.system.description}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="space-y-4 overflow-y-auto pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Shield size={16} className="text-brand-400" />
              {COPY.system.snapshot}
            </h3>
            <p className="text-sm text-gray-600">
              {snapshot.ok ? COPY.system.ok : COPY.system.bad} · 已核对 {snapshot.checked ?? '—'} 处
            </p>
            {(snapshot.violations || []).length > 0 && (
              <ul className="mt-2 text-xs text-rose-600 list-disc pl-5 space-y-1">
                {snapshot.violations.map((v: any, i: number) => (
                  <li key={i}>{typeof v === 'string' ? v : v.detail || v.message || '关系与规则不符'}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-2">{COPY.system.facts}</h3>
            {facts.length === 0 ? (
              <p className="text-xs text-gray-400">本次没有额外确认项。</p>
            ) : (
              <ul className="text-sm text-gray-700 space-y-1">
                {facts.slice(0, 24).map((f: any, i: number) => (
                  <li key={i} className="border-b border-gray-50 py-1">
                    {humanizeFact(typeof f === 'string' ? f : f.predicate ? `${f.predicate}(${f.subject || f.object_id || ''})` : JSON.stringify(f), nameOf)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-2">{COPY.system.trace}</h3>
            {trace.length === 0 ? (
              <p className="text-xs text-gray-400">无步骤。</p>
            ) : (
              <ol className="text-xs text-gray-600 list-decimal pl-5 space-y-1">
                {trace.slice(0, 16).map((step: any, i: number) => (
                  <li key={i}>
                    {humanizeFact(typeof step === 'string' ? step : (step.conclusion || ''), nameOf)}
                    {step?.name ? ` · ${step.name}` : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              {COPY.system.rules}
            </h3>
            {rules.length === 0 ? (
              <p className="text-xs text-gray-400">暂无规则。</p>
            ) : (
              <div className="space-y-2">
                {rules.map((r: any) => (
                  <div key={r.id || r.name} className="text-sm border-b border-gray-50 py-2">
                    <div className="font-medium text-gray-700">{r.name || r.id}</div>
                    {r.description ? <p className="text-xs text-gray-600 mt-1">{r.description}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HubRules;
