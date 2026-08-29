
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ObjectType, OntologyObject, OntologyAction } from '../types';
import { X, ChevronRight, Play, Lightbulb, Network, Sparkles, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionScenario, DecisionDomain, DecisionType, TimeHorizon, DecisionStatus, SpatialScope } from '../decision/DecisionOntology';
import { ImplicitRelation } from '../inference';
import GraphRelationsPanel from './graph/GraphRelationsPanel';
import { useGraphCompute } from './graph/useGraphCompute';

interface OntologyGraphProps {
  objects: OntologyObject[];
  onNodeClick?: (node: OntologyObject) => void;
  onActionExecute?: (action: OntologyAction, objectId: string) => void;
  onDecisionGenerate?: (scenario: DecisionScenario) => void;
}

// 影响传播路径
interface ImpactPath {
  id: string;
  source: string;
  target: string;
  impact: number;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
}

// Color mapping for SVG text (actual hex values, not Tailwind classes)
// 医药行业配色：专业蓝 + 健康绿 + 警戒红/橙
const OBJECT_TYPE_COLORS: Record<ObjectType, { bg: string; border: string; text: string; textColor: string }> = {
  // 核心域
  [ObjectType.Doctor]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#1e40af' },
  [ObjectType.Hospital]: { bg: 'bg-white', border: 'border-emerald-200', text: 'text-emerald-700', textColor: '#047857' },
  [ObjectType.Product]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#2563eb' },
  [ObjectType.SalesRep]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#475569' },
  [ObjectType.VisitRecord]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#1e40af' },
  [ObjectType.SalesTarget]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', textColor: '#dc2626' },
  [ObjectType.ComplianceAlert]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', textColor: '#dc2626' },
  [ObjectType.AcademicEvent]: { bg: 'bg-white', border: 'border-amber-200', text: 'text-amber-700', textColor: '#b45309' },
  [ObjectType.Territory]: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
  [ObjectType.RecoveryPlan]: { bg: 'bg-white', border: 'border-amber-200', text: 'text-amber-700', textColor: '#d97706' },
  [ObjectType.ActionItem]: { bg: 'bg-white', border: 'border-emerald-200', text: 'text-emerald-700', textColor: '#047857' },
  [ObjectType.VisitBrief]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#1e40af' },
  [ObjectType.CoachingNote]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
  // 收入目标管理域
  [ObjectType.SalesFlow]: { bg: 'bg-white', border: 'border-emerald-200', text: 'text-emerald-700', textColor: '#047857' },
  [ObjectType.MarketPotential]: { bg: 'bg-white', border: 'border-amber-200', text: 'text-amber-700', textColor: '#d97706' },
  [ObjectType.HospitalDevelopment]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', textColor: '#dc2626' },
  [ObjectType.TerritoryPerformance]: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
  [ObjectType.ProductFlow]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#2563eb' },
  // 费用管理域
  [ObjectType.BudgetCategory]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#475569' },
  [ObjectType.ExpenseClassification]: { bg: 'bg-white', border: 'border-amber-200', text: 'text-amber-700', textColor: '#b45309' },
  [ObjectType.CostDriver]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
  [ObjectType.LaborPayment]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#475569' },
  [ObjectType.ExpenseROI]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
  // 客户管理域
  [ObjectType.CustomerCategory]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#475569' },
  [ObjectType.VisitFeedback]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#1e40af' },
  [ObjectType.PDCAPlan]: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', textColor: '#b45309' },
  [ObjectType.HospitalStrategy]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#1e40af' },
  [ObjectType.DepartmentResearch]: { bg: 'bg-white', border: 'border-emerald-200', text: 'text-emerald-700', textColor: '#047857' },
  // 医学事务域
  [ObjectType.RWSProject]: { bg: 'bg-white', border: 'border-blue-200', text: 'text-blue-700', textColor: '#2563eb' },
  [ObjectType.ClinicalTrial]: { bg: 'bg-white', border: 'border-emerald-200', text: 'text-emerald-700', textColor: '#047857' },
  [ObjectType.PatientProgram]: { bg: 'bg-white', border: 'border-emerald-200', text: 'text-emerald-700', textColor: '#047857' },
  [ObjectType.ResearchCollaboration]: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
  // 合规管理域
  [ObjectType.MeetingCompliance]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', textColor: '#dc2626' },
  [ObjectType.ExpenseCompliance]: { bg: 'bg-white', border: 'border-amber-200', text: 'text-amber-700', textColor: '#b45309' },
  [ObjectType.CustomerCompliance]: { bg: 'bg-white', border: 'border-amber-200', text: 'text-amber-700', textColor: '#b45309' },
  [ObjectType.ComplianceRule]: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', textColor: '#64748b' },
};

