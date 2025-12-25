# ComplianceAI™ Model Ownership — Phase 6
## Domain Rules & Compliance Logic

---

## Phase Overview

| Aspect | Details |
|--------|---------|
| **Duration** | Week 6 (3-4 days) |
| **Objective** | Apply deterministic compliance rules on top of AI extraction |
| **Prerequisites** | Phase 1-5 complete |
| **Outcome** | Auditable compliance interpretation, normalised data |

```
WHAT WE'RE BUILDING:

  AI Extraction
        │
        ▼
  ┌──────────────────┐
  │  NORMALISATION   │ ──► Standardise names, outcomes, dates
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ COMPLIANCE RULES │ ──► Apply regulatory logic
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ AUTO-ACTIONS     │ ──► Flag urgent, mark incomplete, etc.
  └──────────────────┘

  "Deterministic rules on top of probabilistic extraction"
```

---

## Step 1: Create Normalisation Rules

### Prompt 6.1: Normalisation System

```
Create the normalisation system that standardises extracted data.

1. Create directory: src/lib/compliance-rules/

2. Create src/lib/compliance-rules/normalisation.ts:

// ==========================================
// CONTRACTOR NAME NORMALISATION
// ==========================================

const CONTRACTOR_MAPPINGS: Record<string, string> = {
  // Common contractors - lowercase key -> standardised name
  'british gas': 'British Gas',
  'bg services': 'British Gas',
  'british gas services': 'British Gas',
  'bg': 'British Gas',
  
  'homeserve': 'HomeServe',
  'home serve': 'HomeServe',
  'homeserve plc': 'HomeServe',
  
  'pimlico plumbers': 'Pimlico Plumbers',
  'pimlico': 'Pimlico Plumbers',
  
  'dyno': 'Dyno',
  'dyno-rod': 'Dyno-Rod',
  'dynorod': 'Dyno-Rod',
  
  'corgi': 'CORGI Services',
  'corgi services': 'CORGI Services',
  
  'gas safe register': 'Gas Safe Register',
  'gas safe': 'Gas Safe Register',
};

export function normaliseContractorName(name: string | null): string | null {
  if (!name) return null;
  
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  
  // Check exact mappings first
  if (CONTRACTOR_MAPPINGS[lower]) {
    return CONTRACTOR_MAPPINGS[lower];
  }
  
  // Check partial matches
  for (const [pattern, normalized] of Object.entries(CONTRACTOR_MAPPINGS)) {
    if (lower.includes(pattern) && pattern.length > 5) {
      return normalized;
    }
  }
  
  // Title case if no mapping found
  return trimmed
    .split(' ')
    .map(word => {
      if (word.length <= 2) return word.toUpperCase(); // Ltd, UK, etc.
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// ==========================================
// OUTCOME NORMALISATION
// ==========================================

const OUTCOME_MAPPINGS: Record<string, string> = {
  // Pass variations
  'pass': 'PASS',
  'passed': 'PASS',
  'satisfactory': 'SATISFACTORY',
  'sat': 'SATISFACTORY',
  'sat.': 'SATISFACTORY',
  's': 'SATISFACTORY',
  'ok': 'PASS',
  'safe': 'PASS',
  'safe to use': 'PASS',
  
  // Fail variations
  'fail': 'FAIL',
  'failed': 'FAIL',
  'unsatisfactory': 'UNSATISFACTORY',
  'unsat': 'UNSATISFACTORY',
  'unsat.': 'UNSATISFACTORY',
  'u/s': 'UNSATISFACTORY',
  'u': 'UNSATISFACTORY',
  'unsafe': 'FAIL',
  'not safe': 'FAIL',
  'immediately dangerous': 'FAIL',
  'id': 'FAIL',
  
  // Advisory
  'advisory': 'ADVISORY',
  'at risk': 'AT_RISK',
  'ar': 'AT_RISK',
  
  // Not applicable
  'n/a': 'NOT_APPLICABLE',
  'na': 'NOT_APPLICABLE',
  'not applicable': 'NOT_APPLICABLE',
  'not tested': 'NOT_TESTED',
};

export function normaliseOutcome(outcome: string | null): string | null {
  if (!outcome) return null;
  
  const lower = outcome.toLowerCase().trim();
  return OUTCOME_MAPPINGS[lower] || outcome.toUpperCase();
}

// ==========================================
// DATE NORMALISATION
// ==========================================

export function normaliseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // UK format: DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // UK format with 2-digit year
  const ukShortMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (ukShortMatch) {
    const [, day, month, shortYear] = ukShortMatch;
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try JavaScript Date parsing as fallback
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Parsing failed
  }
  
  return dateStr; // Return original if can't parse
}

// ==========================================
// NEXT DUE DATE CALCULATION
// ==========================================

const INSPECTION_FREQUENCIES: Record<string, number> = {
  GAS_SAFETY: 12,        // Annual
  EICR: 60,              // 5 years (domestic)
  FIRE_RISK_ASSESSMENT: 12, // Annual (social housing)
  ASBESTOS: 12,          // Annual re-inspection
  LEGIONELLA: 24,        // 2 years
  EPC: 120,              // 10 years
  LIFT_LOLER: 6,         // 6 months
  SMOKE_CO_ALARM: 12,    // Annual
};

export function calculateNextDueDate(
  inspectionDate: string | null,
  documentType: string,
  customIntervalMonths?: number
): string | null {
  if (!inspectionDate) return null;
  
  const date = new Date(inspectionDate);
  if (isNaN(date.getTime())) return null;
  
  const months = customIntervalMonths || INSPECTION_FREQUENCIES[documentType] || 12;
  
  date.setMonth(date.getMonth() + months);
  
  return date.toISOString().split('T')[0];
}

// ==========================================
// PRIORITY INFERENCE
// ==========================================

const PRIORITY_KEYWORDS = {
  P1: [
    'immediate', 'immediately', 'danger', 'dangerous', 'emergency',
    'urgent', 'life safety', 'life threatening', 'isolate',
    'do not use', 'condemned', 'at risk', 'fatal',
    'c1', 'code 1', 'intolerable'
  ],
  P2: [
    'within 28 days', 'within 30 days', '28 day', '30 day',
    'urgent attention', 'requires attention', 'potentially dangerous',
    'soon', 'priority', 'c2', 'code 2', 'substantial'
  ],
  P3: [
    'advisory', 'recommend', 'recommended', 'consider', 'improvement',
    'routine', 'when convenient', 'minor', 'observation',
    'c3', 'code 3', 'moderate', 'tolerable'
  ],
};

export function inferPriority(description: string | null): 'P1' | 'P2' | 'P3' {
  if (!description) return 'P3';
  
  const lower = description.toLowerCase();
  
  // Check P1 keywords first
  for (const keyword of PRIORITY_KEYWORDS.P1) {
    if (lower.includes(keyword)) return 'P1';
  }
  
  // Then P2
  for (const keyword of PRIORITY_KEYWORDS.P2) {
    if (lower.includes(keyword)) return 'P2';
  }
  
  // Default to P3
  return 'P3';
}

// ==========================================
// REGISTRATION SCHEME NORMALISATION
// ==========================================

const SCHEME_MAPPINGS: Record<string, string> = {
  'niceic': 'NICEIC',
  'napit': 'NAPIT',
  'elecsa': 'ELECSA',
  'eca': 'ECA',
  'gas safe': 'Gas Safe',
  'gas safe register': 'Gas Safe',
  'corgi': 'Gas Safe', // Historical - now Gas Safe
  'bafe': 'BAFE',
  'firas': 'FIRAS',
  'ukas': 'UKAS',
};

export function normaliseRegistrationScheme(scheme: string | null): string | null {
  if (!scheme) return null;
  
  const lower = scheme.toLowerCase().trim();
  return SCHEME_MAPPINGS[lower] || scheme.toUpperCase();
}

// ==========================================
// MAIN NORMALISATION FUNCTION
// ==========================================

export interface NormalisationResult {
  normalisedData: any;
  changes: Array<{
    field: string;
    original: any;
    normalised: any;
  }>;
}

export function normaliseExtraction(
  extraction: any,
  documentType: string
): NormalisationResult {
  const changes: NormalisationResult['changes'] = [];
  const normalised = JSON.parse(JSON.stringify(extraction)); // Deep clone
  
  // Contractor/company name
  if (normalised.engineer?.company) {
    const original = normalised.engineer.company;
    const norm = normaliseContractorName(original);
    if (norm !== original) {
      normalised.engineer.company = norm;
      changes.push({ field: 'engineer.company', original, normalised: norm });
    }
  }
  
  // Engineer name (title case)
  if (normalised.engineer?.name) {
    const original = normalised.engineer.name;
    const norm = normalised.engineer.name.split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    if (norm !== original) {
      normalised.engineer.name = norm;
      changes.push({ field: 'engineer.name', original, normalised: norm });
    }
  }
  
  // Registration scheme
  if (normalised.engineer?.registration_type) {
    const original = normalised.engineer.registration_type;
    const norm = normaliseRegistrationScheme(original);
    if (norm !== original) {
      normalised.engineer.registration_type = norm;
      changes.push({ field: 'engineer.registration_type', original, normalised: norm });
    }
  }
  
  // Outcome
  if (normalised.inspection?.outcome) {
    const original = normalised.inspection.outcome;
    const norm = normaliseOutcome(original);
    if (norm !== original) {
      normalised.inspection.outcome = norm;
      changes.push({ field: 'inspection.outcome', original, normalised: norm });
    }
  }
  
  // Inspection date
  if (normalised.inspection?.date) {
    const original = normalised.inspection.date;
    const norm = normaliseDate(original);
    if (norm !== original) {
      normalised.inspection.date = norm;
      changes.push({ field: 'inspection.date', original, normalised: norm });
    }
  }
  
  // Next due date - calculate if missing
  if (!normalised.inspection?.next_due_date && normalised.inspection?.date) {
    const nextDue = calculateNextDueDate(normalised.inspection.date, documentType);
    if (nextDue) {
      normalised.inspection.next_due_date = nextDue;
      changes.push({ 
        field: 'inspection.next_due_date', 
        original: null, 
        normalised: nextDue 
      });
    }
  }
  
  // Postcode formatting (uppercase, proper spacing)
  if (normalised.property?.postcode) {
    const original = normalised.property.postcode;
    const norm = normalisePostcode(original);
    if (norm !== original) {
      normalised.property.postcode = norm;
      changes.push({ field: 'property.postcode', original, normalised: norm });
    }
  }
  
  // Remedial action priorities
  if (normalised.findings?.remedial_actions) {
    normalised.findings.remedial_actions = normalised.findings.remedial_actions.map(
      (action: any, index: number) => {
        if (!action.priority) {
          const priority = inferPriority(action.description);
          changes.push({
            field: `findings.remedial_actions[${index}].priority`,
            original: null,
            normalised: priority,
          });
          return { ...action, priority };
        }
        return action;
      }
    );
  }
  
  return { normalisedData: normalised, changes };
}

function normalisePostcode(postcode: string): string {
  // Remove extra spaces, uppercase
  const cleaned = postcode.toUpperCase().replace(/\s+/g, '');
  
  // Add space before last 3 characters
  if (cleaned.length >= 5) {
    return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
  }
  
  return cleaned;
}

3. Create src/lib/compliance-rules/normalisation-rules.ts:

import { prisma } from '@/lib/db';

// Database-driven normalisation rules
export async function applyDatabaseNormalisations(
  extraction: any,
  documentType: string
): Promise<any> {
  const rules = await prisma.normalisationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });
  
  let result = JSON.parse(JSON.stringify(extraction));
  
  for (const rule of rules) {
    const value = getNestedValue(result, rule.fieldPath);
    if (!value) continue;
    
    const stringValue = String(value).toLowerCase();
    
    for (const pattern of rule.inputPatterns) {
      if (rule.ruleType === 'MAPPING' && stringValue === pattern.toLowerCase()) {
        setNestedValue(result, rule.fieldPath, rule.outputValue);
        break;
      }
      
      if (rule.ruleType === 'REGEX') {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(stringValue) && rule.outputValue) {
          setNestedValue(result, rule.fieldPath, rule.outputValue);
          break;
        }
      }
    }
  }
  
  return result;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((o, k) => {
    if (!o[k]) o[k] = {};
    return o[k];
  }, obj);
  target[lastKey] = value;
}
```

