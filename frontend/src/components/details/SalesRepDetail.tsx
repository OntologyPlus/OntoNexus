import React from 'react';
import { OntologyObject } from '../../types';
import { User, MapPin, Phone, Mail } from 'lucide-react';
import TimeSeriesDisplay from './TimeSeriesDisplay';
import RelatedLinksList from './RelatedLinksList';

interface SalesRepDetailProps {
  obj: OntologyObject;
}

const SalesRepDetail: React.FC<SalesRepDetailProps> = ({ obj }) => {
  const props = obj.properties || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <User size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">职位</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.position || '销售代表'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <MapPin size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">负责区域</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.territory || props.region || '未分配'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Phone size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">电话</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.phone || '未设置'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Mail size={14} className="text-gray-800" />
            <span className="text-xs text-gray-800">邮箱</span>
          </div>
          <div className="text-sm font-medium text-gray-700 truncate">{props.email || '未设置'}</div>
        </div>
      </div>

      <TimeSeriesDisplay timeSeries={obj.timeSeries || {}} />

      <RelatedLinksList links={obj.links} />
    </div>
  );
};

export default SalesRepDetail;
