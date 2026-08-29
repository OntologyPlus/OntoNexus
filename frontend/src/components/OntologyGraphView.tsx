import React, { useState } from 'react';
import OntologyGraph from './OntologyGraph';
import ObjectDetailPanel from './details';
import { OntologyObject } from '../types';
import { Activity, X, Filter, Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COPY } from '../copy';
import { useOntologyContext } from '../contexts/OntologyContext';

const DOMAIN_GROUPS = [
  {
    name: '核心域',
    color: 'blue',
    types: [
      { value: 'Doctor', label: '医生' },
      { value: 'Hospital', label: '医院' },
      { value: 'Product', label: '产品' },
      { value: 'SalesRep', label: '代表' },
      { value: 'VisitRecord', label: '拜访记录' },
      { value: 'SalesTarget', label: '销售目标' },
      { value: 'ComplianceAlert', label: '合规告警' },
      { value: 'AcademicEvent', label: '学术活动' },
      { value: 'Territory', label: '区域' },
      { value: 'RecoveryPlan', label: '恢复计划' },
    ],
  },
  {
    name: '收入目标管理',
    color: 'emerald',
    types: [
      { value: 'SalesFlow', label: '销售流' },
      { value: 'MarketPotential', label: '市场潜力' },
      { value: 'HospitalDevelopment', label: '医院开发' },
      { value: 'TerritoryPerformance', label: '区域绩效' },
      { value: 'ProductFlow', label: '产品流' },
    ],
  },
  {
    name: '费用管理',
    color: 'amber',
    types: [
      { value: 'BudgetCategory', label: '预算分类' },
      { value: 'ExpenseClassification', label: '费用分类' },
      { value: 'CostDriver', label: '成本驱动' },
      { value: 'LaborPayment', label: '劳务支付' },
      { value: 'ExpenseROI', label: '费用ROI' },
    ],
  },
  {
    name: '客户管理',
    color: 'purple',
    types: [
      { value: 'CustomerCategory', label: '客户分类' },
      { value: 'VisitFeedback', label: '拜访反馈' },
      { value: 'PDCAPlan', label: 'PDCA计划' },
      { value: 'HospitalStrategy', label: '医院策略' },
      { value: 'DepartmentResearch', label: '科室调研' },
    ],
  },
  {
    name: '医学事务',
    color: 'rose',
    types: [
      { value: 'RWSProject', label: 'RWS项目' },
      { value: 'ClinicalTrial', label: '临床试验' },
      { value: 'PatientProgram', label: '患者项目' },
      { value: 'ResearchCollaboration', label: '科研合作' },
    ],
  },
  {
    name: '合规管理',
    color: 'orange',
    types: [
      { value: 'MeetingCompliance', label: '会议合规' },
      { value: 'ExpenseCompliance', label: '费用合规' },
      { value: 'CustomerCompliance', label: '客户合规' },
      { value: 'ComplianceRule', label: '合规规则' },
    ],
  },
];

const TYPE_LABEL_MAP: Record<string, string> = {};
DOMAIN_GROUPS.forEach(g => g.types.forEach(t => { TYPE_LABEL_MAP[t.value] = t.label; }));

const DOMAIN_COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
  rose: 'text-rose-600',
  orange: 'text-orange-600',
};

const DOMAIN_BG_MAP: Record<string, string> = {
  blue: 'bg-blue-50',
  emerald: 'bg-emerald-50',
  amber: 'bg-amber-50',
  purple: 'bg-purple-50',
  rose: 'bg-rose-50',
  orange: 'bg-orange-50',
};

const DOMAIN_DOT_MAP: Record<string, string> = {
  blue: 'bg-blue-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  purple: 'bg-purple-400',
  rose: 'bg-rose-400',
  orange: 'bg-orange-400',
};

