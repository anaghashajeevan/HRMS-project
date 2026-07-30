# Annual Employee KRA & KPI Management Workflow

**Purpose:** Proposed workflow for an individual employee KRA/KPI system with annual planning, quarterly and monthly targets, date-driven reviews, and automatic carry-forward of incomplete targets.

**Scope:** This is a process and sheet-design document only. It does not change application code.

## 1. What changes from the current cycle-based workflow

The existing performance flow is based on separate performance cycles (monthly, quarterly, half-yearly, or yearly), each with its own scorecard and review phases.

The proposed process uses **one annual performance plan per employee**. Quarters and months are target-tracking and review periods within that annual plan; they are not separate scorecards.

Key principles:

- KRAs are assigned individually. Two employees can have completely different KRAs.
- Each KRA and KPI has its own start and end date.
- Each KPI has an annual target, quarterly targets, and monthly targets/checkpoints where relevant.
- KPI weights are maintained inside the KRA; KRA weights are maintained inside the employee's annual plan.
- A review is due when the relevant KPI/KRA end date is reached.
- An incomplete target is retained in history and carried into the next quarter as a tracked carry-forward amount.

## 2. Core structure

    Annual Employee Performance Plan
      ├── Employee-specific KRA 1 (KRA weight)
      │     ├── KPI 1 (KPI weight, annual target, quarterly/monthly targets)
      │     └── KPI 2 (KPI weight, annual target, quarterly/monthly targets)
      ├── Employee-specific KRA 2 (KRA weight)
      ├── Review records (date-driven)
      └── Carry-forward records (quarter to quarter)

Validation rules:

- Total KRA weight for one employee's annual plan must equal **100%**.
- Total KPI weight inside each KRA must equal **100%**.
- The sum of original quarterly targets should reconcile with the annual target for measurable numeric KPIs.
- Monthly targets should reconcile with their quarter target where a monthly breakdown is used.
- Carry-forward must be recorded separately; it must not overwrite the original quarterly target or actual.

## 3. Annual workflow

### Step 1 — March: Create the annual employee plan

HR and the reporting manager create one annual plan for each employee for the coming financial year. The manager assigns employee-specific KRAs, then defines KPI weights and measurable targets.

Example employee: **Jithin, Software Engineer**

| KRA | Weight |
|---|---:|
| Sprint Delivery | 35% |
| Code Quality | 30% |
| Team Collaboration | 20% |
| Learning & Compliance | 15% |
| **Total** | **100%** |

### Step 2 — March: Set targets and dates

For every KPI, set:

- KPI name, metric type, formula and data source
- KPI weight inside its KRA
- Annual target
- Q1, Q2, Q3 and Q4 original targets
- Monthly targets/checkpoints where applicable
- Start date, end date/review date, action plan and evidence requirements

The employee and manager approve the plan before 1 April. The original approved plan is locked. Any later target change requires a controlled revision with reason and approval.

### Step 3 — April onward: Work and progress updates

The employee works against the annual plan and can periodically enter actuals, comments and evidence. Monthly figures are progress checkpoints, not a new scorecard or a new rating cycle.

### Step 4 — Date-driven review

When an individual KPI or KRA reaches its configured end date, it moves to **Review Due**.

The employee enters actual achievement, comments and evidence. The manager verifies actuals, enters comments/rating, and approves or returns the review. This permits different KPIs to have different review schedules.

### Step 5 — Quarterly review and carry-forward

At quarter end, review all KPIs whose quarter review date falls in that period.

If a target is incomplete, preserve the original target and actual for that quarter, calculate the shortfall, then add the shortfall to the following quarter's target as a carry-forward amount.

Example: Story points completed

| Item | Value |
|---|---:|
| Q1 original target | 40 |
| Q1 actual | 34 |
| Q1 shortfall/carry-forward | 6 |
| Q2 original target | 40 |
| Q2 revised target | 46 |

The Q1 result remains **34 out of 40**. It is never changed to hide the shortfall. The six points are shown in Q2 as a separate carry-forward component.

Overachievement should be recorded separately. Whether it reduces a future target should be an HR policy choice, not an automatic default.

### Step 6 — Year-end closure

At the end of March, all quarterly actuals and carry-forward results roll up to each annual KPI. KPI scores roll up to KRA scores, then KRA scores roll up to the employee's final annual score and rating.

    KRA score = Sum of (KPI score × KPI weight within the KRA)
    Final annual score = Sum of (KRA score × KRA weight)

## 4. Example: Jithin's annual target plan

### KRA 1 — Sprint Delivery (KRA weight: 35%)

| KPI | KPI Weight | Annual Target | Q1 | Q2 | Q3 | Q4 | Data Source |
|---|---:|---:|---:|---:|---:|---:|---|
| Story points completed | 70% | 160 | 40 | 40 | 40 | 40 | Jira |
| Sprint commitment success | 30% | 90% | 90% | 90% | 90% | 90% | Jira |

Monthly plan for Story Points in Q1: April 13, May 13, June 14. Q1 review date: 30 June.

### KRA 2 — Code Quality (KRA weight: 30%)

| KPI | KPI Weight | Annual Target | Q1 | Q2 | Q3 | Q4 | Data Source |
|---|---:|---:|---:|---:|---:|---:|---|
| Production bugs introduced | 60% | Maximum 8 | Maximum 2 | Maximum 2 | Maximum 2 | Maximum 2 | Bug tracker |
| Unit test coverage | 40% | 80% | 75% | 77% | 79% | 80% | SonarQube |

### KRA 3 — Team Collaboration (KRA weight: 20%)

