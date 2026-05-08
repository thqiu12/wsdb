# SchoolCore Screen Design v1

## 1. MVP Goal

The MVP should let school staff manage international students from master data to residence status, attendance, immigration reports, certificates, files, reminders, and audit logs.

The first version focuses on shared functions used by both Japanese language schools and vocational schools with many international students.

## 2. Main Navigation

```text
Dashboard
Students
Attendance
Visa Management
Immigration Reports
Certificates
Files
Templates
Settings
Audit Logs
```

Future modules:

```text
Web Application
Admission Procedures
Academics
Tuition
Career / Pathway
```

## 3. Dashboard

### Purpose

Give staff a daily work queue and risk overview.

### Widgets

| Widget | Description | Main Tables |
|---|---|---|
| Current enrolled students | Count by status, course, class | `students`, `classes`, `courses` |
| Visa expiry alerts | 90/60/30/14/7 day groups | `residence_cards`, `students`, `reminders` |
| Passport expiry alerts | Expiring passports | `passports`, `reminders` |
| Low attendance alerts | Below 50%, below 80%, consecutive absence | `attendance_monthly_summaries`, `attendance_records` |
| Pending immigration reports | Draft/review/report due | `immigration_reports` |
| Overdue reports | Reports past due date | `immigration_reports` |
| Certificates issued today | Count and list | `certificate_issuances` |
| Recent operations | Latest high-risk changes | `audit_logs` |

### Actions

- Open student detail
- Open report batch
- Mark reminder as done
- Create report from alert
- Export alert list

## 4. Students

### 4.1 Student List

### Purpose

Search, filter, and manage all students and past students.

### Filters

| Filter | Source |
|---|---|
| School | `schools` |
| Status | `students.current_status` |
| Course | `courses` |
| Department | `departments` |
| Class | `classes` |
| Admission year/month | `students.admission_date` |
| Nationality | `persons.nationality` |
| Residence status | `residence_cards.residence_status` |
| Visa expiry range | `residence_cards.expiry_date` |
| Attendance rate range | `attendance_monthly_summaries.attendance_rate` |
| Missing documents | `files`, validation rules |

### Table Columns

| Column | Source |
|---|---|
| Student number | `students.student_number` |
| Name | `persons.full_name` |
| Kana | `persons.full_name_kana` |
| Nationality | `persons.nationality` |
| Status | `students.current_status` |
| Course / Department | `courses`, `departments` |
| Class | `classes` |
| Residence status | `residence_cards.residence_status` |
| Residence expiry | `residence_cards.expiry_date` |
| Latest monthly attendance | `attendance_monthly_summaries` |
| Warnings | calculated |

### Actions

- Create student
- Import CSV / Excel
- Export list
- Open student detail
- Bulk generate certificates
- Bulk create immigration report candidates

### Main Tables

`students`, `persons`, `addresses`, `courses`, `departments`, `classes`, `residence_cards`, `attendance_monthly_summaries`, `files`

## 5. Student Detail

### Purpose

Single source of truth for one student.

### Tabs

```text
Overview
Basic Info
Enrollment
Visa / Passport
Attendance
Immigration Reports
Certificates
Files
Status History
Audit
```

### 5.1 Overview Tab

Shows:

- Current status
- Student number
- Course / department / class
- Japanese address
- Residence card expiry
- Passport expiry
- Current attendance rate
- Open reminders
- Missing required fields
- Latest generated documents

Actions:

- Edit profile
- Change status
- Upload file
- Issue certificate
- Create visa renewal case
- Create immigration report item

### 5.2 Basic Info Tab

Fields:

- Name fields
- Gender
- Birth date
- Nationality
- Birth country
- Native language
- Email
- Phone
- Emergency contact
- Japan address
- Home country address

Tables:

`persons`, `addresses`

### 5.3 Enrollment Tab

Fields:

- Student number
- Status
- Admission date
- Expected graduation/completion date
- Actual graduation/completion date
- Course
- Department
- Class
- Grade year
- Enrollment history

