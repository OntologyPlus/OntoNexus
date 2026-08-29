/** Business-language copy for sales decision makers. No Skill / Gateway / evidence IDs. */

export const TYPE_LABELS: Record<string, string> = {
  Doctor: '医生',
  Hospital: '医院',
  Product: '产品',
  SalesRep: '代表',
  VisitRecord: '拜访记录',
  SalesTarget: '销售目标',
  ComplianceAlert: '合规告警',
  AcademicEvent: '学术活动',
  Territory: '区域',
  RecoveryPlan: '恢复计划',
  SalesFlow: '销售流向',
  MarketPotential: '市场潜力',
  HospitalDevelopment: '医院开发',
  TerritoryPerformance: '区域绩效',
  ProductFlow: '产品流向',
  BudgetCategory: '预算分类',
  ExpenseClassification: '费用分类',
  CostDriver: '成本驱动',
  LaborPayment: '劳务支付',
  ExpenseROI: '费用回报',
  CustomerCategory: '客户分类',
  VisitFeedback: '拜访反馈',
  PDCAPlan: '跟进计划',
  HospitalStrategy: '医院策略',
  DepartmentResearch: '科室调研',
  RWSProject: '真实世界研究',
  ClinicalTrial: '临床试验',
  PatientProgram: '患者项目',
  ResearchCollaboration: '科研合作',
  MeetingCompliance: '会议合规',
  ExpenseCompliance: '费用合规',
  CustomerCompliance: '客户合规',
  ComplianceRule: '合规规则',
  HCP: '医疗卫生专业人士',
};

const SIGNAL_LABELS: Record<string, string> = {
  coverage: '覆盖率',
  visit_effect: '拜访后处方',
  kol: '专家影响力',
  roi: '费用回报',
  product: '产品',
};

const FACT_PREDICATES: Record<string, (name: string, rest?: string[]) => string> = {
  AtRisk: (name) => `${name}处于风险`,
  NeedsFollowUp: (name) => `${name}需要跟进`,
  HCP: (name) => `${name}是医疗卫生专业人士`,
  Doctor: (name) => `${name}是医生`,
  Hospital: (name) => `${name}是医院`,
  Product: (name) => `${name}是产品`,
  SalesRep: (name) => `${name}是代表`,
  SalesTarget: (name) => `${name}是销售目标`,
  Status: (name, rest) => {
    const st = rest?.[0] || '';
    const map: Record<string, string> = { warning: '需关注', critical: '高风险', ok: '正常', healthy: '正常', at_risk: '有风险' };
    return `${name}状态为${map[st] || st || '已知'}`;
  },
  WORKS_AT: (name, rest) => `${name}就职于${rest?.[0] || '医院'}`,
  INFLUENCES: (name, rest) => `${name}影响${rest?.[0] || '他人'}`,
};

const SKILL_LABELS: Record<string, string> = {
  'attribution-analyzer': '原因分析',
  'what-if-simulator': '情景推演',
  'recommend-and-accept': '可执行建议',
  'decision-penetrate': '下钻分析',
  metric_diagnosis: '指标诊断',
  action_operator: '动作提交',
  ontology_lookup: '对象查询',
  causal_explainer: '因果说明',
  recovery_plan_drafter: '跟进草稿',
  report_narrator: '情况说明',
  'alert-manager': '风险提醒',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  manager: '区域经理',
  rep: '销售代表',
  user: '用户',
};

export function typeLabel(type?: string): string {
  if (!type) return '';
  return TYPE_LABELS[type] || type;
}

export function roleLabel(role?: string): string {
  if (!role) return '';
  return ROLE_LABELS[role] || role;
}

export function isAdmin(role?: string): boolean {
  return role === 'admin';
}

export function skillLabel(name?: string): string {
  if (!name) return '建议';
  return SKILL_LABELS[name] || name.replace(/[-_]/g, ' ');
}

export function signalLabel(signal?: string): string {
  if (!signal) return '';
  return SIGNAL_LABELS[signal] || signal;
}

