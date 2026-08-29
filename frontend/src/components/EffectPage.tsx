import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import PageHeader from './PageHeader';
import { COPY, scoreNoteText } from '../copy';
import { objectName, useHubOverview } from '../hooks/useHubOverview';
import apiClient from '../api/client';

function formatDue(row: any) {
  if (row.due) return COPY.today.due;
  const s = row.seconds_until_due;
  if (s == null) return '待查看';
  if (s <= 0) return COPY.today.due;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分后`;
  return `${m} 分钟后`;
}

const EffectPage: React.FC = () => {
  const { overview, loading, error, reload } = useHubOverview();
  const [evalMessage, setEvalMessage] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const learning = overview?.learning || { pending: [], due_count: 0, scored: [] };

  const handleEvaluateDue = async () => {
    setEvalMessage('');
    try {
      const result = await apiClient.evaluateLearning();
      setEvalMessage(COPY.today.evaluated(result.evaluated));
      setResults(result.results || []);
      await reload();
    } catch (err: any) {
      setEvalMessage(err.message || '评估失败');
    }
  };

  const scored = results.length > 0 ? results : (learning.scored || []);

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<Clock className="text-brand-400" size={22} />}
        title={COPY.nav.effect}
        description={COPY.today.effectHint}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                {COPY.today.effect}
                {learning.due_count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{COPY.today.due} {learning.due_count}</span>
                )}
              </h3>
              <button
                type="button"
                onClick={handleEvaluateDue}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white"
              >
                {COPY.today.evaluate}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">{COPY.today.effectHint}</p>
            {evalMessage ? <p className="text-xs text-brand-600 mb-3">{evalMessage}</p> : null}
            {(learning.pending || []).length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">{COPY.today.noEffect}</p>
            ) : (
              <div className="space-y-2">
                {learning.pending.map((row: any) => (
                  <div key={row.id} className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-800">{objectName(overview, row.object_id) || overview?.focal_object?.name || '重点客户'}</span>
                    <span className={`text-xs ${row.due ? 'text-amber-700' : 'text-gray-500'}`}>{formatDue(row)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {scored.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-3">已经看过的效果</h3>
              <div className="space-y-2">
                {scored.map((row: any) => (
                  <div key={row.id} className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800">
                    <div>{objectName(overview, row.object_id) || overview?.focal_object?.name || '重点客户'}</div>
                    <div className="text-xs text-gray-600 mt-1">{scoreNoteText(row.signals_note || row.note)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default EffectPage;
