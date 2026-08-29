import { OntologyObject, ObjectType, LinkType } from '../types';
import { ConceptDefinition, OntologyRegistry } from '../ontology/DomainOntology';

// ============================================
// 层次推理引擎
// ============================================

export interface InheritedProperties {
  properties: Record<string, any>;
  sourceConcept: string;
  inheritanceChain: string[];
}

export interface GeneralizedConcept {
  name: string;
  commonProperties: string[];
  propertyRanges: { [propertyName: string]: { min: number; max: number } | string[] };
  sampleSize: number;
  confidence: number;
}

export interface SpecializedConcept {
  baseConcept: ConceptDefinition;
  constraints: Constraint[];
  specializedProperties: Record<string, any>;
}

export interface Constraint {
  property: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface HierarchyNode {
  id: string;
  objectType: ObjectType;
  name: string;
  level: number;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  properties: Record<string, any>;
}

export interface HierarchyPath {
  path: string[];
  distance: number;
  commonAncestor?: string;
}

export class HierarchicalReasoningEngine {
  // 概念层次关系存储，用于后续扩展
  private conceptRelations: Map<ObjectType, ObjectType[]> = new Map();

  /**
   * 设置概念层次关系
   */
  setConceptRelation(parent: ObjectType, children: ObjectType[]): void {
    this.conceptRelations.set(parent, children);
  }

  /**
   * 获取概念层次关系
   */
  getConceptRelation(parent: ObjectType): ObjectType[] | undefined {
    return this.conceptRelations.get(parent);
  }

  /**
   * 属性继承
   */
  inheritProperties(
    instance: OntologyObject,
    conceptHierarchyList: ConceptDefinition[]
  ): InheritedProperties {
    const inherited: Record<string, any> = {};
    const inheritanceChain: string[] = [];
    let sourceConcept = instance.objectType;

    // 获取概念定义
    const concept = OntologyRegistry.getConceptDefinition(instance.objectType);
    if (!concept) {
      return { properties: {}, sourceConcept: instance.objectType, inheritanceChain: [] };
    }

    // 遍历继承链
    let currentConcept: ConceptDefinition | undefined = concept;
    while (currentConcept) {
      inheritanceChain.push(currentConcept.name);

      // 继承属性
      currentConcept.properties.forEach(prop => {
        if (!(prop.name in inherited) && prop.name in instance.properties) {
          inherited[prop.name] = instance.properties[prop.name];
        }
      });

      // 查找父概念
      if (currentConcept.parentConcept) {
        currentConcept = conceptHierarchyList.find((c: ConceptDefinition) => c.objectType === currentConcept!.parentConcept);
      } else {
        currentConcept = undefined;
      }
    }

    return {
      properties: inherited,
      sourceConcept,
      inheritanceChain,
    };
  }

  /**
   * 概念泛化
   */
  generalizeConcept(instances: OntologyObject[]): GeneralizedConcept {
    if (instances.length === 0) {
      return {
        name: 'EmptyConcept',
        commonProperties: [],
        propertyRanges: {},
        sampleSize: 0,
        confidence: 0,
      };
    }

    // 找出共同属性
    const allProperties = instances.map(i => Object.keys(i.properties));
    const commonProperties = allProperties.reduce((common, props) =>
      common.filter(p => props.includes(p)),
      allProperties[0] || []
    );

    // 计算属性范围
    const propertyRanges: { [propertyName: string]: { min: number; max: number } | string[] } = {};

    commonProperties.forEach(prop => {
      const values = instances.map(i => i.properties[prop]).filter(v => v !== undefined);

      if (values.length > 0 && typeof values[0] === 'number') {
        const numericValues = values as number[];
        propertyRanges[prop] = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
        };
      } else if (values.length > 0 && typeof values[0] === 'string') {
        propertyRanges[prop] = [...new Set(values as string[])];
      }
    });

    // 计算置信度
    const confidence = Math.min(1, instances.length / 10);

    return {
      name: `Generalized_${instances[0].objectType}`,
      commonProperties,
      propertyRanges,
      sampleSize: instances.length,
      confidence,
    };
  }

  /**
   * 概念特化
   */
  specializeConcept(
    concept: ConceptDefinition,
    constraints: Constraint[]
  ): SpecializedConcept {
    const specializedProperties: Record<string, any> = {};

    // 应用约束
    constraints.forEach(constraint => {
      const prop = concept.properties.find(p => p.name === constraint.property);
      if (prop) {
        switch (constraint.operator) {
          case 'eq':
            specializedProperties[constraint.property] = constraint.value;
            break;
          case 'in':
            if (prop.type === 'enum') {
              specializedProperties[constraint.property] = constraint.value;
            }
            break;
          // 其他操作符可以根据需要添加
        }
      }
    });

    return {
      baseConcept: concept,
      constraints,
      specializedProperties,
    };
  }

