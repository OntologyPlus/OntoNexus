import {
  ObjectType,
  OntologyObject,
  OntologyAction,
  ObjectLink,
} from '../types';
import { OntologyRegistry, ConceptDefinition } from './DomainOntology';

// ============================================
// 本体工厂 - 用于创建本体实例
// ============================================

export class OntologyFactory {
  /**
   * 创建本体实例
   */
  static createInstance(
    objectType: ObjectType,
    properties: Record<string, any>,
    options?: {
      id?: string;
      name?: string;
      links?: ObjectLink[];
      actions?: OntologyAction[];
    }
  ): OntologyObject {
    const definition = OntologyRegistry.getConceptDefinition(objectType);
    
    if (!definition) {
      throw new Error(`Unknown object type: ${objectType}`);
    }
    
    // 验证必需属性
    this.validateRequiredProperties(definition, properties);
    
    // 计算派生属性
    const computedProperties = this.computeProperties(definition, properties);
    
    // 生成动作
    const actions = options?.actions || this.generateActions(definition);
    
    // 创建本体实例
    return {
      id: options?.id || this.generateId(),
      objectType,
      name: options?.name || properties.name || `${objectType}_${Date.now()}`,
      properties: { ...properties, ...computedProperties },
      links: options?.links || [],
      actions,
      events: [],
      timeSeries: {},
      interfaces: definition.interfaces,
    };
  }
  
  /**
   * 验证必需属性
   */
  private static validateRequiredProperties(
    definition: ConceptDefinition,
    properties: Record<string, any>
  ): void {
    const missingProperties: string[] = [];
    
    for (const prop of definition.properties) {
      if (prop.required && !prop.computed) {
        if (properties[prop.name] === undefined || properties[prop.name] === null) {
          missingProperties.push(prop.name);
        }
      }
    }
    
    if (missingProperties.length > 0) {
      throw new Error(
        `Missing required properties for ${definition.objectType}: ${missingProperties.join(', ')}`
      );
    }
  }
  
  /**
   * 计算派生属性
   */
  private static computeProperties(
    definition: ConceptDefinition,
    properties: Record<string, any>
  ): Record<string, any> {
    const computed: Record<string, any> = {};
    
    for (const prop of definition.properties) {
      if (prop.computed) {
        switch (prop.name) {
          case 'achievementRate':
            if (properties.targetValue && properties.actualValue !== undefined) {
              computed[prop.name] = (properties.actualValue / properties.targetValue) * 100;
            }
            break;
          case 'remainingAmount':
            if (properties.budgetAmount !== undefined && properties.usedAmount !== undefined) {
              computed[prop.name] = properties.budgetAmount - properties.usedAmount;
            }
            break;
          case 'executionRate':
            if (properties.budgetAmount && properties.usedAmount !== undefined) {
              computed[prop.name] = (properties.usedAmount / properties.budgetAmount) * 100;
            }
            break;
          case 'roiRatio':
            if (properties.expenseAmount && properties.revenueGenerated !== undefined) {
              computed[prop.name] = 
                ((properties.revenueGenerated - properties.expenseAmount) / properties.expenseAmount) * 100;
            }
            break;
          case 'growthOpportunity':
            if (properties.potentialValue !== undefined && properties.marketShare !== undefined) {
              computed[prop.name] = properties.potentialValue * (1 - properties.marketShare / 100);
            }
            break;
          case 'performanceRank':
            // 性能排名需要全局数据，这里仅做占位
            computed[prop.name] = 0;
            break;
          case 'complianceScore':
            if (properties.meetingDuration !== undefined) {
              // 简单的合规评分计算
              let score = 100;
              if (properties.meetingDuration > 4) score -= 30;
              if (properties.topicRepetition > 0.5) score -= 20;
              if (properties.topicAlignment < 0.7) score -= 20;
              computed[prop.name] = Math.max(0, score);
            }
            break;
        }
      }
    }
    
    return computed;
  }
  
