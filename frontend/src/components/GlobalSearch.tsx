import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Building2, User, Package, Target, AlertCircle, Cloud, Database } from 'lucide-react';
import { useOntologyContext } from '../contexts/OntologyContext';
import { OntologyObject } from '../types';
import { apiClient } from '../api';

interface GlobalSearchProps {
  onSelectObject: (object: OntologyObject) => void;
}

interface SearchResult extends OntologyObject {
  _source?: 'local' | 'backend';
}

const objectTypeLabels: Record<string, string> = {
  Doctor: '医生',
  Hospital: '医院',
  Product: '产品',
  SalesRep: '代表',
  SalesTarget: '销售目标',
  ComplianceAlert: '合规告警',
  BudgetCategory: '预算分类',
  VisitRecord: '拜访记录',
  RecoveryPlan: '恢复计划',
  Territory: '区域',
  CustomerCategory: '客户分类',
  PDCAPlan: 'PDCA计划',
  RWSProject: 'RWS项目',
  AcademicEvent: '学术活动',
  ActionItem: '行动项',
  VisitBrief: '拜访简报',
  CoachingNote: '辅导记录',
  SalesFlow: '销售流向',
  MarketPotential: '市场潜力',
  HospitalDevelopment: '医院开发',
  TerritoryPerformance: '区域绩效',
  ProductFlow: '产品流向',
  ExpenseClassification: '费用分类',
  CostDriver: '成本驱动',
  LaborPayment: '劳务支付',
  ExpenseROI: '费用ROI',
  VisitFeedback: '拜访反馈',
  HospitalStrategy: '医院策略',
  DepartmentResearch: '科室调研',
  ClinicalTrial: '临床试验',
  PatientProgram: '患者项目',
  ResearchCollaboration: '研究合作',
  MeetingCompliance: '会议合规',
  ExpenseCompliance: '费用合规',
  CustomerCompliance: '客户合规',
  ComplianceRule: '合规规则',
};

const BACKEND_SEARCH_TYPES = ['Doctor', 'Hospital', 'Product', 'SalesRep'];

const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSelectObject }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [backendResults, setBackendResults] = useState<SearchResult[]>([]);
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const { state } = useOntologyContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return state.objects
      .filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.objectType.toLowerCase().includes(q) ||
        (objectTypeLabels[o.objectType] || '').includes(q)
      )
      .slice(0, 8)
      .map(o => ({ ...o, _source: 'local' as const }));
  }, [query, state.objects]);

  const searchBackend = useCallback(async (q: string) => {
    if (!q.trim()) {
      setBackendResults([]);
      return;
    }
    setIsSearchingBackend(true);
    try {
      const allResults: SearchResult[] = [];
      const searches = BACKEND_SEARCH_TYPES.map(type =>
        apiClient.searchOntologyObjects(type, q).catch(() => [])
      );
      const responses = await Promise.all(searches);
      responses.forEach((results, idx) => {
        if (Array.isArray(results)) {
          results.forEach((r: any) => {
            allResults.push({
              id: r.id,
              objectType: r.objectType || BACKEND_SEARCH_TYPES[idx],
              name: r.name || r.properties?.name || '',
              properties: r.properties || {},
              links: r.links || [],
              actions: r.actions || [],
              events: r.events || [],
              timeSeries: r.timeSeries || {},
              interfaces: r.interfaces || [],
              _source: 'backend' as const,
            });
          });
        }
      });
      setBackendResults(allResults.slice(0, 8));
    } catch {
      setBackendResults([]);
    } finally {
      setIsSearchingBackend(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchBackend(query);
      }, 300);
    } else {
      setBackendResults([]);
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchBackend]);

  const mergedResults = useMemo(() => {
    if (!query.trim()) return [];
    const seen = new Map<string, SearchResult>();
    for (const r of localResults) {
      seen.set(r.id, r);
    }
    for (const r of backendResults) {
      if (!seen.has(r.id)) {
        seen.set(r.id, r);
      }
    }
    return Array.from(seen.values()).slice(0, 12);
  }, [query, localResults, backendResults]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'Doctor': return <User size={14} className="text-blue-500" />;
      case 'Hospital': return <Building2 size={14} className="text-emerald-500" />;
      case 'Product': return <Package size={14} className="text-purple-500" />;
      case 'SalesTarget': return <Target size={14} className="text-amber-500" />;
      case 'ComplianceAlert': return <AlertCircle size={14} className="text-rose-500" />;
      default: return <Search size={14} className="text-slate-400" />;
    }
  };

  const handleSelect = (obj: SearchResult) => {
    const { _source, ...ontologyObj } = obj;
    onSelectObject(ontologyObj as OntologyObject);
    setQuery('');
    setIsOpen(false);
    setBackendResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          placeholder="搜索对象..."
          className="bg-slate-100 border border-slate-200 focus:bg-white focus:border-medical-400 rounded-lg py-1.5 pl-9 pr-8 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-medical-50 w-56 transition-all duration-200"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); setBackendResults([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && mergedResults.length > 0 && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 px-2">找到 {mergedResults.length} 个结果</span>
            {isSearchingBackend && (
              <span className="text-xs text-blue-500 px-2 flex items-center gap-1">
                <Cloud size={10} className="animate-pulse" /> 搜索后端...
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {mergedResults.map(obj => (
              <button
                key={`${obj.id}-${obj._source}`}
                onClick={() => handleSelect(obj)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
              >
                {getIcon(obj.objectType)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{obj.name}</div>
                  <div className="text-xs text-slate-500">{objectTypeLabels[obj.objectType] || obj.objectType}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {obj._source === 'backend' ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-0.5">
                      <Cloud size={8} /> 后端
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-0.5">
                      <Database size={8} /> 本地
                    </span>
                  )}
                  {obj.status && obj.status !== 'normal' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      obj.status === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {obj.status === 'critical' ? '危急' : '警告'}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() && mergedResults.length === 0 && !isSearchingBackend && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 p-4 text-center">
          <p className="text-sm text-slate-500">未找到匹配的对象</p>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