const LINK_TYPE_COLORS: Record<string, string> = {
  WORKS_AT: 'stroke-blue-400',
  PRESCRIBES: 'stroke-purple-400',
  MANAGED_BY: 'stroke-orange-400',
  INFLUENCES: 'stroke-yellow-400',
  BELONGS_TO: 'stroke-gray-400',
  HAS_VISIT: 'stroke-cyan-400',
  HAS_ALERT: 'stroke-red-400',
  ATTENDED: 'stroke-green-400',
  PARTICIPATES_IN: 'stroke-teal-400',
};

const DOMAIN_GROUPS = [
  {
    name: '核心域',
    color: 'blue',
    textColor: '#2563eb',
    bgColor: '#eff6ff',
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
    textColor: '#059669',
    bgColor: '#ecfdf5',
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
    textColor: '#d97706',
    bgColor: '#fffbeb',
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
    textColor: '#7c3aed',
    bgColor: '#f5f3ff',
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
    textColor: '#e11d48',
    bgColor: '#fff1f2',
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
    textColor: '#ea580c',
    bgColor: '#fff7ed',
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

const OntologyGraph: React.FC<OntologyGraphProps> = ({ objects, onNodeClick, onActionExecute, onDecisionGenerate }) => {
  const [selectedObject, setSelectedObject] = useState<OntologyObject | null>(null);
  const [activeTab, setActiveTab] = useState<'properties' | 'links' | 'actions' | 'events' | 'timeseries' | 'impact' | 'relations'>('properties');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: OntologyObject } | null>(null);
  const [showImpactPropagation, setShowImpactPropagation] = useState(false);
  const [impactPaths, setImpactPaths] = useState<ImpactPath[]>([]);
  const [generatedScenario, setGeneratedScenario] = useState<DecisionScenario | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<ImplicitRelation | null>(null);
  const [highlightRiskPaths, setHighlightRiskPaths] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<OntologyObject | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showGuide, setShowGuide] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 700 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const { positions, miningResult } = useGraphCompute(objects, containerSize.width, containerSize.height);

  const handleNodeClick = (node: OntologyObject) => {
    setSelectedObject(node);
    onNodeClick?.(node);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, node: OntologyObject) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !selectedObject) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panStartOffset.current = { ...pan };
    }
  }, [pan, selectedObject]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStartOffset.current.x + dx, y: panStartOffset.current.y + dy });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(3, prev * 1.2));
  const handleZoomOut = () => setZoom(prev => Math.max(0.2, prev / 1.2));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.2, Math.min(3, prev * delta)));
  }, []);

  // 生成决策场景
  const generateDecisionScenario = (node: OntologyObject): DecisionScenario => {
    let domain = DecisionDomain.REVENUE;
    let name = '资源优化决策';
    let description = `针对 ${node.name} 的优化决策建议`;

    switch (node.objectType) {
      case 'Doctor':
        domain = DecisionDomain.CUSTOMER;
        name = node.status === 'critical' ? '客户挽留决策' : '客户关系深化决策';
        description = node.status === 'critical'
          ? `${node.name} 存在流失风险，需要制定紧急挽留策略`
          : `${node.name} 是重要客户，需要制定关系深化策略`;
        break;
      case 'Hospital':
        domain = DecisionDomain.REVENUE;
        name = '医院开发策略决策';
        description = `针对 ${node.name} 的开发策略和资源投入决策`;
        break;
      case 'SalesRep':
        domain = DecisionDomain.REVENUE;
        name = '代表效能提升决策';
        description = `${node.name} 的业绩优化和资源配置决策`;
        break;
      case 'ComplianceAlert':
        domain = DecisionDomain.COMPLIANCE;
        name = '合规风险应对决策';
        description = `针对 ${node.name} 的合规风险应对措施`;
        break;
      case 'ExpenseClassification':
        domain = DecisionDomain.EXPENSE;
        name = '费用优化决策';
        description = `${node.name} 的费用控制和优化决策`;
        break;
    }

    const scenario: DecisionScenario = {
      id: `scenario_${node.id}_${Date.now()}`,
      name,
      description,
      context: {
        id: `ctx_${Date.now()}`,
        type: node.status === 'critical' ? DecisionType.OPERATIONAL : DecisionType.TACTICAL,
        domain,
        timeHorizon: node.status === 'critical' ? TimeHorizon.IMMEDIATE : TimeHorizon.SHORT_TERM,
        spatialScope: SpatialScope.INDIVIDUAL,
        stakeholders: [],
        constraints: [],
        objectives: [
          {
            id: 'obj1',
            name: '优化目标',
            description: '实现最优决策效果',
            target: 100,
            weight: 0.5,
            priority: node.status === 'critical' ? 'high' : 'medium',
            metrics: ['effectiveness', 'efficiency']
          }
        ],
        relatedEntities: [node],
        historicalDecisions: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          urgency: node.status === 'critical' ? 90 : 60,
          importance: node.status === 'critical' ? 95 : 70,
          tags: [domain, node.objectType]
        }
      },
      alternatives: [
        {
          id: 'alt1',
          name: '积极策略',
          description: '增加资源投入，主动干预',
          actions: [],
          expectedOutcomes: [],
          risks: [],
          resourceRequirements: []
        },
        {
          id: 'alt2',
          name: '保守策略',
          description: '维持现状，观察发展',
          actions: [],
          expectedOutcomes: [],
          risks: [],
          resourceRequirements: []
        }
      ],
      evaluationCriteria: [],
      confidence: node.status === 'critical' ? 0.85 : 0.75,
      status: DecisionStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return scenario;
  };

  // 计算影响传播路径
  const calculateImpactPropagation = (node: OntologyObject): ImpactPath[] => {
    const paths: ImpactPath[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; sourceImpact: number }> = [{ id: node.id, depth: 0, sourceImpact: 1 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > 2) continue;
      visited.add(current.id);

      const currentNode = objects.find(n => n.id === current.id);
      if (!currentNode) continue;

      currentNode.links.forEach(link => {
        const impact = current.sourceImpact * (link.properties?.strength || 0.5);
        paths.push({
          id: `${current.id}-${link.targetId}`,
          source: current.id,
          target: link.targetId,
          impact,
          type: impact > 0.6 ? 'positive' : impact > 0.3 ? 'neutral' : 'negative',
          description: `${currentNode.name} → ${link.targetName}`
        });

        if (!visited.has(link.targetId)) {
          queue.push({ id: link.targetId, depth: current.depth + 1, sourceImpact: impact });
        }
      });
    }

    return paths;
  };

  const handleNodeHover = useCallback((node: OntologyObject, event: React.MouseEvent) => {
    setHoveredNode(node);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const handleGenerateDecision = () => {
    if (!contextMenu) return;
    const scenario = generateDecisionScenario(contextMenu.node);
    setGeneratedScenario(scenario);
    onDecisionGenerate?.(scenario);
    closeContextMenu();
  };

  const handleShowImpactPropagation = () => {
    if (!contextMenu) return;
    const paths = calculateImpactPropagation(contextMenu.node);
    setImpactPaths(paths);
    setShowImpactPropagation(true);
    setSelectedObject(contextMenu.node);
    setActiveTab('impact');
    closeContextMenu();
  };

  const renderImpactPropagation = () => {
    if (!selectedObject || impactPaths.length === 0) {
      return (
        <div className="text-center py-8 text-gray-800">
          <Network size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">右键点击节点查看影响传播</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-brand-500/8 rounded-lg p-3 border border-brand-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Network size={16} className="text-brand-400" />
            <span className="font-medium text-brand-400">影响传播分析</span>
          </div>
          <p className="text-xs text-brand-400/80">
            从 <strong>{selectedObject.name}</strong> 出发的影响传播路径
          </p>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {impactPaths.map((path, index) => {
            const sourceNode = objects.find(n => n.id === path.source);
            const targetNode = objects.find(n => n.id === path.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <div key={path.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                <span className="text-xs text-gray-800 w-6">{index + 1}</span>
                <span className="font-medium text-gray-600">{sourceNode.name}</span>
                <ChevronRight size={14} className="text-gray-800" />
                <span className="font-medium text-gray-600">{targetNode.name}</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  path.type === 'positive' ? 'bg-white0/10 text-emerald-400' :
                  path.type === 'negative' ? 'bg-white text-rose-700' :
                  'bg-white/5 text-gray-800'
                }`}>
                  {(path.impact * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white0/10 rounded p-2">
              <div className="text-xs text-emerald-400">正向影响</div>
              <div className="text-lg font-bold text-emerald-400">
                {impactPaths.filter(p => p.type === 'positive').length}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs text-gray-800">中性影响</div>
              <div className="text-lg font-bold text-gray-600">
                {impactPaths.filter(p => p.type === 'neutral').length}
              </div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-xs text-rose-700">负向影响</div>
              <div className="text-lg font-bold text-rose-700">
                {impactPaths.filter(p => p.type === 'negative').length}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedObject) return null;

    const colors = OBJECT_TYPE_COLORS[selectedObject.objectType];

    return (
      <AnimatePresence>
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className="absolute top-4 right-4 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20"
        >
          <div className={`p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50`}>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className={`w-3 h-3 rounded-full ${colors.bg} border-2 ${colors.border}`}></span>
                <h3 className="font-bold text-gray-700">{selectedObject.name}</h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}>{TYPE_LABEL_MAP[selectedObject.objectType] || selectedObject.objectType}</span>
            </div>
            <button onClick={() => setSelectedObject(null)} className="text-gray-800 hover:text-gray-800 p-1 hover:bg-gray-50 rounded">
              <X size={16} />
            </button>
          </div>

          <div className="flex border-b border-gray-100 bg-white overflow-x-auto">
            {(['properties', 'links', 'actions', 'impact', 'relations'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors whitespace-nowrap px-3 ${
                  activeTab === tab
                    ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-500/5'
                    : 'text-gray-800 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab === 'properties' ? '属性' :
                 tab === 'links' ? '关联' :
                 tab === 'actions' ? '动作' :
                 tab === 'impact' ? '影响传播' :
                 tab === 'relations' ? '隐含关系' : '时序'}
              </button>
            ))}
          </div>

          <div className="p-4 max-h-80 overflow-y-auto bg-white">
            {activeTab === 'properties' && (
              <div className="space-y-3">
                {Object.entries(selectedObject.properties).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-800 capitalize font-medium">{key}</span>
                    <span className="text-gray-700 font-medium truncate max-w-[60%] text-right">
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </span>
                  </div>
                ))}
                {selectedObject.lifecycleStage && (
                  <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-800 capitalize font-medium">lifecycleStage</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedObject.lifecycleStage === 'at_risk' ? 'bg-white text-rose-700' :
                      selectedObject.lifecycleStage === 'churned' ? 'bg-white/5 text-gray-800' :
                      selectedObject.lifecycleStage === 'mature' ? 'bg-white0/10 text-emerald-400' :
                      'bg-brand-500/10 text-brand-400'
                    }`}>{selectedObject.lifecycleStage}</span>
                  </div>
                )}
                {selectedObject.sentiment && (
                  <div className="flex justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-800 capitalize font-medium">sentiment</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedObject.sentiment === 'positive' ? 'bg-white0/10 text-emerald-400' :
                      selectedObject.sentiment === 'negative' ? 'bg-white text-rose-700' :
                      'bg-white/5 text-gray-800'
                    }`}>{selectedObject.sentiment}</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'links' && (
              <div className="space-y-2">
                {selectedObject.links.length === 0 ? (
                  <div className="text-gray-800 text-sm p-4 text-center">暂无关联对象</div>
                ) : (
                  selectedObject.links.map((link, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-50 transition">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded border ${LINK_TYPE_COLORS[link.linkType] ? 'border-gray-100 bg-white' : 'border-gray-100 bg-white'} mr-2 font-medium text-gray-800`}>{link.linkType}</span>
                        <span className="text-sm text-gray-700 font-medium">{link.targetName}</span>
                      </div>
                      <ChevronRight size={14} className="text-gray-800" />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-2">
                {selectedObject.actions.length === 0 ? (
                  <div className="text-gray-800 text-sm p-4 text-center">暂无可执行动作</div>
                ) : (
                  selectedObject.actions.map(action => (
                    <div key={action.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-brand-600/30 transition">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-semibold text-gray-700">{action.name}</span>
                        {action.requiresApproval && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white0/10 text-amber-700 border border-amber-100">需审批</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-800 mb-2">{action.description}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {action.parameters.slice(0, 2).map(p => (
                          <span key={p.name} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-100 text-gray-800">
                            {p.name}: {p.type}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => onActionExecute?.(action, selectedObject.id)}
                        className="w-full mt-2 py-2 bg-brand-500/10 text-brand-600 border border-brand-600/20 rounded-lg text-xs font-medium hover:bg-brand-500 hover:text-white transition flex items-center justify-center"
                      >
                        <Play size={12} className="mr-1" /> 执行动作
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'relations' && (
              <GraphRelationsPanel
                miningResult={miningResult}
                selectedRelation={selectedRelation}
                onSelectRelation={setSelectedRelation}
              />
            )}

            {activeTab === 'impact' && renderImpactPropagation()}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-50 rounded-xl border border-gray-100 relative overflow-hidden">
      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-800">{contextMenu.node.name}</span>
            </div>
            <button
              onClick={handleGenerateDecision}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Lightbulb size={14} className="text-amber-500" />
              生成决策场景
            </button>
            <button
              onClick={handleShowImpactPropagation}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Network size={14} className="text-blue-500" />
              查看影响传播
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                handleNodeClick(contextMenu.node);
                closeContextMenu();
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <ChevronRight size={14} className="text-gray-800" />
              查看详情
            </button>
          </motion.div>
        </>
      )}

      {/* 图例 - 域分组 */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg p-3 text-xs text-gray-800 border border-gray-100 shadow-sm max-h-[calc(100%-2rem)] overflow-y-auto"
        style={{ minWidth: 160 }}>
        <div className="font-bold text-gray-700 mb-2">对象类型</div>
        {DOMAIN_GROUPS.map(group => (
          <div key={group.name} className="mb-2">
            <div className="flex items-center gap-1.5 mb-1 px-1 py-0.5 rounded" style={{ backgroundColor: group.bgColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: group.textColor }}></span>
              <span className="text-[10px] font-semibold" style={{ color: group.textColor }}>{group.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pl-1">
              {group.types.map(t => {
                const colors = OBJECT_TYPE_COLORS[t.value as ObjectType];
                return (
                  <div key={t.value} className="flex items-center space-x-1 whitespace-nowrap">
                    <span className={`w-2 h-2 rounded-full border ${colors?.border || 'border-gray-200'}`} style={{ backgroundColor: (colors?.textColor || '#94a3b8') + '22' }}></span>
                    <span className="text-xs leading-none">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-700 leading-tight">
          左键拖拽画布 · 滚轮缩放<br />
          右键点击节点查看更多选项
        </div>
      </div>

      {/* 风险路径高亮按钮 */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setHighlightRiskPaths(prev => !prev)}
          className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all shadow-sm ${
            highlightRiskPaths
              ? 'bg-white text-rose-700 border-rose-200 shadow-rose-500/10'
              : 'bg-white text-gray-800 border-gray-100 hover:border-orange-500/30 hover:text-orange-700'
          }`}
        >
          <AlertTriangle size={14} className={highlightRiskPaths ? 'text-rose-700' : 'text-orange-700'} />
          {highlightRiskPaths ? '隐藏风险路径' : '高亮风险路径'}
        </button>
        <button
          onClick={() => {
            setShowGuide(true);
          }}
          className="px-3 py-2 rounded-lg bg-white text-gray-800 border border-gray-100 text-xs font-medium flex items-center gap-2 hover:border-brand-500/30 hover:text-brand-400 transition-all shadow-sm"
        >
          <Sparkles size={14} className="text-brand-400" />
          图谱导览
        </button>
      </div>

      {/* 缩放控制按钮 */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center justify-center text-gray-800 hover:text-brand-400 hover:border-brand-600/30 transition"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleResetView}
          className="w-8 h-8 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center justify-center text-gray-800 hover:text-brand-400 hover:border-brand-600/30 transition text-xs font-medium"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center justify-center text-gray-800 hover:text-brand-400 hover:border-brand-600/30 transition"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* 节点数量统计 */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-700 border border-gray-100">
        {objects.length} 个节点 · {objects.reduce((sum, o) => sum + o.links.length, 0)} 条关系
      </div>

      {/* 生成的决策场景提示 */}
      {generatedScenario && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white rounded-lg text-gray-700 px-4 py-3 shadow-md max-w-md border border-gray-100"
        >
          <div className="flex items-start gap-3">
            <Lightbulb size={20} className="mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">{generatedScenario.name}</div>
              <div className="text-sm text-gray-800 mt-1">{generatedScenario.description}</div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-700">
                <span>置信度: {(generatedScenario.confidence * 100).toFixed(0)}%</span>
                <span>紧急度: {generatedScenario.context.metadata.urgency}/100</span>
              </div>
            </div>
            <button
              onClick={() => setGeneratedScenario(null)}
              className="text-gray-700 hover:text-gray-800"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* SVG 画布 */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker id="arrowhead-light" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#CBD5E1" />
          </marker>
          <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#0066CC" />
          </marker>
          <marker id="arrowhead-impact-positive" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#22C55E" />
          </marker>
          <marker id="arrowhead-impact-negative" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
          </marker>
          <filter id="nodeShadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
          <filter id="selectedShadow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0ea5e9" floodOpacity="0.3" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 普通关系连线 - 过滤掉任一端节点不存在的无效连线 */}
          {objects.flatMap(obj =>
            obj.links
              .filter(link => positions[obj.id] && positions[link.targetId])
              .map(link => {
                const start = positions[obj.id];
                const end = positions[link.targetId];
                const isHighlighted = selectedObject?.id === obj.id || selectedObject?.id === link.targetId;

                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;

              return (
                <g key={`${obj.id}-${link.targetId}`}>
                  <line
                    x1={start.x} y1={start.y}
                    x2={end.x} y2={end.y}
                    stroke={isHighlighted ? '#0066CC' : '#E2E8F0'}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    markerEnd={isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead-light)'}
                    className="transition-all duration-300"
                    opacity={selectedObject ? (isHighlighted ? 1 : 0.15) : 0.7}
                  />
                  {/* 连线标签 - 只在高亮或无选中时显示 */}
                  {(!selectedObject || isHighlighted) && (
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill={isHighlighted ? '#0066CC' : '#94A3B8'}
                      className="pointer-events-none select-none font-medium"
                      opacity={selectedObject ? 1 : 0.6}
                    >
                      {link.linkType.replace(/_/g, ' ')}
                    </text>
                  )}
                </g>
              );
            })
          )}

          {/* 影响传播连线 */}
          {showImpactPropagation && impactPaths.map(path => {
            const start = positions[path.source];
            const end = positions[path.target];
            if (!start || !end) return null;

            return (
              <g key={`impact-${path.id}`}>
                <line
                  x1={start.x} y1={start.y}
                  x2={end.x} y2={end.y}
                  stroke={path.type === 'positive' ? '#22C55E' : path.type === 'negative' ? '#EF4444' : '#94A3B8'}
                  strokeWidth={2 + path.impact * 3}
                  strokeDasharray="5,5"
                  markerEnd={`url(#arrowhead-impact-${path.type})`}
                  opacity={0.7}
                />
              </g>
            );
          })}

          {/* 节点 */}
          {objects.map((node) => {
            const pos = positions[node.id] || { x: 0, y: 0 };
            const colors = OBJECT_TYPE_COLORS[node.objectType] || { bg: '#ffffff', border: '#e5e7eb', text: '#94a3b8', textColor: '#94a3b8' };
            const isSelected = selectedObject?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => handleNodeClick(node)}
                onContextMenu={(e) => handleContextMenu(e, node)}
                onMouseEnter={(e) => handleNodeHover(node, e)}
                onMouseLeave={handleNodeLeave}
                className="cursor-pointer"
                opacity={selectedObject ? (isSelected || node.links.some(l => l.targetId === selectedObject?.id) ? 1 : 0.2) : 1}
              >
                {/* 状态指示脉冲圈 */}
                {(node.status === 'critical' || node.status === 'warning') && (
                  <circle r="32" fill="none" stroke={node.status === 'critical' ? '#f43f5e' : '#f59e0b'} strokeWidth="1.5" opacity="0.4">
                    <animate attributeName="r" values="28;36;28" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* 风险路径连线高亮 */}
                {highlightRiskPaths && (node.status === 'critical' || node.status === 'warning') && node.links.map(link => {
                  const targetNode = objects.find(n => n.id === link.targetId);
                  if (!targetNode) return null;
                  const targetPos = positions[link.targetId];
                  if (!targetPos) return null;
                  const isRiskChain = targetNode?.status === 'critical' || targetNode?.status === 'warning';
                  if (!isRiskChain) return null;

                  return (
                    <line
                      key={`risk-${node.id}-${link.targetId}`}
                      x1={pos.x} y1={pos.y}
                      x2={targetPos.x} y2={targetPos.y}
                      stroke={node.status === 'critical' ? '#f43f5e' : '#f59e0b'}
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                      opacity="0.8"
                      markerEnd="url(#arrowhead-impact-negative)"
                    />
                  );
                })}

                {/* 合规风险等级指示环 */}
                {node.complianceRiskLevel === 'high' && (
                  <circle r={isSelected ? 30 : 26} fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.7" />
                )}
                {node.complianceRiskLevel === 'medium' && (
                  <circle r={isSelected ? 30 : 26} fill="none" stroke="#f97316" strokeWidth="2" opacity="0.7" />
                )}

                {/* 节点主体 */}
                <circle
                  r={isSelected ? 26 : 22}
                  fill="#ffffff"
                  stroke={isSelected ? '#0ea5e9' : colors.textColor + '44'}
                  strokeWidth={isSelected ? 3 : 1.5}
                  filter={isSelected ? 'url(#selectedShadow)' : 'url(#nodeShadow)'}
                />

                {/* 节点图标（前两个字） */}
                <text
                  textAnchor="middle"
                  dy=".35em"
                  fill={colors.textColor}
                  fontSize="11"
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {node.name.length <= 2 ? node.name : node.name.substring(0, 2)}
                </text>

                {/* 节点名称标签 */}
                <text
                  textAnchor="middle"
                  dy="2.4em"
                  fill={isSelected ? '#0369a1' : '#475569'}
                  fontSize="11"
                  fontWeight={isSelected ? 'bold' : 'medium'}
                  className="select-none"
                >
                  {node.name.length > 8 ? node.name.substring(0, 7) + '…' : node.name}
                </text>

                {/* 情感指示点 */}
                {node.sentiment && (
                  <circle
                    cx="0"
                    dy="3.6em"
                    cy={isSelected ? 38 : 34}
                    r="3"
                    fill={
                      node.sentiment === 'positive' ? '#22c55e' :
                      node.sentiment === 'negative' ? '#ef4444' :
                      '#94a3b8'
                    }
                    opacity="0.8"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {renderDetailPanel()}

      {/* 节点悬停 Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 pointer-events-none transition-opacity duration-150"
          style={{
            left: Math.min(tooltipPosition.x + 15, window.innerWidth - 280),
            top: Math.min(tooltipPosition.y - 10, window.innerHeight - 200),
            width: 260
          }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${OBJECT_TYPE_COLORS[hoveredNode.objectType]?.bg || 'bg-gray-100'} border-2 ${OBJECT_TYPE_COLORS[hoveredNode.objectType]?.border || 'border-gray-200'}`}></span>
            <span className="text-sm font-bold text-gray-700">{hoveredNode.name}</span>
            {hoveredNode.status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                hoveredNode.status === 'critical' ? 'bg-white text-rose-700 border border-rose-200' :
                hoveredNode.status === 'warning' ? 'bg-white0/10 text-orange-700 border border-orange-200' :
                'bg-emerald-400/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {hoveredNode.status === 'critical' ? '危急' : hoveredNode.status === 'warning' ? '警告' : '正常'}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-800 mb-1">{TYPE_LABEL_MAP[hoveredNode.objectType] || hoveredNode.objectType}</div>
          {hoveredNode.links.length > 0 && (
            <div className="text-xs text-gray-700">关联: {hoveredNode.links.length} 个对象</div>
          )}
          {hoveredNode.lifecycleStage && (
            <div className="text-xs text-gray-700">生命周期: {hoveredNode.lifecycleStage}</div>
          )}
        </div>
      )}

      {/* 图谱导览 Overlay */}
      {showGuide && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowGuide(false)}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles size={20} className="text-brand-400" />
                <h3 className="text-lg font-bold text-gray-700">图谱导览</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-800" />
              </button>
            </div>

            <div className="space-y-3">
              {(() => {
                const riskNodes = objects.filter(o => o.status === 'warning' || o.status === 'critical');
                const riskSteps: { step: number; title: string; desc: string; nodeId?: string }[] = [];
                
                if (riskNodes.length > 0) {
                  riskNodes.slice(0, 2).forEach((node, idx) => {
                    const statusLabel = node.status === 'critical' ? '危急' : '警告';
                    const typeLabel = TYPE_LABEL_MAP[node.objectType] || node.objectType;
                    riskSteps.push({
                      step: idx + 1,
                      title: `关注${typeLabel}：${node.name}`,
                      desc: `${node.name}当前状态为${statusLabel}，点击查看详细风险信息和关联路径。`,
                      nodeId: node.id,
                    });
                  });
                }
                
                riskSteps.push({
                  step: riskSteps.length + 1,
                  title: '高亮风险路径',
                  desc: `当前有${riskNodes.length}个风险节点，点击"高亮风险路径"按钮一键查看所有风险链路。`,
                });
                
                if (riskNodes.length === 0) {
                  return [
                    { step: 1, title: '点击节点查看详情', desc: '点击图谱中的任意节点，查看该对象的详细属性、关联关系和影响传播路径。' },
                    { step: 2, title: '右键生成决策场景', desc: '右键点击节点，可以生成针对该对象的智能决策场景。' },
                    { step: 3, title: '高亮风险路径', desc: '点击右上方的"高亮风险路径"按钮，一键高亮所有处于警告/危急状态的节点及其关联链路。' },
                    { step: 4, title: '拖拽和缩放', desc: '左键拖拽画布移动视图，滚轮缩放查看细节。' },
                  ].map(item => (
                    <div key={item.step} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-700 mb-0.5">{item.title}</div>
                        <div className="text-xs text-gray-800 leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ));
                }
                
                return riskSteps.map(item => (
                  <div
                    key={item.step}
                    className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      item.nodeId ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-gray-50 border-gray-100'
                    }`}
                    onClick={() => {
                      if (item.nodeId) {
                        const node = objects.find(o => o.id === item.nodeId);
                        if (node) handleNodeClick(node);
                        setShowGuide(false);
                      }
                    }}
                  >
                    <div className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      item.nodeId ? 'bg-amber-500' : 'bg-brand-500'
                    }`}>
                      {item.step}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-700 mb-0.5">{item.title}</div>
                      <div className="text-xs text-gray-800 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full mt-4 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-xl hover:bg-brand-600 transition-colors shadow-sm shadow-brand-500/30"
            >
              开始探索图谱
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default OntologyGraph;