| KPI | KPI Weight | Annual Target | Q1 | Q2 | Q3 | Q4 | Data Source |
|---|---:|---:|---:|---:|---:|---:|---|
| Peer feedback score | 100% | 4.2 / 5 | 4.0 | 4.1 | 4.2 | 4.2 | Peer review |

### KRA 4 — Learning & Compliance (KRA weight: 15%)

| KPI | KPI Weight | Annual Target | Q1 | Q2 | Q3 | Q4 | Data Source |
|---|---:|---:|---:|---:|---:|---:|---|
| Learning/certification hours | 60% | 40 hours | 10 | 10 | 10 | 10 | LMS |
| Mandatory compliance completion | 40% | Yes | Yes | Maintain | Maintain | Maintain | LMS |

## 5. Single-page user interface requirement

One page, titled **Annual Employee KRA Plan**, should show the following without navigating to separate monthly or quarterly scorecards:

1. Employee and annual plan header: employee, manager, department, financial year, plan status, plan dates.
2. KRA summary: KRA, weight, dates, annual progress and review status.
3. Expandable KPI rows under each KRA: annual target, Q1–Q4 targets/actuals, monthly targets/actuals, weights, dates and evidence.
4. Review panel: employee update, manager verification, comments, score and review status.
5. Carry-forward log: source quarter, pending amount, destination quarter, revised target, reason and approver.
6. Annual scoring summary: KPI scores, KRA scores, total score and final rating.

## 6. Sheet content for Excel

### Sheet 1 — Annual Employee KRA Plan

| FY | Employee ID | Employee | Department | Manager | Plan Start | Plan End | Status |
|---|---|---|---|---|---|---|---|
| FY 2026–27 | EMP-1024 | Jithin | Engineering | John | 01-Apr-2026 | 31-Mar-2027 | Approved |

| KRA No. | KRA | KRA Weight % | KRA Start | KRA End | KPI No. | KPI | KPI Weight % | KPI Type | Annual Target | Data Source |
|---:|---|---:|---|---|---:|---|---:|---|---:|---|
| 1 | Sprint Delivery | 35 | 01-Apr-2026 | 31-Mar-2027 | 1.1 | Story points completed | 70 | Numeric Up | 160 | Jira |
| 1 | Sprint Delivery | 35 | 01-Apr-2026 | 31-Mar-2027 | 1.2 | Sprint commitment success | 30 | Percentage | 90% | Jira |
| 2 | Code Quality | 30 | 01-Apr-2026 | 31-Mar-2027 | 2.1 | Production bugs introduced | 60 | Numeric Down | Maximum 8 | Bug tracker |
| 2 | Code Quality | 30 | 01-Apr-2026 | 31-Mar-2027 | 2.2 | Unit test coverage | 40 | Percentage | 80% | SonarQube |
| 3 | Team Collaboration | 20 | 01-Apr-2026 | 31-Mar-2027 | 3.1 | Peer feedback score | 100 | Rating | 4.2 / 5 | Peer review |
| 4 | Learning & Compliance | 15 | 01-Apr-2026 | 31-Mar-2027 | 4.1 | Learning/certification hours | 60 | Numeric Up | 40 hours | LMS |
| 4 | Learning & Compliance | 15 | 01-Apr-2026 | 31-Mar-2027 | 4.2 | Mandatory compliance completion | 40 | Boolean | Yes | LMS |

### Sheet 2 — Quarterly and Monthly Target Plan

| KPI No. | KPI | Q1 Target | Apr | May | Jun | Q1 Review Date | Q2 Target | Jul | Aug | Sep | Q2 Review Date | Q3 Target | Q4 Target |
|---:|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---:|---:|
| 1.1 | Story points completed | 40 | 13 | 13 | 14 | 30-Jun-2026 | 40 | 13 | 13 | 14 | 30-Sep-2026 | 40 | 40 |
| 1.2 | Sprint commitment success | 90% | 90% | 90% | 90% | 30-Jun-2026 | 90% | 90% | 90% | 90% | 30-Sep-2026 | 90% | 90% |
| 2.1 | Production bugs introduced | Maximum 2 | Maximum 1 | Maximum 1 | Maximum 0 | 30-Jun-2026 | Maximum 2 | Maximum 1 | Maximum 1 | Maximum 0 | 30-Sep-2026 | Maximum 2 | Maximum 2 |
| 2.2 | Unit test coverage | 75% | 72% | 74% | 75% | 30-Jun-2026 | 77% | 76% | 77% | 77% | 30-Sep-2026 | 79% | 80% |
| 3.1 | Peer feedback score | 4.0 | — | — | 4.0 | 30-Jun-2026 | 4.1 | — | — | 4.1 | 30-Sep-2026 | 4.2 | 4.2 |

### Sheet 3 — Review and Carry-forward Log

| Review Date | KPI | Period | Original Target | Actual | Result | Carry-forward | Next-period Revised Target | Employee Update | Manager Review |
|---|---|---|---:|---:|---|---:|---:|---|---|
| 30-Jun-2026 | Story points completed | Q1 | 40 | 34 | Partially achieved | 6 | Q2: 46 | Leave and production support affected capacity | Carry-forward approved; Q2 plan revised |
| 30-Jun-2026 | Sprint commitment success | Q1 | 90% | 92% | Achieved | 0 | Q2: 90% | Improved refinement process | Good performance |
| 30-Jun-2026 | Unit test coverage | Q1 | 75% | 73% | Partially achieved | 2 percentage points | Q2: 79% | Legacy module delayed coverage work | Carry-forward approved |

## 7. Implementation direction when approved

The final system should use an annual-plan record as the parent. Employee-specific KRAs and KPIs belong to that plan; period-target, review, evidence and carry-forward records belong to each KPI. This preserves history, supports date-based reviews and keeps the full plan visible on one page.
