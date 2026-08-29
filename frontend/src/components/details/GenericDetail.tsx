import React from 'react';
import { OntologyObject } from '../../types';
import RelatedLinksList from './RelatedLinksList';
import TimeSeriesDisplay from './TimeSeriesDisplay';
import { Check, X, Clock, Activity, Shield, HeartPulse } from 'lucide-react';
import { typeLabel } from '../../copy';

interface GenericDetailProps {
  obj: OntologyObject;
}

function formatValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-300">—</span>;
  }

  if (typeof value === 'boolean') {
    return value ? (
      <Check size={14} className="text-green-600" />
    ) : (
      <X size={14} className="text-red-500" />
    );
  }

  if (typeof value === 'number') {
    return (
      <span className="font-mono text-right tabular-nums">
        {value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-300">—</span>;
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span
              key={i}
              className="inline-block px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded"
            >
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return <span className="text-xs text-gray-500">{JSON.stringify(value)}</span>;
  }

  if (typeof value === 'object') {
    return <span className="text-xs text-gray-500">{JSON.stringify(value)}</span>;
  }

  return <span>{String(value)}</span>;
}

function valueAlignment(value: unknown): string {
  if (typeof value === 'number') return 'text-right';
  return '';
}

const STATUS_STYLES: Record<string, string> = {
  normal: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const LIFECYCLE_STYLES: Record<string, string> = {
  prospect: 'bg-blue-50 text-blue-700 border-blue-200',
  developing: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  mature: 'bg-green-50 text-green-700 border-green-200',
  at_risk: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  churned: 'bg-red-50 text-red-700 border-red-200',
};

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-green-50 text-green-700 border-green-200',
  neutral: 'bg-gray-50 text-gray-700 border-gray-200',
  negative: 'bg-red-50 text-red-700 border-red-200',
};

const COMPLIANCE_STYLES: Record<string, string> = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-red-50 text-red-700 border-red-200',
};

const GenericDetail: React.FC<GenericDetailProps> = ({ obj }) => {
  const propertyEntries = Object.entries(obj.properties || {});

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
        <div className="text-xs font-bold text-gray-800 uppercase mb-3">基本信息</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">类型</span>
            <span className="text-gray-800 font-medium">{typeLabel(obj.objectType)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">名称</span>
            <span className="text-gray-800 font-medium">{obj.name}</span>
          </div>
        </div>

        {(obj.status || obj.lifecycleStage || obj.sentiment || obj.complianceRiskLevel) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
            {obj.status && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${STATUS_STYLES[obj.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
              >
                <Activity size={10} />
                {obj.status}
              </span>
            )}
            {obj.lifecycleStage && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${LIFECYCLE_STYLES[obj.lifecycleStage] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
              >
                <HeartPulse size={10} />
                {obj.lifecycleStage}
              </span>
            )}
            {obj.sentiment && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${SENTIMENT_STYLES[obj.sentiment] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
              >
                {obj.sentiment === 'positive' ? '😊' : obj.sentiment === 'negative' ? '😟' : '😐'}
                {obj.sentiment}
              </span>
            )}
            {obj.complianceRiskLevel && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${COMPLIANCE_STYLES[obj.complianceRiskLevel] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
              >
                <Shield size={10} />
                {obj.complianceRiskLevel}
              </span>
            )}
          </div>
        )}
      </div>

      {propertyEntries.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-xs font-bold text-gray-800 uppercase mb-3">属性</div>
          <div className="space-y-1.5">
            {propertyEntries.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between text-sm gap-4">
                <span className="text-gray-500 shrink-0 min-w-[80px]">{key}</span>
                <span className={`text-gray-800 break-all ${valueAlignment(value)}`}>
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {obj.events && obj.events.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-xs font-bold text-gray-800 uppercase mb-3">事件</div>
          <div className="relative pl-4 border-l-2 border-gray-200 space-y-3">
            {obj.events.map((event) => (
              <div key={event.id} className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-400 border-2 border-white" />
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(event.timestamp).toLocaleString('zh-CN')}
                  <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px]">
                    {event.eventType}
                  </span>
                </div>
                <div className="text-sm text-gray-700 mt-0.5">{event.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {obj.timeSeries && Object.keys(obj.timeSeries).length > 0 && (
        <TimeSeriesDisplay timeSeries={obj.timeSeries} />
      )}

      {obj.links && obj.links.length > 0 && <RelatedLinksList links={obj.links} />}
    </div>
  );
};

export default GenericDetail;
