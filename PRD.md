# Multi-Tenant School Management System — Product Requirements Document

**Status:** Ground truth for AI-assisted development (Antigravity / Claude Code)
**Purpose:** This document is the single source of truth for every module built. When prompting an AI IDE, paste the relevant section(s) verbatim rather than describing the feature from memory — this prevents schema drift and re-litigated decisions across sessions.

---

## 0. How to use this document with an AI IDE

- Treat every "Acceptance Criteria" block as non-negotiable. State it explicitly in the prompt, every time that module is touched, even in later sessions.
- Never let the AI IDE invent a table, field, or relationship not defined in §4 (Data Model). If a prompt seems to need a new field, add it here first, then prompt.
- Build and test one module fully (§9, Build Order) before starting the next. Do not let the AI IDE generate multiple modules in one pass.
- If the AI IDE proposes something that contradicts this document, treat the document as correct and tell it to revise — do not silently accept a "cleaner" alternative it invents, since this is a common source of hallucinated architecture that looks plausible but breaks assumptions made elsewhere in the system.
- Domain names, prices, and specific numbers below (e.g. `yourdomain.com`, ₦500) are placeholders — replace with real values before/during build, they are not meant to be hardcoded.

---

## 1. Product Summary

A multi-tenant SaaS platform where independent schools ("tenants") register, get an isolated branded instance (subdomain or custom domain), and run their academic operations: sessions/terms, enrollment, staff assignments, attendance, result entry and publishing, report cards, school fees, and a paid result-checker PIN system for parents. The platform owner runs a super admin control plane separate from all tenant systems.

**Explicitly not in scope for v1:** see §13A (Deferred — Post-v1) for the full list, including true push notifications, SMS/WhatsApp, timetable, academic calendar, SSS elective selection, document generation beyond report cards, admissions pipeline/bulk import, full page-builder, and self-service custom-domain verification UI. Also out of scope: API access for schools, white-labeling/reselling.

---

## 2. Core Architectural Principle (applies everywhere)

**Everything academic is scoped to a session and never mutated in place — only new records are added.**

This single rule governs `Enrollment`, `FormTeacherAssignment`, `TeachingAssignment` continuity, and result records. It is what makes promotion, historical report cards, and year-over-year reassignment correct without special-case code. Any new feature touching academic data must follow this rule by default; deviating from it requires explicit justification, not convenience.

---

## 3. Tenancy & Domains

