# SchoolCore MVP Functional Specification v1

## 1. Product Name

SchoolCore 留学生学校业务平台

## 2. Product Positioning

SchoolCore is a school operations platform centered on international students.

It supports both:

- Japanese language schools
- Vocational schools with many international students

The MVP focuses on shared core operations:

- Student master data
- Residence card and passport management
- Attendance management
- Immigration report generation
- Certificate issuance
- File archive
- Template-based document generation
- Web application entry point

## 3. MVP Goal

The MVP should replace scattered Excel, Google Forms, and paper workflows with one consistent data flow:

```text
Web application / manual registration
  -> Student master record
  -> Visa, passport, address, files
  -> Attendance and warnings
  -> Immigration reports
  -> Certificates and renewal documents
```

The key value is:

```text
Enter student data once, reuse it for all reports, certificates, and visa documents.
```

## 4. Target Users

| Role | Main Use |
|---|---|
| System admin | System settings, users, permissions |
| School admin | School-wide management |
| Principal / responsible officer | Report approval, status overview |
| Office staff | Student info, visa, reports, certificates |
| Academic staff | Classes, attendance, status checking |
| Teacher | Attendance input |
| Read-only user | View data without editing |
| Applicant | Future web application and admission procedure |

## 5. MVP Scope

### Included

| Module | Included in MVP |
|---|---|
| Dashboard | Yes |
| Student management | Yes |
| Residence card / passport | Yes |
| Address and contact info | Yes |
| File archive | Yes |
| Attendance input | Yes |
| Monthly attendance calculation | Yes |
| Half-year attendance calculation | Basic |
| Low attendance report | Yes |
| Withdrawal / leaving report | Yes |
| Immigration report batch management | Yes |
| Certificate issuance | Yes |
| Template management | Basic |
| Visa expiry reminders | Yes |
| Visa renewal document generation | Basic |
| Automatic receipt issuance | Basic |
| AI COE material check | Basic assisted review |
| Data migration from old system Excel | Basic import and validation |
| Document/ledger template catalog | Basic template registration |
| Operation logs | Yes |
| Web application form | Basic demo/MVP entry |
| Applicant mobile portal | Basic |
| Enrolled student mobile portal | Basic |

### Not Included in MVP

| Module | Reason |
|---|---|
| Full online payment | Phase 2 or 3 |
| Full admission procedure portal | Phase 2 |
| Interview scheduling | Phase 2 |
| Full grade and credit management | Phase 2 or 3 |
| Graduation judgment | Phase 3 |
| Finance and tuition ledger | Phase 3 |
| Native student mobile app | Phase 3 |
| Final AI Error/Warning standard | Phase 2 |
| OCR for residence cards | Phase 3 |
| Automatic login/submission to immigration websites | Excluded for security and stability |

## 6. Main User Stories

### 6.1 Student Registration

Office staff can register a new student with:

- Basic identity
- Address
- Contact
- Course / department / class
- Residence card
- Passport
- Uploaded files

The system validates missing or invalid data.

Acceptance criteria:

- Student number is unique inside the school.
- Required fields are checked before saving.
- Residence card front/back images can be uploaded.
- Passport and residence expiry dates are stored.
- Operation is recorded in audit logs.

### 6.2 Web Application

Applicants can submit basic application information online.

MVP fields:

- Desired course/department
- Admission term
- Name
- Email
- Nationality
- Birth date
- Education history
- Photo upload
- Passport upload
- Confirmation text

Acceptance criteria:

- Application number is generated.
- Application status starts as submitted.
- Staff can later convert accepted applicant data into student master data.
- File uploads are stored with application/student linkage.

### 6.3 Student Detail

Office staff can view all student data from one screen:

- Basic info
- Enrollment
- Residence card and passport
- Attendance
- Immigration reports
- Certificates
- Files
- Status history

Acceptance criteria:

- Current residence expiry and latest attendance rate are visible.
- Missing required items are highlighted.
- Staff can open certificate/report/visa renewal actions from the student page.

### 6.4 Residence Management

Office staff can manage:

- Residence card number
- Residence status
- Period of stay
- Expiry date
- Work permission
- Card front/back images
- Passport number and expiry
- Part-time activity institution

Acceptance criteria:

- Current residence card can be changed while history is retained.
- Expiry alerts are generated for 90/60/30/14/7 days.
- Expired cards are visible in alert lists.
- Residence card file access is logged.

### 6.5 Attendance Management

Teachers or staff can input attendance by class and date.

MVP supports:

- Daily mode
- Present
- Absent
- Late
- Early leave
- Official absence
- Unknown

Acceptance criteria:

