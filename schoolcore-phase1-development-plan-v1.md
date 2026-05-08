# SchoolCore Phase 1 Development Plan v1

## 1. Phase 1 Goal

Phase 1 should turn the current demo and requirements into a usable internal beta for office staff.

The main goal is:

```text
出願・面接から学生台帳、COE、入金、帳票、入学後の在籍管理まで、
1人の学生情報を重複入力せずに流せる状態を作る。
```

Phase 1 is not a full accounting, payment, or LMS system. It should be strong enough for staff to stop managing core student, visa, report, and certificate work only in scattered Excel and paper.

## 2. Product Language and Design Direction

System UI language:

- Japanese

Requirement discussion and internal notes:

- Chinese or Japanese

Design direction:

- Staff backend: clean, efficient, SaaS-like, formal, and stable.
- Applicant/student portal: more polished and trust-building than backend.
- Student-facing pages must be mobile-first.

## 3. Included Scope

| Area | Phase 1 Scope |
|---|---|
| User / role management | Staff, immigration report staff, manager |
| Applicant intake | Manual entry from interview application form |
| Web application foundation | Japanese applicant form structure, mobile-first |
| Applicant profile | Interview application required sections |
| Application fee | Fixed 20,000 JPY, agent collection support |
| Interview result | 合格 / 保留 / 再面接 / 不合格 |
| Acceptance notice | Campus template selection and generation |
| COE workflow | Status tracking from preparation to full release |
| Student master | Person, student, enrollment, address, contact |
| File archive | Passport, residence card, COE, application materials |
| AI COE check | Assisted check with staff confirmation |
| Payment / receipt | Application fee, partial tuition, full tuition, void/reissue |
| COE release control | Partial screenshot before payment, full COE after full tuition |
| Attendance | Period/class-hour input, daily summary, configurable rules |
| Immigration reports | Low attendance, withdrawal, half-year, May/Nov, annual report foundation |
| Certificate issuance | Attendance, grade, completion, graduation, enrollment certificates |
| Template management | Campus-specific templates and version history |
| Data migration | Old system Excel import mapping and validation |
| Audit logs | Sensitive file access, document generation, void/reissue, submission |
| Student portal | Application-stage portal and enrolled-student portal foundation |

## 4. Deferred Scope

| Area | Reason |
|---|---|
| Online payment gateway | Not required for first operational beta |
| Automatic immigration website submission | Security and stability risk |
| Full OCR extraction | Can be added after data model is stable |
| Full vocational credits / graduation judgment | Phase 2 or later |
| Final AI Error/Warning standard | User marked as next-version confirmation |
| Full school accounting ledger | Needs separate finance requirements |

## 5. Confirmed Rules To Implement

### 5.1 Admission and COE

| Rule | Implementation |
|---|---|
| Interview required sections | 入学時期・滞在予定期間, 個人情報, 個人学歴, 個人申請歴, 経費支弁者情報 |
| Interview result statuses | 合格, 保留, 再面接, 不合格 |
| COE deadline | Support both intake-level deadline and student-level deadline |
| Rolling submission | Support per-student COE cases |
| Full COE release | Block until full tuition confirmation and receipt issuance |
| Partial COE screenshot | Staff can send before tuition payment |
| Full COE recipient | Student or agent after release conditions are satisfied |

### 5.2 Payment and Numbering

| Rule | Implementation |
|---|---|
| Application fee | Fixed 20,000 JPY |
| Tuition | Configurable by course and admission period |
| Standard intakes | January, April, July, October |
| Short-term admission | Anytime |
| Receipt targets | Application fee, partial tuition, full tuition |
| Agent-collected payment | Receipt/payment display uses agent name; student remains linked |
| Receipt void/reissue | Allowed with reason, user, timestamp, and history |
| Student number | Admission year/month + 3 random digits |
| Certificate number | Issue date + 3 random digits |
| Receipt number | Issue date + admission period based; final format still needs confirmation |

### 5.3 Attendance

| Rule | Implementation |
|---|---|
| Main input unit | Period/class-hour |
| Additional view | Daily summary/input |
| Late / early leave / official absence | Configurable by school in backend |
| Low attendance report trigger | Below 50% for immigration report candidate |
| Internal warning | Below 80% candidate |

### 5.4 Student Downloads

Student-facing file downloads require:

1. Student request/application.
2. Staff approval.
3. Download permission after approval.
4. Audit log for sensitive files.

Staff-only confidential files must not be visible in student portal.

## 6. Database Build Order

| Priority | Tables / Domain |
|---|---|
| P0 | users, roles, permissions, audit_logs |
| P0 | schools, campuses, courses, admission_terms, classes |
| P0 | persons, students, applicants |
| P0 | addresses, passports, residence_cards |
| P0 | files, file_access_logs |
| P0 | templates, template_versions, generated_documents |
| P0 | payments, receipts, receipt_versions |
| P0 | coe_cases, coe_case_events, coe_material_checks |
| P0 | attendance_sessions, attendance_records, attendance_rule_settings |
| P0 | immigration_report_batches, immigration_report_items |
| P1 | certificate_requests, certificate_issuances |
| P1 | student_portal_accounts, download_requests |
| P1 | migration_batches, migration_rows |

