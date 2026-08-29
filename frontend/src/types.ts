export enum ObjectType {
  // 原有类型
  Doctor = 'Doctor',
  Hospital = 'Hospital',
  Product = 'Product',
  SalesRep = 'SalesRep',
  VisitRecord = 'VisitRecord',
  SalesTarget = 'SalesTarget',
  ComplianceAlert = 'ComplianceAlert',
  AcademicEvent = 'AcademicEvent',
  Territory = 'Territory',
  RecoveryPlan = 'RecoveryPlan',
  ActionItem = 'ActionItem',
  VisitBrief = 'VisitBrief',
  CoachingNote = 'CoachingNote',

  // 收入目标管理域
  SalesFlow = 'SalesFlow',
  MarketPotential = 'MarketPotential',
  HospitalDevelopment = 'HospitalDevelopment',
  TerritoryPerformance = 'TerritoryPerformance',
  ProductFlow = 'ProductFlow',

  // 费用管理域
  BudgetCategory = 'BudgetCategory',
  ExpenseClassification = 'ExpenseClassification',
  CostDriver = 'CostDriver',
  LaborPayment = 'LaborPayment',
  ExpenseROI = 'ExpenseROI',

  // 客户管理域
  CustomerCategory = 'CustomerCategory',
  VisitFeedback = 'VisitFeedback',
  PDCAPlan = 'PDCAPlan',
  HospitalStrategy = 'HospitalStrategy',
  DepartmentResearch = 'DepartmentResearch',

  // 医学事务域
  RWSProject = 'RWSProject',
  ClinicalTrial = 'ClinicalTrial',
  PatientProgram = 'PatientProgram',
  ResearchCollaboration = 'ResearchCollaboration',

  // 合规管理域
  MeetingCompliance = 'MeetingCompliance',
  ExpenseCompliance = 'ExpenseCompliance',
  CustomerCompliance = 'CustomerCompliance',
  ComplianceRule = 'ComplianceRule',
}

export enum LifecycleStage {
  prospect = 'prospect',
  developing = 'developing',
  mature = 'mature',
  at_risk = 'at_risk',
  churned = 'churned',
}

export enum Sentiment {
  positive = 'positive',
  neutral = 'neutral',
  negative = 'negative',
}

export enum ComplianceRiskLevel {
  low = 'low',
  medium = 'medium',
  high = 'high',
}

export enum RiskLevel {
  on_track = 'on_track',
  at_risk = 'at_risk',
  critical = 'critical',
}

export enum LinkType {
  // 原有关系
  WORKS_AT = 'WORKS_AT',
  PRESCRIBES = 'PRESCRIBES',
  MANAGED_BY = 'MANAGED_BY',
  INFLUENCES = 'INFLUENCES',
  ATTENDED = 'ATTENDED',
  HAS_VISIT = 'HAS_VISIT',
  HAS_ALERT = 'HAS_ALERT',
  COVERS = 'COVERS',
  BELONGS_TO = 'BELONGS_TO',
  PARTICIPATES_IN = 'PARTICIPATES_IN',

  // 新增语义关系
  CAUSES = 'CAUSES',
  DEPENDS_ON = 'DEPENDS_ON',
  IMPACTS = 'IMPACTS',
  CONTAINS = 'CONTAINS',
  TRANSFORMS_TO = 'TRANSFORMS_TO',
  CONSUMES = 'CONSUMES',
  PRODUCES = 'PRODUCES',
  FLOWS_TO = 'FLOWS_TO',
  POTENTIAL_OF = 'POTENTIAL_OF',
  ACHIEVES = 'ACHIEVES',
  CATEGORIZED_AS = 'CATEGORIZED_AS',
  FEEDS_BACK = 'FEEDS_BACK',
  FOLLOWS = 'FOLLOWS',
  STRATEGY_FOR = 'STRATEGY_FOR',
  CLASSIFIED_AS = 'CLASSIFIED_AS',
  DRIVEN_BY = 'DRIVEN_BY',
  COMPLIES_WITH = 'COMPLIES_WITH',
  VIOLATES = 'VIOLATES',
  GOVERNED_BY = 'GOVERNED_BY',
  MANAGES = 'MANAGES',
  CONDUCTS = 'CONDUCTS',
  ENROLLS = 'ENROLLS',
}