- Monthly required minutes and attended minutes are calculated.
- Monthly attendance rate is calculated.
- Students below 50% are flagged for immigration report.
- Students below 80% are flagged for internal warning.
- Monthly summary can be locked after confirmation.

### 6.6 Low Attendance Immigration Report

Staff can generate candidates from monthly attendance.

Trigger:

- Monthly attendance rate below 50%

Report includes:

- Student identity
- Residence card info
- Address
- Course/class
- Monthly attendance rate
- Work permission
- Part-time activity institution, if applicable

Acceptance criteria:

- System extracts candidates automatically.
- Missing address/card/passport/part-time activity items are listed.
- Staff can include/exclude students with reason.
- Excel/PDF can be generated from template.
- Submission status can be recorded.

### 6.7 Withdrawal / Leaving Report

When a student status changes to withdrawal, expulsion, missing, transfer, graduation, completion, employment, or return home, the system creates a leaving record.

Acceptance criteria:

- Leaving date and reason are required.
- Final residence status and expiry are snapshotted.
- Final address is snapshotted.
- Report due date is generated when report is required.
- Fixed-format leaving/immigration documents can be generated.
- Submission status is recorded.

### 6.8 Half-Year Attendance Report

Staff can calculate six-month attendance periods.

MVP periods:

- April 1 to September 30
- October 1 to March 31

Acceptance criteria:

- System calculates total required and attended minutes.
- System calculates period attendance rate.
- Student monthly attendance details can be attached/exported.
- Report batch can be created from the calculated period.

### 6.9 Immigration Report Management

Staff can manage report batches.

Report statuses:

- Draft
- Pending review
- Confirmed
- Generated
- Submitted
- Accepted
- Correction required
- Completed
- Not required
- Cancelled

Acceptance criteria:

- Report list supports filtering by type/status/due date.
- Report detail shows target students and validation errors.
- Generated files keep version history.
- Submission method, date, submitter, and receipt number can be stored.

### 6.10 Certificate Issuance

Staff can issue:

- Enrollment certificate
- Attendance certificate
- Grade certificate
- Completion certificate
- Graduation certificate
- Expected graduation certificate
- Transcript + attendance certificate

Acceptance criteria:

- Certificate number is generated.
- Issuer and issue time are recorded.
- Generated file is stored.
- Snapshot data is stored.
- Certificate can be voided with reason.
- Voided certificate remains in history.

### 6.11 Template Management

Admin can upload and manage templates.

MVP supported formats:

- Excel
- Word
- PDF output from generated data

Template types:

- Immigration report
- Certificate
- Visa renewal
- Admission

Acceptance criteria:

- Template has code, name, type, version, and active flag.
- Template variables can be mapped.
- Generated documents store template version and data snapshot.
- Old generated files are not affected by template updates.

### 6.12 Visa Renewal Documents

Office staff can select students whose residence period is expiring and generate renewal documents from templates.

Acceptance criteria:

- Students expiring within selected period can be extracted.
- Student data is pre-filled into configured templates.
- Missing fields are listed before generation.
- Generated files are linked to visa renewal case.
- Case status can be updated.

### 6.13 Automatic Receipt Issuance

Staff can generate receipts automatically after payment confirmation.

Receipt targets:

- Application fee
- Tuition partial payment
- Full tuition payment
- Agent-collected payment record

Acceptance criteria:

- Receipt number is generated.
- Receipt number is generated from issue date and admission period.
- Application fee amount is 20,000 JPY.
- Standard admission periods are January, April, July, and October; short-term admission can be anytime.
- Receipt template is filled automatically.
- Issuer and issue time are recorded.
- Receipt file is stored in file archive.
- Receipt can be voided with reason.
- Receipt can be reissued without overwriting the original history.
- Agent-collected receipt/payment display shows agent name.
- Full COE release is blocked until full tuition payment is confirmed and receipt is issued.
- Full COE can be sent to agent after release conditions are satisfied.

### 6.13A Numbering Rules

Confirmed numbering rules:

- Student number: admission year/month + 3 random digits.
- Certificate number: issue date + 3 random digits.
- Receipt number: issue date + admission period based format, final exact format to be confirmed.

Examples:

```text
Student number: 202604123
Certificate number: 20260420027
Receipt number: RC-20260420-202610-001
```

### 6.13B Attendance Rule Settings

Attendance calculation must be configurable by school in the backend.

Rules to configure:

- Late handling
- Early leave handling
- Official absence handling
- Required/attended period conversion
- Day-level summary from period-level attendance

Attendance input:

- Period/class-hour input is most important.
- Day-level view/input is also needed.

