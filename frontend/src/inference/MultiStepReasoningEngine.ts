export interface ReasoningState {
  id: string;
  name: string;
  type: 'initial' | 'intermediate' | 'goal';
  facts: Fact[];
  status: 'unexplored' | 'exploring' | 'explored' | 'achieved';
}

export interface Fact {
  id: string;
  predicate: string;
  subject: string;
  object: string;
  confidence: number;
  source: 'observation' | 'inference' | 'assumption';
}

export interface ReasoningRule {
  id: string;
  name: string;
  type: 'forward' | 'backward';
  conditions: Condition[];
  conclusions: Conclusion[];
  confidence: number;
}

export interface Condition {
  predicate: string;
  subject?: string;
  object?: string;
  negated?: boolean;
}

export interface Conclusion {
  predicate: string;
  subject: string;
  object: string;
}

export interface ReasoningStep {
  step: number;
  rule: ReasoningRule;
  inputs: Fact[];
  outputs: Fact[];
  confidence: number;
  description: string;
}

export interface ReasoningPath {
  id: string;
  steps: ReasoningStep[];
  initialState: ReasoningState;
  goalState: ReasoningState;
  totalConfidence: number;
  length: number;
  isValid: boolean;
}

export interface MultiStepResult {
  paths: ReasoningPath[];
  bestPath: ReasoningPath | null;
  allGoalsAchieved: boolean;
  unachievedGoals: string[];
  recommendations: string[];
}

export class MultiStepReasoningEngine {
  private rules: ReasoningRule[] = [];
  private facts: Fact[] = [];
  private maxSteps: number = 10;

  setRules(rules: ReasoningRule[]): void {
    this.rules = rules;
  }

  addRule(rule: ReasoningRule): void {
    this.rules.push(rule);
  }

  setFacts(facts: Fact[]): void {
    this.facts = facts;
  }

  addFact(fact: Fact): void {
    this.facts.push(fact);
  }

  forwardChain(initialFacts: Fact[], maxSteps?: number): Fact[] {
    const derivedFacts: Fact[] = [...initialFacts];
    const appliedRules = new Set<string>();
    const stepLimit = maxSteps || this.maxSteps;

    let newFactsAdded = true;
    let iterations = 0;

    while (newFactsAdded && iterations < stepLimit) {
      newFactsAdded = false;
      iterations++;

      for (const rule of this.rules) {
        if (appliedRules.has(rule.id)) continue;
        if (rule.type === 'backward') continue;

        const matches = this.matchConditions(rule.conditions, derivedFacts);
        
        for (const match of matches) {
          const newFacts = this.applyForwardRule(rule, match, derivedFacts);
          
          for (const newFact of newFacts) {
            if (!this.factExists(newFact, derivedFacts)) {
              derivedFacts.push(newFact);
              newFactsAdded = true;
            }
          }
        }

        if (matches.length > 0) {
          appliedRules.add(rule.id);
        }
      }
    }

    return derivedFacts;
  }

  backwardChain(goal: Fact, availableFacts: Fact[]): ReasoningPath | null {
    const path: ReasoningStep[] = [];
    const visitedGoals = new Set<string>();

    const result = this.backwardChainRecursive(goal, availableFacts, path, visitedGoals, 0);
    
    if (result) {
      return {
        id: `path_${Date.now()}`,
        steps: path,
        initialState: { id: 'initial', name: '初始状态', type: 'initial', facts: availableFacts, status: 'explored' },
        goalState: { id: 'goal', name: '目标状态', type: 'goal', facts: [goal], status: 'achieved' },
        totalConfidence: this.calculatePathConfidence(path),
        length: path.length,
        isValid: true,
      };
    }

    return null;
  }

