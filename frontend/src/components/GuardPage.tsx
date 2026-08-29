import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import PageHeader from './PageHeader';
import { COPY, stripSystemJargon } from '../copy';
import { HubAction, mapHubAction, useHubOverview } from '../hooks/useHubOverview';
import { useAuth } from '../contexts/AuthContext';
import apiClient, { notifyHubChanged } from '../api/client';

const GuardPage: React.FC = () => {
  const { user } = useAuth();
  const { overview, loading, error, reload } = useHubOverview();
  const [probe, setProbe] = useState('');
  const loop = overview?.loop || {};
  const submitter = loop.submitter || {};
  const blocked: { message?: string; when?: string }[] = loop.blocked || [];
  const pending: HubAction[] = (overview?.pending_for_me || []).map(mapHubAction);
  const submitted: HubAction[] = (overview?.submitted_by_me || []).map(mapHubAction);
  const caseAction = submitted[0] || pending.find((a) => a.proposedBy === submitter.id) || null;
  const isSubmitter = Boolean(submitter.is_current_user);

  const handleTrySelf = async () => {
    if (!caseAction) {
      setProbe(COPY.brief.noPending);
      return;
    }
    try {
      const result = await apiClient.approveAction(caseAction.id, user?.id || '');
      if (result.status === 'blocked') {
        setProbe(COPY.brief.blockedSelf);
      } else {
        setProbe(stripSystemJargon(result.message || COPY.brief.done));
      }
      await reload();
      notifyHubChanged();
    } catch (err: any) {
      setProbe(COPY.brief.blockedSelf);
    }
  };

  const rules = [COPY.guard.ruleNoObject, COPY.guard.ruleNeedManager, COPY.guard.ruleNoSelf, COPY.guard.ruleType];

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<Shield className="text-brand-400" size={22} />}
        title={COPY.nav.guard}
        description={COPY.guard.description}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">{COPY.guard.caseTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500">{COPY.guard.submitter}</div>
                <div className="text-gray-800 mt-1">{submitter.name || '—'}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500">{COPY.guard.mustSign}</div>
                <div className="text-gray-800 mt-1">{COPY.today.needManager}</div>
              </div>
            </div>
            {isSubmitter ? (
              <div className="mt-4">
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  {COPY.guard.youAreSubmitter}
                </p>
                <button
                  type="button"
                  onClick={handleTrySelf}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  {COPY.guard.trySelf}
                </button>
                {probe ? <p className="text-sm text-amber-800 mt-2">{probe}</p> : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                {COPY.guard.youMustSign}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">{COPY.guard.rules}</h3>
            <ul className="space-y-2">
              {rules.map((line) => (
                <li key={line} className="text-sm text-gray-700 flex gap-2">
                  <Shield size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-800 mb-3">{COPY.guard.history}</h3>
            {blocked.length === 0 ? (
              <p className="text-sm text-gray-500">{COPY.guard.none}</p>
            ) : (
              <ul className="space-y-2">
                {blocked.map((row, i) => (
                  <li key={`${row.when}-${i}`} className="text-sm text-gray-700 p-3 bg-orange-50 rounded-xl">
                    {row.message || COPY.brief.blockedSelf}
                    {row.when ? (
                      <div className="text-xs text-gray-400 mt-1">{new Date(row.when).toLocaleString('zh-CN')}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardPage;
