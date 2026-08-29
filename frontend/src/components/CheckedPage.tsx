import React from 'react';
import { BadgeCheck, Network, Sparkles } from 'lucide-react';
import PageHeader from './PageHeader';
import { COPY, claimText, humanizeFact, humanizeMissing, typeLabel } from '../copy';
import { objectName, useHubOverview } from '../hooks/useHubOverview';
import { useOntologyContext } from '../contexts/OntologyContext';

const REL_LABELS: Record<string, string> = {
  WORKS_AT: '就职于',
  INFLUENCES: '影响',
  MANAGED_BY: '由代表负责',
  PRESCRIBES: '处方',
  HAS_VISIT: '有拜访',
  HAS_ROI: '费用回报',
};

function rmb(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

interface CheckedPageProps {
  onTabChange?: (tab: string) => void;
}

const CheckedPage: React.FC<CheckedPageProps> = ({ onTabChange }) => {
  const { overview, loading, error } = useHubOverview();
  const { state } = useOntologyContext();
  const focalId = overview?.focal_object?.id || 'd1';
  const focalName = overview?.focal_object?.name || '重点客户';
  const focalObj = state.objects.find((o) => o.id === focalId);
  const neighbors = (focalObj?.links || []).map((link) => ({
    rel: REL_LABELS[link.linkType] || link.linkType,
    name: link.targetName,
    type: typeLabel(link.targetType),
  }));
  const facts: string[] = overview?.loop?.facts || [];
  const systems: { name: string; count: number }[] = overview?.loop?.bindings?.systems || [];
  const signals = overview?.sales_signals || {};
  const missing: string[] = overview?.latest_attribution?.missing_signals || [];
  const nameOf = (id: string) => objectName(overview, id) || id;
  const visit = signals.visit_effect || {};
  const quota = signals.quota || {};
  const coverage = signals.coverage || {};

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<BadgeCheck className="text-brand-400" size={22} />}
        title={COPY.nav.checked}
        description={COPY.checked.description}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">{focalName} · {COPY.checked.relations}</h3>
              <button
                type="button"
                onClick={() => onTabChange?.('ontology')}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1"
              >
                <Network size={12} /> {COPY.today.goGraph}
              </button>
            </div>
            {neighbors.length === 0 ? (
              <p className="text-sm text-gray-500">关系图加载后会出现医院、代表、产品。</p>
            ) : (
              <ul className="space-y-2">
                {neighbors.slice(0, 8).map((n, i) => (
                  <li key={`${n.name}-${i}`} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{n.rel}</span>
                    <span>{n.name}</span>
                    <span className="text-xs text-gray-400">{n.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">{COPY.checked.facts}</h3>
            {facts.length === 0 ? (
              <p className="text-sm text-gray-500">{COPY.checked.noFacts}</p>
            ) : (
              <ul className="space-y-2">
                {facts.map((f) => (
                  <li key={f} className="text-sm text-gray-700">{humanizeFact(f, nameOf)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">{COPY.checked.source}</h3>
            {systems.length === 0 ? (
              <p className="text-sm text-gray-500">{COPY.checked.noSource}</p>
            ) : (
              <ul className="space-y-2">
                {systems.map((s) => (
                  <li key={s.name} className="text-sm text-gray-700">{COPY.checked.fromSystem(s.name, s.count)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">{COPY.checked.signals}</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {visit.before != null && visit.after != null ? (
                <li>拜访后处方从 {visit.before} 到 {visit.after}</li>
              ) : null}
              {coverage.rate != null ? <li>覆盖率 {coverage.rate}%</li> : null}
              {quota.gap != null ? <li>本季还差 {rmb(quota.gap)}</li> : null}
              {claimText(overview?.latest_attribution?.insight_chain?.root?.[0]) ? (
                <li>{claimText(overview.latest_attribution.insight_chain.root[0])}</li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={() => onTabChange?.('insights')}
              className="mt-3 text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
            >
              <Sparkles size={12} /> {COPY.today.goWhy}
            </button>
          </div>

          {missing.length > 0 ? (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-amber-900 mb-1">{COPY.checked.missing}</h3>
              <p className="text-sm text-amber-800">
                {missing.map((s) => humanizeMissing(s, nameOf)).join('；')}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default CheckedPage;