const OntologyGraphView: React.FC = () => {
  const [selectedObject, setSelectedObject] = useState<OntologyObject | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const { state } = useOntologyContext();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState(1);
  const graphContainerRef = React.useRef<HTMLDivElement>(null);

  const handleNodeClick = (node: OntologyObject) => {
    setSelectedObject(node);
    setShowTimeline(true);
  };

  const handleCloseTimeline = () => {
    setShowTimeline(false);
  };

  const filteredObjects = React.useMemo(() => {
    let result = state.objects;
    if (filterType !== 'all') {
      result = result.filter(o => o.objectType === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.objectType.toLowerCase().includes(q) ||
        (o.properties && Object.values(o.properties).some(v => String(v).toLowerCase().includes(q)))
      );
    }
    return result;
  }, [state.objects, filterType, searchQuery]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.3));
  };

  const handleFullscreen = () => {
    if (graphContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        graphContainerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="flex h-full">
      <div className={`flex-1 transition-all duration-300 ${showTimeline ? 'w-2/3' : 'w-full'}`}>
        <div className="h-full flex flex-col">
          <div className="bg-white backdrop-blur-xl border-b border-gray-100 p-5 z-10 sticky top-0 shadow-lg shadow-black/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <div className="p-2 bg-brand-500/15 rounded-xl mr-3 ring-1 ring-brand-500/20">
                    <Activity className="text-brand-400" size={20} />
                  </div>
                  {COPY.graph.title}
                </h2>
                {selectedObject && (
                  <div className="text-sm text-gray-800 bg-gray-50/60 px-3 py-1.5 rounded-full border border-gray-100 flex items-center backdrop-blur-sm">
                    <span className="mr-2">选中:</span>
                    <span className="font-semibold text-gray-600">{selectedObject.name}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2 bg-gray-50/60 p-1.5 rounded-xl border border-gray-100 backdrop-blur-sm">
                <button
                  onClick={() => { setShowSearch(!showSearch); setShowFilter(false); }}
                  className={`p-2 rounded-lg transition-all duration-300 ${showSearch ? 'text-brand-400 bg-white/10 shadow-sm' : 'text-gray-800 hover:text-brand-400 hover:bg-white/10 hover:shadow-sm'}`}
                  title="搜索"
                >
                  <Search size={18} />
                </button>
                <div className="w-px h-4 bg-white/15 mx-1"></div>
                <div className="relative">
                  <button
                    onClick={() => { setShowFilter(!showFilter); setShowSearch(false); }}
                    className={`p-2 rounded-lg transition-all duration-300 ${showFilter ? 'text-brand-400 bg-white/10 shadow-sm' : 'text-gray-800 hover:text-brand-400 hover:bg-white/10 hover:shadow-sm'}`}
                    title="筛选"
                  >
                    <Filter size={18} />
                  </button>
                  {showFilter && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="p-2 max-h-80 overflow-y-auto">
                        <button
                          onClick={() => { setFilterType('all'); setShowFilter(false); }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${filterType === 'all' ? 'bg-brand-500/10 text-brand-400 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          全部类型
                        </button>
                        {DOMAIN_GROUPS.map(group => (
                          <div key={group.name}>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 mt-1.5 mb-0.5 rounded-md ${DOMAIN_BG_MAP[group.color] || 'bg-gray-50'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${DOMAIN_DOT_MAP[group.color] || 'bg-gray-400'}`}></span>
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${DOMAIN_COLOR_MAP[group.color] || 'text-gray-600'}`}>{group.name}</span>
                            </div>
                            {group.types.map(t => (
                              <button
                                key={t.value}
                                onClick={() => { setFilterType(t.value); setShowFilter(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors pl-6 ${filterType === t.value ? 'bg-brand-500/10 text-brand-400 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-px h-4 bg-white/15 mx-1"></div>
                <button onClick={handleZoomIn} className="p-2 text-gray-800 hover:text-brand-400 hover:bg-white/10 hover:shadow-sm rounded-lg transition-all duration-300" title="放大">
                  <ZoomIn size={18} />
                </button>
                <button onClick={handleZoomOut} className="p-2 text-gray-800 hover:text-brand-400 hover:bg-white/10 hover:shadow-sm rounded-lg transition-all duration-300" title="缩小">
                  <ZoomOut size={18} />
                </button>
                <span className="text-xs text-gray-700 min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                <div className="w-px h-4 bg-white/15 mx-1"></div>
                <button onClick={handleFullscreen} className="p-2 text-gray-800 hover:text-brand-400 hover:bg-white/10 hover:shadow-sm rounded-lg transition-all duration-300" title="全屏">
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="mt-4 flex items-center text-xs text-gray-800 bg-brand-500/10 p-2.5 rounded-lg border border-brand-500/25 shadow-glow">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2 animate-pulse"></div>
              点击图谱中的节点查看详细信息和时间轴
            </div>
            
            {showSearch && (
              <div className="mt-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索节点名称、类型或属性..."
                    className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <div className="mt-1 text-xs text-gray-800">
                    找到 {filteredObjects.length} 个匹配节点
                    {filterType !== 'all' && ` (筛选: ${TYPE_LABEL_MAP[filterType] || filterType})`}
                  </div>
                )}
              </div>
            )}
            
            {(filterType !== 'all' || searchQuery) && !showSearch && (
              <div className="mt-3 flex items-center gap-2">
                {filterType !== 'all' && (
                  <span className="text-xs px-2 py-1 bg-brand-500/10 text-brand-400 rounded-md border border-brand-500/20 flex items-center gap-1">
                    筛选: {TYPE_LABEL_MAP[filterType] || filterType}
                    <button onClick={() => setFilterType('all')} className="hover:text-brand-600">
                      <X size={10} />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md border border-blue-200 flex items-center gap-1">
                    搜索: {searchQuery}
                    <button onClick={() => setSearchQuery('')} className="hover:text-blue-800">
                      <X size={10} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 bg-gray-50/30 p-6 overflow-hidden" ref={graphContainerRef}>
            <div className="w-full h-full bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden backdrop-blur-sm" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}>
              <OntologyGraph objects={filteredObjects} onNodeClick={handleNodeClick} />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showTimeline && selectedObject && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '33.333%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white border-l border-gray-100 overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/5"
          >
            <div className="h-full flex flex-col">
              <div className="bg-white border-b border-gray-100 p-5 sticky top-0 z-10 shadow-md shadow-black/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {selectedObject.name}
                    </h3>
                    <div className="flex items-center text-xs font-medium text-gray-800 space-x-2">
                      <span className="bg-brand-500/15 text-brand-400 px-2 py-0.5 rounded-md border border-brand-500/25 font-medium">{TYPE_LABEL_MAP[selectedObject.objectType] || selectedObject.objectType}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseTimeline}
                    className="p-2 text-gray-800 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors"
                    title="关闭时间轴"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 bg-gray-50/30">
                <ObjectDetailPanel selectedObject={selectedObject} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OntologyGraphView;