### 6.13C Student File Download Approval

Student-facing file downloads must use an application/approval flow.

Rule:

- Student requests or applies for a document/file.
- Staff reviews and approves.
- Student can download after approval.
- Staff-only confidential files remain hidden.

### 6.14 AI COE Material Check

Staff can run an AI-assisted check before COE submission.

The AI check reviews:

- Interview application form
- Full 願書/application form
- Passport
- Graduation documents
- Transcripts
- Japanese study certificate
- Sponsor documents
- Bank balance certificate
- Family relationship documents
- Past visa/COE history explanations

Acceptance criteria:

- AI check creates an issue list by severity.
- It detects missing required fields.
- It flags inconsistent names, dates, addresses, passport numbers, and education history.
- It compares interview form data and 願書 data.
- It stores check result, check time, and reviewer.
- Staff must confirm or dismiss each important issue before final lock/submission.
- The system clearly states that AI check is staff support, not final legal/immigration judgment.

### 6.15 Data Migration From Old System Excel

The old system can export Excel files. SchoolCore must support migration from those exports.

Acceptance criteria:

- Staff/admin can upload old-system Excel exports.
- System can map old columns to SchoolCore fields.
- System validates required fields before import.
- System detects duplicate students.
- System reports errors and warnings.
- System creates an import batch history.
- System keeps original uploaded Excel as source evidence.
- System supports trial import before final import.
- System provides downloadable error/warning report.

### 6.16 Document / Ledger Templates

SchoolCore should support school documents and ledgers through template management.

Initial template categories:

- 帳票番号設定
- 資格外活動（上陸）
- 入学決定通知書
- 卒業証書
- 修了証書
- 証書台帳
- 出席簿
- 出席簿（新）
- クラス名簿
- クラス名簿（新）
- 全クラス名簿
- 定期試験結果①
- 定期試験結果②
- 定期試験結果通知①
- 定期試験結果通知②
- 日本留学試験結果
- 日本語能力試験結果

Acceptance criteria:

- Templates can be registered by document type.
- Old and new formats can coexist.
- Numbering rules can be configured.
- Generated files store template version and snapshot data.
- Certificate ledger can be generated/exported.
- Attendance books and class rosters can be generated by period/class.
- Exam results can be stored and exported.

## 7. MVP Screens

| Screen | Purpose |
|---|---|
| Dashboard | Daily alerts and risk overview |
| Web application | Basic applicant intake |
| Student list | Search/filter/manage students |
| Student detail | One-student master view |
| New student registration | Register student and required files |
| Attendance input | Record class attendance |
| Monthly attendance summary | Confirm and lock monthly rates |
| Half-year attendance summary | Prepare six-month reports |
| Visa expiry list | Prevent residence expiry |
| Visa renewal case detail | Track renewal preparation |
| Immigration report list | Manage all report batches |
| Immigration report detail | Validate, generate, submit |
| Certificate issue | Generate certificate |
| Certificate list | View issued/voided certificates |
| File search | Find and audit files |
| Template list | Manage templates |
| Template mapping | Map variables |
| School settings | School master |
| Course/class settings | Course and class master |
| User/role settings | Permissions |
| Audit logs | Operation history |

## 8. Data Requirements

The MVP uses the database design in:

- `schoolcore-database-v1.md`

Minimum implemented tables:

- schools
- users
- roles
- permissions
- persons
- students
- addresses
- courses
- departments
- classes
- enrollment_histories
- passports
- residence_cards
- part_time_activities
- files
- file_access_logs
- attendance_sessions
- attendance_records
- attendance_monthly_summaries
- attendance_period_summaries
- student_status_changes
- leaving_records
- immigration_report_types
- immigration_reports
- immigration_report_items
- immigration_report_files
- certificate_types
- certificate_issuances
- document_templates
- generated_documents
- reminders
- audit_logs

## 9. Validation Rules

### Student Required Checks

| Check | Level |
|---|---|
| Student number missing | Error |
| Duplicate student number | Error |
| Name missing | Error |
| Birth date missing | Error |
| Nationality missing for international student | Error |
| Course/class missing for enrolled student | Warning/Error by setting |
| Japanese address missing | Warning |
| Residence card missing for student already in Japan | Warning/Error by setting |
| Residence expiry missing | Warning/Error by setting |
| Passport number missing | Warning |
| Passport expired | Warning |

### Immigration Report Checks

| Check | Level |
|---|---|
| Missing residence card number | Error |
| Missing residence expiry | Error |
| Missing Japanese address | Error |
| Missing birth date | Error |
| Missing nationality | Error |
| Attendance not calculated | Error |
| Low-attendance student has work permission but no employer data | Warning/Error by setting |
| Leaving report without leaving date | Error |
| Report due date exceeded | Warning |