export function claimText(item: unknown): string {
  if (!item) return '';
  const raw = typeof item === 'string' ? item : String((item as { claim?: string }).claim || '');
  return raw
    .replace(/\bKOL\b/g, '专家')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

export function humanizeMissing(raw: string, nameOf?: (id: string) => string): string {
  const named = raw.match(/^(.+?)\s*\(([^)]+)\)\s*(?:未采集|无)\s*(\S+)/i);
  if (named) {
    const person = named[1].trim();
    const key = named[3].replace(/^ROI$/i, 'roi');
    return `尚未掌握：${person}${signalLabel(key) || key}`;
  }
  const noRoi = raw.match(/^([A-Za-z0-9_]+)\s+无\s*ROI/i);
  if (noRoi) {
    const id = noRoi[1];
    return `尚未掌握：${nameOf?.(id) || id}费用回报`;
  }
  let text = raw
    .replace(/未采集/g, '尚未掌握')
    .replace(/\broi\b/gi, '费用回报')
    .replace(/\bvisit_effect\b/gi, '拜访后处方')
    .replace(/\bcoverage\b/gi, '覆盖率')
    .replace(/\bkol\b/gi, '专家影响力');
  text = text.replace(/\(([a-zA-Z0-9_]+)\)/g, (_m, id) => (nameOf?.(id) && nameOf(id) !== id ? '' : ''));
  return text.replace(/\s{2,}/g, ' ').trim();
}

const HIDDEN_ROW_KEYS = new Set([
  'id', 'object_id', 'decision_id', 'skill', 'skill_name', 'parent_decision_id', 'external_id', 'evidence_id',
]);

const ROW_KEY_LABELS: Record<string, string> = {
  achievement_rate: '预测达成率',
  risk: '风险',
  forecast: '预测',
  name: '名称',
  coverage: '覆盖率',
  visit_effect: '拜访后处方',
  roi: '费用回报',
  kol: '专家影响力',
  status: '状态',
};

export function visibleRowEntries(row: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(row).filter(([k, v]) => !HIDDEN_ROW_KEYS.has(k) && v !== undefined && v !== null && v !== '');
}

export function rowKeyLabel(key: string): string {
  return ROW_KEY_LABELS[key] || key;
}

export function stripSystemJargon(text: string): string {
  if (!text) return '';
  let out = text
    .replace(/^###\s+[\w-]+\s*$/gm, '')
    .replace(/\[(?:routing|skill|intent|reasoning)\]\s*/gi, '')
    .replace(/\[证据\s+[^\]]+\]/g, '')
    .replace(/本 Skill 不落库/g, '')
    .replace(/Action Gateway/gi, '')
    .replace(/HR-\d+/g, '')
    .replace(/\bobject_id\b/gi, '')
    .replace(/\bdecision_id\b/gi, '')
    .replace(/\bexternal_id\b/gi, '')
    .replace(/前向链/g, '')
    .replace(/工作记忆/g, '')
    .replace(/落库/g, '执行');
  for (const [name, label] of Object.entries(SKILL_LABELS)) {
    out = out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), label);
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function humanizeFact(raw: unknown, nameOf?: (id: string) => string): string {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const match = text.match(/^([A-Za-z_]+)\(([^)]+)\)$/);
  if (!match) return text;
  const [, pred, args] = match;
  const id = args.split(',')[0].trim();
  const rest = args.split(',').slice(1).map((s) => s.trim()).map((x) => nameOf?.(x) || x);
  const name = nameOf?.(id) || id;
  const fmt = FACT_PREDICATES[pred];
  if (fmt) return fmt(name, rest);
  return `${name}：${pred}`;
}

export function scoreNoteText(note?: string): string {
  if (!note) return COPY.scoreNote.neutral;
  return (COPY.scoreNote as Record<string, string>)[note] || COPY.scoreNote.neutral;
}

