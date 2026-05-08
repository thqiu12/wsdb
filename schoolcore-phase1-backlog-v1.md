# SchoolCore Phase 1 Engineering Backlog v1

## 1. Backlog Policy

This backlog converts the confirmed requirements into engineering tasks.

Priority meanings:

- P0: Required for internal beta.
- P1: Strongly recommended for Phase 1, can ship after first beta if needed.
- P2: Useful but can wait.

Definition of Done for every ticket:

- UI text is Japanese.
- Sensitive actions create audit logs.
- Permission checks are applied.
- Generated files store template version and data snapshot.
- Validation errors are shown before staff commits high-risk operations.

## 2. Epic A: Foundation, Roles, and Audit

### A-01 User Roles and Permissions

Priority: P0

Build:

- Role master for `staff`, `immigration_report_staff`, `manager`.
- Permission matrix from confirmed rules.
- UI permission guards.
- API permission guards.

Acceptance:

- `staff` can edit student info, view files, run AI check, confirm payments, issue receipts, send COE.
- `immigration_report_staff` can generate immigration files and mark reports submitted.
- `manager` can create accounts.
- Forbidden actions return clear Japanese error messages.

### A-02 Audit Log Foundation

Priority: P0

Build:

- Audit log table/service.
- Event categories: create, update, delete, view_file, download_file, generate_document, void_document, submit_report, release_coe.
- Actor, timestamp, target type/id, before/after summary, IP/user agent where available.

Acceptance:

- Viewing/downloading passport, residence card, and COE creates logs.
- Voiding receipts/certificates creates logs with reason.
- COE partial/full send actions create logs.

## 3. Epic B: Master Data

### B-01 School, Campus, Course, Admission Term

Priority: P0

Build:

- School/campus settings.
- Course settings.
- Admission terms for January, April, July, October.
- Short-term admission support.
- Tuition setting per course/admission term.

Acceptance:

- Staff can create standard intake and short-term intake.
- Tuition can differ by course and intake.
- Templates can later be assigned by campus.

### B-02 Person, Applicant, Student Master

Priority: P0

Build:

- Person master.
- Applicant record.
- Student record.
- Applicant-to-student conversion.
- Student number generation: admission year/month + 3 random digits.

Acceptance:

- One person can move from applicant to student without duplicate profile.
- Student number is unique within school.
- Staff can search by name, nationality, passport, student number.

## 4. Epic C: Applicant and Language School COE Workflow

### C-01 Interview Application Form

Priority: P0

Build required sections:

- 入学時期・語学学校滞在予定期間
- 個人情報
- 個人学歴
- 個人申請歴
- 経費支弁者情報

Acceptance:

- Staff can save draft even if incomplete.
- System shows missing required sections.
- Required errors block COE submission, not draft entry.

### C-02 Application Fee

Priority: P0

Build:

- Fixed 20,000 JPY application fee.
- Payment status.
- Student payment and agent-collected payment.
- Agent name when agent collected.

Acceptance:

- Payment record links to applicant/student.
- Agent-collected payment displays agent name.
- Student remains searchable from receipt/payment details.

### C-03 Interview Result

Priority: P0

Build statuses:

- 合格
- 保留
- 再面接
- 不合格

Acceptance:

- Multiple interview records can be stored.
- 合格 enables acceptance notice generation.
- 再面接 creates next action.

### C-04 Acceptance Notice Generation

Priority: P0

Build:

- Template selection by school/campus.
- Generated file archive.
- Versioned template snapshot.

Acceptance:

- Staff can generate a campus-specific acceptance notice.
- Generated notice remains unchanged even if student data changes later.

### C-05 COE Case Timeline

Priority: P0

Build stages:

- COE準備
- 願書・資料回収
- AIチェック
- 入管提出
- COE交付
- 学費確認
- COE全体送付
- 来日予定
- 口頭テスト
- クラス分け

