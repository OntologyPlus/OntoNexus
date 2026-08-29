import React from 'react';
import { OntologyObject } from '../../types';
import { Package, TrendingUp, BarChart3, AlertCircle, Tag, DollarSign, PieChart, Receipt } from 'lucide-react';
import TimeSeriesDisplay from './TimeSeriesDisplay';
import RelatedLinksList from './RelatedLinksList';

interface ProductDetailProps {
  obj: OntologyObject;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ obj }) => {
  const props = obj.properties || {};

  const formatNumber = (val: any) => {
    if (typeof val === 'number') return val.toLocaleString();
    return val || '-';
  };

  const formatPercent = (val: any) => {
    if (typeof val === 'number') return `${(val * 100).toFixed(1)}%`;
    if (typeof val === 'string' && val.includes('%')) return val;
    return val ? `${val}%` : '-';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Package size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">产品类型</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.type || props.category || '处方药'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Tag size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">品类</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.category || props.type || '心血管'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">销售额</span>
          </div>
          <div className="text-sm font-medium text-gray-700">¥{formatNumber(props.sales || props.salesVolume || props.revenue || '0')}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <PieChart size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">市场份额</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{formatPercent(props.market_share || props.marketShare)}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <Receipt size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">价格</span>
          </div>
          <div className="text-sm font-medium text-gray-700">¥{formatNumber(props.price || '-')}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">生命周期</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{obj.lifecycleStage || '成熟期'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <BarChart3 size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">销售趋势</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{props.salesTrend || '稳定'}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle size={14} className="text-gray-500" />
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

export default ProductDetail;
