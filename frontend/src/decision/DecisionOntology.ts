import { OntologyObject } from '../types';
import { ReasoningChain } from '../types';

// ============================================
// 决策本体定义
// ============================================

export enum DecisionType {
  STRATEGIC = 'strategic',      // 战略决策：目标设定、资源分配
  TACTICAL = 'tactical',        // 战术决策：策略调整、计划变更
  OPERATIONAL = 'operational',  // 运营决策：日常执行、任务安排
}

export enum DecisionDomain {
  REVENUE = 'revenue',           // 收入目标管理
  CUSTOMER = 'customer',         // 客户管理
  EXPENSE = 'expense',           // 费用管理
  MEDICAL_AFFAIRS = 'medical',   // 医学事务
  COMPLIANCE = 'compliance',     // 合规管理
}

export enum DecisionStatus {
  PENDING = 'pending',           // 待决策
  ANALYZING = 'analyzing',       // 分析中
  RECOMMENDED = 'recommended',   // 已推荐
  APPROVED = 'approved',         // 已批准
  EXECUTING = 'executing',       // 执行中
  COMPLETED = 'completed',       // 已完成
  CANCELLED = 'cancelled',       // 已取消
}

export enum TimeHorizon {
  IMMEDIATE = 'immediate',       // 立即（< 1天）
  SHORT_TERM = 'short_term',     // 短期（1天 - 1周）
  MEDIUM_TERM = 'medium_term',   // 中期（1周 - 1月）
  LONG_TERM = 'long_term',       // 长期（1月 - 1季）
  STRATEGIC = 'strategic',       // 战略（> 1季）
}

export enum SpatialScope {
  INDIVIDUAL = 'individual',     // 个人
  TEAM = 'team',                 // 团队
  TERRITORY = 'territory',       // 区域
  REGION = 'region',             // 大区
  NATIONAL = 'national',         // 全国
  GLOBAL = 'global',             // 全球
}

// ============================================
// 决策上下文
// ============================================

export interface DecisionContext {
  id: string;
  type: DecisionType;
  domain: DecisionDomain;
  timeHorizon: TimeHorizon;
  spatialScope: SpatialScope;
  stakeholders: Stakeholder[];
  constraints: Constraint[];
  objectives: Objective[];
  relatedEntities: OntologyObject[];
  historicalDecisions: DecisionRecord[];
  metadata: ContextMetadata;
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  influence: number;  // 0-100
  interest: number;   // 0-100
  constraints: string[];
}

export interface Constraint {
  id: string;
  type: 'budget' | 'time' | 'resource' | 'compliance' | 'policy';
  description: string;
  limit: number | string;
  currentValue?: number | string;
  severity: 'hard' | 'soft';
}

export interface Objective {
  id: string;
  name: string;
  description: string;
  target: number;
  current?: number;
  weight: number;
  priority: 'high' | 'medium' | 'low';
  metrics: string[];
}

export interface ContextMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  urgency: number;    // 0-100
  importance: number; // 0-100
  tags: string[];
}

// ============================================
// 决策场景
// ============================================

