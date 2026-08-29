import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail?: string;
  rightContent?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, description, detail, rightContent }) => {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-brand-500/10 rounded-xl ring-1 ring-brand-500/20 flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            {title}
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">{description}</p>
          {detail && (
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1 transition-colors"
            >
              {showDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showDetail ? '收起详情' : '了解更多'}
            </button>
          )}
          {detail && showDetail && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">{detail}</p>
          )}
        </div>
      </div>
      {rightContent && <div>{rightContent}</div>}
    </div>
  );
};

export default PageHeader;