### Certificate Checks

| Check | Level |
|---|---|
| Missing student identity | Error |
| Attendance certificate without calculated period | Error |
| Grade certificate without grade data | Warning |
| Template not active | Error |
| Duplicate certificate number | Error |

## 10. Permissions

Confirmed permission model:

| Operation | staff | immigration report staff | manager |
|---|---:|---:|---:|
| Modify student basic information | Yes | Yes, if also staff | Yes |
| View/download passport, residence card, COE | Yes | Yes, if also staff | Yes |
| Run AI check | Yes | Yes, if also staff | Yes |
| Confirm AI check | Yes | Yes, if also staff | Yes |
| Generate immigration files | No | Yes | Yes |
| Mark immigration report as submitted | No | Yes | Yes |
| Confirm tuition/payment | Yes | No, unless also staff | Yes |
| Issue receipt | Yes | No, unless also staff | Yes |
| Send full COE | Yes | No, unless also staff | Yes |
| Void certificate/receipt | Yes | No, unless also staff | Yes |
| Create new user account | No | No | Yes |

Operational permission notes:

- Passport, residence card, and COE downloads must be logged.
- Full COE sending is blocked until full tuition confirmation.
- Certificate/receipt voiding requires reason, user, and timestamp.
- Immigration file generation and submission marking require `immigration_report_staff`.

## 11. Audit Log Requirements

The system must log:

- Login failure
- Student create/update/delete
- Residence card create/update/delete
- Passport create/update/delete
- Address update
- File upload/download/delete
- Attendance update
- Attendance lock/unlock
- Report creation
- Report confirmation
- Report file generation
- Report submission status change
- Certificate issue
- Certificate void
- Template upload/update
- User and permission changes

## 12. Generated Document Requirements

Every generated document must store:

- Template id
- Template version
- Generated file id
- Generator user
- Generated time
- Owner type and id
- Snapshot data used for generation

This prevents old documents from changing when student data or templates are updated later.

## 13. Suggested MVP Phases

### Phase 1: Core Student and File Management

Deliver:

- Login
- School settings
- User/role settings
- Course/class settings
- Student list
- Student detail
- New student registration
- Residence card/passport
- File upload
- Audit log basics

Exit criteria:

- Staff can register and search students.
- Residence card and passport data can be stored.
- Files can be uploaded and downloaded with access log.

### Phase 2: Attendance and Visa Alerts

Deliver:

- Attendance input
- Monthly attendance calculation
- Half-year calculation
- Visa expiry list
- Reminders

Exit criteria:

- Monthly attendance rate is calculated.
- Below 50% students are flagged.
- Expiring residence cards are visible.

### Phase 3: Reports and Certificates

Deliver:

- Template management
- Certificate issuance
- Certificate history
- Immigration report list/detail
- Low-attendance report
- Withdrawal/leaving report
- Generated document history

Exit criteria:

- Staff can generate at least one certificate.
- Staff can create a low-attendance report batch.
- Staff can generate report file and record submission.

### Phase 4: Web Application Entry

Deliver:

- Public web application form
- Applicant list
- Basic review status
- Applicant-to-student conversion

Exit criteria:

- Google Form replacement is usable for basic application intake.
- Accepted applicants can become student records without retyping core data.

## 14. Success Criteria

The MVP is successful if:

1. Student data can be managed centrally.
2. Residence expiry and missing data risks are visible.
3. Attendance rates are calculated automatically.
4. Low-attendance report candidates are extracted automatically.
5. Leaving/withdrawal reports can be generated from student status changes.
6. Certificates can be generated with issuer/time logs.
7. Generated files preserve data snapshots.
8. Staff can reduce manual copy-paste from Excel and paper forms.
9. Web application can replace Google Form for basic intake.

## 15. Required Materials From School

To build the real system, collect:

1. Current student Excel files
2. Current attendance Excel files
3. Current immigration report formats
4. Residence renewal five-form templates
5. Attendance certificate template
6. Grade certificate template
7. Completion/graduation certificate template
8. Leaving/withdrawal form template
9. Application form fields currently used in Google Form
10. Paper admission procedure documents
11. User role list inside the school
12. Certificate numbering rules
13. Student numbering rules
14. Attendance calculation rules for late/early leave

## 16. Current Prototype

Static demo:

- `schoolcore-demo.html`

Related design documents:

- `schoolcore-database-v1.md`
- `schoolcore-screens-v1.md`
- `immigration-template-catalog-v1.md`
