import React, { useState } from 'react';
import { Inbox, Target } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import PageHeader from './PageHeader';
import ApproveModal from './ApproveModal';
import { COPY } from '../copy';
import { HubAction, mapHubAction, useHubOverview } from '../hooks/useHubOverview';
import { useAuth } from '../contexts/AuthContext';
import apiClient, { notifyHubChanged } from '../api/client';

const ApprovePage: React.FC = () => {
  const { user } = useAuth();
  const { overview, loading, error, reload } = useHubOverview();
  const pendingForMe: HubAction[] = (overview?.pending_for_me || []).map(mapHubAction);
  const submittedByMe: HubAction[] = (overview?.submitted_by_me || []).map(mapHubAction);
  const [selected, setSelected] = useState<HubAction | null>(null);
  const [actionError, setActionError] = useState('');

  const handleApprove = async (actionId: string) => {
    setActionError('');
    try {
      const result = await apiClient.approveAction(actionId, user?.id || '');
      if (result.status === 'blocked') {
        setActionError(result.message || '审批被拒绝');
        return;
      }
      setSelected(null);
      await reload();
      notifyHubChanged();
    } catch (err: any) {
      setActionError(err.message || '审批失败');
    }
  };

  const handleReject = async (actionId: string) => {
    try {
      await apiClient.rejectAction(actionId, user?.id || '');
      setSelected(null);
      await reload();
      notifyHubChanged();
    } catch (err: any) {
      setActionError(err.message || '退回失败');
    }
  };

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<Inbox className="text-brand-400" size={22} />}
        title={COPY.nav.approve}
        description={COPY.today.noPendingHint}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              {COPY.today.decide}
              {pendingForMe.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400">{pendingForMe.length}</span>
              )}
            </h3>
            {pendingForMe.length === 0 ? (
              <div className="text-center py-8">
                <Inbox size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-800">{COPY.today.noPending}</p>
                <p className="text-xs text-gray-500 mt-1">{COPY.today.noPendingHint}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingForMe.map((action) => {
                  const n = action.reasoningChain?.evidence?.length || 0;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className="w-full text-left p-4 bg-gray-50 rounded-xl hover:bg-gray-100 border border-transparent hover:border-brand-200"
                      onClick={() => { setActionError(''); setSelected(action); }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-800 text-sm">{action.title}</div>
                          <p className="text-xs text-gray-600 mt-1">{action.description}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 shrink-0">{COPY.today.decide}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3">
                        <span className="flex items-center"><Target size={11} className="mr-1" />{action.entityName}</span>
                        {action.timestamp ? <span>{new Date(action.timestamp).toLocaleString('zh-CN')}</span> : null}
                        {n > 0 ? <span>{COPY.today.evidenceCount(n)}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-2">{COPY.today.submitted}</h3>
            {submittedByMe.length === 0 ? (
              <p className="text-xs text-gray-400">{COPY.today.noSubmitted}</p>
            ) : (
              <div className="space-y-2">
                {submittedByMe.map((action) => (
                  <div key={action.id} className="p-3 bg-slate-50 rounded-xl text-sm">
                    <div className="font-medium text-gray-700">{action.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{COPY.today.waiting} · {action.entityName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected ? (
          <ApproveModal
            action={selected}
            error={actionError}
            onClose={() => setSelected(null)}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default ApprovePage;
