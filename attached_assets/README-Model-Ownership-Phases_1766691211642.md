# ComplianceAI™ Model Ownership Guide
## Phase-by-Phase Implementation for AI Coding Agents

---

## Overview

This guide transforms ComplianceAI from "using Claude API" to **owning the extraction system**. Each phase is a self-contained document with prompts ready for Replit Agent or Lovable.

```
THE LASHAN MODEL OWNERSHIP STACK:

┌─────────────────────────────────────────────────────────┐
│  Phase 7: IMPROVEMENT LOOP                              │
│  Weekly iteration, training data export, insights       │
├─────────────────────────────────────────────────────────┤
│  Phase 6: DOMAIN RULES                                  │
│  Compliance logic, normalisation, auto-actions          │
├─────────────────────────────────────────────────────────┤
│  Phase 5: BENCHMARKING                                  │
│  Scoring, evaluation runs, release gating               │
├─────────────────────────────────────────────────────────┤
│  Phase 4: HUMAN REVIEW                                  │
│  Review UI, corrections capture, data flywheel          │
├─────────────────────────────────────────────────────────┤
│  Phase 3: REPAIR PIPELINE                               │
│  Field validators, repair prompts, self-correction      │
├─────────────────────────────────────────────────────────┤
│  Phase 2: CLASSIFICATION & ROUTING                      │
│  Document classifier, doc-type extractors               │
├─────────────────────────────────────────────────────────┤
│  Phase 1: SCHEMA & VALIDATION                           │
│  TypeScript types, Zod validators, database tables      │
├─────────────────────────────────────────────────────────┤
│  CLAUDE API (Engine)                                    │
│  Anthropic provides the model, Lashan owns the system   │
└─────────────────────────────────────────────────────────┘
```

---

## Phase Documents

| Phase | Document | Duration | Key Deliverables |
|-------|----------|----------|------------------|
| **1** | `Phase1-Schema-Validation.md` | Week 1 | Database tables, TypeScript types, Zod validators |
| **2** | `Phase2-Classification-Routing.md` | Week 2 | Document classifier, routing system, extractors |
| **3** | `Phase3-Repair-Pipeline.md` | Week 3 | Field validators, repair prompts, self-correction |
| **4** | `Phase4-Human-Review-Flywheel.md` | Week 4 | Review UI, correction capture, error tagging |
| **5** | `Phase5-Benchmarking-Evaluation.md` | Week 5 | Scorer, benchmark runner, release gating |
| **6** | `Phase6-Domain-Rules.md` | Week 6 | Normalisation, compliance rules, auto-actions |
| **7** | `Phase7-Improvement-Loop.md` | Ongoing | Insights dashboard, weekly process, training export |

---

## How to Use These Documents

### With Replit Agent

1. Open your ComplianceAI project in Replit
2. Open the Phase document for your current phase
3. Copy each prompt block (starts with ``` and ends with ```)
4. Paste into Replit Agent chat
5. Review and test the generated code
6. Move to next prompt in the phase

### With Lovable

1. Open Lovable with your project
2. Copy the prompt blocks one at a time
3. Paste and let Lovable implement
4. Verify functionality before continuing
5. Commit changes after each working feature

### Key Tips

- **Complete phases in order** — each builds on the previous
- **Test after each prompt** — don't move on until it works
- **Commit frequently** — save your progress
- **Read the verification checklist** — at the end of each phase

---

## Implementation Timeline

```
Week 1:  Phase 1 - Schema & Validation
Week 2:  Phase 2 - Classification & Routing  
Week 3:  Phase 3 - Repair Pipeline
Week 4:  Phase 4 - Human Review
Week 5:  Phase 5 - Benchmarking
Week 6:  Phase 6 - Domain Rules
Week 7+: Phase 7 - Improvement Loop (ongoing)
```

---

## What You're Building

### Phase 1: Behaviour Contract
- **Versioned schemas** — GasSafetySchema v1.0, EICRSchema v1.0, etc.
- **Type safety** — TypeScript types for all extraction outputs
- **Validation** — Zod validators catch malformed data

### Phase 2: Smart Routing
- **Document classifier** — Identifies Gas/EICR/FRA/etc. automatically
- **Tailored extractors** — Each doc type has optimised prompts
- **Confidence tracking** — Know when extraction is uncertain

### Phase 3: Self-Correction
- **Field validators** — Catch invalid dates, postcodes, names
- **Repair prompts** — Re-ask for specific failed fields
- **Auto-retry** — Fix errors without human intervention

### Phase 4: Data Flywheel
- **Review UI** — Side-by-side document and extraction
- **Change tracking** — Record what humans correct
- **Error tagging** — Categorise why extraction failed

### Phase 5: Quality Metrics
- **Benchmark sets** — "Gold standard" test certificates
- **Scoring engine** — Quantify accuracy (exact match, fuzzy, lists)
- **Release gating** — Only ship if score improves

### Phase 6: Domain Expertise
- **Normalisation** — Standardise contractor names, outcomes
- **Compliance rules** — C1 = urgent, EICR unsatisfactory = fail
- **Auto-actions** — Create remedials automatically

### Phase 7: Continuous Improvement
- **Insights dashboard** — See accuracy trends, top errors
- **Training data export** — Use corrections for fine-tuning
- **Weekly process** — Structured improvement workflow

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total prompts across all phases | ~30 |
| Database tables added | 8 |
| TypeScript type files | 12 |
| API endpoints added | 15+ |
| UI components added | 10+ |

---

## Prerequisites

Before starting Phase 1, ensure you have:

✅ Core ComplianceAI app built (from Complete Build Guide)
✅ Database running (PostgreSQL)
✅ Authentication working
✅ File upload/storage working
✅ Basic certificate processing working

---

## After Completion

When you finish all 7 phases, you will have:

1. **Owned schemas** — Your extraction format, versioned
2. **Classification system** — 95%+ document type accuracy
3. **Self-healing extraction** — Repairs common errors automatically
4. **Correction flywheel** — Every human edit improves the system
5. **Quantified quality** — Benchmark scores, trend tracking
6. **Compliance automation** — Domain rules applied consistently
7. **Improvement process** — Weekly gains, measured and tracked

**Anthropic is the engine; Lashan owns the system.**

---

## Support

For each phase, the document includes:
- Step-by-step prompts
- Complete code examples
- Verification checklists
- Files created summary

Work through one phase at a time, verify everything works, then proceed.

Good luck! 🚀
