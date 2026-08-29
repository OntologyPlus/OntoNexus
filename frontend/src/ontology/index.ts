// 本体论模块导出

export {
  // 领域本体定义
  RevenueOntology,
  CustomerOntology,
  ExpenseOntology,
  MedicalAffairsOntology,
  ComplianceOntology,
  DomainOntologies,
  OntologyRegistry,
} from './DomainOntology';

export type {
  // 类型定义
  DomainOntology,
  ConceptDefinition,
  PropertyDefinition,
  RelationDefinition,
  AxiomDefinition,
} from './DomainOntology';

export {
  // 本体工厂
  OntologyFactory,
  DataSourceMapperRegistry,
  SalesFlowMapper,
  BudgetCategoryMapper,
  CustomerCategoryMapper,
  RWSProjectMapper,
  ComplianceRuleMapper,
} from './OntologyFactory';

export type {
  // 数据源映射器类型
  DataSourceMapper,
} from './OntologyFactory';
