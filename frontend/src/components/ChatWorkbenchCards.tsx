import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { COPY, visibleRowEntries, rowKeyLabel } from '../copy';

export interface WorkbenchAction {
  id: string;
  title: string;
  description?: string;
  status: 'executed' | 'pending' | 'failed';
  action_id?: string;
  action_type?: string;
  object_id?: string;
  requires_accept?: boolean;
  proposed_by?: string;
}

export interface WorkbenchDataCard {
  title: string;
  rows: Array<Record<string, unknown>>;
}

export interface FollowUp {
  label: string;
  query: string;
}

const STATUS_STYLE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  executed: { label: COPY.actionStatus.executed, className: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  pending: { label: COPY.actionStatus.pending, className: 'border-amber-200 bg-amber-50 text-amber-700', Icon: Clock },
  failed: { label: COPY.actionStatus.failed, className: 'border-rose-200 bg-rose-50 text-rose-700', Icon: XCircle },
};

export const ActionCards: React.FC<{
  actions: WorkbenchAction[];
  onApprove?: (actionId: string) => void;
  onAccept?: (action: WorkbenchAction) => void;
  disabled?: boolean;
  currentUserId?: string;
}> = ({ actions, onApprove, onAccept, disabled, currentUserId }) => {
  if (!actions.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {actions.map((action) => {
        const style = STATUS_STYLE[action.status] || STATUS_STYLE.pending;
        const Icon = style.Icon;
        const isSubmitter = Boolean(action.proposed_by && currentUserId && action.proposed_by === currentUserId);
        return (
          <div key={action.id} className={`rounded-xl border p-3 ${style.className}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Icon size={14} />
                <span>{action.title}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide">{style.label}</span>
            </div>
            {action.description ? (
              <p className="mt-1 text-xs opacity-80">{action.description}</p>
            ) : null}
            {action.status === 'pending' && action.action_id && isSubmitter ? (
              <p className="mt-2 text-xs">{COPY.today.needManager}</p>
            ) : null}
            {action.status === 'pending' && action.action_id && onApprove && !isSubmitter ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onApprove(action.action_id as string)}
                className="mt-2 text-xs px-2 py-1 rounded-lg bg-white/80 border border-current"
              >
                {COPY.today.approve}
              </button>
            ) : null}
            {action.requires_accept && onAccept ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAccept(action)}
                className="mt-2 text-xs px-2 py-1 rounded-lg bg-white/80 border border-current"
              >
                接受建议
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const DataCards: React.FC<{
  cards: WorkbenchDataCard[];
  onRowClick?: (row: Record<string, unknown>) => void;
}> = ({ cards, onRowClick }) => {
  if (!cards.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {cards.map((card, idx) => (
        <div key={`${card.title}-${idx}`} className="rounded-xl border border-gray-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">{card.title}</div>
          <div className="space-y-1">
            {(card.rows || []).map((row, ridx) => (
              <div
                key={String(row.id || ridx)}
                className={`text-[11px] text-gray-600 flex flex-wrap gap-x-3 ${onRowClick ? 'cursor-pointer hover:text-brand-600' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {visibleRowEntries(row)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <span key={k}>
                      <span className="text-gray-400">{rowKeyLabel(k)}</span> {String(v)}
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const FollowUpButtons: React.FC<{
  items: FollowUp[];
  onPick: (query: string) => void;
  disabled?: boolean;
}> = ({ items, onPick, disabled }) => {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(item.query)}
          className="text-xs px-2 py-1 rounded-lg border border-brand-200 bg-brand-50 text-brand-700"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