Actions:

- Change class
- Change course/department
- Change status
- Create leaving record

Tables:

`students`, `enrollment_histories`, `student_status_changes`, `leaving_records`

### 5.4 Visa / Passport Tab

Sections:

1. Current residence card
2. Residence card history
3. Passport
4. Part-time activity
5. Visa renewal cases

Residence card fields:

- Card number
- Residence status
- Period of stay
- Permission date
- Expiry date
- Work permission
- Front image
- Back image

Actions:

- Add new residence card
- Mark as current
- Upload front/back image
- Create renewal reminder
- Generate renewal documents

Tables:

`residence_cards`, `passports`, `part_time_activities`, `visa_renewal_cases`, `files`

### 5.5 Attendance Tab

Shows:

- Monthly summaries
- Half-year summaries
- Daily/period records
- Below 50% warning
- Below 80% warning

Actions:

- Open attendance input
- Recalculate attendance
- Lock monthly summary
- Generate attendance certificate
- Add to low-attendance report

Tables:

`attendance_records`, `attendance_sessions`, `attendance_monthly_summaries`, `attendance_period_summaries`

### 5.6 Immigration Reports Tab

Shows report items involving this student.

Columns:

- Report type
- Period
- Status
- Due date
- Submitted date
- Receipt number
- Generated files

Tables:

`immigration_report_items`, `immigration_reports`, `immigration_report_files`

### 5.7 Certificates Tab

Shows:

- Certificate number
- Type
- Language
- Period
- Status
- Issued by
- Issued at
- File

Actions:

- Issue new certificate
- Download
- Void

Tables:

`certificate_issuances`

### 5.8 Files Tab

Shows all files owned by the student or person.

Filters:

- Passport
- Residence card
- Application document
- Certificate
- Immigration report
- Visa renewal
- Other

Actions:

- Upload
- Download
- Replace
- Delete
- View access log

Tables:

`files`, `file_access_logs`

## 6. New Student Registration

### Purpose

Register new students manually or from imported data.

### Steps

1. Basic info
2. Address and contact
3. Enrollment info
4. Visa and passport
5. File upload
6. Confirmation and validation

### Validation Checks

| Check | Rule |
|---|---|
| Name required | At least display name and kana/roman name |
| Birth date required | Must be valid date |
| Nationality required | Required for international students |
| Student number unique | Unique inside school |
| Residence card | Required if already in Japan |
| Residence expiry | Must be future date unless special status |
| Passport expiry | Warning if expired or near expiry |
| Japan address | Warning if missing |
| Course/class | Required for enrolled students |

### Save Result

Creates:

- `persons`
- `students`
- `addresses`
- `residence_cards`
- `passports`
- `files`
- `enrollment_histories`
- `audit_logs`

## 7. Attendance

### 7.1 Attendance Input

### Purpose

Teachers or office staff record attendance by class and date.

### Filters

- School
- Date
- Class
- Course
- Period

### Input Modes

1. Daily mode
2. Period mode

### Status Buttons

- Present
- Absent
- Late
- Early leave
- Official absence
- Unknown

### Actions

- Save draft
- Confirm day
- Copy previous day roster
- Recalculate month
- Export attendance sheet

### Tables

`attendance_sessions`, `attendance_records`, `classes`, `students`

### 7.2 Monthly Attendance Summary

### Purpose

Review calculated monthly attendance rates.

### Filters

- Year
- Month
- Course
- Class
- Below 50%
- Below 80%

### Columns

- Student number
- Name
- Required minutes
- Attended minutes
- Absence minutes
- Attendance rate
- Low-attendance flag
- Lock status

### Actions

- Recalculate
- Lock month
- Create low-attendance report
- Export list

### Tables

`attendance_monthly_summaries`

### 7.3 Half-Year Attendance Summary

### Purpose

Prepare half-year immigration reports.

### Periods

- April 1 to September 30
- October 1 to March 31
- Custom

### Actions

- Calculate period
- Review by course
- Create half-year report
- Export attachment