Acceptance:

- Each stage has status, due date, responsible staff, notes.
- Term-level and student-level COE deadlines are supported.
- Rolling submission per student is supported.

### C-06 AI COE Check Basic

Priority: P0

Build:

- Material checklist.
- Inconsistency issue list.
- Severity: Error / Warning / Info, but final strict standard remains configurable/deferred.
- Staff confirmation/dismissal.

Acceptance:

- Staff can run AI check from COE case.
- Issues are stored with time and actor.
- Staff must confirm/dismiss important issues before final lock.
- UI states AI check is support, not final immigration judgment.

## 5. Epic D: Files and Sensitive Documents

### D-01 File Archive

Priority: P0

Build file categories:

- Passport
- Residence card front/back
- COE partial screenshot
- COE full file
- Interview application
- 願書
- Sponsor documents
- Certificates
- Immigration reports
- Submission evidence screenshot

Acceptance:

- Files link to person, applicant, student, or report.
- File visibility can be staff-only or student-visible after approval.
- Sensitive file view/download is logged.

### D-02 Student Download Approval

Priority: P1

Build:

- Student document request.
- Staff approval/rejection.
- Download permission after approval.

Acceptance:

- Student cannot download staff-only files.
- Student can download approved certificate/document only.
- Approval and download are logged.

## 6. Epic E: Payment, Receipt, and COE Release

### E-01 Payment Records

Priority: P0

Build payment types:

- Application fee
- Tuition partial payment
- Tuition full payment

Acceptance:

- Payment has amount, date, payer display name, method, proof file, confirmed by, confirmed at.
- Tuition full-payment status can be derived from payment records.

### E-02 Receipt Generation

Priority: P0

Build:

- Receipt number generation from issue date and admission period.
- Certificate number style support: issue date + 3 random digits.
- Receipt file generation from template.
- Issuer and issue time.

Acceptance:

- Receipt can be generated after confirmed payment.
- Receipt history is stored.
- Agent-collected payment receipt displays agent name.
- Final receipt number pattern remains configurable.

### E-03 Receipt Void and Reissue

Priority: P0

Build:

- Void receipt with reason.
- Reissue receipt as new version/new number according to setting.

Acceptance:

- Voided receipt remains visible.
- Reissued receipt does not overwrite old file.
- Void/reissue creates audit log.

### E-04 COE Release Control

Priority: P0

Build:

- Partial screenshot send record.
- Full COE send action.
- Release guard requiring full tuition confirmation and receipt issuance.
- Student/agent recipient selection.

Acceptance:

- Staff can send partial screenshot before full tuition.
- Full COE send is blocked until conditions are satisfied.
- Full COE can be sent to student or agent after release.
- Every send action is logged.

## 7. Epic F: Attendance

### F-01 Attendance Rule Settings

Priority: P0

Build configurable rules:

- Late handling.
- Early leave handling.
- Official absence handling.
- Period-to-minute conversion.
- Day summary from period records.

Acceptance:

- School can change attendance calculation rules.
- Recalculation uses rule version.
- Historical summaries keep rule snapshot.

### F-02 Period Attendance Input

Priority: P0

Build:

- Class/date/session selection.
- Period-level attendance input.
- Statuses: present, absent, late, early_leave, official_absence, unknown.

Acceptance:

- Staff/teacher can enter period attendance.
- Daily summary can be calculated.
- Monthly summary can be recalculated.

### F-03 Monthly and Half-Year Summary

Priority: P0

Build:

- Monthly attendance summaries.
- Half-year summaries: Apr-Sep and Oct-Mar.
- Lock/confirm summary.

Acceptance:

- Students below 50% are flagged for immigration report.
- Students below 80% are flagged for internal warning.
- Locked summary cannot be changed without permission and reason.

## 8. Epic G: Immigration Reports and Templates

### G-01 Template Management

Priority: P0

Build:

