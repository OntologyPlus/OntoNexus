import { OntologyObject, ObjectType, LinkType } from '../types';
import { AxiomDefinition, OntologyRegistry } from '../ontology/DomainOntology';

// ============================================
// 约束检查引擎
// ============================================

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  suggestions: string[];
  checkedAt: string;
}

export interface Violation {
  axiomId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedEntities: string[];
  property?: string;
  expectedValue?: any;
  actualValue?: any;
}

export interface ConsistencyReport {
  consistent: boolean;
  totalViolations: number;
  errors: number;
  warnings: number;
  infos: number;
  violations: Violation[];
  recommendations: string[];
}

export interface RelationValidation {
  valid: boolean;
  violations: Violation[];
  cardinalityCheck: boolean;
  domainCheck: boolean;
  rangeCheck: boolean;
}

export class ConstraintCheckingEngine {
  private axiomCache: Map<string, AxiomDefinition> = new Map();

  constructor() {
    this.loadAxioms();
  }

  /**
   * 加载所有公理
   */
  private loadAxioms(): void {
    const axioms = OntologyRegistry.getAxiomDefinitions();
    axioms.forEach(axiom => {
      this.axiomCache.set(axiom.id, axiom);
    });
  }

  /**
   * 验证实例
   */
  validateInstance(
    instance: OntologyObject,
    customAxioms?: AxiomDefinition[]
  ): ValidationResult {
    const violations: Violation[] = [];
    const suggestions: string[] = [];

    // 1. 结构验证
    const structuralViolations = this.validateStructure(instance);
    violations.push(...structuralViolations);

    // 2. 业务规则验证
    const businessViolations = this.validateBusinessRules(instance);
    violations.push(...businessViolations);

    // 3. 合规性验证
    const complianceViolations = this.validateCompliance(instance);
    violations.push(...complianceViolations);

    // 4. 自定义公理验证
    if (customAxioms) {
      customAxioms.forEach(axiom => {
        const result = this.evaluateAxiom(instance, axiom);
        if (!result.valid) {
          violations.push({
            axiomId: axiom.id,
            severity: axiom.severity,
            message: result.message,
            affectedEntities: [instance.id],
          });
        }
      });
    }

    // 5. 生成建议
    if (violations.length > 0) {
      suggestions.push(...this.generateSuggestions(instance, violations));
    }

    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      suggestions,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 验证结构
   */
  private validateStructure(instance: OntologyObject): Violation[] {
    const violations: Violation[] = [];
    const concept = OntologyRegistry.getConceptDefinition(instance.objectType);

    if (!concept) {
      violations.push({
        axiomId: 'structure.concept_exists',
        severity: 'error',
        message: `未知概念类型: ${instance.objectType}`,
        affectedEntities: [instance.id],
      });
      return violations;
    }

    // 验证必需属性
    concept.properties.forEach(prop => {
      if (prop.required && !prop.computed) {
        if (!(prop.name in instance.properties) || instance.properties[prop.name] === undefined) {
          violations.push({
            axiomId: 'structure.required_property',
            severity: 'error',
            message: `缺少必需属性: ${prop.name}`,
            affectedEntities: [instance.id],
            property: prop.name,
          });
        }
      }
    });

    // 验证属性类型
    concept.properties.forEach(prop => {
      const value = instance.properties[prop.name];
      if (value !== undefined) {
        const typeValid = this.validatePropertyType(value, prop.type);
        if (!typeValid) {
          violations.push({
            axiomId: 'structure.property_type',
            severity: 'error',
            message: `属性 ${prop.name} 类型不匹配，期望: ${prop.type}`,
            affectedEntities: [instance.id],
            property: prop.name,
            actualValue: value,
          });
        }
      }
    });

    return violations;
  }

  /**
   * 验证属性类型
   */
  private validatePropertyType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return !isNaN(Date.parse(value));
      case 'array':
        return Array.isArray(value);
      case 'enum':
        return typeof value === 'string' || typeof value === 'number';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 验证业务规则
   */
  private validateBusinessRules(instance: OntologyObject): Violation[] {
    const violations: Violation[] = [];
    const props = instance.properties;

    // 收入目标管理规则
    if (instance.objectType === ObjectType.SalesFlow) {
      if (props.targetValue !== undefined && props.actualValue !== undefined) {
        // 验证达成率计算
        const expectedRate = (props.actualValue / props.targetValue) * 100;
        const actualRate = props.achievementRate;
        if (actualRate !== undefined && Math.abs(actualRate - expectedRate) > 0.1) {
          violations.push({
            axiomId: 'business.achievement_calculation',
            severity: 'warning',
            message: `达成率计算可能不正确，期望值: ${expectedRate.toFixed(2)}%，实际值: ${actualRate}%`,
            affectedEntities: [instance.id],
            property: 'achievementRate',
            expectedValue: expectedRate,
            actualValue: actualRate,
          });
        }
      }
    }

    // 费用管理规则
    if (instance.objectType === ObjectType.BudgetCategory) {
      if (props.budgetAmount !== undefined && props.usedAmount !== undefined) {
        if (props.usedAmount > props.budgetAmount) {
          violations.push({
            axiomId: 'business.budget_exceeded',
            severity: 'error',
            message: `费用超出预算: 已用 ${props.usedAmount}，预算 ${props.budgetAmount}`,
            affectedEntities: [instance.id],
            property: 'usedAmount',
            expectedValue: `<= ${props.budgetAmount}`,
            actualValue: props.usedAmount,
          });
        }
      }
    }

    // 客户管理规则 - PDCA状态转换验证
    if (instance.objectType === ObjectType.PDCAPlan) {
      // 状态转换验证逻辑可以在这里实现
      // const currentStatus = instance.properties.cycleStatus;
      // 验证状态转换是否合法
    }

    return violations;
  }

  /**
   * 验证合规性
   */
  private validateCompliance(instance: OntologyObject): Violation[] {
    const violations: Violation[] = [];
    const props = instance.properties;

    // 会议合规
    if (instance.objectType === ObjectType.MeetingCompliance) {
      if (props.meetingDuration !== undefined && props.meetingDuration > 4) {
        violations.push({
          axiomId: 'compliance.meeting_duration',
          severity: 'error',
          message: `会议时长 ${props.meetingDuration}小时 超过限制(4小时)`,
          affectedEntities: [instance.id],
          property: 'meetingDuration',
          expectedValue: '<= 4',
          actualValue: props.meetingDuration,
        });
      }
    }

    // 费用合规
    if (instance.objectType === ObjectType.ExpenseClassification) {
      if (props.amount !== undefined && props.amount > 500) {
        violations.push({
          axiomId: 'compliance.expense_limit',
          severity: 'error',
          message: `单次费用 ${props.amount} 超过限制(500)`,
          affectedEntities: [instance.id],
          property: 'amount',
          expectedValue: '<= 500',
          actualValue: props.amount,
        });
      }
    }

    return violations;
  }

  /**
   * 评估公理
   */
  private evaluateAxiom(
    _instance: OntologyObject,
    _axiom: AxiomDefinition
  ): { valid: boolean; message: string } {
    // 简化的公理评估
    // 实际实现中可以使用表达式解析器
    return { valid: true, message: '' };
  }

  /**
   * 验证关系
   */
  validateRelation(
    source: OntologyObject,
    relation: LinkType,
    target: OntologyObject
  ): RelationValidation {
    const violations: Violation[] = [];
    let cardinalityCheck = true;
    let domainCheck = true;
    let rangeCheck = true;

    const relationDef = OntologyRegistry.getRelationDefinition(relation);

    if (relationDef) {
      // 验证domain
      if (!relationDef.domain.includes(source.objectType)) {
        domainCheck = false;
        violations.push({
          axiomId: 'relation.domain',
          severity: 'error',
          message: `源实体类型 ${source.objectType} 不在关系 ${relation} 的domain中`,
          affectedEntities: [source.id],
        });
      }

      // 验证range
      if (!relationDef.range.includes(target.objectType)) {
        rangeCheck = false;
        violations.push({
          axiomId: 'relation.range',
          severity: 'error',
          message: `目标实体类型 ${target.objectType} 不在关系 ${relation} 的range中`,
          affectedEntities: [target.id],
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      cardinalityCheck,
      domainCheck,
      rangeCheck,
    };
  }

  /**
   * 一致性检查
   */
  checkConsistency(ontology: OntologyObject[]): ConsistencyReport {
    const allViolations: Violation[] = [];

    // 1. 检查每个实例
    ontology.forEach(instance => {
      const result = this.validateInstance(instance);
      allViolations.push(...result.violations);
    });

    // 2. 检查关系一致性
    ontology.forEach(source => {
      source.links.forEach(link => {
        const target = ontology.find(o => o.id === link.targetId);
        if (target) {
          const relationResult = this.validateRelation(source, link.linkType, target);
          allViolations.push(...relationResult.violations);
        }
      });
    });

    // 3. 检查循环引用
    const cycleViolations = this.detectCycles(ontology);
    allViolations.push(...cycleViolations);

    // 4. 统计
    const errors = allViolations.filter(v => v.severity === 'error').length;
    const warnings = allViolations.filter(v => v.severity === 'warning').length;
    const infos = allViolations.filter(v => v.severity === 'info').length;

    // 5. 生成建议
    const recommendations = this.generateConsistencyRecommendations(allViolations);

    return {
      consistent: errors === 0,
      totalViolations: allViolations.length,
      errors,
      warnings,
      infos,
      violations: allViolations,
      recommendations,
    };
  }

  /**
   * 检测循环引用
   */
  private detectCycles(ontology: OntologyObject[]): Violation[] {
    const violations: Violation[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // 发现循环
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        violations.push({
          axiomId: 'consistency.cycle',
          severity: 'error',
          message: `检测到循环引用: ${cycle.join(' -> ')} -> ${nodeId}`,
          affectedEntities: cycle,
        });
        return true;
      }

      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = ontology.find(o => o.id === nodeId);
      if (node) {
        for (const link of node.links) {
          if (dfs(link.targetId, [...path, nodeId])) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    ontology.forEach(obj => {
      if (!visited.has(obj.id)) {
        dfs(obj.id, []);
      }
    });

    return violations;
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    instance: OntologyObject,
    violations: Violation[]
  ): string[] {
    const suggestions: string[] = [];

    violations.forEach(violation => {
      switch (violation.axiomId) {
        case 'structure.required_property':
          suggestions.push(`请为 ${instance.name} 添加 ${violation.property} 属性`);
          break;
        case 'business.budget_exceeded':
          suggestions.push(`建议调整预算或控制费用支出`);
          break;
        case 'compliance.meeting_duration':
          suggestions.push(`建议将会议拆分为多个短会议，或精简议程`);
          break;
        case 'compliance.expense_limit':
          suggestions.push(`建议将费用拆分为多次报销，或申请特批`);
          break;
      }
    });

    return [...new Set(suggestions)];
  }

  /**
   * 生成一致性建议
   */
  private generateConsistencyRecommendations(violations: Violation[]): string[] {
    const recommendations: string[] = [];
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    if (errorCount > 0) {
      recommendations.push(`存在 ${errorCount} 个错误需要立即修复`);
    }
    if (warningCount > 0) {
      recommendations.push(`存在 ${warningCount} 个警告建议处理`);
    }
    if (violations.some(v => v.axiomId === 'consistency.cycle')) {
      recommendations.push('请检查并打破循环引用');
    }

    return recommendations;
  }

  /**
   * 批量验证
   */
  validateBatch(instances: OntologyObject[]): ValidationResult[] {
    return instances.map(instance => this.validateInstance(instance));
  }

  /**
   * 获取公理
   */
  getAxiom(axiomId: string): AxiomDefinition | undefined {
    return this.axiomCache.get(axiomId);
  }

  /**
   * 获取所有公理
   */
  getAllAxioms(): AxiomDefinition[] {
    return Array.from(this.axiomCache.values());
  }
}