export enum EntityType {
  DOCTOR = 'Doctor',
  HOSPITAL = 'Hospital',
  PRODUCT = 'Product',
  REP = 'Rep',
}

export enum RuleType {
  DEDUCTION = 'deduction',
  INDUCTION = 'induction',
  ABDUCTION = 'abduction',
}

export enum ScenarioType {
  RESOURCE_REALLOCATION = 'resource_reallocation',
  PRODUCT_MIX_OPTIMIZATION = 'product_mix_optimization',
  PRICE_ADJUSTMENT = 'price_adjustment',
  CHANNEL_STRATEGY = 'channel_strategy',
  KOL_STRATEGY = 'kol_strategy',
  CUSTOMER_CHURN_INTERVENTION = 'customer_churn_intervention',
  NEW_CUSTOMER_DEVELOPMENT = 'new_customer_development',
  COMPLIANCE_RISK_RESPONSE = 'compliance_risk_response',
  COMPETITOR_RESPONSE = 'competitor_response',
  EMERGENCY_RESPONSE = 'emergency_response',
}

export enum RecommendationCategory {
  SALES = 'sales',
  RISK = 'risk',
  COMPLIANCE = 'compliance',
  DEVELOPMENT = 'development',
  STRATEGY = 'strategy',
}

export enum RecommendationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface Auditable {
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  auditLog: string[];
}

export interface Scorable {
  computeScore(): number;
  getScoreHistory(): TimeSeriesDataPoint[];
  explainScore(): ReasoningChain;
}