### 3.1 Subdomain resolution
- Wildcard DNS: `*.yourdomain.com` → app server. No per-school DNS work at registration.
- Wildcard TLS certificate via DNS-01 challenge (Let's Encrypt), automated (Caddy or equivalent).
- Every request's `Host` header is parsed by middleware to extract the subdomain slug, which resolves to a `Tenant` record. Requests to unknown slugs return 404, not a default tenant.
- Super admin lives on its own subdomain (`admin.yourdomain.com`), with **authentication entirely separate** from tenant auth — separate session cookie, separate login route, no shared cookie scope with any `*.yourdomain.com` tenant session.

### 3.2 Slug rules
- Chosen by the school at registration (not auto-derived silently).
- Lowercase alphanumeric + hyphens, 3–63 characters, unique.
- Checked against a reserved list: `www, app, api, admin, mail, smtp, status, docs, support, staging, cdn, blog` (extend as needed) — reserved slugs cannot be registered.

### 3.3 Custom domains (Enterprise tier)
- School provides a domain/subdomain (e.g. `portal.theirschool.edu.ng`), adds a CNAME pointing at the platform.
- Verified via DNS check (CNAME resolution or a TXT-record token) before activation.
- Stored as a `DomainAlias` mapped to the tenant. Middleware resolution checks subdomain-slug lookup OR domain-alias lookup — same downstream tenant-context loader either way.
- TLS for custom domains via on-demand issuance (Caddy `on_demand_tls` with an authorizing ask-endpoint, to prevent abuse) or a managed service (Cloudflare for SaaS).

### 3.4 Dashboard branding
Every tenant-side dashboard (school admin, teacher, student, parent) displays that tenant's own name and logo in the header/nav shell — pulled from `Tenant.name`/`Tenant.branding.logo_url` via the same tenant context loaded once per request (§3.1). The platform's own branding must not appear inside any tenant dashboard.

### 3.5 Acceptance Criteria
- [ ] A request to an unregistered subdomain returns 404, never falls through to any tenant.
- [ ] Super admin session cookies are never valid on any tenant subdomain, and vice versa.
- [ ] Reserved slugs are rejected at registration with a clear error, not a silent renaming.
- [ ] Tenant resolution (subdomain or custom domain) happens once per request in a single middleware/loader function; no feature re-implements host-parsing independently.
- [ ] Every tenant dashboard header/nav shows that tenant's own name and logo, never the platform's branding.

---

## 4. Data Model (core entities)

This is the authoritative schema shape. Field lists are illustrative of required relationships, not exhaustive column lists — the AI IDE may add standard fields (timestamps, soft-delete flags) but must not omit or restructure the relationships below.

```
Tenant
  id, slug (unique), name, plan_id, status (trial/active/suspended/cancelled),
  trial_ends_at, lowest_class_level_id, highest_class_level_id,
  branding: { primary_color, accent_color, logo_url, font_heading, font_body }

DomainAlias
  id, tenant_id, domain (unique), verified_at, verification_token

ClassLevel   -- global, fixed, ordered ladder — NOT per-tenant
  id, name (e.g. "Nursery 1", "Primary 3", "JSS2", "SSS3"), order_index

ClassArm     -- per-tenant subdivision of a level, e.g. "Primary 3A", "Primary 3B"
  id, tenant_id, class_level_id, name, session_id (arms can be redefined per session)

AcademicSession
  id, tenant_id, label (e.g. "2024/2025"), start_date, end_date, is_current

Term
  id, session_id, name ("1st Term"...), start_date, end_date, is_current, total_school_days

Student
  id, tenant_id, name, ...  -- no single guardian_contact_info field; see StudentGuardian below

Guardian
  id, tenant_id, name, contact_info, relationship (mother/father/guardian/emergency_contact)

StudentGuardian    -- many-to-many; a student can have multiple guardians, a guardian can have multiple children
  id, student_id, guardian_id, is_primary_contact (bool)

Enrollment            -- NEVER mutated across sessions; new row per session
  id, student_id, class_level_id, class_arm_id (nullable — schools with no arms leave this null),
  session_id, status (active/repeated/withdrawn)

Staff
  id, tenant_id, name, role_base (teacher/admin/bursar), contact_info

TeachingAssignment      -- many per staff member, independent of form-teacher status
  id, staff_id, class_level_id, class_arm_id (nullable), subject_id, session_id

FormTeacherAssignment   -- one active per class(+arm) per session; resolved against CURRENT session only
  id, staff_id, class_level_id, class_arm_id (nullable), session_id

Subject
  id, tenant_id, name

ResultEntry
  id, student_id, subject_id, term_id, teacher_id,
  score_data (jsonb: per-AssessmentComponent scores + computed total),
  grade (nullable — set once at publish time from GradingScale, frozen thereafter; see §5A.7),
  comment,
  status: not_started | submitted | form_teacher_reviewed | published

ClassResultReview       -- form teacher's overall remark, one per class(+arm) per term
  id, class_level_id, class_arm_id (nullable), term_id, form_teacher_id, overall_remarks, submitted_to_admin_at

AttendanceRecord
  id, student_id, class_arm_id (nullable), term_id, date,
  status (present/absent/late), marked_by (staff_id)

ResultPIN
  id, student_id, term_id, code (unique),
  price_paid, platform_fee, school_net, payment_ref,
  status: unused | active | expired,
  activated_at, expires_at

Plan
  id, name, student_ceiling, price, pin_required (bool), platform_fee_percent

Feature
  id, key (unique), name, description

PlanFeature
  plan_id, feature_key, enabled_by_default

TenantFeatureOverride
  tenant_id, feature_key, enabled

ImpersonationLog
  id, super_admin_id, tenant_id, reason, started_at, ended_at
```

### 4.1 Acceptance Criteria
- [ ] `ClassLevel` is one global table (Nursery 1 through SSS3), never duplicated per tenant.
- [ ] A tenant's usable class range is defined by `lowest_class_level_id`/`highest_class_level_id`, and every class-level picker in the UI (enrollment, promotion, teaching assignment) filters against this range, never the full global ladder.
- [ ] `Enrollment` and `FormTeacherAssignment` rows are immutable once created — a new session always produces new rows, never an update to an existing row's session reference.
- [ ] `FormTeacherAssignment` permission checks always filter by `session_id = current session` — no code path treats form-teacher status as a static, session-independent flag on `Staff`.
- [ ] A staff member can simultaneously hold multiple `TeachingAssignment` rows and at most one active `FormTeacherAssignment` per session — these are independent and both may be true.
- [ ] Shrinking a tenant's class range (raising `lowest_class_level_id` or lowering `highest_class_level_id`) is blocked if active enrollments exist in the class level being removed. Extending the range is always allowed.
- [ ] `ClassArm` is optional at the schema level — a tenant that never creates arms for a level behaves exactly as if arms don't exist (`class_arm_id` null throughout), no forced migration for single-stream schools.
- [ ] A `FormTeacherAssignment` is scoped to a specific arm when arms exist for that level (e.g. "form teacher of Primary 3A," not all of Primary 3) — the permission and submission-coverage checks in §5.2 operate per-arm when arms are in use.
- [ ] A student can have more than one `Guardian` (via `StudentGuardian`), each able to independently log in and access that student's fee balance, PIN-gated results, and announcements — access is not restricted to a single "primary" guardian, though one may be flagged `is_primary_contact` for default notification routing.

---

## 5. Academic Workflows

### 5.1 Class-level range
See §3/§4 — contiguous range per tenant, range picker at setup (not independent checkboxes), extend-safe/shrink-guarded as above.

### 5.2 Result entry status machine
`not_started → submitted → form_teacher_reviewed → published`

1. **Subject teacher** enters scores + comment for their assigned class+subject+term → `submitted`. Editable freely up to this point.
2. **Form teacher** dashboard shows subject-by-subject submission coverage for their class (not per-student notifications). Once all required subjects for the class show `submitted`, form teacher reviews the compiled sheet, adds overall remarks (`ClassResultReview`), and submits to admin → all entries for that class+term move to `form_teacher_reviewed`. This step is blocked until every required subject — including the form teacher's own, if they also teach a subject in that class — is submitted. No special-casing for the form teacher's own entries.
3. **School admin** does final review and publishes → `published`. This is the only status from which report cards may be generated, and the only status that makes the PIN-purchase flow relevant for parents/students.
4. Edits after `form_teacher_reviewed` require an explicit reopen action (logged), not silent overwriting.
5. Primary/nursery classes use the identical pipeline — one staff member simply holds subject-teacher assignments for every subject in their class, plus the form-teacher assignment. No separate "simple mode" system.

### 5.3 Promotion
- Manual, explicit, per-session, only available once all classes' 3rd term results are `published`.
- School admin sees, per class, every student defaulted to "Promote to [next class level]", overridable per student to Repeat / Promote / Graduate / Withdraw.
- Confirming creates new `Enrollment` rows for the new session; old rows are untouched.
- At the top of a tenant's enabled class range (e.g. a primary-only school's Primary 6), the only valid outcomes are Graduate or Repeat — never an attempted promotion into a disabled class level.