### Tables

`attendance_period_summaries`, `attendance_monthly_summaries`

## 8. Visa Management

### 8.1 Visa Expiry List

### Purpose

Prevent residence period expiration.

### Filters

- 90 days
- 60 days
- 30 days
- 14 days
- 7 days
- Expired
- By class/course
- By assigned staff

### Columns

- Student number
- Name
- Residence status
- Residence card number
- Expiry date
- Days left
- Renewal case status
- Assigned staff

### Actions

- Create renewal case
- Generate renewal documents
- Mark submitted
- Mark approved
- Add reminder

### Tables

`residence_cards`, `visa_renewal_cases`, `students`, `reminders`

### 8.2 Visa Renewal Case Detail

### Purpose

Track preparation and document generation for one renewal case.

### Sections

- Student snapshot
- Current residence card
- Required documents checklist
- Generated renewal forms
- Student check status
- Staff check status
- Submission result

### Status Flow

```text
Not started
  -> Preparing
  -> Student checking
  -> Staff checking
  -> Ready
  -> Submitted
  -> Approved / Correction required
  -> Closed
```

### Tables

`visa_renewal_cases`, `document_templates`, `generated_documents`, `files`

## 9. Immigration Reports

### 9.1 Report List

### Purpose

Manage all immigration report batches.

### Filters

- Report type
- Period
- Status
- Due date
- Submission method
- School

### Columns

- Title
- Report type
- Period/base date
- Item count
- Status
- Due date
- Submitted at
- Receipt number
- Created by

### Actions

- Create report
- Generate automatic candidates
- Export list
- Open detail

### Tables

`immigration_reports`, `immigration_report_types`, `immigration_report_items`

### 9.2 Create Report

### Steps

1. Select report type
2. Select period or base date
3. Generate candidates
4. Run validation
5. Confirm report

### Initial Report Types

| Report Type | Trigger |
|---|---|
| New student report | New enrolled students |
| Completion student report | Completed/graduated students |
| Low attendance report | Monthly attendance below 50% |
| Withdrawal/leaving report | Withdrawal, expulsion, missing, transfer |
| Half-year attendance report | Six-month attendance period |
| May/November report | Configured base date |
| Annual completion report | Academic year end |
| Visa renewal documents | Expiry/renewal case |

### Tables

`immigration_report_types`, `immigration_reports`, `immigration_report_items`

### 9.3 Report Detail

### Sections

1. Report summary
2. Target students/items
3. Validation results
4. Generated files
5. Submission record
6. Audit history

### Item Columns

- Student number
- Name
- Nationality
- Residence card number
- Residence expiry
- Address
- Course/class
- Attendance rate, if applicable
- Leaving date/type, if applicable
- Validation result
- Item status

### Validation Examples

- Missing residence card number
- Missing Japanese address
- Missing passport number
- Residence card expired
- Attendance not calculated
- Leaving date missing
- Part-time activity missing for low-attendance report when work permission exists

### Actions

- Add/remove student
- Exclude with reason
- Re-run validation
- Confirm report
- Generate Excel/PDF
- Upload submitted copy
- Mark submitted
- Mark accepted
- Mark correction required
- Complete report

### Tables

`immigration_reports`, `immigration_report_items`, `immigration_report_files`, `files`, `generated_documents`

## 10. Certificates

### 10.1 Certificate Issue

### Purpose

Issue school certificates with automatic data fill and full issuance record.

### Steps

1. Select student
2. Select certificate type
3. Select language
4. Select period, if needed
5. Preview data
6. Generate file
7. Issue certificate number

### Certificate Types

- Enrollment certificate
- Attendance certificate
- Grade certificate
- Completion certificate
- Graduation certificate
- Expected graduation certificate
- Transcript + attendance certificate

### Required Record

- Certificate number
- Student
- Type
- Language
- Period
- Issued by
- Issued at
- File
- Snapshot data

### Tables

`certificate_types`, `certificate_issuances`, `document_templates`, `generated_documents`, `files`

