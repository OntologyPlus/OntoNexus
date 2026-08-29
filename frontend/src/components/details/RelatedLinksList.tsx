import React from 'react';
import { ObjectLink } from '../../types';

interface RelatedLinksListProps {
  links: ObjectLink[];
  maxDisplay?: number;
}

const PROVENANCE_LABELS: Record<string, string> = {
  manual: '人工',
  auto: '自动',
  inferred: '推理',
};

const RelatedLinksList: React.FC<RelatedLinksListProps> = ({ links, maxDisplay = 5 }) => {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-xs font-bold text-gray-800 uppercase mb-2">关联关系 ({links.length})</div>
      <div className="space-y-2">
        {links.slice(0, maxDisplay).map((link, idx) => {
          const props = link.properties || {};
          const strength = typeof props.strength === 'number' ? props.strength : null;
          const confidence = typeof props.confidence === 'number' ? props.confidence : null;
          const provenance = typeof props.provenance === 'string' ? props.provenance : null;
          const validFrom = props.valid_from || props.validFrom;
          const validTo = props.valid_to || props.validTo;

          return (
            <div key={idx} className="text-xs p-2.5 bg-white rounded-lg border border-gray-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">{link.linkType}</span>
                <span className="text-gray-800">{link.targetName || link.targetId}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {strength !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">强度</span>
                    <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(Math.max(strength, 0), 1) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-500">{(strength * 100).toFixed(0)}%</span>
                  </div>
                )}

                {confidence !== null && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    confidence > 0.8
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : confidence > 0.5
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {confidence > 0.8 ? '高置信' : confidence > 0.5 ? '中置信' : '低置信'} {(confidence * 100).toFixed(0)}%
                  </span>
                )}

                {provenance && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200">
                    {PROVENANCE_LABELS[provenance] || provenance}
                  </span>
                )}
              </div>

              {(validFrom || validTo) && (
                <div className="text-[10px] text-gray-500">
                  {validFrom && validTo
                    ? `${validFrom} ~ ${validTo}`
                    : validFrom
                      ? `从 ${validFrom} 起`
                      : `至 ${validTo}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedLinksList;