### 5.3A Attendance
- **Denominator:** each `Term` has a `total_school_days` field, set once by admin at term setup (a single number, e.g. 60 — not a full day-by-day school calendar, which is unnecessary complexity for v1). This is the standard Nigerian report card format ("Present: 55/60 days").
- **Marking:** the current form teacher for a class(+arm), per §10.1, marks a daily register — present/absent/late, one `AttendanceRecord` per student per date. Backfill/correction of any date within the current term is allowed up until that term's results reach `published`.
- **Lock:** attendance for a term locks at the same point results lock — once `published`. Corrections after that require the same explicit "reopen" action (logged) used for result edits in §5.2, not silent editing.
- **Percentage:** computed at read/report-generation time as `(days marked present) ÷ Term.total_school_days` — never stored as a mutable running percentage, following the same ledger-not-cache principle used for fee balances (§6A.2).
- Attendance percentage is surfaced on the report card, read from `AttendanceRecord` once results reach `published` status — same data-freshness rule as §5.2/§5A.7.
- Guardian/student view: attendance is free to view (§6, already listed as ungated), no PIN required.

### 5.4 Acceptance Criteria
- [ ] Report card generation reads exclusively from `ResultEntry` rows with status `published`.
- [ ] The "submit to admin" action is disabled in the UI (and rejected server-side, not just client-side) unless every required subject for that class+term is `submitted`.
- [ ] Attendance percentage is always computed from `AttendanceRecord` ÷ `Term.total_school_days` at read/report-generation time, never stored as a mutable running percentage.
- [ ] Only the current form teacher for a class(+arm) can mark or backfill attendance for that class in the current session and current (unpublished) term — enforced through the same `FormTeacherAssignment` lookup used elsewhere (§10.1).
- [ ] Attendance records lock at the same point as results (§5.2) — once a term's results are `published`, further attendance edits require the same logged reopen action as result edits, never silent overwriting.
- [ ] Promotion never auto-runs; it is always a reviewed, confirmed admin action producing new `Enrollment` rows.

---

## 5A. Assessment Structure & Grading

### 5A.1 Overview
Two related but distinct concerns, both admin-controlled, never freely defined by individual teachers:
1. **Assessment components** — the breakdown a score is built from (e.g. 1st CA, 2nd CA, Exam).
2. **Grading scale** — how a computed total maps to a letter grade and remark.

Every tenant gets a sensible default for both, seeded automatically at tenant creation. Customizing either is a plan-gated feature (`grading_customization`); the existence of grading itself is never toggled off — a school cannot function without some scale in place, so "off" can only ever mean "use the platform default," never "no grading."

### 5A.2 Data model addition

```
AssessmentComponent
  id, tenant_id, term_id (nullable — if null, applies to all terms until overridden),
  name (e.g. "1st CA", "2nd CA", "Exam"), max_score, weight_percent, order_index

GradingScale
  id, tenant_id, lowest_class_level_id, highest_class_level_id (scopes the scale to a class-level band —
  e.g. primary vs secondary may use different scales),
  min_score, max_score, grade (e.g. "A"), remark (e.g. "Excellent")
```

`ResultEntry.score_data` (§4) stores per-component scores, not a single flat total:
`{ "1st_ca": 18, "2nd_ca": 17, "exam": 52, "total": 87 }` — total and grade are both computed, never entered directly.

### 5A.3 Defaults (seeded automatically per tenant)
- `AssessmentComponent`: 1st CA (20), 2nd CA (20), Exam (60) — standard Nigerian school convention.
- `GradingScale`: a standard A–F band for the full class-level range, adjustable later if the tenant has `grading_customization` enabled.

### 5A.4 Plan gating
- `grading_customization` is a `Feature` key in the existing `PlanFeature`/`TenantFeatureOverride` system (§8) — not a new mechanism.
- Without it: tenant uses the seeded defaults, no editing UI shown.
- With it: school admin can edit `AssessmentComponent` weights per term and define `GradingScale` entries scoped by class-level band (e.g. a more lenient primary scale, stricter secondary scale).
- A Starter-tier school needing a one-off custom scale can have `grading_customization` flipped on individually via `TenantFeatureOverride`, without a full plan upgrade — same mechanism already used elsewhere in §8.

### 5A.5 Who does what
- **School admin**: defines/edits `AssessmentComponent`s and `GradingScale`(s) if `grading_customization` is enabled; otherwise inherits defaults.
- **Subject teacher**: score entry screen is generated from the tenant's current `AssessmentComponent` set for that term — enters only per-component scores, never a freeform total, never a letter grade.
- **System**: computes total from components (respecting `weight_percent`) and resolves the letter grade from `GradingScale` server-side, at save time — always computed, never teacher-entered.

