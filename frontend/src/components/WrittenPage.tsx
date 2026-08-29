import React from 'react';
import { CheckCircle, PenLine } from 'lucide-react';
import PageHeader from './PageHeader';
import { COPY } from '../copy';
import { useHubOverview } from '../hooks/useHubOverview';

interface WrittenPageProps {
  onTabChange?: (tab: string) => void;
}

const WrittenPage: React.FC<WrittenPageProps> = ({ onTabChange }) => {
  const { overview, loading, error } = useHubOverview();
  const writes: {
    id: string;
    title: string;
    status: string;
    entity_name?: string;
    effects?: string[];
    error?: string;
    at?: string;
  }[] = overview?.loop?.writes || [];

  return (
    <div className="h-full flex flex-col max-w-[1100px] mx-auto w-full px-4">
      <PageHeader
        icon={<PenLine className="text-brand-400" size={22} />}
        title={COPY.nav.written}
        description={COPY.written.description}
      />
      {loading ? (
        <div className="text-sm text-gray-500">加载中…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : writes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-sm text-gray-600">{COPY.written.empty}</p>
          <button
            type="button"
            onClick={() => onTabChange?.('brief')}
            className="mt-4 text-sm text-brand-600 hover:text-brand-700"
          >
            {COPY.written.goSign}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pb-8">
          {writes.map((row) => (
            <div key={row.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-gray-900">{row.title}</h3>
                  {row.entity_name ? <p className="text-xs text-gray-500 mt-1">{row.entity_name}</p> : null}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  row.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {row.status === 'failed' ? COPY.written.failed : COPY.written.done}
                </span>
              </div>
              {(row.effects || []).length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {row.effects!.map((line) => (
                    <li key={line} className="text-sm text-gray-700 flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-600 shrink-0" /> {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              {row.error ? <p className="text-sm text-rose-600 mt-2">{row.error}</p> : null}
              {row.at ? (
                <p className="text-xs text-gray-400 mt-3">{COPY.written.when} {new Date(row.at).toLocaleString('zh-CN')}</p>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onTabChange?.('effect')}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            {COPY.written.next}
          </button>
        </div>
      )}
    </div>
  );
};

export default WrittenPage;