  private backwardChainRecursive(
    goal: Fact,
    availableFacts: Fact[],
    path: ReasoningStep[],
    visitedGoals: Set<string>,
    depth: number
  ): boolean {
    if (depth > this.maxSteps) return false;

    const goalKey = `${goal.predicate}_${goal.subject}_${goal.object}`;
    if (visitedGoals.has(goalKey)) return false;
    visitedGoals.add(goalKey);

    if (this.factMatches(goal, availableFacts)) {
      return true;
    }

    const relevantRules = this.rules.filter(r => 
      r.type === 'backward' &&
      r.conclusions.some(c => c.predicate === goal.predicate)
    );

    for (const rule of relevantRules) {
      const subGoals: Fact[] = [];
      let allSubGoalsAchieved = true;

      for (const condition of rule.conditions) {
        const subGoal: Fact = {
          id: `subgoal_${Date.now()}_${Math.random()}`,
          predicate: condition.predicate,
          subject: condition.subject || goal.subject,
          object: condition.object || goal.object,
          confidence: rule.confidence,
          source: 'inference',
        };
        subGoals.push(subGoal);

        if (!this.backwardChainRecursive(subGoal, availableFacts, path, visitedGoals, depth + 1)) {
          allSubGoalsAchieved = false;
          break;
        }
      }

      if (allSubGoalsAchieved) {
        path.push({
          step: path.length + 1,
          rule,
          inputs: subGoals,
          outputs: [goal],
          confidence: rule.confidence,
          description: `应用规则 ${rule.name} 推导 ${goal.predicate}`,
        });
        return true;
      }
    }

    return false;
  }

  planSteps(initialState: ReasoningState, goalState: ReasoningState): MultiStepResult {
    const paths: ReasoningPath[] = [];
    
    const forwardFacts = this.forwardChain(initialState.facts);
    
    const goalAchieved = goalState.facts.every(goal => 
      this.factMatches(goal, forwardFacts)
    );

    if (goalAchieved) {
      const path = this.constructPath(initialState, goalState, forwardFacts);
      if (path) paths.push(path);
    }

    for (const goal of goalState.facts) {
      const backwardPath = this.backwardChain(goal, initialState.facts);
      if (backwardPath) {
        paths.push(backwardPath);
      }
    }

    const bestPath = this.selectBestPath(paths);
    const unachievedGoals = this.findUnachievedGoals(goalState.facts, bestPath);

    return {
      paths,
      bestPath,
      allGoalsAchieved: unachievedGoals.length === 0,
      unachievedGoals,
      recommendations: this.generateRecommendations(bestPath, unachievedGoals),
    };
  }

  validatePath(path: ReasoningPath): boolean {
    for (let i = 1; i < path.steps.length; i++) {
      const prevOutputs = path.steps[i - 1].outputs;
      const currentInputs = path.steps[i].inputs;

      const inputsAvailable = currentInputs.every(input =>
        prevOutputs.some(output => this.factsMatch(input, output))
      );

      if (!inputsAvailable && i > 1) {
        return false;
      }
    }

    return true;
  }

  optimizePath(path: ReasoningPath): ReasoningPath {
    const optimizedSteps: ReasoningStep[] = [];
    const usedFacts = new Set<string>();

    for (const step of path.steps) {
      const newOutputs = step.outputs.filter(f => !usedFacts.has(f.id));
      
      if (newOutputs.length > 0) {
        optimizedSteps.push({
          ...step,
          outputs: newOutputs,
        });
        newOutputs.forEach(f => usedFacts.add(f.id));
      }
    }

    return {
      ...path,
      steps: optimizedSteps,
      length: optimizedSteps.length,
      totalConfidence: this.calculatePathConfidence(optimizedSteps),
    };
  }

  private matchConditions(conditions: Condition[], facts: Fact[]): Map<string, string>[] {
    if (conditions.length === 0) return [new Map()];

    const results: Map<string, string>[] = [];
    const [firstCondition, ...restConditions] = conditions;

    for (const fact of facts) {
      const match = this.matchCondition(firstCondition, fact);
      if (match) {
        const restMatches = this.matchConditions(restConditions, facts);
        for (const restMatch of restMatches) {
          const combined = new Map([...match, ...restMatch]);
          results.push(combined);
        }
      }
    }

    return results;
  }

  private matchCondition(condition: Condition, fact: Fact): Map<string, string> | null {
    if (condition.predicate !== fact.predicate) return null;

    const bindings = new Map<string, string>();

    if (condition.subject && condition.subject !== fact.subject) {
      if (condition.subject.startsWith('?')) {
        bindings.set(condition.subject, fact.subject);
      } else {
        return null;
      }
    }

    if (condition.object && condition.object !== fact.object) {
      if (condition.object.startsWith('?')) {
        bindings.set(condition.object, fact.object);
      } else {
        return null;
      }
    }

    if (condition.negated) {
      return null;
    }

    return bindings;
  }