### 5A.6 Acceptance Criteria
- [ ] A tenant with `grading_customization` disabled cannot access any assessment-component or grading-scale editing UI — only the seeded defaults apply.
- [ ] A new tenant is seeded with default `AssessmentComponent`s and a default `GradingScale` automatically at creation — grading is never in an unconfigured state.
- [ ] Letter grade is computed server-side from `GradingScale`; there is no input field anywhere that lets a teacher or admin type a grade directly onto a `ResultEntry`. (A live preview grade may be shown during entry, but the frozen, permanent grade is only set at publish — see §5A.7.)
- [ ] `GradingScale` lookups respect class-level band scoping — a primary-level score is graded against the scale whose range includes that class level, not a single school-wide scale by default assumption.
- [ ] The subject teacher's score entry form is generated dynamically from the term's active `AssessmentComponent` set, not hardcoded to a fixed 3-field layout.

### 5A.7 Setup timing and lock behavior
- `AssessmentComponent`s for a term are defined before score entry begins. Once the first `ResultEntry` for that term reaches `submitted`, the component set for that term is locked — no further edits. Changing it after that point requires an explicit admin "reopen term structure" action, logged, with an on-screen warning of what it affects — the same reopen-after-lock pattern used for result edits in §5.2.
- **Grade is computed once and frozen at publish, not recalculated on every view.** When a `ResultEntry` transitions to `published`, its letter grade is computed from the `GradingScale` active at that moment and stored on the record (`ResultEntry.grade`). A later change to `GradingScale` affects only future terms — it must never silently reinterpret an already-published result. This follows the same never-mutate-history principle as `Enrollment` and `FormTeacherAssignment` (§2).

### 5A.8 Acceptance Criteria (in addition to 5A.6)
- [ ] `AssessmentComponent` edits are blocked server-side once any `ResultEntry` for that term has left `not_started` — not just hidden in the UI.
- [ ] `ResultEntry.grade` is set once, at publish time, and never recomputed from a live `GradingScale` lookup on subsequent reads — report cards render the stored grade, not a fresh calculation.

---

## 6. Result Checker PIN System

- **Every school, every PIN, paid.** No free/scholarship/staff-child exception path exists in v1 — this was decided explicitly.
- PIN is scoped to `(student_id, term_id)` — not to parent or student identity. Whoever redeems it first (parent login or student login) unlocks that student's result for that term on both logins.
- **Student login has no free bypass.** The compiled result (scores + comments) is gated identically whether accessed via parent or student account. This must be enforced as a single authorization check shared by both login types, not two separate implementations.
- Free without a PIN, regardless of gate status: timetable, attendance, announcements, fee status. Gated: the compiled `ResultEntry` output (scores and comments) for that term.
- PIN price set per tenant (school admin setting). Platform commission set per plan (`Plan.platform_fee_percent`), stored separately from the school's price so schools do not see your cut as a line item in their own settings.
- Payment via gateway (Paystack/Flutterwave). v1 fallback: full payment to platform account, manual payout batch to schools. Later: gateway-native split payment direct to school sub-accounts.
- PIN validity: from generation until `term.end_date` + grace period (e.g. 30 days) — tied to the actual term end date, not a recalculated rolling duration.
- Once activated, a PIN unlocks permanent re-viewing access for that student+term (not single-use viewing) until expiry. Historical terms remain viewable after expiry at no extra charge in v1 (no "reprint fee" — deferred decision, revisit only if it becomes a support burden).

### 6.1 Acceptance Criteria
- [ ] The authorization check "does an active PIN exist for `(student_id, term_id)`" is implemented once and called by both the parent-facing and student-facing result view — not duplicated.
- [ ] There is no code path, flag, or role that grants free result viewing. Any future free-access feature requires a deliberate schema addition, not a shortcut through an existing role check.
- [ ] PIN generation is server-side only, using a cryptographically random code generator, checked for uniqueness before issuance.
- [ ] `payment_ref` is stored on every PIN for dispute/refund traceability.

---

## 6A. School Fees

### 6A.1 Overview
Parents view and pay outstanding school fees from their own dashboard; school admins track collection status and record offline (cash/bank transfer) payments. Balances are always computed from a payment ledger, never stored as a mutable running total.

### 6A.2 Data model addition

```
FeeItem
  id, tenant_id, term_id, class_level_id (nullable = applies to all class levels),
  name, amount

StudentFeeAdjustment      -- optional per-student discount/waiver, layered on top of FeeItem
  id, student_id, fee_item_id, adjustment_type (discount/waiver), amount_or_percent

FeePayment
  id, student_id, term_id, amount,
  method (gateway/cash/bank_transfer),
  payment_ref (nullable — gateway payments only),
  recorded_by (staff_id, nullable — manual entries only),
  paid_at
```

**Balance for a student+term is always computed, never stored:**
`balance = sum(applicable FeeItem.amount for that class_level+term) − sum(StudentFeeAdjustment) − sum(FeePayment.amount)`

### 6A.3 School admin capabilities
- Define `FeeItem`s per term, optionally scoped to a class level (e.g. SSS-only lab fee).
- Apply a `StudentFeeAdjustment` to an individual student (discount/waiver) where needed.
- View a per-student fee status list, filterable by class and by paid/partial/unpaid.
- View school-wide totals for the term: expected, collected, outstanding.
- Manually record an offline payment (cash/bank transfer), attributed to the recording staff member — this is the primary reconciliation tool for payments made outside the portal.