export interface Notifiable {
  notify(): void;
  getNotificationPreferences(): NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface Targetable {
  setTarget(target: ObjectType | string): void;
  getTargetAchievement(): AchievementResult;
}

export interface AchievementResult {
  targetValue: number;
  currentValue: number;
  achievementRate: number;
  remainingValue: number;
  isOnTrack: boolean;
}

export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface OntologyAction {
  id: string;
  name: string;
  description: string;
  parameters: ActionParameter[];
  preconditions: string[];
  sideEffects: string[];
  writeBackTargets: string[];
  requiresApproval: boolean;
}

export interface OntologyEvent {
  id: string;
  eventType: string;
  timestamp: string;
  description: string;
  relatedObjectId?: string;
  relatedObjectName?: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface TimeSeriesData {
  [key: string]: TimeSeriesDataPoint[];
}

export interface ObjectLink {
  linkType: LinkType;
  targetId: string;
  targetName: string;
  targetType: ObjectType;
  properties?: Record<string, any>;
}

export interface ReasoningEvidence {
  source: string;
  observation: string;
  weight: number;
}

export interface SuggestedAction {
  actionName: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ReasoningChain {
  conclusion: string;
  evidence: ReasoningEvidence[];
  confidence: number;
  alternativeHypotheses: { hypothesis: string; confidence: number }[];
  suggestedActions: SuggestedAction[];
}

export type AgentType =
  | 'InsightAgent'
  | 'ComplianceAgent'
  | 'ForecastAgent'
  | 'AtRiskAgent'
  | 'CoachAgent'
  | 'KnowledgeAgent'
  | 'TerritoryAgent'
  | 'InferenceAgent'
  | 'ActionAgent'
  | 'StrategyAgent'
  | 'MarketAgent'
  | 'CompetitorAgent'
  | 'ResourceAgent'
  | 'LearningAgent';

export interface AgentExecution {
  agentType: AgentType;
  agentName: string;
  status: 'pending' | 'running' | 'completed';
  output?: string;
  timestamp: string;
}

export interface AgentCollaboration {
  id: string;
  triggerEvent: string;
  agents: AgentExecution[];
  status: 'running' | 'completed' | 'awaiting_approval';
  conclusion?: string;
  reasoningChain?: ReasoningChain;
}

export interface ActionProposal {
  id: string;
  title: string;
  description: string;
  type: string;
  entityId: string;
  entityName: string;
  entityType: ObjectType;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  reasoningChain: ReasoningChain;
  actionDefinition: OntologyAction;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  timestamp: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ForecastResult {
  targetValue: number;
  forecastValue: number;
  achievementRate: number;
  riskLevel: RiskLevel;
  confidenceInterval: [number, number];
}

export interface ComparisonResult {
  baseline: ForecastResult;
  scenario: ForecastResult;
  delta: number;
  impactAnalysis: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  forecastResult?: ForecastResult;
  comparisonWithBaseline?: ComparisonResult;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  actions?: ActionProposal[];
  agentCollaboration?: AgentCollaboration;
  reasoningChain?: ReasoningChain;
  timestamp: number;
}

export interface OntologyObject {
  id: string;
  objectType: ObjectType;
  name: string;
  properties: Record<string, any>;
  links: ObjectLink[];
  actions: OntologyAction[];
  events: OntologyEvent[];
  timeSeries: TimeSeriesData;
  interfaces: string[];
  status?: 'normal' | 'warning' | 'critical';
  lifecycleStage?: LifecycleStage;
  sentiment?: Sentiment;
  complianceRiskLevel?: ComplianceRiskLevel;
}

export interface Notification {
  id: string;
  type: 'risk_alert' | 'compliance_warning' | 'approval_request' | 'action_approved' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userId: string;
  timestamp: string;
  details?: string;
}

export type EffectType = 'update_node' | 'create_link' | 'delete_link' | 'create_node' | 'delete_node' | 'trigger_event' | 'start_workflow';

export interface EffectPayload {
  entityId?: string;
  property?: string;
  operation?: 'increment' | 'decrement' | 'set';
  value?: any;
  source?: string;
  target?: string;
  linkType?: string;
  strength?: number;
  details?: string;
  entityType?: ObjectType;
  eventType?: string;
  workflowType?: string;
  relatedProductId?: string;
  validFrom?: string;
  validTo?: string;
}

export interface SideEffect {
  type: EffectType;
  payload: EffectPayload;
}

export interface ExecutionContext {
  actionId: string;
  entityId: string;
  entityType: EntityType;
  parameters: Record<string, any>;
  executedBy?: string;
  executionId: string;
}

export interface ActionHandlerResult {
  success: boolean;
  data?: any;
  error?: string;
  sideEffects: SideEffect[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ActionExecution {
  id: string;
  actionId: string;
  entityId: string;
  entityType: EntityType;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  executedAt: Date;
  completedAt?: Date;
  executedBy?: string;
  error?: string;
  result?: any;
}

export interface InferenceRuleMetadata {
  createdAt: Date;
  updatedAt: Date;
  author: string;
  tags: string[];
}

export interface ConfidenceModifier {
  condition: string;
  modifier: number;
}

export interface ConfidenceConfig {
  base: number;
  modifiers: ConfidenceModifier[];
}

export interface RuleConfig {
  enabled: boolean;
  priority: number;
  ttl?: number;
  autoApply: boolean;
}

export interface RuleCondition {
  pattern: string;
  filters?: string[];
  description?: string;
}

export interface NewLinkConclusion {
  sourcePattern: string;
  targetPattern: string;
  type: string;
  strengthFormula?: string;
}

export interface NewPropertyConclusion {
  entityPattern: string;
  property: string;
  valueFormula: string;
}

export interface AlertConclusion {
  type: string;
  messageTemplate: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface TagConclusion {
  entityPattern: string;
  tag: string;
}

export interface RuleConclusion {
  newLink?: NewLinkConclusion;
  newProperty?: NewPropertyConclusion;
  alert?: AlertConclusion;
  tag?: TagConclusion;
}

export interface InferenceRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  conditions: RuleCondition[];
  conclusion: RuleConclusion;
  confidence: ConfidenceConfig;
  config: RuleConfig;
  metadata: InferenceRuleMetadata;
}

export interface InferenceResult {
  id: string;
  ruleId: string;
  ruleName: string;
  resultType: 'new_link' | 'new_property' | 'alert' | 'tag';
  sourceEntityId?: string;
  targetEntityId?: string;
  inferredLinkType?: string;
  inferredProperty?: string;
  inferredValue: any;
  confidence: number;
  evidence: ReasoningEvidence[];
  validFrom: Date;
  validTo?: Date;
  status: 'active' | 'dismissed' | 'confirmed';
  createdAt: Date;
}

export interface OntologyLink {
  source: string;
  target: string;
  type: string;
  strength?: number;
  details?: string;
  relatedProductId?: string;
}

export interface OntologyNode {
  id: string;
  type: EntityType;
  label: string;
  tags: string[];
  metrics?: Record<string, any>;
  details?: string;
}

export interface GraphChange {
  type: 'node_added' | 'node_updated' | 'node_removed' | 'link_added' | 'link_removed';
  entityId?: string;
  linkId?: string;
  data?: any;
  timestamp: Date;
}

export interface ComplianceCheckResult {
  passed: boolean;
  alerts: ComplianceAlertItem[];
}

export interface ComplianceAlertItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
  description: string;
  relatedEntity: string;
  suggestedAction: string;
  createdAt: string;
  status: 'active' | 'resolved';
}

export interface DecisionRecommendation {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  reasoning: ReasoningChain;
  expectedImpact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercent: number;
  };
  confidence: number;
  suggestedActions: ActionProposal[];
  relatedEntities: OntologyObject[];
}

export interface RiskAlert {
  id: string;
  type: 'sales_risk' | 'compliance_risk' | 'customer_risk' | 'development_risk';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedEntities: string[];
  propagationPath: string[];
  suggestedActions: string[];
  confidence: number;
  createdAt: Date;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  decisionType: 'approve' | 'reject' | 'modify' | 'create_scenario';
  executedBy: string;
  executedAt: Date;
  relatedScenarioId?: string;
  relatedActionIds: string[];
  outcome: {
    success: boolean;
    actualImpact?: number;
    expectedImpact?: number;
    notes?: string;
  };
}

export interface ScenarioParameter {
  name: string;
  type: 'number' | 'string' | 'select' | 'boolean';
  label: string;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
  required: boolean;
  description?: string;
}

export interface EnhancedScenario {
  id: string;
  type: ScenarioType;
  name: string;
  description: string;
  category: 'sales_strategy' | 'customer_management' | 'risk_response';
  parameters: ScenarioParameter[];
  forecastResult?: ForecastResult;
  comparisonWithBaseline?: ComparisonResult;
  relatedScenarios?: string[];
  createdAt?: Date;
  createdBy?: string;
}

export type InsightType = 'risk' | 'opportunity' | 'anomaly' | 'trend' | 'relationship';

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  reasoningChain: ReasoningChain;
  confidence: number;
  impact: {
    entities: string[];
    metrics: { name: string; change: number }[];
  };
  suggestedActions: ActionProposal[];
  createdAt: Date;
  status: 'new' | 'viewed' | 'acted' | 'dismissed';
}

// ============================================
// 领域属性接口 - 收入目标管理域
// ============================================

export interface SalesFlowProperties {
  flowType: 'M1' | 'M2' | 'M3';
  targetValue: number;
  actualValue: number;
  achievementRate: number;
  yoyGrowth: number;
  momGrowth: number;
  dimension: 'region' | 'province' | 'city' | 'hospital' | 'product';
  period: string;
}

export interface MarketPotentialProperties {
  potentialValue: number;
  penetrationRate: number;
  marketShare: number;
  competitorShare: number;
  growthOpportunity: number;
}

export interface HospitalDevelopmentProperties {
  developmentStage: 'prospect' | 'contact' | 'negotiation' | 'contract' | 'launch';
  successRate: number;
  resourceAllocation: number;
  timeline: string;
  milestones: Milestone[];
}

export interface TerritoryPerformanceProperties {
  territoryId: string;
  hospitalCount: number;
  repCount: number;
  targetRevenue: number;
  actualRevenue: number;
  performanceRank: number;
}

export interface ProductFlowProperties {
  productId: string;
  flowDirection: string;
  flowVolume: number;
  flowValue: number;
  period: string;
}

// ============================================
// 领域属性接口 - 费用管理域
// ============================================

export interface BudgetCategoryProperties {
  category: 'sales' | 'market' | 'medical' | 'patient' | 'policy' | 'development';
  budgetAmount: number;
  usedAmount: number;
  remainingAmount: number;
  executionRate: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ExpenseClassificationProperties {
  expenseType: 'C1' | 'C2A' | 'C2B' | 'C3';
  amount: number;
  costCenter: string;
  approvalStatus: string;
}

export interface CostDriverProperties {
  driverType: string;
  driverName: string;
  impactFactor: number;
  relatedExpenses: string[];
}

export interface LaborPaymentProperties {
  paymentType: string;
  totalPersons: number;
  totalAmount: number;
  paymentDate: string;
}

export interface ExpenseROIProperties {
  expenseAmount: number;
  revenueGenerated: number;
  roiRatio: number;
  attributionModel: string;
  calculationPeriod: string;
}

// ============================================
// 领域属性接口 - 客户管理域
// ============================================

export interface CustomerCategoryProperties {
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  categoryName: string;
  prescriptionPotential: number;
  influenceLevel: number;
  cooperationWillingness: number;
}

export interface VisitFeedbackProperties {
  feedbackType: 'positive' | 'neutral' | 'negative';
  content: string;
  sentiment: Sentiment;
  keyInsights: string[];
  followUpRequired: boolean;
}

export interface PDCAPlanProperties {
  planType: 'visit' | 'academic' | 'service';
  planContent: string;
  doActions: PDCAActionItem[];
  checkResults: CheckResult[];
  actImprovements: Improvement[];
  cycleStatus: 'planning' | 'doing' | 'checking' | 'acting' | 'completed';
}

export interface PDCAActionItem {
  id: string;
  actionName: string;
  description: string;
  responsible: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface HospitalStrategyProperties {
  strategyType: string;
  salesRatio: number;
  vacancyRate: number;
  consumptionProgress: number;
  overlappingHospitals: number;
  flowDirection: string;
  contractRatio: number;
}

export interface DepartmentResearchProperties {
  departmentId: string;
  bedCount: number;
  outpatientVolume: number;
  competitorShare: number;
  ourShare: number;
  growthPotential: number;
}

// ============================================
// 领域属性接口 - 医学事务域
// ============================================

export interface RWSProjectProperties {
  projectName: string;
  projectType: 'registry' | 'observational' | 'interventional';
  status: 'initiated' | 'multicenter' | 'gcp' | 'settlement';
  centers: number;
  enrolledPatients: number;
  budget: number;
  timeline: string;
}

export interface ClinicalTrialProperties {
  trialPhase: string;
  enrolledPatients: number;
  followUpCount: number;
  drugUsage: number;
  reportContent: string;
}

export interface PatientProgramProperties {
  programType: string;
  enrolledPatients: number;
  activePatients: number;
  drugSwitchCount: number;
  commercialInsuranceCount: number;
  reimbursementAmount: number;
}

export interface ResearchCollaborationProperties {
  collaborationType: string;
  partnerInstitution: string;
  researchTopic: string;
  budget: number;
  startDate: string;
  endDate: string;
}

// ============================================
// 领域属性接口 - 合规管理域
// ============================================

export interface MeetingComplianceProperties {
  meetingDuration: number;
  topicAlignment: number;
  topicRepetition: number;
  complianceScore: number;
}

export interface ExpenseComplianceProperties {
  totalLaborFee: number;
  totalFrequency: number;
  complianceStatus: 'compliant' | 'warning' | 'violation';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CustomerComplianceProperties {
  meetingFrequency: number;
  realNameVerified: boolean;
  complianceHistory: ComplianceRecord[];
}

export interface ComplianceRuleProperties {
  ruleName: string;
  ruleType: 'meeting' | 'expense' | 'customer';
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ============================================
// 辅助类型定义
// ============================================

export interface Milestone {
  name: string;
  targetDate: string;
  completedDate?: string;
  status: 'pending' | 'completed' | 'delayed';
}

export interface CheckResult {
  checkItem: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  status: 'on_track' | 'at_risk' | 'off_track';
}

export interface Improvement {
  improvementArea: string;
  actionItem: string;
  responsible: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ComplianceRecord {
  date: string;
  eventType: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}
