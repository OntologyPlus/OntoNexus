import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Network, Sparkles, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from './PageHeader';
import { COPY, typeLabel } from '../copy';
import { useHubOverview } from '../hooks/useHubOverview';

interface WatchPageProps {
  onTabChange?: (tab: string) => void;
}

const WatchPage: React.FC<WatchPageProps> = ({ onTabChange }) => {
  const { overview, loading, error } = useHubOverview();
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const alerts = overview?.alerts || [];
  const signals = overview?.sales_signals || {};
  const focalName = overview?.focal_object?.name;

  const gauges = [
    { label: '覆盖率', value: signals.coverage?.rate != null ? `${signals.coverage.rate}%` : '—', hint: signals.coverage?.covered != null ? `已覆盖 ${signals.coverage.covered}/${signals.coverage.total}` : '' },
    { label: '拜访后处方', value: signals.visit_effect?.delta ?? '—', hint: signals.visit_effect?.before != null ? `访前 ${signals.visit_effect.before} → 访后 ${signals.visit_effect.after}` : '' },
    { label: '费用回报', value: signals.roi?.roi_ratio ?? '—', hint: '' },
    { label: '专家影响力', value: signals.kol?.influence_score ?? '—', hint: signals.kol?.influenced_count != null ? `下游 ${signals.kol.influenced_count} 人` : '' },
  ];

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<AlertTriangle className="text-orange-600" size={22} />}
        title={COPY.nav.watch}
        description={COPY.today.watchHint}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          {focalName && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{focalName} · 处方下滑</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onTabChange?.('ontology')} className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    {COPY.today.goGraph}
                  </button>
                  <button type="button" onClick={() => onTabChange?.('insights')} className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50">
                    {COPY.today.goWhy}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {gauges.map((g) => (
                  <div key={g.label} className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500">{g.label}</div>
                    <div className="text-2xl font-semibold text-gray-800 mt-1">{String(g.value)}</div>
                    {g.hint ? <div className="text-[11px] text-gray-400 mt-1">{g.hint}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="text-orange-700" size={18} />
              风险名单
              {alerts.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">{alerts.length}</span>
              )}
            </h3>
            {alerts.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle size={28} className="mx-auto text-emerald-300 mb-2" />
                <p className="text-sm text-gray-800">{COPY.today.noWatch}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert: any) => (
                  <button
                    key={alert.id}
                    type="button"
                    className="w-full text-left p-3 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100"
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {alert.name || alert.title} · {alert.status === 'critical' ? '高风险' : '需关注'}
                      </span>
                      <span className="text-xs text-gray-400">{typeLabel(alert.object_type)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-100/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setSelectedAlert(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedAlert.name || selectedAlert.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">{typeLabel(selectedAlert.object_type)}</p>
                </div>
                <button type="button" onClick={() => setSelectedAlert(null)}>
                  <XCircle size={20} className="text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-600 bg-orange-50 border border-orange-200 p-4 rounded-xl">
                {selectedAlert.message || `${selectedAlert.name || '该客户'} 需要关注`}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => { setSelectedAlert(null); onTabChange?.('ontology'); }} className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 flex items-center gap-1">
                  <Network size={12} /> {COPY.today.goGraph}
                </button>
                <button type="button" onClick={() => { setSelectedAlert(null); onTabChange?.('insights'); }} className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 flex items-center gap-1">
                  <Sparkles size={12} /> {COPY.today.goWhy}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchPage;