---

## Step 2: Create Compliance Rules Engine

### Prompt 6.2: Rules Engine

```
Create the compliance rules engine for applying regulatory logic.

1. Create src/lib/compliance-rules/engine.ts:

import { prisma } from '@/lib/db';

// ==========================================
// TYPES
// ==========================================

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 
            'exists' | 'not_exists' | 'greater_than' | 'less_than' |
            'in_list' | 'matches_regex';
  value: any;
}

export interface ComplianceRuleResult {
  ruleCode: string;
  ruleName: string;
  triggered: boolean;
  action: 'FLAG_URGENT' | 'MARK_INCOMPLETE' | 'AUTO_FAIL' | 'INFO' | 'WARNING';
  priority: 'P1' | 'P2' | 'P3' | null;
  message: string;
  legislation?: string;
  affectedField?: string;
}

export interface ComplianceEvaluationResult {
  results: ComplianceRuleResult[];
  summary: {
    totalRules: number;
    triggered: number;
    urgent: number;
    warnings: number;
    info: number;
  };
  autoActions: Array<{
    action: string;
    priority: string;
    reason: string;
  }>;
}

// ==========================================
// RULE EVALUATION
// ==========================================

export async function evaluateComplianceRules(
  extraction: any,
  documentType: string
): Promise<ComplianceEvaluationResult> {
  // Load active rules for this document type
  const rules = await prisma.complianceRule.findMany({
    where: {
      documentType,
      isActive: true,
    },
  });
  
  const results: ComplianceRuleResult[] = [];
  
  for (const rule of rules) {
    const conditions = rule.conditions as RuleCondition[];
    const logic = rule.conditionLogic as 'AND' | 'OR';
    
    const triggered = evaluateConditions(extraction, conditions, logic);
    
    results.push({
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      triggered,
      action: rule.action as any,
      priority: triggered ? (rule.priority as any) : null,
      message: triggered ? rule.description : '',
      legislation: rule.legislation || undefined,
    });
  }
  
  // Calculate summary
  const triggeredResults = results.filter(r => r.triggered);
  const summary = {
    totalRules: results.length,
    triggered: triggeredResults.length,
    urgent: triggeredResults.filter(r => r.action === 'FLAG_URGENT' || r.action === 'AUTO_FAIL').length,
    warnings: triggeredResults.filter(r => r.action === 'WARNING').length,
    info: triggeredResults.filter(r => r.action === 'INFO').length,
  };
  
  // Generate auto-actions
  const autoActions = triggeredResults
    .filter(r => r.action !== 'INFO')
    .map(r => ({
      action: r.action,
      priority: r.priority || 'P3',
      reason: r.message,
    }));
  
  return { results, summary, autoActions };
}

function evaluateConditions(
  extraction: any,
  conditions: RuleCondition[],
  logic: 'AND' | 'OR'
): boolean {
  if (conditions.length === 0) return false;
  
  const results = conditions.map(c => evaluateCondition(extraction, c));
  
  if (logic === 'AND') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

function evaluateCondition(
  extraction: any,
  condition: RuleCondition
): boolean {
  const value = getNestedValue(extraction, condition.field);
  
  switch (condition.operator) {
    case 'equals':
      return normaliseForComparison(value) === normaliseForComparison(condition.value);
      
    case 'not_equals':
      return normaliseForComparison(value) !== normaliseForComparison(condition.value);
      
    case 'contains':
      if (Array.isArray(value)) {
        return value.some(v => matchesValue(v, condition.value));
      }
      if (typeof value === 'string') {
        return value.toLowerCase().includes(String(condition.value).toLowerCase());
      }
      return false;
      
    case 'not_contains':
      if (Array.isArray(value)) {
        return !value.some(v => matchesValue(v, condition.value));
      }
      if (typeof value === 'string') {
        return !value.toLowerCase().includes(String(condition.value).toLowerCase());
      }
      return true;
      
    case 'exists':
      return value !== null && value !== undefined && value !== '';
      
    case 'not_exists':
      return value === null || value === undefined || value === '';
      
    case 'greater_than':
      return Number(value) > Number(condition.value);
      
    case 'less_than':
      return Number(value) < Number(condition.value);
      
    case 'in_list':
      const list = Array.isArray(condition.value) ? condition.value : [condition.value];
      return list.includes(value);
      
    case 'matches_regex':
      try {
        const regex = new RegExp(condition.value, 'i');
        return regex.test(String(value));
      } catch {
        return false;
      }
      
    default:
      return false;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => {
    if (o === null || o === undefined) return undefined;
    // Handle array notation like "codes[].code"
    if (k.includes('[]')) {
      const arrayKey = k.replace('[]', '');
      if (Array.isArray(o[arrayKey])) {
        return o[arrayKey];
      }
    }
    return o[k];
  }, obj);
}

function normaliseForComparison(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().trim();
}

function matchesValue(item: any, target: any): boolean {
  if (typeof item === 'object' && typeof target === 'object') {
    // Compare object properties
    for (const key of Object.keys(target)) {
      if (item[key] !== target[key]) return false;
    }
    return true;
  }
  return normaliseForComparison(item) === normaliseForComparison(target);
}

2. Create src/lib/compliance-rules/predefined-rules.ts:

import { prisma } from '@/lib/db';

// ==========================================
// PREDEFINED COMPLIANCE RULES
// ==========================================

export const PREDEFINED_RULES = [
  // ==========================================
  // GAS SAFETY RULES
  // ==========================================
  {
    ruleCode: 'GAS_APPLIANCE_FAIL',
    ruleName: 'Gas Appliance Failed',
    documentType: 'GAS_SAFETY',
    conditions: [
      { field: 'gas_specific.appliances', operator: 'contains', value: { result: 'FAIL' } }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'One or more gas appliances failed safety check - immediate action required',
    legislation: 'Gas Safety (Installation and Use) Regulations 1998',
  },
  {
    ruleCode: 'GAS_NO_CO_ALARM',
    ruleName: 'No CO Alarm Present',
    documentType: 'GAS_SAFETY',
    conditions: [
      { field: 'gas_specific.alarms.co_alarm_present', operator: 'equals', value: false }
    ],
    conditionLogic: 'AND',
    action: 'WARNING',
    priority: 'P2',
    description: 'No carbon monoxide alarm present - strongly recommended for all properties with gas appliances',
    legislation: 'Smoke and CO Alarm Regulations 2015',
  },
  {
    ruleCode: 'GAS_MISSING_APPLIANCES',
    ruleName: 'No Appliances Listed',
    documentType: 'GAS_SAFETY',
    conditions: [
      { field: 'gas_specific.appliance_count', operator: 'equals', value: 0 }
    ],
    conditionLogic: 'AND',
    action: 'MARK_INCOMPLETE',
    priority: 'P2',
    description: 'Certificate lists no appliances - may be incomplete',
  },
  {
    ruleCode: 'GAS_OVERALL_FAIL',
    ruleName: 'Overall Gas Safety Fail',
    documentType: 'GAS_SAFETY',
    conditions: [
      { field: 'inspection.outcome', operator: 'in_list', value: ['FAIL', 'UNSATISFACTORY'] }
    ],
    conditionLogic: 'AND',
    action: 'AUTO_FAIL',
    priority: 'P1',
    description: 'Gas safety certificate shows overall fail - property may be unsafe',
    legislation: 'Gas Safety (Installation and Use) Regulations 1998',
  },
  
  // ==========================================
  // EICR RULES
  // ==========================================
  {
    ruleCode: 'EICR_C1_DANGER',
    ruleName: 'EICR C1 Code - Danger Present',
    documentType: 'EICR',
    conditions: [
      { field: 'eicr_specific.code_summary.c1_count', operator: 'greater_than', value: 0 }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'C1 code indicates danger present - requires immediate action (within 24 hours)',
    legislation: 'Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020',
  },
  {
    ruleCode: 'EICR_C2_POTENTIALLY_DANGEROUS',
    ruleName: 'EICR C2 Code - Potentially Dangerous',
    documentType: 'EICR',
    conditions: [
      { field: 'eicr_specific.code_summary.c2_count', operator: 'greater_than', value: 0 }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P2',
    description: 'C2 code indicates potential danger - requires urgent remedial action within 28 days',
    legislation: 'Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020',
  },
  {
    ruleCode: 'EICR_UNSATISFACTORY',
    ruleName: 'EICR Unsatisfactory Assessment',
    documentType: 'EICR',
    conditions: [
      { field: 'eicr_specific.overall_assessment', operator: 'equals', value: 'UNSATISFACTORY' }
    ],
    conditionLogic: 'AND',
    action: 'AUTO_FAIL',
    priority: 'P1',
    description: 'EICR assessment is unsatisfactory - remedial work required within 28 days',
    legislation: 'Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020',
  },
  {
    ruleCode: 'EICR_FI_REQUIRED',
    ruleName: 'EICR Further Investigation Required',
    documentType: 'EICR',
    conditions: [
      { field: 'eicr_specific.code_summary.fi_count', operator: 'greater_than', value: 0 }
    ],
    conditionLogic: 'AND',
    action: 'WARNING',
    priority: 'P2',
    description: 'Further investigation codes present - additional inspection needed',
  },
  
  // ==========================================
  // FIRE RISK ASSESSMENT RULES
  // ==========================================
  {
    ruleCode: 'FRA_INTOLERABLE_RISK',
    ruleName: 'Fire Risk Intolerable',
    documentType: 'FIRE_RISK_ASSESSMENT',
    conditions: [
      { field: 'fra_specific.overall_risk', operator: 'equals', value: 'INTOLERABLE' }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'Intolerable fire risk identified - immediate action required before occupation',
    legislation: 'Regulatory Reform (Fire Safety) Order 2005',
  },
  {
    ruleCode: 'FRA_SUBSTANTIAL_RISK',
    ruleName: 'Fire Risk Substantial',
    documentType: 'FIRE_RISK_ASSESSMENT',
    conditions: [
      { field: 'fra_specific.overall_risk', operator: 'equals', value: 'SUBSTANTIAL' }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P2',
    description: 'Substantial fire risk identified - urgent action required',
    legislation: 'Regulatory Reform (Fire Safety) Order 2005',
  },
  {
    ruleCode: 'FRA_ESCAPE_ISSUES',
    ruleName: 'Means of Escape Issues',
    documentType: 'FIRE_RISK_ASSESSMENT',
    conditions: [
      { field: 'fra_specific.means_of_escape.escape_routes_adequate', operator: 'equals', value: false }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'Means of escape inadequate - critical fire safety issue',
    legislation: 'Regulatory Reform (Fire Safety) Order 2005',
  },
  
  // ==========================================
  // ASBESTOS RULES
  // ==========================================
  {
    ruleCode: 'ASBESTOS_HIGH_RISK',
    ruleName: 'High Risk Asbestos Material',
    documentType: 'ASBESTOS',
    conditions: [
      { field: 'asbestos_specific.risk_summary.high_risk_count', operator: 'greater_than', value: 0 }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'High-risk asbestos containing materials identified - management plan required',
    legislation: 'Control of Asbestos Regulations 2012',
  },
  {
    ruleCode: 'ASBESTOS_REMOVAL_REQUIRED',
    ruleName: 'Asbestos Removal Required',
    documentType: 'ASBESTOS',
    conditions: [
      { field: 'asbestos_specific.removal_required', operator: 'equals', value: true }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'Asbestos removal recommended - engage licensed contractor',
    legislation: 'Control of Asbestos Regulations 2012',
  },
  
  // ==========================================
  // LEGIONELLA RULES
  // ==========================================
  {
    ruleCode: 'LEGIONELLA_HIGH_RISK',
    ruleName: 'High Legionella Risk',
    documentType: 'LEGIONELLA',
    conditions: [
      { field: 'legionella_specific.overall_risk', operator: 'equals', value: 'HIGH' }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'High legionella risk identified - immediate control measures required',
    legislation: 'HSE ACOP L8',
  },
  {
    ruleCode: 'LEGIONELLA_TEMP_NON_COMPLIANT',
    ruleName: 'Water Temperature Non-Compliant',
    documentType: 'LEGIONELLA',
    conditions: [
      { field: 'legionella_specific.temperature_compliance.hot_water_compliant', operator: 'equals', value: false }
    ],
    conditionLogic: 'OR',
    action: 'WARNING',
    priority: 'P2',
    description: 'Water temperatures outside safe ranges - adjust system settings',
    legislation: 'HSE ACOP L8',
  },
  
  // ==========================================
  // LIFT/LOLER RULES
  // ==========================================
  {
    ruleCode: 'LIFT_UNSAFE',
    ruleName: 'Lift Not Safe to Use',
    documentType: 'LIFT_LOLER',
    conditions: [
      { field: 'lift_specific.safe_to_use', operator: 'equals', value: false }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'Lift declared not safe to use - take out of service immediately',
    legislation: 'LOLER 1998',
  },
  {
    ruleCode: 'LIFT_IMMEDIATE_DEFECTS',
    ruleName: 'Lift Immediate Defects',
    documentType: 'LIFT_LOLER',
    conditions: [
      { field: 'lift_specific.defect_summary.immediate_count', operator: 'greater_than', value: 0 }
    ],
    conditionLogic: 'AND',
    action: 'FLAG_URGENT',
    priority: 'P1',
    description: 'Immediate defects identified - rectify before continued use',
    legislation: 'LOLER 1998',
  },
];

// ==========================================
// SEED FUNCTION
// ==========================================

export async function seedPredefinedRules(): Promise<void> {
  console.log('Seeding predefined compliance rules...');
  
  for (const rule of PREDEFINED_RULES) {
    await prisma.complianceRule.upsert({
      where: { ruleCode: rule.ruleCode },
      update: {
        ruleName: rule.ruleName,
        conditions: rule.conditions,
        conditionLogic: rule.conditionLogic,
        action: rule.action,
        priority: rule.priority,
        description: rule.description,
        legislation: rule.legislation,
        isActive: true,
      },
      create: {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        documentType: rule.documentType,
        conditions: rule.conditions,
        conditionLogic: rule.conditionLogic,
        action: rule.action,
        priority: rule.priority,
        description: rule.description,
        legislation: rule.legislation,
        isActive: true,
      },
    });
  }
  
  console.log(`Seeded ${PREDEFINED_RULES.length} compliance rules`);
}

3. Create src/lib/compliance-rules/index.ts:

export * from './normalisation';
export * from './engine';
export { seedPredefinedRules, PREDEFINED_RULES } from './predefined-rules';
```

