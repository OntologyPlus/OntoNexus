import { OntologyObject, ObjectType, LinkType } from '../types';
import { AxiomDefinition, OntologyRegistry } from '../ontology/DomainOntology';

export interface ValidationResult {
  axiomId: string;
  axiomName: string;
  constraintType: 'structural' | 'business' | 'compliance';
  severity: 'error' | 'warning' | 'info';
  passed: boolean;
  message: string;
  affectedEntities: string[];
  suggestion?: string;
}

export interface ConsistencyReport {
  overallScore: number;
  totalAxioms: number;
  passedAxioms: number;
  failedAxioms: number;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  lastValidated: Date;
}

export class ConsistencyValidationEngine {
  private objects: OntologyObject[];
  private results: ValidationResult[] = [];

  constructor(objects: OntologyObject[]) {
    this.objects = objects;
  }

  validateAll(): ConsistencyReport {
    this.results = [];
    
    const allAxioms = OntologyRegistry.getAxiomDefinitions();
    
    for (const axiom of allAxioms) {
      const result = this.validateAxiom(axiom);
      this.results.push(result);
    }

    const errors = this.results.filter(r => !r.passed && r.severity === 'error');
    const warnings = this.results.filter(r => !r.passed && r.severity === 'warning');
    const infos = this.results.filter(r => !r.passed && r.severity === 'info');
    const passedAxioms = this.results.filter(r => r.passed).length;

    const errorWeight = 0.4;
    const warningWeight = 0.2;
    const infoWeight = 0.05;
    const totalPenalty = errors.length * errorWeight + warnings.length * warningWeight + infos.length * infoWeight;
    const overallScore = Math.max(0, Math.min(100, 100 - totalPenalty * 10));

    return {
      overallScore: Math.round(overallScore),
      totalAxioms: allAxioms.length,
      passedAxioms,
      failedAxioms: this.results.filter(r => !r.passed).length,
      errors,
      warnings,
      infos,
      lastValidated: new Date(),
    };
  }

  private validateAxiom(axiom: AxiomDefinition): ValidationResult {
    switch (axiom.id) {
      case 'revenue.aggregation':
        return this.validateRevenueAggregation(axiom);
      case 'flow.balance':
        return this.validateFlowBalance(axiom);
      case 'achievement.calculation':
        return this.validateAchievementCalculation(axiom);
      case 'customer.lifecycle':
        return this.validateCustomerLifecycle(axiom);
      case 'pdca.cycle':
        return this.validatePDCACycle(axiom);
      case 'visit.feedback':
        return this.validateVisitFeedback(axiom);
      case 'expense.limit':
        return this.validateExpenseLimit(axiom);
      case 'expense.roi':
        return this.validateExpenseROI(axiom);
      case 'budget.execution':
        return this.validateBudgetExecution(axiom);
      case 'rws.progress':
        return this.validateRWSProgress(axiom);
      case 'patient.retention':
        return this.validatePatientRetention(axiom);
      case 'compliance.meeting.duration':
        return this.validateMeetingDuration(axiom);
      case 'compliance.expense.single':
        return this.validateSingleExpense(axiom);
      case 'compliance.expense.monthly':
        return this.validateMonthlyExpense(axiom);
      case 'compliance.customer.verification':
        return this.validateCustomerVerification(axiom);
      default:
        return this.validateGenericAxiom(axiom);
    }
  }

  private validateRevenueAggregation(axiom: AxiomDefinition): ValidationResult {
    const territories = this.objects.filter(obj => obj.objectType === ObjectType.Territory);
    const territoryPerformances = this.objects.filter(obj => obj.objectType === ObjectType.TerritoryPerformance);
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const territory of territories) {
      const childPerformances = territoryPerformances.filter(tp => 
        tp.properties.parentTerritoryId === territory.id
      );
      
      if (childPerformances.length > 0) {
        const childSum = childPerformances.reduce((sum, tp) => 
          sum + (tp.properties.actualRevenue || 0), 0
        );
        const parentRevenue = territory.properties.totalRevenue || 0;
        
        if (Math.abs(childSum - parentRevenue) > parentRevenue * 0.01) {
          issues.push(`${territory.name}: 子区域汇总(${childSum})与父区域(${parentRevenue})不一致`);
          affectedEntities.push(territory.id);
        }
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有区域销售汇总正确' 
        : `发现 ${issues.length} 处汇总不一致`,
      affectedEntities,
      suggestion: issues.length > 0 ? '检查区域层级关系和销售数据录入' : undefined,
    };
  }