  /**
   * 构建层级结构
   */
  buildHierarchy(
    objects: OntologyObject[],
    _hierarchyType: 'territory' | 'organization' | 'product'
  ): HierarchyNode[] {
    const nodeMap = new Map<string, HierarchyNode>();
    const roots: HierarchyNode[] = [];

    // 创建节点
    objects.forEach(obj => {
      const node: HierarchyNode = {
        id: obj.id,
        objectType: obj.objectType,
        name: obj.name,
        level: 0,
        children: [],
        properties: obj.properties,
      };
      nodeMap.set(obj.id, node);
    });

    // 建立父子关系
    objects.forEach(obj => {
      const node = nodeMap.get(obj.id);
      if (!node) return;

      // 查找父节点
      const parentLink = obj.links.find(link => link.linkType === LinkType.BELONGS_TO);
      if (parentLink) {
        const parent = nodeMap.get(parentLink.targetId);
        if (parent) {
          node.parent = parent;
          node.level = parent.level + 1;
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * 查找层级路径
   */
  findHierarchyPath(
    fromId: string,
    toId: string,
    hierarchy: HierarchyNode[]
  ): HierarchyPath | null {
    const findNode = (nodes: HierarchyNode[], id: string): HierarchyNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
      }
      return null;
    };

    const fromNode = findNode(hierarchy, fromId);
    const toNode = findNode(hierarchy, toId);

    if (!fromNode || !toNode) return null;

    // 获取从根到节点的路径
    const getPathToRoot = (node: HierarchyNode): string[] => {
      const path: string[] = [node.id];
      let current = node;
      while (current.parent) {
        path.unshift(current.parent.id);
        current = current.parent;
      }
      return path;
    };

    const pathFrom = getPathToRoot(fromNode);
    const pathTo = getPathToRoot(toNode);

    // 找到最近公共祖先
    let commonAncestorIndex = 0;
    while (
      commonAncestorIndex < pathFrom.length &&
      commonAncestorIndex < pathTo.length &&
      pathFrom[commonAncestorIndex] === pathTo[commonAncestorIndex]
    ) {
      commonAncestorIndex++;
    }

    const commonAncestor = pathFrom[commonAncestorIndex - 1];

    // 构建路径
    const upPath = pathFrom.slice(commonAncestorIndex).reverse();
    const downPath = pathTo.slice(commonAncestorIndex);
    const fullPath = [...upPath, commonAncestor, ...downPath];

    return {
      path: fullPath,
      distance: upPath.length + downPath.length,
      commonAncestor,
    };
  }

  /**
   * 层级聚合
   */
  aggregateByLevel(
    hierarchy: HierarchyNode[],
    propertyName: string,
    aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count'
  ): { level: number; value: number; nodes: number }[] {
    const levelMap = new Map<number, { values: number[]; nodes: number }>();

    const collectValues = (nodes: HierarchyNode[]) => {
      nodes.forEach(node => {
        const value = node.properties[propertyName];
        if (typeof value === 'number') {
          if (!levelMap.has(node.level)) {
            levelMap.set(node.level, { values: [], nodes: 0 });
          }
          levelMap.get(node.level)!.values.push(value);
          levelMap.get(node.level)!.nodes++;
        }
        collectValues(node.children);
      });
    };

    collectValues(hierarchy);

    return Array.from(levelMap.entries()).map(([level, data]) => {
      let value: number;
      switch (aggregation) {
        case 'sum':
          value = data.values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = data.values.reduce((a, b) => a + b, 0) / data.values.length;
          break;
        case 'max':
          value = Math.max(...data.values);
          break;
        case 'min':
          value = Math.min(...data.values);
          break;
        case 'count':
          value = data.values.length;
          break;
      }

      return { level, value, nodes: data.nodes };
    });
  }

  /**
   * 查找相似概念
   */
  findSimilarConcepts(
    conceptType: ObjectType,
    similarityThreshold: number = 0.7
  ): ObjectType[] {
    const concept = OntologyRegistry.getConceptDefinition(conceptType);
    if (!concept) return [];

    const allConcepts = OntologyRegistry.getAllObjectTypes();
    const similar: ObjectType[] = [];

    allConcepts.forEach(otherType => {
      if (otherType === conceptType) return;

      const otherConcept = OntologyRegistry.getConceptDefinition(otherType);
      if (!otherConcept) return;

      // 计算概念相似度
      const similarity = this.calculateConceptSimilarity(concept, otherConcept);
      if (similarity >= similarityThreshold) {
        similar.push(otherType);
      }
    });

    return similar;
  }

  /**
   * 计算概念相似度
   */
  private calculateConceptSimilarity(
    conceptA: ConceptDefinition,
    conceptB: ConceptDefinition
  ): number {
    // 计算属性重叠度
    const propertiesA = new Set(conceptA.properties.map(p => p.name));
    const propertiesB = new Set(conceptB.properties.map(p => p.name));

    const intersection = new Set([...propertiesA].filter(x => propertiesB.has(x)));
    const union = new Set([...propertiesA, ...propertiesB]);

    return intersection.size / union.size;
  }

  /**
   * 获取概念层次
   */
  getConceptLevel(objectType: ObjectType): number {
    const concept = OntologyRegistry.getConceptDefinition(objectType);
    if (!concept) return 0;

    let level = 0;
    let current: ConceptDefinition | undefined = concept;

    while (current?.parentConcept) {
      level++;
      current = OntologyRegistry.getConceptDefinition(current.parentConcept);
    }

    return level;
  }
}
