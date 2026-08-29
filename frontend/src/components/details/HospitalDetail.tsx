import React from 'react';
import { OntologyObject } from '../../types';
import { Building2, MapPin, Users, TrendingUp, ShieldCheck, ShoppingCart, DollarSign, BedDouble } from 'lucide-react';
import TimeSeriesDisplay from './TimeSeriesDisplay';
import RelatedLinksList from './RelatedLinksList';

interface HospitalDetailProps {
  obj: OntologyObject;
}

const HospitalDetail: React.FC<HospitalDetailProps> = ({ obj }) => {
  const props = obj.properties || {};

  const accessStatusConfig: Record<string, { label: string; className: string }> = {
    已准入: { label: '已准入', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    准入中: { label: '准入中', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    未准入: { label: '未准入', className: 'bg-rose-50 text-rose-700 border-rose-200' },
    pending: { label: '准入中', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: '已准入', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: '未准入', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  const accessStatus = props.access_status || '已准入';
  const statusConfig = accessStatusConfig[accessStatus] || { label: accessStatus, className: 'bg-gray-50 text-gray-700 border-gray-200' };

  const formatNumber = (val: any) => {
    if (typeof val === 'number') return val.toLocaleString();
    return val || '-';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Building2 size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">医院等级</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.level || '三级甲等'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <ShieldCheck size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">准入状态</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <ShoppingCart size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">采购模式</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.procurement_mode || '集中采购'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">年收入</span>
          </div>
          <div className="text-sm font-medium text-gray-700">¥{formatNumber(props.annual_revenue || '5.2亿')}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <BedDouble size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">床位数</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{formatNumber(props.beds || '1,200')}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Users size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">医生数</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.doctorCount || obj.links.filter(l => l.targetType === 'Doctor').length || 0}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 col-span-2">
          <div className="flex items-center space-x-2 mb-1">
            <MapPin size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">位置</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.location || props.address || '上海市浦东新区'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">状态</span>
          </div>
          <div className={`text-sm font-medium ${obj.status === 'critical' ? 'text-rose-700' : obj.status === 'warning' ? 'text-amber-700' : 'text-emerald-600'}`}>
            {obj.status === 'critical' ? '危急' : obj.status === 'warning' ? '警告' : '正常'}
          </div>
        </div>
      </div>

      <TimeSeriesDisplay timeSeries={obj.timeSeries || {}} />

      <RelatedLinksList links={obj.links} />
    </div>
  );
};

export default HospitalDetail;