  private validateFlowBalance(axiom: AxiomDefinition): ValidationResult {
    const salesFlows = this.objects.filter(obj => obj.objectType === ObjectType.SalesFlow);
    
    const m1Flows = salesFlows.filter(sf => sf.properties.flowType === 'M1');
    const m2Flows = salesFlows.filter(sf => sf.properties.flowType === 'M2');
    const m3Flows = salesFlows.filter(sf => sf.properties.flowType === 'M3');
    
    const m1Total = m1Flows.reduce((sum, sf) => sum + (sf.properties.actualValue || 0), 0);
    const m2Total = m2Flows.reduce((sum, sf) => sum + (sf.properties.actualValue || 0), 0);
    const m3Total = m3Flows.reduce((sum, sf) => sum + (sf.properties.actualValue || 0), 0);
    const flowSum = m1Total + m2Total + m3Total;

    const salesTargets = this.objects.filter(obj => obj.objectType === ObjectType.SalesTarget);
    const totalSales = salesTargets.reduce((sum, st) => sum + (st.properties.actualValue || 0), 0);

    const passed = Math.abs(flowSum - totalSales) < totalSales * 0.05;

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed,
      message: passed 
        ? '流向数据与总销售平衡' 
        : `流向汇总(${flowSum})与总销售(${totalSales})差异超过5%`,
      affectedEntities: passed ? [] : salesFlows.map(sf => sf.id),
      suggestion: !passed ? '检查M1/M2/M3流向数据完整性' : undefined,
    };
  }

  private validateAchievementCalculation(axiom: AxiomDefinition): ValidationResult {
    const targets = this.objects.filter(obj => 
      obj.objectType === ObjectType.SalesTarget || obj.objectType === ObjectType.SalesFlow
    );
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const target of targets) {
      const targetValue = target.properties.targetValue || 0;
      const actualValue = target.properties.actualValue || 0;
      const achievementRate = target.properties.achievementRate;
      
      if (targetValue > 0 && achievementRate !== undefined) {
        const expectedRate = (actualValue / targetValue) * 100;
        if (Math.abs(achievementRate - expectedRate) > 1) {
          issues.push(`${target.name}: 达成率${achievementRate}%与计算值${expectedRate.toFixed(1)}%不一致`);
          affectedEntities.push(target.id);
        }
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有达成率计算正确' 
        : `发现 ${issues.length} 处达成率计算错误`,
      affectedEntities,
      suggestion: issues.length > 0 ? '重新计算或更新达成率字段' : undefined,
    };
  }

  private validateCustomerLifecycle(axiom: AxiomDefinition): ValidationResult {
    const doctors = this.objects.filter(obj => obj.objectType === ObjectType.Doctor);
    
    const validStages = ['prospect', 'developing', 'mature', 'at_risk', 'churned'];
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const doctor of doctors) {
      const stage = doctor.lifecycleStage;
      if (stage && !validStages.includes(stage)) {
        issues.push(`${doctor.name}: 无效生命周期阶段 "${stage}"`);
        affectedEntities.push(doctor.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有客户生命周期状态有效' 
        : `发现 ${issues.length} 处无效生命周期`,
      affectedEntities,
      suggestion: issues.length > 0 ? '修正客户生命周期阶段' : undefined,
    };
  }

  private validatePDCACycle(axiom: AxiomDefinition): ValidationResult {
    const pdcaPlans = this.objects.filter(obj => obj.objectType === ObjectType.PDCAPlan);
    
    const validStatuses = ['planning', 'doing', 'checking', 'acting', 'completed'];
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const plan of pdcaPlans) {
      const status = plan.properties.cycleStatus;
      if (status && !validStatuses.includes(status)) {
        issues.push(`${plan.name}: 无效PDCA状态 "${status}"`);
        affectedEntities.push(plan.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有PDCA循环状态有效' 
        : `发现 ${issues.length} 处无效PDCA状态`,
      affectedEntities,
      suggestion: issues.length > 0 ? '修正PDCA循环状态' : undefined,
    };
  }

  private validateVisitFeedback(axiom: AxiomDefinition): ValidationResult {
    const visitRecords = this.objects.filter(obj => obj.objectType === ObjectType.VisitRecord);
    
    const visitsWithoutFeedback: string[] = [];
    const affectedEntities: string[] = [];

    for (const visit of visitRecords) {
      const hasFeedback = visit.links.some(link => link.linkType === LinkType.HAS_VISIT) ||
        this.objects.some(obj => 
          obj.objectType === ObjectType.VisitFeedback && 
          obj.properties.visitId === visit.id
        );
      
      if (!hasFeedback && visit.properties.status === 'completed') {
        visitsWithoutFeedback.push(visit.name);
        affectedEntities.push(visit.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: visitsWithoutFeedback.length === 0,
      message: visitsWithoutFeedback.length === 0 
        ? '所有已完成拜访都有反馈' 
        : `发现 ${visitsWithoutFeedback.length} 条已完成拜访缺少反馈`,
      affectedEntities,
      suggestion: visitsWithoutFeedback.length > 0 ? '为已完成拜访添加反馈记录' : undefined,
    };
  }

  private validateExpenseLimit(axiom: AxiomDefinition): ValidationResult {
    const budgets = this.objects.filter(obj => obj.objectType === ObjectType.BudgetCategory);
    
    const overBudgetExpenses: string[] = [];
    const affectedEntities: string[] = [];

    for (const budget of budgets) {
      const budgetAmount = budget.properties.budgetAmount || 0;
      const usedAmount = budget.properties.usedAmount || 0;
      
      if (usedAmount > budgetAmount) {
        overBudgetExpenses.push(`${budget.name}: 已用${usedAmount}超过预算${budgetAmount}`);
        affectedEntities.push(budget.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: overBudgetExpenses.length === 0,
      message: overBudgetExpenses.length === 0 
        ? '所有费用在预算范围内' 
        : `发现 ${overBudgetExpenses.length} 处超预算`,
      affectedEntities,
      suggestion: overBudgetExpenses.length > 0 ? '调整费用支出或申请预算追加' : undefined,
    };
  }

  private validateExpenseROI(axiom: AxiomDefinition): ValidationResult {
    const expenseROIs = this.objects.filter(obj => obj.objectType === ObjectType.ExpenseROI);
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const roi of expenseROIs) {
      const expense = roi.properties.expenseAmount || 0;
      const revenue = roi.properties.revenueGenerated || 0;
      const roiRatio = roi.properties.roiRatio;
      
      if (expense > 0 && roiRatio !== undefined) {
        const expectedROI = (revenue - expense) / expense;
        if (Math.abs(roiRatio - expectedROI) > 0.01) {
          issues.push(`${roi.name}: ROI${roiRatio}与计算值${expectedROI.toFixed(2)}不一致`);
          affectedEntities.push(roi.id);
        }
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有ROI计算正确' 
        : `发现 ${issues.length} 处ROI计算错误`,
      affectedEntities,
      suggestion: issues.length > 0 ? '重新计算ROI' : undefined,
    };
  }

  private validateBudgetExecution(axiom: AxiomDefinition): ValidationResult {
    const budgets = this.objects.filter(obj => obj.objectType === ObjectType.BudgetCategory);
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const budget of budgets) {
      const budgetAmount = budget.properties.budgetAmount || 0;
      const usedAmount = budget.properties.usedAmount || 0;
      const executionRate = budget.properties.executionRate;
      
      if (budgetAmount > 0 && executionRate !== undefined) {
        const expectedRate = (usedAmount / budgetAmount) * 100;
        if (Math.abs(executionRate - expectedRate) > 1) {
          issues.push(`${budget.name}: 执行率${executionRate}%与计算值${expectedRate.toFixed(1)}%不一致`);
          affectedEntities.push(budget.id);
        }
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有预算执行率计算正确' 
        : `发现 ${issues.length} 处执行率计算错误`,
      affectedEntities,
      suggestion: issues.length > 0 ? '重新计算预算执行率' : undefined,
    };
  }

  private validateRWSProgress(axiom: AxiomDefinition): ValidationResult {
    const rwsProjects = this.objects.filter(obj => obj.objectType === ObjectType.RWSProject);
    
    const validStatuses = ['initiated', 'multicenter', 'gcp', 'settlement'];
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const project of rwsProjects) {
      const status = project.properties.status;
      if (status && !validStatuses.includes(status)) {
        issues.push(`${project.name}: 无效RWS状态 "${status}"`);
        affectedEntities.push(project.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有RWS项目状态有效' 
        : `发现 ${issues.length} 处无效RWS状态`,
      affectedEntities,
      suggestion: issues.length > 0 ? '修正RWS项目状态' : undefined,
    };
  }

  private validatePatientRetention(axiom: AxiomDefinition): ValidationResult {
    const patientPrograms = this.objects.filter(obj => obj.objectType === ObjectType.PatientProgram);
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const program of patientPrograms) {
      const enrolled = program.properties.enrolledPatients || 0;
      const active = program.properties.activePatients || 0;
      
      if (active > enrolled) {
        issues.push(`${program.name}: 活跃患者${active}超过入组患者${enrolled}`);
        affectedEntities.push(program.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有患者项目数据合理' 
        : `发现 ${issues.length} 处患者数据异常`,
      affectedEntities,
      suggestion: issues.length > 0 ? '检查患者数据录入' : undefined,
    };
  }

  private validateMeetingDuration(axiom: AxiomDefinition): ValidationResult {
    const meetings = this.objects.filter(obj => obj.objectType === ObjectType.MeetingCompliance);
    const academicEvents = this.objects.filter(obj => obj.objectType === ObjectType.AcademicEvent);
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const meeting of [...meetings, ...academicEvents]) {
      const duration = meeting.properties.duration || meeting.properties.meetingDuration || 0;
      
      if (duration > 4) {
        issues.push(`${meeting.name}: 会议时长${duration}小时超过4小时限制`);
        affectedEntities.push(meeting.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有会议时长合规' 
        : `发现 ${issues.length} 处会议超时`,
      affectedEntities,
      suggestion: issues.length > 0 ? '调整会议时长或申请例外' : undefined,
    };
  }

  private validateSingleExpense(axiom: AxiomDefinition): ValidationResult {
    const expenses = this.objects.filter(obj => 
      obj.objectType === ObjectType.ExpenseClassification || 
      obj.objectType === ObjectType.LaborPayment
    );
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const expense of expenses) {
      const amount = expense.properties.amount || expense.properties.singleAmount || 0;
      
      if (amount > 500) {
        issues.push(`${expense.name}: 单次费用${amount}元超过500元限制`);
        affectedEntities.push(expense.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有单次费用合规' 
        : `发现 ${issues.length} 处单次费用超限`,
      affectedEntities,
      suggestion: issues.length > 0 ? '拆分费用或申请审批' : undefined,
    };
  }

  private validateMonthlyExpense(axiom: AxiomDefinition): ValidationResult {
    const budgets = this.objects.filter(obj => obj.objectType === ObjectType.BudgetCategory);
    
    const issues: string[] = [];
    const affectedEntities: string[] = [];

    for (const budget of budgets) {
      const budgetAmount = budget.properties.budgetAmount || 0;
      const monthlyUsed = budget.properties.monthlyUsed || 0;
      
      if (budgetAmount > 0 && monthlyUsed > budgetAmount * 0.8) {
        issues.push(`${budget.name}: 月度费用${monthlyUsed}超过预算80%`);
        affectedEntities.push(budget.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: issues.length === 0,
      message: issues.length === 0 
        ? '所有月度费用合规' 
        : `发现 ${issues.length} 处月度费用超限`,
      affectedEntities,
      suggestion: issues.length > 0 ? '控制月度费用支出' : undefined,
    };
  }

  private validateCustomerVerification(axiom: AxiomDefinition): ValidationResult {
    const doctors = this.objects.filter(obj => obj.objectType === ObjectType.Doctor);
    const customerCompliance = this.objects.filter(obj => obj.objectType === ObjectType.CustomerCompliance);
    
    const unverifiedDoctors: string[] = [];
    const affectedEntities: string[] = [];

    for (const doctor of doctors) {
      const isVerified = doctor.properties.realNameVerified === true ||
        customerCompliance.some(cc => 
          cc.properties.doctorId === doctor.id && 
          cc.properties.realNameVerified === true
        );
      
      if (!isVerified && doctor.lifecycleStage !== 'prospect') {
        unverifiedDoctors.push(doctor.name);
        affectedEntities.push(doctor.id);
      }
    }

    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: unverifiedDoctors.length === 0,
      message: unverifiedDoctors.length === 0 
        ? '所有客户已完成实名验证' 
        : `发现 ${unverifiedDoctors.length} 位客户未实名验证`,
      affectedEntities,
      suggestion: unverifiedDoctors.length > 0 ? '完成客户实名验证' : undefined,
    };
  }

  private validateGenericAxiom(axiom: AxiomDefinition): ValidationResult {
    return {
      axiomId: axiom.id,
      axiomName: axiom.name,
      constraintType: axiom.constraintType,
      severity: axiom.severity,
      passed: true,
      message: `公理 "${axiom.name}" 暂无具体验证逻辑`,
      affectedEntities: [],
    };
  }

  validateByType(constraintType: 'structural' | 'business' | 'compliance'): ValidationResult[] {
    return this.results.filter(r => r.constraintType === constraintType);
  }

  getErrors(): ValidationResult[] {
    return this.results.filter(r => !r.passed && r.severity === 'error');
  }

  getWarnings(): ValidationResult[] {
    return this.results.filter(r => !r.passed && r.severity === 'warning');
  }

  getHealthScore(): number {
    const total = this.results.length;
    if (total === 0) return 100;
    
    const passed = this.results.filter(r => r.passed).length;
    const errors = this.results.filter(r => !r.passed && r.severity === 'error').length;
    const warnings = this.results.filter(r => !r.passed && r.severity === 'warning').length;
    
    const errorPenalty = errors * 15;
    const warningPenalty = warnings * 5;
    
    return Math.max(0, Math.min(100, (passed / total) * 100 - errorPenalty - warningPenalty));
  }
}