export const COPY = {
  product: '医药销售 AI 决策中枢',
  nav: {
    brief: '今日战情',
    watch: '谁需要盯',
    approve: '待你拍板',
    effect: '做完看效果',
    checked: '核对过什么',
    guard: '拦住了什么',
    written: '已经改了什么',
    why: '原因说明',
    whatIf: '先算一算',
    ask: '问一句',
    graph: '关系图',
    system: '系统校验',
    groups: {
      decide: '拍板',
      loop: '闭环',
      analyze: '弄清原因',
      graph: '关系',
      system: '系统',
    },
  },
  today: {
    title: '今日要事',
    description: '风险客户、待审批动作、动作是否见效。',
    watch: '谁需要盯',
    watchHint: '覆盖率、拜访后处方、费用回报、专家影响力。点名单可看详情，也可去关系图或原因说明。',
    decide: '待你拍板',
    submitted: '我已提交',
    effect: '做完看效果',
    effectHint: '批准后约 24 小时，用拜访后处方、覆盖率判断有没有用。',
    evaluate: '查看到期效果',
    evaluated: (n: number) => `已查看 ${n} 条到期效果`,
    due: '已到查看时间',
    approve: '批准执行',
    reject: '退回',
    needManager: '需区域经理审批',
    evidence: '依据',
    noPending: '暂无待你审批的事项',
    noPendingHint: '代表提交建议后会出现在这里。',
    noSubmitted: '还没有提交中的建议。在「问一句」里提交给经理。',
    noWatch: '暂无需要盯的风险客户',
    noEffect: '暂无待看效果的动作。提交并批准后会出现在这里。',
    waiting: '等待区域经理审批',
    goGraph: '看关系图',
    goWhy: '看原因说明',
    submittedBy: '提交人',
    evidenceCount: (n: number) => `${n} 条依据`,
  },
  brief: {
    kicker: '这一案须区域经理当场决定做还是不做。',
    falling: '处方下滑',
    mustSign: '须签批',
    waiting: '待区域经理签批',
    ifNotTitle: '若现在不批',
    ifNot: (stake: string) => `跟进不做，处方还会掉。${stake}已经花出去的费用没有下一手。`,
    ifYesTitle: '若批准执行',
    ifYes: (hours: number) => `代表马上去安排拜访。系统写入拜访记录、通知代表。批准即执行，这一笔记在你名下。约 ${hours} 小时后用拜访后处方验证，不是批完就结案。`,
    already: '系统已经替你做了',
    checkedRel: '关系已核对，不是拍脑袋',
    blockedSelf: '系统已拦住：提交人不能自己批。',
    willVerify: (hours: number) => `批准不是结案，约 ${hours} 小时后看拜访后处方`,
    root: '根因',
    advice: '要你拍板的动作',
    irreversible: '批准即执行，不能当没发生。',
    openGraph: '看关系图',
    seeWhy: '看原因说明',
    seeEvidence: '看依据',
    done: '已批准执行。这一笔记在你名下。',
    doneHint: '到点后用拜访后处方验证有没有用。',
    noPending: '本案还没有待批建议。代表在「问一句」提交后会出现在这里。',
    goAsk: '去问一句',
    goEffect: '去做完看效果',
    goChecked: '去核对过什么',
    goGuard: '去拦住了什么',
    goWritten: '去已经改了什么',
    loopHint: '系统核对、拦住、写入，各在闭环里一页。',
    stakeGap: (gap: string, rate: string) => `本季还差 ${gap}（达成 ${rate}%），会继续空转。`,
    stakeExpense: (yen: string) => `已投入 ${yen} 对不上量。`,
    stakeVisit: (delta: string) => `拜访后处方变化 ${delta}。`,
  },
  why: {
    title: '原因说明',
    description: '这块差在哪：根因、中间原因、表面上的结果。',
    gap: '这块差在哪',
    missing: '还缺哪些数',
    related: '相关判断',
    empty: '还没有原因说明。到「问一句」问「为什么这块达成差」。',
    root: '根因',
    mid: '中间原因',
    surface: '表面上的结果',
    fromPrior: '由刚才那次归因接着做的建议',
  },
  whatIf: {
    title: '先算一算',
    description: '只是推演，不会改销售目标。',
    run: '算一算',
    running: '计算中…',
    pickObject: '看谁',
    current: '当前',
    forecastCol: '推演后',
    risk: '风险',
    achievement: '达成率',
  },
  ask: {
    title: '问一句',
    subtitle: '先问为什么差，再试一种假设，再要可执行建议；代表提交、经理审批。',
    welcome: '先问为什么这块差，再试一种假设，再要可执行建议。代表提交，区域经理审批。点结果里的人可钉住继续问。',
    analyzing: '正在分析…',
    thinking: '分析过程',
    whyGap: '为什么这块差',
    tryWhatIf: '先算一算',
    giveAdvice: '给出建议',
    submit: '提交给经理',
    executed: '已生效',
    pending: '等经理批',
    failed: '未通过',
    pinned: '已钉住当前客户，后续问题会带上',
    stepRel: '在核对这个人的关系',
    stepVisit: '在对照拜访后处方和覆盖率',
    stepAdvice: '在写可执行建议',
    stepSim: '在做情景推演，不改真实目标',
    stepSubmit: '已提交，须区域经理批',
  },
  checked: {
    title: '核对过什么',
    description: '这一案的关系、已确认的判断、数从哪来。不是拍脑袋。',
    relations: '已核对的关系',
    facts: '系统已确认',
    source: '数从哪来',
    signals: '对照过的数',
    missing: '还缺哪些数',
    fromSystem: (name: string, n: number) => `来自 ${name} ${n} 条`,
    noFacts: '还没有推导出新判断。关系图加载后会出现。',
    noSource: '还没有接到 CRM / ERP 档案。',
  },
  guard: {
    title: '拦住了什么',
    description: '谁提交、谁必须签。提交人不能自己批。',
    caseTitle: '这一案',
    submitter: '提交人',
    mustSign: '须区域经理签批',
    youAreSubmitter: '你是提交人，系统拦住你自己批。',
    youMustSign: '提交人不能签，须你签。',
    trySelf: '试一下自己批',
    rules: '系统会拦住这些',
    ruleNoObject: '没有指定客户，不能下动作',
    ruleNeedManager: '高风险动作必须区域经理批过才能执行',
    ruleNoSelf: '提交人不能自己批自己',
    ruleType: '动作必须匹配这个人（医生或医院），对不上就拒',
    history: '已经拦住过',
    none: '还没有拦住记录。代表若自己批，会出现在这里。',
  },
  written: {
    title: '已经改了什么',
    description: '批准之前不会改拜访记录、不会通知代表。批准即写入。',
    empty: '批准之前不会改拜访记录、不会通知代表。',
    goSign: '去今日战情签批',
    done: '已写入世界',
    failed: '写入失败',
    when: '时间',
    next: '写入之后约 24 小时，用拜访后处方验证有没有用。',
  },
  scoreNote: {
    visit_effect_up: '拜访后处方有抬升，这次跟进算管用',
    visit_effect_down: '拜访后处方仍在掉，这次跟进不算管用',
    coverage_ok: '覆盖尚可',
    coverage_low: '覆盖偏低',
    roi_positive: '费用回报为正',
    roi_negative: '费用回报没有对上',
    still_at_risk: '客户仍处于风险',
    status_normal: '状态已回到正常',
    no_object: '还对不上客户',
    object_missing: '还对不上客户',
    neutral: '还看不出有没有用',
  },
  graph: {
    title: '关系图',
  },
  system: {
    title: '系统校验',
    description: '数据是否自洽，以及系统已确认的判断。',
    snapshot: '数据是否自洽',
    facts: '系统已确认',
    trace: '判断步骤',
    rules: '启用中的规则',
    ok: '通过',
    bad: '有问题',
  },
  actionStatus: {
    executed: '已生效',
    pending: '等经理批',
    failed: '未通过',
  },
  login: {
    wang: '王代表 · 提交建议',
    manager: '区域经理 · 审批',
    admin: '管理员 · 含系统校验',
  },
};