### 10.2 Certificate List

### Filters

- Student
- Certificate type
- Issue date
- Issued by
- Status

### Actions

- Download
- Reissue as new version
- Void
- View snapshot

### Tables

`certificate_issuances`

## 11. Files

### 11.1 File Search

### Purpose

Find uploaded and generated files while keeping access logs.

### Filters

- Owner type
- Owner name/student number
- File category
- Uploaded date
- Uploaded by
- Confidential only

### Actions

- Upload file
- Download
- View file access log
- Soft delete

### Tables

`files`, `file_access_logs`

## 12. Templates

### 12.1 Template List

### Purpose

Manage Excel/Word/PDF/CSV templates for reports and certificates.

### Filters

- Template type
- School
- Active/inactive
- Output format

### Columns

- Code
- Name
- Type
- Output format
- Version
- Active
- Updated at

### Actions

- Upload template
- Edit mapping
- Test generation
- Activate/deactivate
- Create new version

### Tables

`document_templates`, `files`

### 12.2 Template Mapping

### Purpose

Map template placeholders or cells to system variables.

### Supported Variables

```text
{{school.name_ja}}
{{student.student_number}}
{{person.full_name}}
{{person.full_name_kana}}
{{person.birth_date}}
{{person.nationality}}
{{address.japan.full}}
{{passport.passport_number}}
{{residence_card.card_number}}
{{residence_card.expiry_date}}
{{enrollment.course_name}}
{{attendance.monthly_rate}}
{{attendance.period_rate}}
{{leaving.leaving_date}}
{{leaving.leaving_type}}
{{certificate.issue_date}}
```

### Actions

- Validate variables
- Generate sample file
- Save mapping

### Tables

`document_templates`, `generated_documents`

## 13. Settings

### 13.1 School Settings

Fields:

- School names
- School type
- Address
- Contact
- Representative
- Immigration office

Tables:

`schools`

### 13.2 Course / Department / Class Settings

Manage:

- Courses
- Departments
- Classes
- Homeroom teachers
- Academic year

Tables:

`courses`, `departments`, `classes`

### 13.3 User and Role Settings

Manage:

- Users
- Roles
- Permissions
- Disabled accounts

Tables:

`users`, `roles`, `permissions`, `user_roles`, `role_permissions`

### 13.4 Report Type Settings

Manage immigration report rules.

Fields:

- Report code
- Report name
- Applicable school types
- Default period type
- Trigger rule
- Required fields
- Default template
- Active flag

Tables:

`immigration_report_types`

## 14. Audit Logs

### Purpose

Track sensitive and important operations.

### Filters

- User
- Action
- Entity type
- Date
- Student

### Important Logged Actions

- Student profile update
- Residence card update
- Passport update
- File download
- Attendance change after lock
- Report confirmation
- Report generation
- Report submission status change
- Certificate issuance
- Certificate void
- User permission change

### Tables

`audit_logs`, `file_access_logs`

## 15. MVP Development Order

### Phase 1: Core Master

1. Login and role framework
2. School settings
3. Course/class settings
4. Student list
5. Student registration
6. Student detail
7. File upload

### Phase 2: Visa and Attendance

1. Residence card/passport screens
2. Visa expiry list
3. Attendance input
4. Monthly attendance summary
5. Half-year attendance summary

### Phase 3: Reports and Certificates

1. Template list
2. Template mapping
3. Certificate issue
4. Certificate list
5. Immigration report list
6. Report creation
7. Report detail

### Phase 4: Operational Safety

1. Dashboard
2. Reminders
3. Audit logs
4. File access logs
5. Data validation refinements

## 16. Future Screen Additions

### Admission

- Public web application form
- Applicant account
- Application review
- Interview/exam management
- Pass/fail decision
- Admission procedure portal
- Student conversion

### Academic

- Subject master
- Grade input
- Credit summary
- Graduation judgment
- Career/pathway management

### Finance

- Tuition plan
- Payment registration
- Unpaid list
- Invoice generation
- Receipt generation
