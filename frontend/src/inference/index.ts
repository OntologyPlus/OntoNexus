// 推理引擎模块导出

export {
  TemporalReasoningEngine,
  SpatialReasoningEngine,
} from './TemporalReasoningEngine';

export type {
  TrendPrediction,
  SeasonalityPattern,
  AnomalyPoint,
  AggregationResult,
  SpatialCorrelation,
  CoverageAnalysis,
} from './TemporalReasoningEngine';

export {
  CausalReasoningEngine,
} from './CausalReasoningEngine';

export type {
  CausalNode,
  CausalEdge,
  CausalGraph,
  RootCause,
  ImpactPath,
} from './CausalReasoningEngine';

export {
  AnalogicalReasoningEngine,
} from './AnalogicalReasoningEngine';

export type {
  Case,
  CaseContext,
  CaseFeature,
  CaseOutcome,
  CaseMetadata,
  SimilarityScore,
  SimilarCase,
  AdaptedRecommendation,
  Adaptation,
} from './AnalogicalReasoningEngine';

export {
  HierarchicalReasoningEngine,
} from './HierarchicalReasoningEngine';

export type {
  InheritedProperties,
  GeneralizedConcept,
  SpecializedConcept,
  Constraint,
  HierarchyNode,
  HierarchyPath,
} from './HierarchicalReasoningEngine';

export {
  ConstraintCheckingEngine,
} from './ConstraintCheckingEngine';

export type {
  ValidationResult,
  Violation,
  ConsistencyReport,
  RelationValidation,
} from './ConstraintCheckingEngine';

export {
  ConsistencyValidationEngine,
} from './ConsistencyValidationEngine';

export type {
  ValidationResult as CVValidationResult,
  ConsistencyReport as CVConsistencyReport,
} from './ConsistencyValidationEngine';

export {
  ImplicitRelationMiner,
} from './ImplicitRelationMiner';

export type {
  ImplicitRelation,
  AssociationRule,
  NetworkMetrics,
  AnomalyPattern,
} from './ImplicitRelationMiner';

export {
  AbductiveReasoningEngine,
} from './AbductiveReasoningEngine';

export type {
  Observation,
  Hypothesis,
  VerificationResult,
  RankedHypothesis,
  AbductiveContext,
  HistoricalPattern,
} from './AbductiveReasoningEngine';

export {
  CounterfactualReasoningEngine,
} from './CounterfactualReasoningEngine';

export type {
  WhatIfScenario,
  Intervention,
  CounterfactualResult,
  PredictedOutcome,
  CausalPath,
  SideEffect,
  EffectPrediction,
  Alternative,
  ComparisonResult,
  AlternativeComparison,
  Parameter,
  SensitivityResult,
} from './CounterfactualReasoningEngine';

export {
  MultiStepReasoningEngine,
} from './MultiStepReasoningEngine';

export type {
  ReasoningState,
  Fact,
  ReasoningRule,
  Condition,
  Conclusion,
  ReasoningStep,
  ReasoningPath,
  MultiStepResult,
} from './MultiStepReasoningEngine';