- Template upload.
- Template version.
- Campus assignment.
- Variable/cell mapping.
- Active/inactive status.

Acceptance:

- Old and new formats can coexist.
- Generated documents store template version.
- Campus-specific templates are selectable.

### G-02 Low Attendance Below 50% Report

Priority: P0

Build:

- Candidate extraction from monthly attendance.
- Validation based on `入管5割出席率不佳報告_模板.xlsx`.
- Excel generation.

Acceptance:

- Missing nationality, roman name, birth date, gender, card number, admission date, graduation date, and attendance are errors.
- Previous month attendance and work permission employer can be warnings.
- Staff can include/exclude candidate with reason.

### G-03 Leaving / Withdrawal Report

Priority: P0

Build:

- Leaving record from status change.
- Snapshot of final address, residence card, reason.
- Template generation.

Acceptance:

- Withdrawal/expulsion/missing/completion/graduation can create leaving record as needed.
- Submission status and due date are stored.

### G-04 May/November Report Foundation

Priority: P1

Build:

- Report batch.
- Current student list extraction.
- Status notification summary.

Acceptance:

- Staff can generate resident list and summary with validation.
- Exact cell mapping can be completed after `.xls` conversion.

### G-05 Annual Completion Report Foundation

Priority: P1

Build:

- Annual completion summary.
- Requirement list.
- Attachment file archive.
- Submission evidence screenshot storage.

Acceptance:

- Annual package links `報告様式`, `リスト`, attachment PDFs, and submission screenshot.
- Submission screenshot is confidential and logged.

## 9. Epic H: Certificates

### H-01 Certificate Request and Approval

Priority: P1

Build:

- Student certificate request.
- Staff approval/rejection.
- Request status.

Acceptance:

- Student can request documents from portal.
- Staff approval is required before download.

### H-02 Certificate Issuance and Ledger

Priority: P1

Build certificate types:

- 在学証明書
- 出席率証明書
- 成績証明書
- 修了証書
- 卒業証書

Acceptance:

- Certificate number is generated by issue date + 3 random digits.
- Issuer and issue time are recorded.
- Certificate can be voided with reason.
- 証書台帳 can be exported.

## 10. Epic I: Data Migration

### I-01 Old System Excel Import

Priority: P1

Build:

- Upload old system Excel export.
- Field mapping.
- Trial import.
- Duplicate detection.
- Error/warning report.

Acceptance:

- Imported data can create/update person/student records.
- Missing required data is reported before final import.
- Original Excel is stored as evidence.

### I-02 Migration Mapping Presets

Priority: P1

Build mapping presets for detected WSDB export columns:

- 学籍号码
- 姓名(英文)
- 代理商名称
- 登録状態
- 入学時期
- course
- 班级
- 国籍
- 性別
- 出生年月日
- 入学日期
- 卒業/修了/脱離年月日
- 国内住所
- 申請時住所
- 護照番号
- 在留資格
- 納付状況

Acceptance:

- Staff can reuse mapping preset.
- Unknown columns are kept in import batch details.

## 11. First Three Documents To Automate

Recommended order:

1. 領収書
2. 合格通知書
3. 入管5割出席率不佳報告

Reason:

- Receipt controls money and COE release.
- Acceptance notice closes the interview/pass workflow.
- Low attendance report is already `.xlsx` and mappable.

## 12. Internal Beta Exit Criteria

The internal beta is ready when:

- Staff can create applicant, collect application fee, record interview result, and generate acceptance notice.
- Staff can prepare a COE case, run AI check, track missing items, and record submission.
- Staff can confirm tuition payment, issue receipt, and release full COE only after conditions are met.
- Staff can register enrolled student information, passport, residence card, Japan address, and class.
- Staff can enter period attendance and generate low-attendance candidates.
- Staff can issue at least one certificate type with number, issuer, time, and void history.
- Sensitive files and high-risk operations are auditable.