  /**
   * 生成本体动作
   */
  private static generateActions(definition: ConceptDefinition): OntologyAction[] {
    const actions: OntologyAction[] = [];
    
    // 根据概念类型生成默认动作
    switch (definition.objectType) {
      case ObjectType.SalesFlow:
        actions.push({
          id: 'update_actual',
          name: 'updateActualValue',
          description: '更新实际完成值',
          parameters: [
            { name: 'actualValue', type: 'number', required: true, description: '实际值' },
          ],
          preconditions: ['actualValue >= 0'],
          sideEffects: ['recalculate achievementRate'],
          writeBackTargets: ['CRM'],
          requiresApproval: false,
        });
        break;
        
      case ObjectType.BudgetCategory:
        actions.push({
          id: 'allocate_budget',
          name: 'allocateBudget',
          description: '分配预算',
          parameters: [
            { name: 'amount', type: 'number', required: true, description: '分配金额' },
          ],
          preconditions: ['amount > 0'],
          sideEffects: ['update remainingAmount'],
          writeBackTargets: ['ERP'],
          requiresApproval: true,
        });
        break;
        
      case ObjectType.PDCAPlan:
        actions.push({
          id: 'advance_cycle',
          name: 'advanceCycle',
          description: '推进PDCA循环',
          parameters: [],
          preconditions: ['cycleStatus != completed'],
          sideEffects: ['update cycleStatus'],
          writeBackTargets: ['CRM'],
          requiresApproval: false,
        });
        break;
        
      case ObjectType.RWSProject:
        actions.push({
          id: 'update_status',
          name: 'updateStatus',
          description: '更新项目状态',
          parameters: [
            { name: 'status', type: 'string', required: true, description: '新状态' },
          ],
          preconditions: ['status in [initiated, multicenter, gcp, settlement]'],
          sideEffects: ['trigger status change event'],
          writeBackTargets: ['MedicalSystem'],
          requiresApproval: true,
        });
        break;
    }
    
    return actions;
  }
  
  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================
// 数据源映射器接口和注册表
// ============================================

export interface DataSourceMapper {
  map(rawData: any): OntologyObject;
}

export class DataSourceMapperRegistry {
  private static mappers: Map<string, DataSourceMapper> = new Map();
  
  static register(sourceType: string, mapper: DataSourceMapper): void {
    this.mappers.set(sourceType, mapper);
  }
  
  static getMapper(sourceType: string): DataSourceMapper {
    const mapper = this.mappers.get(sourceType);
    if (!mapper) {
      throw new Error(`No mapper registered for source type: ${sourceType}`);
    }
    return mapper;
  }
  
  static hasMapper(sourceType: string): boolean {
    return this.mappers.has(sourceType);
  }
}

// ============================================
// 具体数据源映射器实现
// ============================================

// 销售流向数据映射器
export class SalesFlowMapper implements DataSourceMapper {
  map(rawData: any): OntologyObject {
    return OntologyFactory.createInstance(ObjectType.SalesFlow, {
      flowType: rawData.flow_type,
      targetValue: rawData.target_value,
      actualValue: rawData.actual_value,
      dimension: rawData.dimension,
      period: rawData.period,
    }, {
      name: rawData.name || `${rawData.flow_type}流向_${rawData.period}`,
    });
  }
}

// 预算类别数据映射器
export class BudgetCategoryMapper implements DataSourceMapper {
  map(rawData: any): OntologyObject {
    return OntologyFactory.createInstance(ObjectType.BudgetCategory, {
      category: rawData.category,
      budgetAmount: rawData.budget_amount,
      usedAmount: rawData.used_amount,
      status: rawData.status,
    }, {
      name: rawData.name || `预算_${rawData.category}`,
    });
  }
}

// 客户分级数据映射器
export class CustomerCategoryMapper implements DataSourceMapper {
  map(rawData: any): OntologyObject {
    return OntologyFactory.createInstance(ObjectType.CustomerCategory, {
      category: rawData.category,
      categoryName: rawData.category_name,
      prescriptionPotential: rawData.prescription_potential,
      influenceLevel: rawData.influence_level,
      cooperationWillingness: rawData.cooperation_willingness,
    }, {
      name: rawData.name || `${rawData.category}类客户`,
    });
  }
}

// RWS项目数据映射器
export class RWSProjectMapper implements DataSourceMapper {
  map(rawData: any): OntologyObject {
    return OntologyFactory.createInstance(ObjectType.RWSProject, {
      projectName: rawData.project_name,
      projectType: rawData.project_type,
      status: rawData.status,
      centers: rawData.centers,
      enrolledPatients: rawData.enrolled_patients,
      budget: rawData.budget,
      timeline: rawData.timeline,
    }, {
      name: rawData.project_name,
    });
  }
}

// 合规规则数据映射器
export class ComplianceRuleMapper implements DataSourceMapper {
  map(rawData: any): OntologyObject {
    return OntologyFactory.createInstance(ObjectType.ComplianceRule, {
      ruleName: rawData.rule_name,
      ruleType: rawData.rule_type,
      threshold: rawData.threshold,
      severity: rawData.severity,
      description: rawData.description,
    }, {
      name: rawData.rule_name,
    });
  }
}

// 注册所有映射器
DataSourceMapperRegistry.register('sales_flow', new SalesFlowMapper());
DataSourceMapperRegistry.register('budget_category', new BudgetCategoryMapper());
DataSourceMapperRegistry.register('customer_category', new CustomerCategoryMapper());
DataSourceMapperRegistry.register('rws_project', new RWSProjectMapper());
DataSourceMapperRegistry.register('compliance_rule', new ComplianceRuleMapper());
