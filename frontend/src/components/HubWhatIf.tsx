import React, { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import PageHeader from './PageHeader';
import apiClient, { notifyHubChanged } from '../api/client';
import { DataCards, WorkbenchDataCard } from './ChatWorkbenchCards';
import { COPY, stripSystemJargon } from '../copy';
import { useHubOverview } from '../hooks/useHubOverview';

function riskLabel(risk?: string) {
  if (risk === 'critical') return '高';
  if (risk === 'at_risk') return '需关注';
  if (risk === 'on_track') return '正常';
  return risk || '—';
}

const HubWhatIf: React.FC = () => {
  const { overview } = useHubOverview();
  const objects = useMemo(() => {
    const candidates = [overview?.focal_object, ...(overview?.alerts || [])]
      .filter((item: any) => item?.id)
      .map((item: any) => ({ id: item.id, label: item.name || item.title || item.id }));
    return candidates.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  }, [overview]);
  const [objectId, setObjectId] = useState('');
  const [query, setQuery] = useState('如果覆盖提升会怎样');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!objects.length) return;
    if (!objects.some((item) => item.id === objectId)) setObjectId(objects[0].id);
  }, [objectId, objects]);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.hubRun(query, objectId);
      setResult(data);
      notifyHubChanged();
    } catch (err: any) {
      setError(err.message || '计算失败');
    } finally {
      setLoading(false);
    }
  };

  const cards: WorkbenchDataCard[] = result?.data_cards || [];
  const forecast = result?.data_cards?.[0]?.rows?.[0] || {};
  const answer = stripSystemJargon(String(result?.response || ''));
  const currentCoverage = overview?.sales_signals?.coverage?.rate;
  const hasCompare = forecast.achievement_rate != null || forecast.forecast != null;

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<Target className="text-brand-400" size={22} />}
        title={COPY.whatIf.title}
        description={COPY.whatIf.description}
      />
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <p className="text-xs text-gray-500">{COPY.whatIf.description}</p>
        <div className="flex flex-col md:flex-row gap-2">
          <select
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
          >
            {objects.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <input
            className="flex-[2] px-3 py-2 border border-gray-200 rounded-xl text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="如果覆盖提升会怎样"
          />
          <button
            type="button"
            onClick={run}
            disabled={loading || !objectId}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm disabled:opacity-50"
          >
            {loading ? COPY.whatIf.running : COPY.whatIf.run}
          </button>
        </div>
        {error ? <div className="text-sm text-rose-600">{error}</div> : null}
        {hasCompare && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-gray-500">{COPY.whatIf.current}</div>
              <div className="text-xs text-gray-400 mt-2">覆盖率</div>
              <div className="text-2xl font-semibold text-gray-800">{currentCoverage != null ? `${currentCoverage}%` : '—'}</div>
            </div>
            <div className="bg-brand-50 rounded-xl p-4">
              <div className="text-xs text-brand-700">{COPY.whatIf.forecastCol}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-400">{COPY.whatIf.achievement}</div>
                  <div className="text-2xl font-semibold text-gray-800">{forecast.achievement_rate != null ? `${forecast.achievement_rate}%` : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">{COPY.whatIf.risk}</div>
                  <div className="text-2xl font-semibold text-gray-800">{riskLabel(String(forecast.risk || ''))}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {answer ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{answer}</pre>
        ) : null}
        <DataCards cards={cards} />
      </div>
    </div>
  );
};

export default HubWhatIf;