### 6A.4 Parent-facing capabilities
- View amount owed, amount paid, and balance remaining, per term, for each of their children.
- Pay the outstanding balance via the same gateway integration used for PINs (§6) — **partial payments allowed**, not full-balance-only, since installment payment is common.
- View payment history and download/view receipts.

### 6A.5 Interaction with promotion (§5.3)
Decide explicitly, per school (or platform-wide default), whether an outstanding balance blocks promotion at session end. If it does, surface it directly in the promotion review screen (§5.3) as a visible flag per student — not as a separate manual check the admin has to remember to run elsewhere.

### 6A.6 Acceptance Criteria
- [ ] Balance is always computed from `FeeItem`/`StudentFeeAdjustment`/`FeePayment` at read time — no `balance` or `amount_paid` column is stored and manually kept in sync.
- [ ] Gateway fee payments follow the exact same webhook-verification rule as §6/§11.4 — a payment is never marked recorded from an unverified client-side callback.
- [ ] A manually recorded offline payment always stores which staff member recorded it (`recorded_by`), for audit purposes.
- [ ] Partial payments are supported end-to-end (gateway checkout for a partial amount, and reflected correctly in the computed balance) — the flow does not assume full-balance-only payment.

---

## 7. Branding & Public Site

- One shared template/CSS system. Per-tenant customization is a small set of CSS custom properties (`--brand-primary`, `--brand-accent`, `--brand-radius`, `--brand-font-heading`, etc.) injected server-side — never a per-tenant stylesheet file.
- School selects one primary color (and optionally an accent); the full UI color scale (hover states, tints, text-on-primary contrast) is derived programmatically, with a contrast check against WCAG AA — do not allow a school to ship an inaccessible color combination unmodified.
- Curated font pairings only (5–6 pre-tested options), not an open Google Fonts picker.
- Logo upload triggers client-side palette extraction, presented as 2–3 suggested schemes for the school to pick from — never silently auto-applied.
- v1 public site: one fixed, well-designed template with content fields (not a block/section builder). Internally, structure the page content as an ordered block list in the data model even though v1 exposes no reordering UI — this allows section-composition to be added later without a schema migration.
- 3 starter visual presets at signup (e.g. Traditional / Modern / Nursery-Playful) = pre-filled color + font combination, not separate templates to maintain.

### 7.1 Acceptance Criteria
- [ ] Changing a tenant's brand color is a database update with no deploy or file generation involved.
- [ ] Every derived color passes a contrast check before being used for text-on-color; auto-darken/lighten if it fails.

---

## 7A. Public Site Content Management

### 7A.1 Overview
School admin manages their own public site content (hero images, about text, gallery, contact info) from their dashboard — a set of content forms per page, not a page builder, consistent with §7's "fixed template" decision.

