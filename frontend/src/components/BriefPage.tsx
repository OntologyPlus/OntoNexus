import React, { useMemo, useState } from 'react';
import { CheckCircle, FileText, Network, Shield, Sparkles, XOctagon } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import PageHeader from './PageHeader';
import { COPY, claimText, typeLabel } from '../copy';
import { HubAction, mapHubAction, useHubOverview } from '../hooks/useHubOverview';
import { useOntologyContext } from '../contexts/OntologyContext';
import { useAuth } from '../contexts/AuthContext';
import apiClient, { notifyHubChanged } from '../api/client';
import ApproveModal from './ApproveModal';

const REL_LABELS: Record<string, string> = {
  WORKS_AT: '就职于',
  INFLUENCES: '影响',
  INFLUENCED_BY: '受影响',
  HAS_VISIT: '有拜访',
  VISIT_OF: '拜访',
  MANAGED_BY: '由代表负责',
  PRESCRIBES: '处方',
  HAS_ROI: '费用回报',
};

const EFFECT_LABELS: Record<string, string> = {
  'create VisitRecord': '写入拜访记录',
  'update doctor.nextRecommendedVisitDate': '更新下次建议拜访日',
  'notify SalesRep': '通知负责代表',
};

function rmb(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function signed(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v > 0 ? `+${v}` : String(v);
}

function pick(neighbors: { rel: string; name: string; type: string }[], type: string, rel?: string) {
  return neighbors.find((n) => n.type === type && (!rel || n.rel === rel))?.name;
}

interface BriefPageProps {
  onTabChange?: (tab: string) => void;
}

const BriefPage: React.FC<BriefPageProps> = ({ onTabChange }) => {
  const { user } = useAuth();
  const { overview, loading, error, reload } = useHubOverview();
  const { state } = useOntologyContext();
  const [showEvidence, setShowEvidence] = useState(false);
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState('');

  const focalId = overview?.focal_object?.id || 'd1';
  const focalName = overview?.focal_object?.name || '重点客户';
  const signals = overview?.sales_signals || {};
  const pendingForMe: HubAction[] = (overview?.pending_for_me || []).map(mapHubAction);
  const submittedByMe: HubAction[] = (overview?.submitted_by_me || []).map(mapHubAction);
  const caseAction = useMemo(() => {
    const pool = [...pendingForMe, ...submittedByMe];
    return pool.find((a) => a.entityId === focalId || a.entityName === focalName)
      || pendingForMe[0]
      || submittedByMe[0]
      || null;
  }, [pendingForMe, submittedByMe, focalId, focalName]);

  const visit = signals.visit_effect || {};
  const roi = signals.roi || {};
  const quota = signals.quota || {};
  const attributed = claimText(overview?.latest_attribution?.insight_chain?.root?.[0]);
  const isSubmitter = Boolean(caseAction?.proposedBy && caseAction.proposedBy === user?.id);
  const evidenceCount = caseAction?.reasoningChain?.evidence?.length || 0;
  const hours = overview?.learning?.evaluate_after_hours || 24;
  const focalObj = state.objects.find((o) => o.id === focalId);
  const neighbors = (focalObj?.links || []).map((link) => ({
    rel: REL_LABELS[link.linkType] || link.linkType,
    name: link.targetName,
    type: typeLabel(link.targetType),
  }));
  const hospital = pick(neighbors, '医院', '就职于');
  const rep = pick(neighbors, '代表');
  const product = pick(neighbors, '产品', '处方');
  const downstream = neighbors.filter((n) => n.rel === '影响').map((n) => n.name).filter(Boolean);

  const stakeLine = quota.gap != null && Number(quota.gap) > 0
    ? COPY.brief.stakeGap(rmb(quota.gap), quota.achievement_rate != null ? String(quota.achievement_rate) : '—')
    : roi.expense_amount != null
      ? COPY.brief.stakeExpense(rmb(roi.expense_amount))
      : COPY.brief.stakeVisit(signed(visit.delta));

  const visitLine = visit.before != null && visit.after != null
    ? `拜访后处方从 ${visit.before} 掉到 ${visit.after}。`
    : '';
  const rootLine = visitLine ? '跟进断了，量跟着断。' : (attributed || '');
  const whoBits = [
    hospital && `在${hospital}`,
    rep && `由${rep}负责`,
    product && `处方${product}`,
  ].filter(Boolean).join('，');
  const story = [
    `${focalName}${whoBits ? `${whoBits}。` : '。'}`,
    downstream.length ? `他影响${downstream.join('、')}，一动下游会跟着动。` : '',
    visitLine,
    stakeLine,
    rootLine,
  ].filter(Boolean).join('');

  const yesEffects = ((caseAction?.actionDefinition as any)?.sideEffects || [])
    .map((raw: string) => EFFECT_LABELS[raw] || '')
    .filter(Boolean);

  const handleApprove = async (id: string) => {
    setActionError('');
    try {
      const result = await apiClient.approveAction(id, user?.id || '');
      if (result.status === 'blocked') {
        setActionError(COPY.brief.blockedSelf);
        return;
      }
      setShowEvidence(false);
      setFlash(COPY.brief.done);
      await reload();
      notifyHubChanged();
    } catch (err: any) {
      setActionError(err.message || '审批失败');
    }
  };

  const handleReject = async (id: string) => {
    setActionError('');
    try {
      await apiClient.rejectAction(id, user?.id || '');
      setShowEvidence(false);
      setFlash('已退回。');
      await reload();
      notifyHubChanged();
    } catch (err: any) {
      setActionError(err.message || '退回失败');
    }
  };

  if (loading) return <div className="text-sm text-gray-500 p-6">加载中…</div>;
  if (error) return <div className="text-sm text-rose-600 p-6">{error}</div>;

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<FileText className="text-brand-400" size={22} />}
        title={COPY.nav.brief}
        description={COPY.brief.kicker}
      />

      <div className="flex-1 min-h-0 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {focalName}
                <span className="text-gray-500 font-normal"> · {COPY.brief.falling}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">{focalObj ? typeLabel(focalObj.objectType) : '医生'} · 华东</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 shrink-0">
              {isSubmitter ? COPY.brief.waiting : COPY.brief.mustSign}
            </span>
          </div>

          <p className="text-[15px] text-gray-700 leading-relaxed mt-5">{story}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTabChange?.('ontology')}
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1"
            >
              <Network size={12} /> {COPY.brief.openGraph}
            </button>
            <button
              type="button"
              onClick={() => onTabChange?.('insights')}
              className="text-xs px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1"
            >
              <Sparkles size={12} /> {COPY.brief.seeWhy}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="text-xs font-semibold text-orange-800">{COPY.brief.ifNotTitle}</div>
              {quota.gap != null && Number(quota.gap) > 0 ? (
                <div className="text-2xl font-semibold tabular-nums text-orange-800 mt-2">{rmb(quota.gap)}</div>
              ) : null}
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{COPY.brief.ifNot(stakeLine)}</p>
            </div>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="text-xs font-semibold text-brand-700">{COPY.brief.ifYesTitle}</div>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{COPY.brief.ifYes(hours)}</p>
              {yesEffects.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {yesEffects.map((line: string) => (
                    <li key={line} className="text-xs text-gray-600 flex items-center gap-1.5">
                      <CheckCircle size={12} className="text-brand-500 shrink-0" /> {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => onTabChange?.('checked')} className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50">
              {COPY.brief.goChecked}
            </button>
            <button type="button" onClick={() => onTabChange?.('guard')} className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50">
              {COPY.brief.goGuard}
            </button>
            <button type="button" onClick={() => onTabChange?.('written')} className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50">
              {COPY.brief.goWritten}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{COPY.brief.loopHint}</p>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 mb-1">{COPY.brief.advice}</div>
            {flash ? (
              <div className="mt-2">
                <p className="text-sm text-emerald-700 font-medium">{flash}</p>
                <p className="text-xs text-gray-500 mt-1">{COPY.brief.doneHint}</p>
                <button
                  type="button"
                  onClick={() => onTabChange?.('written')}
                  className="mt-3 mr-4 text-sm text-brand-600 hover:text-brand-700"
                >
                  {COPY.brief.goWritten}
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange?.('effect')}
                  className="mt-3 text-sm text-brand-600 hover:text-brand-700"
                >
                  {COPY.brief.goEffect}
                </button>
              </div>
            ) : caseAction ? (
              <>
                <p className="text-base font-medium text-gray-900">{caseAction.title}</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{caseAction.description}</p>
                <p className="text-xs text-gray-500 mt-2">{COPY.brief.irreversible}</p>
                {actionError ? <p className="text-xs text-rose-600 mt-2">{actionError}</p> : null}
                {isSubmitter ? (
                  <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Shield size={16} /> {COPY.brief.blockedSelf}
                  </p>
                ) : (
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleReject(caseAction.id)}
                      className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
                    >
                      <XOctagon size={18} />
                      <span className="font-medium">{COPY.today.reject}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(caseAction.id)}
                      className="flex-[1.4] px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:from-brand-600 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      <span className="font-medium">{COPY.today.approve}</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowEvidence(true)}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-700"
                >
                  {evidenceCount ? COPY.today.evidenceCount(evidenceCount) : COPY.brief.seeEvidence}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">{COPY.brief.noPending}</p>
                <button type="button" onClick={() => onTabChange?.('chat')} className="mt-3 text-sm text-brand-600 hover:text-brand-700">
                  {COPY.brief.goAsk}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEvidence && caseAction ? (
          <ApproveModal
            action={caseAction}
            error={actionError}
            onClose={() => setShowEvidence(false)}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default BriefPage;