export interface DecisionScenario {
  id: string;
  name: string;
  description: string;
  context: DecisionContext;
  alternatives: DecisionAlternative[];
  evaluationCriteria: Criterion[];
  recommendedAlternative?: DecisionAlternative;
  confidence: number;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionAlternative {
  id: string;
  name: string;
  description: string;
  actions: ActionProposal[];
  expectedOutcomes: ExpectedOutcome[];
  risks: Risk[];
  resourceRequirements: ResourceRequirement[];
  evaluationScores?: { [criterionId: string]: number };
  overallScore?: number;
}

export interface ActionProposal {
  id: string;
  name: string;
  description: string;
  targetObject?: OntologyObject;
  actionType: string;
  parameters: Record<string, any>;
  expectedImpact: string;
  timeline: string;
  dependencies: string[];
}

export interface ExpectedOutcome {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidenceInterval: [number, number];
  probability: number;
}

export interface Risk {
  id: string;
  description: string;
  probability: number;  // 0-1
  impact: number;       // 0-100
  mitigation: string[];
  contingency: string;
}

export interface ResourceRequirement {
  type: 'budget' | 'personnel' | 'time' | 'material';
  amount: number;
  unit: string;
  availability: 'available' | 'limited' | 'unavailable';
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  type: 'benefit' | 'cost' | 'risk';
  scale: 'numeric' | 'ordinal' | 'boolean';
  minValue?: number;
  maxValue?: number;
}

// ============================================
// 决策推荐
// ============================================

export interface DecisionRecommendation {
  id: string;
  scenario: DecisionScenario;
  recommendedAlternative: DecisionAlternative;
  confidence: number;
  reasoningChain: ReasoningChain;
  expectedImpact: ImpactAssessment;
  implementationPlan: ImplementationStep[];
  createdAt: string;
  validUntil: string;
}

export interface ImpactAssessment {
  financial: FinancialImpact;
  operational: OperationalImpact;
  strategic: StrategicImpact;
  risk: RiskImpact;
}

export interface FinancialImpact {
  revenue: number;
  cost: number;
  roi: number;
  paybackPeriod: number;
  npv: number;
}

export interface OperationalImpact {
  efficiency: number;
  quality: number;
  speed: number;
  resourceUtilization: number;
}

export interface StrategicImpact {
  marketPosition: number;
  competitiveAdvantage: number;
  capabilityBuilding: number;
  alignment: number;
}

export interface RiskImpact {
  overallRisk: number;
  riskBreakdown: { [riskType: string]: number };
  mitigationEffectiveness: number;
}

export interface ImplementationStep {
  step: number;
  name: string;
  description: string;
  duration: number;
  dependencies: number[];
  responsible: string;
  deliverables: string[];
  milestones: Milestone[];
}

export interface Milestone {
  name: string;
  targetDate: string;
  criteria: string[];
}

// ============================================
// 决策执行
// ============================================

export interface DecisionExecution {
  id: string;
  decisionId: string;
  recommendationId: string;
  executor: string;
  executedAt: string;
  status: ExecutionStatus;
  actions: ExecutedAction[];
  progress: ExecutionProgress;
  issues: ExecutionIssue[];
}

export enum ExecutionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DELAYED = 'delayed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
}

export interface ExecutedAction {
  actionId: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  result?: any;
  notes: string;
}

export interface ExecutionProgress {
  overall: number;  // 0-100
  byAction: { [actionId: string]: number };
  estimatedCompletion: string;
  actualCompletion?: string;
}

export interface ExecutionIssue {
  id: string;
  type: 'delay' | 'resource' | 'quality' | 'external' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

// ============================================
// 决策记录与学习
// ============================================

export interface DecisionRecord {
  id: string;
  scenario: DecisionScenario;
  selectedAlternative: DecisionAlternative;
  execution: DecisionExecution;
  actualImpact: ActualImpact;
  lessons: Lesson[];
  feedback: DecisionFeedback[];
  createdAt: string;
}

export interface ActualImpact {
  financial: FinancialImpact;
  operational: OperationalImpact;
  strategic: StrategicImpact;
  variance: ImpactVariance;
}

export interface ImpactVariance {
  financial: number;
  operational: number;
  strategic: number;
  explanations: string[];
}

export interface Lesson {
  id: string;
  category: 'process' | 'analysis' | 'execution' | 'outcome';
  description: string;
  recommendations: string[];
  applicability: string[];
}

export interface DecisionFeedback {
  id: string;
  stakeholder: string;
  rating: number;  // 1-5
  comments: string;
  providedAt: string;
}

export interface LearningResult {
  patterns: DecisionPattern[];
  improvedHeuristics: Heuristic[];
  modelUpdates: ModelUpdate[];
}

export interface DecisionPattern {
  id: string;
  name: string;
  condition: string;
  action: string;
  successRate: number;
  confidence: number;
}

export interface Heuristic {
  id: string;
  name: string;
  rule: string;
  applicability: string[];
  effectiveness: number;
}

export interface ModelUpdate {
  component: string;
  change: string;
  reason: string;
  impact: string;
}

// ============================================
// 解释与可视化
// ============================================

export interface Explanation {
  summary: string;
  reasoning: ReasoningStep[];
  evidence: Evidence[];
  confidence: number;
}

export interface ReasoningStep {
  step: number;
  description: string;
  premise: string;
  conclusion: string;
  confidence: number;
}

export interface Evidence {
  type: 'data' | 'rule' | 'model' | 'expert';
  source: string;
  content: string;
  reliability: number;
}