Important database principles:

- `persons` is the single identity source from applicant to student.
- `applicants` and `students` point to the same `person`.
- Generated files store template version and data snapshot.
- Sensitive files need access logs.
- Voided receipts and certificates remain visible in history.

## 7. Phase 1 Screens

### 7.1 Staff Backend

| Screen | Phase 1 Function |
|---|---|
| ダッシュボード | Alerts, pending COE, visa expiry, low attendance, pending approvals |
| 出願者一覧 | Applicant search, status, fee, interview, COE stage |
| 出願者詳細 | Interview form, files, fee, interview result, acceptance notice |
| COE進行 | Case timeline, AI check, missing fields, submission deadline |
| 学生一覧 | Student search/filter/import |
| 学生詳細 | Master data, visa, passport, address, attendance, files |
| 出席入力 | Period/class-hour attendance input |
| 出席集計 | Monthly and half-year calculation |
| 入金・領収書 | Payment confirmation, receipt issue, void/reissue |
| 入管報告 | Report batches, validation, generated files, submission status |
| 証明書 | Request approval, issue, void, ledger |
| テンプレート | Upload, campus mapping, version management |
| データ移行 | Excel upload, mapping, trial import, error report |
| 設定 | Numbering, attendance rules, roles, campus/course settings |

### 7.2 Applicant Portal

Mobile-first screens:

- 出願入力
- 出願状況
- 追加書類提出
- COE準備状況
- 学費案内
- 来日予定入力

### 7.3 Enrolled Student Portal

Mobile-first screens:

- ホーム
- 出席状況
- 在留期限・更新案内
- 証明書申請
- 学校からのお知らせ
- 承認済み書類ダウンロード

## 8. Development Milestones

### Milestone 1: Foundation

Build:

- Auth shell and roles
- School/campus/course/class settings
- Student/applicant master data
- File archive
- Audit logs

Acceptance:

- Staff can create an applicant and student.
- Staff can upload passport, residence card, and COE files.
- Sensitive file access is logged.
- Manager can create staff accounts.

### Milestone 2: Language School COE Flow

Build:

- Interview application required sections
- Application fee 20,000 JPY
- Interview result flow
- Acceptance notice generation
- COE case timeline
- AI COE check basic version

Acceptance:

- Staff can enter interview form data and see missing required sections.
- Staff can mark fee collected by student or agent.
- Staff can generate campus-specific acceptance notice.
- Staff can run AI check and confirm/dismiss issues.
- COE case cannot be submitted while required errors remain unresolved.

### Milestone 3: Payment, Receipt, and COE Release

Build:

- Payment records
- Receipt generation
- Void/reissue
- Full COE release control
- Partial screenshot send record

Acceptance:

- Receipt is generated for application fee and tuition.
- Agent-collected payment displays agent name.
- Full COE is blocked until full tuition and receipt are confirmed.
- Full COE can be released to student or agent after conditions are satisfied.
- Every release/send action is logged.

### Milestone 4: Attendance and Immigration Reports

Build:

- Attendance rule settings
- Period/class-hour attendance input
- Monthly and half-year summaries
- Low attendance report
- Withdrawal report
- May/November report foundation
- Annual report foundation

Acceptance:

- Staff can configure late/early leave/official absence rules.
- System calculates monthly attendance rates.
- Students below 50% become immigration report candidates.
- Report batches show validation errors before generation.
- Generated Excel files retain template version and snapshot data.

### Milestone 5: Certificates, Student Portal, and Migration

Build:

- Certificate request and approval
- Certificate issuance and ledger
- Applicant portal mobile screens
- Enrolled-student portal mobile screens
- Old-system Excel migration trial import

Acceptance:

- Student can request a certificate.
- Staff can approve and issue certificate.
- Student can download only approved documents.
- Old Excel import can detect duplicate/missing data before final import.
- Migration batch history is saved.

## 9. Still To Confirm Before Engineering Starts

| Item | Why It Matters |
|---|---|
| Final receipt number format | Affects legal/accounting documents |
| Receipt template layout | Needed for exact generation |
| Whether application fee can be waived/refunded | Affects payment statuses |
| COE screenshot send record format | Needed for audit and communication history |
| Exact required fields inside each interview form section | Needed for validation rules |
| First campus/school to support | Determines first template set |
| First production database choice | Affects backend implementation |
| Hosting/security policy | Important because passport, residence card, COE are sensitive |
| AI check Error/Warning standard | Deferred, but needed before strict automation |

## 10. Recommended Immediate Next Actions

1. Freeze Phase 1 scope from this document.
2. Convert critical `.xls` templates to `.xlsx` for exact cell mapping.
3. Decide the first campus and first three documents to generate automatically.
4. Finalize the receipt number and receipt template.
5. Start backend implementation with master data, files, roles, and audit logs.
6. Keep the current HTML demo as the living UI prototype until a production frontend is started.
