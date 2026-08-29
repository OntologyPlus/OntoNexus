import React from 'react';
import { OntologyObject } from '../../types';
import { Target, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import TimeSeriesDisplay from './TimeSeriesDisplay';
import RelatedLinksList from './RelatedLinksList';

interface SalesTargetDetailProps {
  obj: OntologyObject;
}

const SalesTargetDetail: React.FC<SalesTargetDetailProps> = ({ obj }) => {
  const props = obj.properties || {};
  const achievementRate = props.achievementRate || props.currentValue / props.targetValue * 100 || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Target size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">目标金额</span>
          </div>
          <div className="text-sm font-medium text-gray-700">¥{props.targetValue?.toLocaleString() || '1,000,000'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">当前完成</span>
          </div>
          <div className="text-sm font-medium text-gray-700">¥{props.currentValue?.toLocaleString() || '833,000'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <BarChart3 size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">达成率</span>
          </div>
          <div className={`text-sm font-bold ${achievementRate >= 100 ? 'text-emerald-400' : achievementRate >= 80 ? 'text-amber-700' : 'text-rose-700'}`}>
            {achievementRate.toFixed(1)}%
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">周期</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.period || 'Q1 2026'}</div>
        </div>
      </div>

      <TimeSeriesDisplay timeSeries={obj.timeSeries || {}} />

      <RelatedLinksList links={obj.links} />
    </div>
  );
};

export default SalesTargetDetail;