  private applyForwardRule(rule: ReasoningRule, bindings: Map<string, string>, _currentFacts: Fact[]): Fact[] {
    const newFacts: Fact[] = [];

    for (const conclusion of rule.conclusions) {
      const subject = this.applyBindings(conclusion.subject, bindings);
      const object = this.applyBindings(conclusion.object, bindings);

      const newFact: Fact = {
        id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        predicate: conclusion.predicate,
        subject,
        object,
        confidence: rule.confidence,
        source: 'inference',
      };

      newFacts.push(newFact);
    }

    return newFacts;
  }

  private applyBindings(value: string, bindings: Map<string, string>): string {
    if (value.startsWith('?')) {
      return bindings.get(value) || value;
    }
    return value;
  }

  private factExists(fact: Fact, facts: Fact[]): boolean {
    return facts.some(f => this.factsMatch(fact, f));
  }

  private factMatches(fact: Fact, facts: Fact[]): boolean {
    return facts.some(f => this.factsMatch(fact, f));
  }

  private factsMatch(a: Fact, b: Fact): boolean {
    return a.predicate === b.predicate && 
           a.subject === b.subject && 
           a.object === b.object;
  }

  private constructPath(initialState: ReasoningState, goalState: ReasoningState, derivedFacts: Fact[]): ReasoningPath | null {
    const steps: ReasoningStep[] = [];
    
    const newFacts = derivedFacts.filter(f => 
      !initialState.facts.some(init => this.factsMatch(f, init))
    );

    if (newFacts.length === 0) return null;

    steps.push({
      step: 1,
      rule: { id: 'forward_chain', name: '前向链推理', type: 'forward', conditions: [], conclusions: [], confidence: 0.8 },
      inputs: initialState.facts,
      outputs: newFacts,
      confidence: 0.8,
      description: '通过前向链推理推导新事实',
    });

    return {
      id: `path_${Date.now()}`,
      steps,
      initialState,
      goalState,
      totalConfidence: 0.8,
      length: steps.length,
      isValid: true,
    };
  }

  private selectBestPath(paths: ReasoningPath[]): ReasoningPath | null {
    if (paths.length === 0) return null;

    return paths.reduce((best, current) => {
      if (current.totalConfidence > best.totalConfidence) return current;
      if (current.totalConfidence === best.totalConfidence && current.length < best.length) return current;
      return best;
    });
  }

  private findUnachievedGoals(goals: Fact[], path: ReasoningPath | null): string[] {
    if (!path) return goals.map(g => g.predicate);

    const achievedPredicates = new Set(
      path.steps.flatMap(s => s.outputs.map(o => o.predicate))
    );

    return goals
      .filter(g => !achievedPredicates.has(g.predicate))
      .map(g => g.predicate);
  }

  private calculatePathConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;
    
    return steps.reduce((product, step) => product * step.confidence, 1);
  }

  private generateRecommendations(bestPath: ReasoningPath | null, unachievedGoals: string[]): string[] {
    const recommendations: string[] = [];

    if (bestPath) {
      recommendations.push(`找到包含 ${bestPath.length} 步的推理路径`);
      recommendations.push(`路径置信度: ${(bestPath.totalConfidence * 100).toFixed(1)}%`);
    }

    if (unachievedGoals.length > 0) {
      recommendations.push(`未能达成目标: ${unachievedGoals.join(', ')}`);
      recommendations.push('建议添加更多规则或事实');
    }

    return recommendations;
  }

  explainPath(path: ReasoningPath): string[] {
    const explanations: string[] = [];

    for (const step of path.steps) {
      const inputStr = step.inputs.map(f => `${f.predicate}(${f.subject}, ${f.object})`).join(', ');
      const outputStr = step.outputs.map(f => `${f.predicate}(${f.subject}, ${f.object})`).join(', ');
      
      explanations.push(`步骤 ${step.step}: 应用规则 "${step.rule.name}"`);
      explanations.push(`  输入: ${inputStr}`);
      explanations.push(`  输出: ${outputStr}`);
      explanations.push(`  置信度: ${(step.confidence * 100).toFixed(1)}%`);
    }

    return explanations;
  }
}