### 7A.2 Pages and fields (v1)
- **Home**: hero heading, hero subheading, hero image, short about blurb, optional highlight stats (founded year, student count, pass rate).
- **About**: mission/vision text, history text, principal's welcome message + photo.
- **Academics**: programs/levels offered (auto-derived from the tenant's class-level range, §3/§4, editable blurb text around it), curriculum description.
- **Gallery**: multi-image upload, optionally grouped into albums.
- **Contact**: address, phone, email, map coordinates (static map, not an interactive picker).

### 7A.3 Data model addition

```
SiteContent
  id, tenant_id, page (home/about/academics/contact),
  content (jsonb — field-value pairs for that page)

GalleryImage
  id, tenant_id, image_url, caption (nullable), album (nullable), uploaded_at
```

`content` is stored as jsonb (not a rigid column per field) so new fields can be added to a page's form later without a schema migration, while page structure itself stays fixed per §7.

### 7A.4 Image upload flow
1. Admin selects a file in a content form (e.g. Home page's "Hero Image").
2. Browser uploads directly to object storage (R2) via a presigned URL issued by the API — never routed through the app server buffering the full file.
3. On success, the resulting URL is written into the relevant `SiteContent.content` field or a new `GalleryImage` row.
4. File type and size are validated server-side at the point the presigned URL is issued (jpg/png/webp, size cap e.g. 5MB) — never trusted from client-side `accept=""` alone, per §11.3.
5. Uploaded images are resized/optimized for web delivery (via a background job or framework-level image handling) rather than served at original upload size.

### 7A.5 Acceptance Criteria
- [ ] A tenant with no site content filled in still renders a presentable page — sensible default/placeholder copy, never a broken empty page.
- [ ] Image uploads never pass through the app server as a buffered request body; presigned direct-to-storage upload only.
- [ ] File type/size validation happens server-side at presigned-URL issuance, not only client-side.

---

## 7B. Notifications

### 7B.1 Overview
An in-app notification center, present in every tenant dashboard (all roles) and in the super admin panel, surfacing events generated across the system — form teacher submission coverage, PIN issuance, fee payments recorded, results published, and platform-wide announcements from super admin to tenants.

**In scope for v1:** in-app notifications only (visible when the user is logged in, via a notification bell/list in the dashboard shell).
**Deferred, not v1:** true push notifications (Web Push API to browser/lock-screen, or a native/PWA mobile app) and SMS (per the earlier explicit scope decision) — both require separate delivery infrastructure and permission UX beyond what in-app notifications need, and are better justified once real usage shows email + in-app isn't enough.

### 7B.2 Data model addition

```
Notification
  id, tenant_id, recipient_id, recipient_type (school_admin/staff/parent/student/super_admin),
  type (e.g. subject_submitted, fee_payment_recorded, result_published, platform_announcement),
  message, link (nullable — deep-links to the relevant page),
  read_at (nullable), created_at
```

### 7B.3 Notes
- This table is the natural home for the super-admin "Broadcast" capability listed as deferred in §9 — a platform_announcement notification written once per tenant recipient. Because the notification infrastructure is being built regardless (for the tenant-level events above), broadcast becomes low-effort to include once this table exists, and may be worth pulling into v1 rather than staying fully deferred.
- Notification-generating events should hook into actions already defined elsewhere in this document (subject submission in §5.2, PIN issuance in §6, fee payment in §6A, result publishing in §5.2) rather than being designed as a separate standalone feature — the events already exist, this module just gives them a visible destination.

### 7B.4 Acceptance Criteria
- [ ] Notifications are tenant-scoped like all other data (§11.1) — a recipient never sees another tenant's notifications, including super-admin broadcasts which are correctly attributed per-tenant even though authored once.
- [ ] Marking a notification read is a per-recipient action, not global.
- [ ] No true push/browser-permission code is introduced in v1 — the notification center is purely in-app.

---

## 8. Plans, Feature Flags & Billing

- Tiers differentiated by **feature set + a student-count ceiling** — one axis, not two independent dials.
- `Feature` / `PlanFeature` / `TenantFeatureOverride` as defined in §4: every feature check in code calls a single `tenant.hasFeature(key)` helper that checks the override table first, falls back to the plan default. Build this helper before building any feature that needs it. Example feature key already in use: `grading_customization` (§5A.4) — gates the ability to edit assessment components/grading scales, not the existence of grading itself, which is always on.
- Super admin can flip an individual tenant's feature access without altering their plan (`TenantFeatureOverride`).
- One trial policy platform-wide: 30 days, no card required, full feature access at whatever plan they signed up under. Do not vary trial length by plan in v1.
- `Plan.pin_required` exists as a field for future flexibility but defaults `true` for every plan in v1 — do not build a "PIN optional" UI path yet, just leave the field.

### 8.1 Acceptance Criteria
- [ ] No feature check anywhere in the codebase hardcodes a plan name (e.g. `if (plan === 'enterprise')`). All checks go through `tenant.hasFeature(key)`.
- [ ] A super admin toggling a tenant's feature override takes effect immediately, without requiring a plan change or redeploy.

---

## 9. Super Admin

**In v1:**
- Tenant list/management: view, suspend, manually create/cancel a tenant.
- Impersonation: enter any tenant as an admin-equivalent view. Every session logs `super_admin_id`, `tenant_id`, `reason` (required text field), `started_at`, `ended_at`. A persistent, unmissable banner ("Viewing as [School] — Exit") is shown for the entire duration.
- Financial overview: subscription revenue, PIN revenue, and platform commission — shown separately, not blended into one number. School fee volume (§6A) is the *school's* money, not the platform's, so show it only as a per-tenant operational figure (collected/outstanding), never mixed into platform revenue totals.
- Plan & feature management (per §8).
- Audit log of impersonation and manual plan/tenant changes.

**Deferred until needed (not v1):**
- Domain-alias verification UI — build only once the first Enterprise custom-domain request arrives.
- Broadcast/announcement tool.
- Advanced analytics/cohort dashboards.

**Explicitly excluded from the product UI, permanently:**
- Database migrations, backups, server version info (PHP/DB/webserver versions), memory/uptime stats, or any infrastructure-internals panel. These belong to deploy scripts and external monitoring (e.g. Sentry, UptimeRobot), never to an in-app admin screen. Exposing exact runtime/dependency versions in a browser-accessible panel is a reconnaissance risk and must not be built, regardless of how convenient it seems.

### 9.1 Acceptance Criteria
- [ ] Every impersonation session is logged with a non-empty reason before it is permitted to start.
- [ ] The impersonation banner cannot be dismissed or hidden by CSS/script within the impersonated view.
- [ ] No route, component, or API endpoint in the product exposes server software versions, database credentials, or infrastructure internals.

---

## 10. Roles & Permissions Summary

| Role                                           | Scope                                                                                                                                                                                                                                                                                                                      |
|------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Super Admin                                    | Cross-tenant. Separate auth system entirely.                                                                                                                                                                                                                                                                               |
| School Admin                                   | Full tenant scope: staff, students, sessions/terms, fee items/adjustments/collection status (§6A), PIN pricing, publishing, branding/site content.                                                                                                                                                                         |
| Bursar (optional staff sub-role)               | Fee items, adjustments, payment recording, and financial reporting (§6A) — a school may delegate this to a dedicated staff member instead of the school admin handling it directly.                                                                                                                                        |
| Subject Teacher                                | Score/comment entry, scoped to their own `TeachingAssignment` rows (class+subject+session) only.                                                                                                                                                                                                                           |
| Form Teacher                                   | Everything a subject teacher has for their own subjects, plus whole-class oversight for the one class(+arm) they hold a current `FormTeacherAssignment` for: attendance (§5.3A), class-scoped announcements, conduct remarks, roster visibility, and the results-review/submit-to-admin action.                            |
| Student                                        | Own timetable/attendance/announcements free; own compiled result PIN-gated identically to guardian access.                                                                                                                                                                                                                 |
| Guardian (parent or other registered guardian) | Own children's fee status/announcements/attendance free, plus ability to pay outstanding fee balance (§6A) in full or partially; compiled results PIN-gated. A student may have multiple guardians (§4), each with independent, equal access to that student's data — access is not limited to a single "primary" account. |

### 10.1 Acceptance Criteria
- [ ] Permission checks for form-teacher-scoped features (attendance, conduct, roster, class announcements, results review) all resolve through the single `FormTeacherAssignment` lookup for the current session — no feature invents its own separate notion of class ownership.
- [ ] A subject teacher without a form-teacher assignment cannot access any whole-class oversight feature, even for a class they teach a subject in.
- [ ] The Bursar sub-role, where assigned, can access fee/payment features (§6A) without being granted the full School Admin role — a school that doesn't use this sub-role simply has the admin handle it directly, no forced setup.
- [ ] Any guardian linked to a student via `StudentGuardian` has equal read/pay access to that student's fee balance and PIN-gated results — access checks key off the `StudentGuardian` relationship, not a single `parent_id` field.

---

## 11. Security Requirements

These apply across every module, not as a separate late-stage pass.

### 11.1 Tenant isolation
- Every query that touches tenant-scoped data (students, staff, results, etc.) must filter by `tenant_id`, enforced at the query-builder/ORM level (e.g. a Prisma middleware or a repository pattern that injects the tenant filter automatically), not left to be remembered per-query by whoever writes the feature. A missing tenant filter is a data breach between schools, and must be structurally hard to forget, not just documented as a rule.
- Cross-tenant data leakage (School A staff seeing School B data) is treated as a critical severity bug class, tested explicitly for every new data-access endpoint.

### 11.2 Authentication & sessions
- Super admin and tenant auth are fully separate systems (§3.1) — separate session stores, separate cookie names/scopes, ideally separate login routes.
- Passwords hashed with a modern algorithm (bcrypt/argon2) via the auth library — never rolled by hand.
- Session cookies: `httpOnly`, `secure`, `sameSite=lax` at minimum.
- Rate-limit login attempts and PIN-redemption attempts (PIN codes are guessable if unlimited attempts are allowed — treat PIN redemption like a login form, not a free-text lookup).

### 11.3 Input handling
- All user input (registration forms, result entry, PIN codes, custom domain input) validated server-side, never trusting client-side validation alone.
- Parameterized queries / ORM usage only — no raw string-interpolated SQL anywhere in the codebase.
- File uploads (logos, documents) validated by actual content type, not just file extension; size-limited; stored in object storage (R2), never executed from or served directly from the app server's filesystem.

### 11.4 Payments
- No card data ever touches your own servers — checkout happens via the gateway's hosted flow (Paystack/Flutterwave), your server only receives a webhook confirmation and a reference ID.
- Webhook signatures verified before trusting any "payment successful" event — never mark a PIN active on an unverified request.

### 11.5 Impersonation
- As specified in §9: mandatory reason, full audit log, unmissable banner. Impersonation access itself is a super-admin-only capability, never delegable.

### 11.6 Infrastructure
- No infrastructure internals (versions, server stats, migration/backup controls) exposed in-app, per §9.
- Secrets (DB credentials, API keys, gateway secrets) via environment variables / a secrets manager, never committed to the repository — this includes in AI IDE-generated code, which must be explicitly instructed never to hardcode example keys "for now."
- HTTPS enforced everywhere, including tenant subdomains and custom domains — no plain-HTTP fallback.

### 11.7 Data protection (NDPR)
The platform stores personal data on minors (students) and their guardians across many independent schools, which falls under Nigeria's Data Protection Regulation (NDPR). This is a compliance requirement, not an optional hardening step:
- A documented data-retention policy: how long student/guardian data is kept after a tenant cancels or a student is withdrawn, and when it's purged.
- A tenant offboarding path: if a school leaves the platform, they can export their full data (students, results, fees) and request deletion — this should be a defined operational process even if not a one-click self-service feature in v1.
- Guardian-facing data: only the minimum necessary contact info is collected (§4, `Guardian.contact_info`), and access to a child's data is limited to that child's linked guardians (§4, `StudentGuardian`) and authorized staff — never exposed across tenants or to staff outside the relevant assignments.
- This section should be revisited with actual legal guidance before handling real student data at scale — treat this PRD's coverage as the technical baseline (retention, export, access control), not a substitute for compliance review.

### 11.8 Acceptance Criteria
- [ ] A deliberate test exists (or is requested from the AI IDE) that confirms one tenant's authenticated user cannot retrieve another tenant's data via any API route, by ID-guessing or otherwise.
- [ ] PIN redemption is rate-limited per IP/session.
- [ ] No secret, API key, or credential appears in any committed file, including seed scripts and example `.env` files (which must use placeholder values only).
- [ ] A tenant's full data (students, guardians, results, fees) can be exported in a structured format (e.g. JSON/CSV) on request — this is the operational basis for both NDPR compliance and a school's own peace of mind about not being locked in.

---

## 12. Anti-Hallucination Guardrails for AI-IDE-Assisted Development

Because this system will be built largely through AI-generated code, the following practices are mandatory project discipline, not suggestions:

1. **This document is ground truth.** If the AI IDE's output conflicts with a schema, workflow, or rule defined here, the document wins — correct the code, don't silently accept the AI's alternative.
2. **Paste relevant sections into every prompt.** Do not rely on the AI IDE "remembering" earlier decisions across sessions — restate the exact schema and acceptance criteria for the module being touched.
3. **State acceptance criteria as explicit instructions in the prompt**, not just as this document's context — e.g., literally include "form-teacher status must resolve against the current session, never a static flag" in the prompt text for any module touching `FormTeacherAssignment`.
4. **One module at a time.** Do not prompt for multiple modules (§13) in a single generation pass. Build, test against real seed data, then move on.
5. **Never let the AI IDE invent a new table or relationship silently.** If a feature seems to need one, stop and add it to §4 first, deliberately, then prompt.
6. **Test every module against one consistent, realistic seed dataset** (one fake school, real-shaped names/dates), not abstract placeholder data — this surfaces edge cases (mid-term transfers, a form teacher who also teaches, a promotion at the top of a school's class range) that generic prompting won't.
7. **Treat any AI-suggested shortcut around tenant isolation, PIN gating, or session-scoping as a rejected suggestion by default** — these are the three places a plausible-looking shortcut causes real damage (cross-tenant leaks, bypassed monetization, and incorrect historical records, respectively).

---

## 13. Build Order

1. Project setup, `Tenant`/`AcademicSession`/`Term`/`ClassLevel` schema, subdomain middleware, reserved-slug check, seed script with one fake tenant.
2. Auth: tenant auth + fully separate super admin auth.
3. `Student`, `Guardian`, `StudentGuardian`, `Enrollment`, `ClassArm`, `Staff`, `TeachingAssignment`, `FormTeacherAssignment` — enforcing session-scoping throughout, and arm-scoping where a tenant uses class arms.
4. Assessment structure & grading (§5A) — seed defaults at tenant creation. Required before result entry, since the teacher's entry form and computed grade both depend on it.
5. Result entry status machine (§5.2), plus attendance (§5.3A) — build together, both are form-teacher-owned, class(+arm)-scoped workflows.
6. Report card generation (reads only `published` results and computed attendance).
7. Result checker PIN + payment integration (§6).
8. School fees module (§6A) — reuses the payment-gateway integration and webhook-verification pattern from step 7.
9. Promotion workflow (§5.3) — including the fee-balance flag from §6A.5 if the school opts to block promotion on outstanding balance.
10. Public site template + branding tokens (§7), then public site content management (§7A) once the template exists to populate.
11. In-app notifications (§7B) — hook into events already generated by modules 4–10 rather than building as a standalone feature.
12. Plans, feature flags, billing (§8) — only once 1–11 work end-to-end against one real school's data.
13. Super admin panel (§9) — tenant management, impersonation, financial overview (now including fee-revenue totals alongside subscription and PIN revenue), and optionally broadcast (§7B.3) since it rides on the same notification table.
14. Data export (§11.7/11.8) — build once real tenant data exists to export against.

---

## 13A. Deferred — Post-v1

Explicitly out of scope for this build pass. Documented here so they're deliberate omissions, not gaps discovered later. Revisit once the core loop (§13, steps 1–13) is proven against real schools:

- **True push notifications** (Web Push API / native mobile app) — §7B already scopes v1 to in-app only.
- **SMS/WhatsApp integration** — noted early in this document; likely high-value given Nigerian parent usage patterns, but a separate provider integration and cost model, best justified by real usage data rather than built speculatively.
- **Timetable / class schedule** — a standard expectation but not part of the core academic/results/payment loop; add once the core loop is stable.
- **Academic calendar / school events** (term dates, exam dates, holidays, PTA notices) — distinct from the one-off announcements already in §7B; a lightweight addition once notifications exist.
- **SSS subject/elective selection** (Science/Arts/Commercial combinations) — affects which subjects appear on a senior secondary student's result; deferred because it adds real complexity to `TeachingAssignment`/`ResultEntry` scoping that the current v1 flat model doesn't need to solve yet.
- **Document generation beyond report cards** (transfer certificates, testimonials, admission letters) — a real, recurring school need, but a separate templating effort from report cards.
- **Admissions/intake pipeline** (inquiry → accepted → enrolled) and **bulk CSV student import** — v1 assumes a school admin adds students directly; a lighter admissions workflow and bulk import are valuable onboarding accelerants worth adding once the first few real schools reveal how painful manual entry actually is.
- **Full page-builder / section reordering** for the public site — §7 already scopes v1 to fixed-template-with-content-fields.
- **Custom domain self-service verification UI** — §9 already notes this is built once the first Enterprise request arrives, not speculatively.

---

## 14. Tech Stack

- **Framework:** Next.js (App Router) — single codebase for public site, tenant portals, and API (Route Handlers).
- **Database:** PostgreSQL.
- **ORM:** Prisma, with a tenant-scoping middleware/pattern enforced at the query layer (§11.1).
- **Auth:** Better Auth or Lucia (TypeScript-native), with tenant and super-admin auth fully separated (§3.1, §11.2).
- **Background jobs:** BullMQ + Redis (payment confirmation, bulk report card generation, email sending).
- **File storage:** Cloudflare R2 (S3-compatible).
- **Email:** Resend or Brevo (transactional), separate sending subdomain with SPF/DKIM/DMARC configured.
- **Payments:** Paystack (or Flutterwave) — hosted checkout, webhook-verified confirmation only.
- **Hosting:** Hetzner VPS + Docker + Caddy (wildcard TLS, on-demand TLS for custom domains) + Cloudflare (DNS/CDN, free tier) as the default; move to managed infrastructure only once real load justifies it.
- **Monitoring:** Sentry (errors) + UptimeRobot (uptime) — external to the product, never surfaced in-app.

---

*End of document. Update this file as decisions change — it should always reflect current ground truth, not conversation history.*