---

## Step 3: Integrate into Pipeline

### Prompt 6.3: Pipeline Integration

```
Update the unified processing pipeline to include normalisation and compliance rules.

1. Create src/lib/extraction/unified-pipeline.ts:

import { routeAndExtract, RoutedExtractionResult } from './router';
import { normaliseExtraction, NormalisationResult } from '../compliance-rules/normalisation';
import { evaluateComplianceRules, ComplianceEvaluationResult } from '../compliance-rules/engine';
import { prisma } from '../db';

export interface UnifiedProcessingResult {
  success: boolean;
  
  // Extraction stages
  classification: any;
  rawExtraction: any;
  validation: any;
  repair?: any;
  
  // Post-processing stages (NEW)
  normalisation: NormalisationResult;
  compliance: ComplianceEvaluationResult;
  
  // Final output
  finalExtraction: any;
  
  // Processing metadata
  processing: {
    tier: number;
    cost: number;
    timeMs: number;
    schemaVersion: string;
    modelVersion: string;
    repairAttempts: number;
    normalisationChanges: number;
    complianceRulesTriggered: number;
  };
  
  // Actions required
  requiresReview: boolean;
  urgentActions: Array<{
    action: string;
    priority: string;
    reason: string;
  }>;
  
  // Database record
  extractionRunId: string;
}

export async function processDocumentUnified(
  certificateId: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
  organisationId: string,
  options: {
    maxTier?: number;
    skipNormalisation?: boolean;
    skipComplianceRules?: boolean;
    forceDocType?: string;
  } = {}
): Promise<UnifiedProcessingResult> {
  const startTime = Date.now();
  
  // Step 1: Route and extract (includes classification, extraction, validation, repair)
  const extractionResult = await routeAndExtract(buffer, mimeType, {
    filename,
    uploadId: certificateId,
    organisationId,
    maxTier: options.maxTier,
    forceDocType: options.forceDocType as any,
  });
  
  const documentType = extractionResult.classification.document_type;
  let currentExtraction = extractionResult.extraction;
  
  // Step 2: Normalise data
  let normalisation: NormalisationResult = { normalisedData: currentExtraction, changes: [] };
  
  if (!options.skipNormalisation) {
    normalisation = normaliseExtraction(currentExtraction, documentType);
    currentExtraction = normalisation.normalisedData;
  }
  
  // Step 3: Apply compliance rules
  let compliance: ComplianceEvaluationResult = {
    results: [],
    summary: { totalRules: 0, triggered: 0, urgent: 0, warnings: 0, info: 0 },
    autoActions: [],
  };
  
  if (!options.skipComplianceRules) {
    compliance = await evaluateComplianceRules(currentExtraction, documentType);
  }
  
  // Step 4: Determine if review is needed
  const requiresReview = 
    !extractionResult.validation.valid ||
    (currentExtraction.extraction_metadata?.confidence || 0) < 0.8 ||
    compliance.summary.urgent > 0;
  
  // Step 5: Get urgent actions
  const urgentActions = compliance.autoActions.filter(
    a => a.priority === 'P1' || a.action === 'FLAG_URGENT' || a.action === 'AUTO_FAIL'
  );
  
  // Step 6: Save extraction run
  const schema = await prisma.extractionSchema.findFirst({
    where: { documentType, isActive: true },
  });
  
  const extractionRun = await prisma.extractionRun.create({
    data: {
      certificateId,
      schemaId: schema?.id,
      modelVersion: extractionResult.processing.modelVersion,
      promptVersion: `${documentType.toLowerCase()}_v1.0`,
      schemaVersion: extractionResult.processing.schemaVersion,
      documentType,
      classificationConfidence: extractionResult.classification.confidence,
      rawOutput: extractionResult.rawExtraction,
      validatedOutput: extractionResult.validation.valid ? extractionResult.rawExtraction : null,
      repairedOutput: extractionResult.repair?.attempted ? extractionResult.extraction : null,
      normalisedOutput: normalisation.changes.length > 0 ? currentExtraction : null,
      finalOutput: currentExtraction,
      confidence: currentExtraction.extraction_metadata?.confidence || 0,
      processingTier: extractionResult.processing.tier,
      processingTimeMs: Date.now() - startTime,
      processingCost: extractionResult.processing.cost,
      validationErrors: extractionResult.validation.errors,
      validationPassed: extractionResult.validation.valid,
      repairAttempts: extractionResult.processing.repairAttempts || 0,
      status: requiresReview ? 'AWAITING_REVIEW' : 'APPROVED',
    },
  });
  
  // Step 7: Update certificate
  await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      processingStatus: requiresReview ? 'REVIEW_REQUIRED' : 'COMPLETED',
      processingTier: extractionResult.processing.tier,
      processingCost: extractionResult.processing.cost,
    },
  });
  
  // Step 8: Create compliance alerts if urgent
  if (urgentActions.length > 0) {
    // Create alerts/tasks for urgent items
    for (const action of urgentActions) {
      await prisma.remedialAction.create({
        data: {
          organisationId,
          certificateId,
          description: action.reason,
          priority: action.priority,
          status: 'OPEN',
          source: 'COMPLIANCE_RULE',
          dueDate: calculateDueDate(action.priority),
        },
      });
    }
  }
  
  return {
    success: true,
    classification: extractionResult.classification,
    rawExtraction: extractionResult.rawExtraction,
    validation: extractionResult.validation,
    repair: extractionResult.repair,
    normalisation,
    compliance,
    finalExtraction: currentExtraction,
    processing: {
      tier: extractionResult.processing.tier,
      cost: extractionResult.processing.cost,
      timeMs: Date.now() - startTime,
      schemaVersion: extractionResult.processing.schemaVersion,
      modelVersion: extractionResult.processing.modelVersion,
      repairAttempts: extractionResult.processing.repairAttempts || 0,
      normalisationChanges: normalisation.changes.length,
      complianceRulesTriggered: compliance.summary.triggered,
    },
    requiresReview,
    urgentActions,
    extractionRunId: extractionRun.id,
  };
}

function calculateDueDate(priority: string): Date {
  const now = new Date();
  switch (priority) {
    case 'P1':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    case 'P2':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    default:
      return new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000); // 28 days
  }
}

2. Update the seed script to include compliance rules:

// Add to prisma/seed.ts

import { seedPredefinedRules } from '../src/lib/compliance-rules';

async function main() {
  // ... existing seed code ...
  
  await seedExtractionSchemas();
  await seedPredefinedRules();
}

Run: npx prisma db seed
```

---

## Verification Checklist

After completing Phase 6, verify:

```
□ Normalisation works
  - Contractor names standardised
  - Outcomes mapped correctly
  - Dates converted to ISO format
  - Next due calculated when missing
  - Priorities inferred for remedials

□ Compliance rules evaluate
  - Gas Safety fail triggers P1
  - EICR C1/C2 codes trigger alerts
  - FRA intolerable risk flagged
  - Rules loaded from database

□ Pipeline integration complete
  - processDocumentUnified uses normalisation
  - Compliance results included in output
  - Urgent actions create remedial records
  - Certificate status reflects urgency

□ Rules seeded
  - Run: npx prisma db seed
  - Check ComplianceRule table has entries

□ Auto-actions created
  - Upload failing certificate
  - Verify RemedialAction created with correct priority
```

---

## Files Created in Phase 6

```
src/lib/compliance-rules/
  normalisation.ts
  normalisation-rules.ts
  engine.ts
  predefined-rules.ts
  index.ts

src/lib/extraction/
  unified-pipeline.ts

prisma/
  seed.ts (updated)
```
