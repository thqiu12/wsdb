# SchoolCore Database Design v1

## 1. Product Scope

SchoolCore is a student-centered school operations platform for institutions with many international students.

The first shared database design supports:

- Student master records
- Enrollment and school status
- Visa and residence card management
- Passport and address management
- File archives
- Attendance and attendance-rate calculation
- Immigration reports
- Certificate issuance
- Template-based document generation
- Audit logs and user permissions

Later modules can extend the same base:

- Web application / web entrance application
- Admission procedure
- Academic records, subjects, credits, graduation judgment
- Tuition and payment management

## 2. Design Principles

1. A person is stored once and reused through all stages.
2. Application, enrollment, visa, attendance, certificate, and report data must remain traceable.
3. Generated documents must keep historical versions, even if templates or student data later change.
4. Immigration report rules must be configurable by school type, template, period, and target condition.
5. Sensitive personal information and document access must be auditable.

## 3. Main Entity Flow

```text
Person
  -> Applicant / Student
  -> Enrollment
  -> Visa / Passport / Address / Documents
  -> Attendance / Grades / Status Changes
  -> Immigration Reports / Certificates / Generated Files
```

For the first version, `persons` and `students` are separated:

- `persons`: identity and contact master.
- `students`: school-side student record.

This allows the same person to later pass through web application, admission, and enrollment without duplicated identity records.

## 4. Core Tables

### 4.1 schools

Stores each school or campus.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| code | varchar | School code |
| name_ja | varchar | Japanese name |
| name_en | varchar | English name |
| name_zh | varchar | Chinese name |
| school_type | enum | `language_school`, `vocational_school`, `combined`, `other` |
| postal_code | varchar | School postal code |
| address | text | School address |
| phone | varchar | School phone |
| email | varchar | School email |
| representative_name | varchar | Representative |
| immigration_office_name | varchar | Main immigration office |
| is_active | boolean | Active flag |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.2 persons

Stores the person identity shared by applicants, students, alumni, and withdrawn students.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| family_name | varchar | Family name |
| given_name | varchar | Given name |
| full_name | varchar | Display name |
| full_name_kana | varchar | Katakana name |
| full_name_kanji | varchar | Kanji name |
| full_name_roman | varchar | Roman name |
| gender | enum | `male`, `female`, `other`, `unknown` |
| birth_date | date | Date of birth |
| nationality | varchar | Nationality |
| birth_country | varchar | Birth country |
| native_language | varchar | Native language |
| email | varchar | Main email |
| phone | varchar | Main phone |
| emergency_contact_name | varchar | Emergency contact |
| emergency_contact_relation | varchar | Relation |
| emergency_contact_phone | varchar | Phone |
| notes | text | Internal notes |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Recommended indexes:

- `idx_persons_full_name`
- `idx_persons_birth_date`
- `idx_persons_nationality`

### 4.3 students

Stores the school-side student record.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| person_id | uuid | FK to `persons` |
| student_number | varchar | Student number |
| current_status | enum | See status list below |
| admission_date | date | Admission date |
| expected_graduation_date | date | Expected graduation/completion date |
| actual_graduation_date | date | Actual graduation/completion date |
| current_course_id | uuid | FK to `courses` |
| current_department_id | uuid | FK to `departments`, vocational school |
| current_class_id | uuid | FK to `classes` |
| current_grade_year | integer | Vocational school grade year |
| is_international_student | boolean | Usually true for target users |
| source_type | enum | `manual`, `google_form_import`, `web_application`, `csv_import`, `migration` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Student status enum:

- `pre_enrollment`
- `enrolled`
- `leave_of_absence`
- `withdrawn`
- `expelled`
- `missing`
- `transferred`
- `graduated`
- `completed`
- `advanced_to_next_school`
- `employed`
- `returned_home`
- `cancelled`

Constraints:

- `(school_id, student_number)` should be unique when `student_number` is present.

### 4.4 addresses

Stores current and historical addresses.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| person_id | uuid | FK to `persons` |
| address_type | enum | `japan`, `home_country`, `guarantor`, `other` |
| postal_code | varchar |  |
| prefecture | varchar |  |
| city | varchar |  |
| address_line1 | varchar |  |
| address_line2 | varchar |  |
| country | varchar |  |
| phone | varchar | Optional |
| valid_from | date |  |
| valid_to | date | Null means current |
| is_current | boolean | Current flag |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.5 courses

Common course table for language schools and vocational schools.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| code | varchar | Course code |
| name | varchar | Course name |
| course_type | enum | `language`, `vocational`, `other` |
| start_date | date |  |
| end_date | date |  |
| standard_months | integer | Course length |
| total_hours | integer | Planned total hours |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.6 departments

Mainly for vocational schools.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| code | varchar | Department code |
| name | varchar | Department name |
| standard_years | integer |  |
| graduation_required_credits | decimal | Optional |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.7 classes

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| course_id | uuid | FK to `courses` |
| department_id | uuid | Nullable |
| code | varchar | Class code |
| name | varchar | Class name |
| academic_year | integer | Example: 2026 |
| homeroom_teacher_user_id | uuid | FK to `users` |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 4.8 enrollment_histories

Tracks class, course, department, grade, and status changes.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| school_id | uuid | FK to `schools` |
| course_id | uuid | FK to `courses` |
| department_id | uuid | Nullable |
| class_id | uuid | Nullable |
| grade_year | integer | Nullable |
| status | enum | Same as student status |
| start_date | date |  |
| end_date | date | Null means current |
| reason | text | Reason for change |
| created_by | uuid | FK to `users` |
| created_at | timestamp |  |

## 5. Visa and Identification Tables

### 5.1 passports

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| person_id | uuid | FK to `persons` |
| passport_number | varchar |  |
| issuing_country | varchar |  |
| issue_date | date |  |
| expiry_date | date |  |
| is_current | boolean |  |
| document_file_id | uuid | FK to `files` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 5.2 residence_cards

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| person_id | uuid | FK to `persons` |
| card_number | varchar | Residence card number |
| residence_status | varchar | Example: 留学 |
| period_of_stay | varchar | Example: 1年3月 |
| expiry_date | date | 在留期限 |
| permission_date | date | Optional |
| has_work_permission | boolean | 資格外活動許可 |
| work_permission_detail | text | Optional |
| front_file_id | uuid | FK to `files` |
| back_file_id | uuid | FK to `files` |
| is_current | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Recommended indexes:

- `idx_residence_cards_card_number`
- `idx_residence_cards_expiry_date`
- `idx_residence_cards_status`

### 5.3 part_time_activities

Stores part-time work or activity institution information for immigration reports.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| employer_name | varchar | Institution name |
| employer_address | text |  |
| employer_phone | varchar |  |
| start_date | date |  |
| end_date | date |  |
| is_current | boolean |  |
| notes | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 5.4 visa_renewal_cases

Tracks residence period renewal preparation.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| residence_card_id | uuid | FK to `residence_cards` |
| case_type | enum | `period_renewal`, `status_change`, `coe`, `other` |
| target_expiry_date | date | Current expiry date |
| recommended_start_date | date | Usually around 3 months before expiry |
| status | enum | `not_started`, `preparing`, `student_checking`, `staff_checking`, `ready`, `submitted`, `approved`, `correction_required`, `closed` |
| submitted_date | date |  |
| approved_date | date |  |
| assigned_user_id | uuid | FK to `users` |
| notes | text |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 6. File Archive

### 6.1 files

Stores metadata for uploaded or generated files.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| owner_type | varchar | Example: `student`, `person`, `report`, `certificate` |
| owner_id | uuid | Owner record id |
| file_category | enum | See list below |
| original_filename | varchar |  |
| stored_path | text | Storage key/path |
| mime_type | varchar |  |
| file_size | bigint | Bytes |
| checksum | varchar | Optional |
| uploaded_by | uuid | FK to `users` |
| uploaded_at | timestamp |  |
| is_confidential | boolean |  |
| deleted_at | timestamp | Soft delete |

File categories:

- `passport`
- `residence_card_front`
- `residence_card_back`
- `student_photo`
- `application_document`
- `certificate`
- `immigration_report`
- `visa_renewal`
- `entrance_procedure`
- `payment_proof`
- `other`

### 6.2 file_access_logs

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| file_id | uuid | FK to `files` |
| user_id | uuid | FK to `users` |
| action | enum | `view`, `download`, `upload`, `delete`, `restore` |
| ip_address | varchar |  |
| user_agent | text |  |
| created_at | timestamp |  |

## 7. Attendance

### 7.1 attendance_sessions

Defines class days or lesson periods.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| class_id | uuid | FK to `classes` |
| course_id | uuid | FK to `courses` |
| session_date | date |  |
| period_no | integer | Nullable for daily mode |
| start_time | time |  |
| end_time | time |  |
| planned_minutes | integer |  |
| teacher_user_id | uuid | FK to `users` |
| is_required | boolean | If false, excluded from denominator |
| status | enum | `planned`, `completed`, `cancelled` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 7.2 attendance_records

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| attendance_session_id | uuid | FK to `attendance_sessions` |
| student_id | uuid | FK to `students` |
| status | enum | `present`, `absent`, `late`, `early_leave`, `official_absence`, `suspended`, `unknown` |
| attended_minutes | integer | For rate calculation |
| required_minutes | integer | Snapshot denominator |
| note | text |  |
| recorded_by | uuid | FK to `users` |
| recorded_at | timestamp |  |
| updated_at | timestamp |  |

Unique constraint:

- `(attendance_session_id, student_id)`

### 7.3 attendance_monthly_summaries

Materialized monthly result for reports and certificates.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| school_id | uuid | FK to `schools` |
| year | integer |  |
| month | integer |  |
| required_minutes | integer |  |
| attended_minutes | integer |  |
| absence_minutes | integer |  |
| attendance_rate | decimal | Example: 87.50 |
| is_below_50 | boolean | Immigration report candidate |
| is_below_80 | boolean | Internal warning |
| calculated_at | timestamp |  |
| locked_at | timestamp | Lock after report/certificate |
| locked_by | uuid | FK to `users` |

Unique constraint:

- `(student_id, year, month)`

### 7.4 attendance_period_summaries

For half-year or custom periods.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| school_id | uuid | FK to `schools` |
| period_type | enum | `half_year_apr_sep`, `half_year_oct_mar`, `academic_year`, `custom` |
| period_start | date |  |
| period_end | date |  |
| required_minutes | integer |  |
| attended_minutes | integer |  |
| attendance_rate | decimal |  |
| calculated_at | timestamp |  |
| locked_at | timestamp |  |

## 8. Student Status and Leaving Records

### 8.1 student_status_changes

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| from_status | enum | Nullable |
| to_status | enum | Student status |
| effective_date | date |  |
| reason_code | varchar | Configurable |
| reason_text | text |  |
| requires_immigration_report | boolean |  |
| report_due_date | date | Usually next month end when applicable |
| created_by | uuid | FK to `users` |
| created_at | timestamp |  |

### 8.2 leaving_records

Unified leaving/completion/withdrawal records.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| leaving_type | enum | `withdrawal`, `expulsion`, `missing`, `graduation`, `completion`, `transfer`, `employment`, `return_home`, `other` |
| leaving_date | date |  |
| reason | text |  |
| final_residence_status | varchar | Snapshot |
| final_residence_expiry_date | date | Snapshot |
| final_address | text | Snapshot |
| next_destination_type | enum | `next_school`, `employment`, `return_home`, `unknown`, `other` |
| next_destination_name | varchar | School/company/etc. |
| needs_report | boolean |  |
| immigration_report_item_id | uuid | Nullable |
| created_by | uuid | FK to `users` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 9. Immigration Reports

### 9.1 immigration_report_types

Configurable report type master.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| code | varchar | Example: `low_attendance_monthly` |
| name | varchar | Report name |
| applicable_school_types | jsonb | Example: `["language_school","vocational_school"]` |
| default_period_type | enum | `monthly`, `half_year`, `annual`, `custom`, `event_based` |
| trigger_rule | jsonb | Machine-readable condition |
| required_fields | jsonb | Field checks |
| default_template_id | uuid | FK to `document_templates` |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Initial report types:

- `new_student_report`
- `completion_student_report`
- `low_attendance_monthly`
- `withdrawal_report`
- `half_year_attendance_report`
- `may_november_report`
- `annual_completion_report`
- `visa_renewal_documents`
- `custom_immigration_report`

### 9.2 immigration_reports

Report batch.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| report_type_id | uuid | FK to `immigration_report_types` |
| title | varchar | Human-readable title |
| period_start | date | Nullable |
| period_end | date | Nullable |
| base_date | date | For point-in-time reports |
| status | enum | `draft`, `pending_review`, `confirmed`, `generated`, `submitted`, `accepted`, `correction_required`, `completed`, `not_required`, `cancelled` |
| due_date | date | Submission due date |
| confirmed_by | uuid | FK to `users` |
| confirmed_at | timestamp |  |
| submitted_by | uuid | FK to `users` |
| submitted_at | timestamp |  |
| submission_method | enum | `electronic_system`, `mail`, `counter`, `other` |
| receipt_number | varchar | Optional |
| notes | text |  |
| created_by | uuid | FK to `users` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 9.3 immigration_report_items

Students included in each report.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| immigration_report_id | uuid | FK to `immigration_reports` |
| student_id | uuid | FK to `students` |
| item_status | enum | `candidate`, `included`, `excluded`, `confirmed` |
| snapshot_data | jsonb | Frozen student/report data |
| validation_errors | jsonb | Missing/invalid fields |
| exclusion_reason | text | If excluded |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 9.4 immigration_report_files

Generated and submitted files.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| immigration_report_id | uuid | FK to `immigration_reports` |
| file_id | uuid | FK to `files` |
| template_id | uuid | FK to `document_templates` |
| version_no | integer | Generated version |
| generated_by | uuid | FK to `users` |
| generated_at | timestamp |  |
| locked_snapshot | jsonb | Data used to generate file |

## 10. Certificates

### 10.1 certificate_types

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| code | varchar | Example: `attendance_certificate` |
| name | varchar |  |
| default_template_id | uuid | FK to `document_templates` |
| requires_approval | boolean |  |
| is_active | boolean |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Initial certificate types:

- `enrollment_certificate`
- `attendance_certificate`
- `grade_certificate`
- `completion_certificate`
- `graduation_certificate`
- `expected_graduation_certificate`
- `transcript_attendance_certificate`

### 10.2 certificate_issuances

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| student_id | uuid | FK to `students` |
| certificate_type_id | uuid | FK to `certificate_types` |
| certificate_number | varchar | Unique document number |
| language | enum | `ja`, `en`, `zh`, `vi`, `ko` |
| purpose | varchar | Optional |
| period_start | date | Optional |
| period_end | date | Optional |
| status | enum | `draft`, `issued`, `voided` |
| issued_by | uuid | FK to `users` |
| issued_at | timestamp |  |
| voided_by | uuid | FK to `users` |
| voided_at | timestamp |  |
| void_reason | text |  |
| snapshot_data | jsonb | Frozen data |
| file_id | uuid | FK to `files` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Unique constraint:

- `certificate_number`

## 11. Template Engine

### 11.1 document_templates

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | Nullable for global templates |
| template_type | enum | `immigration_report`, `certificate`, `visa_renewal`, `admission`, `finance`, `other` |
| code | varchar | Template code |
| name | varchar | Template name |
| file_id | uuid | FK to `files` for source template |
| output_format | enum | `xlsx`, `docx`, `pdf`, `csv` |
| variable_schema | jsonb | Supported variables |
| mapping_config | jsonb | Cell/placeholder mapping |
| version_no | integer | Template version |
| is_active | boolean |  |
| created_by | uuid | FK to `users` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Example variables:

```text
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
{{certificate.issue_date}}
```

### 11.2 generated_documents

Generic generated document history.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| template_id | uuid | FK to `document_templates` |
| owner_type | varchar | `student`, `report`, `certificate`, etc. |
| owner_id | uuid | Owner record |
| file_id | uuid | FK to `files` |
| version_no | integer |  |
| generated_by | uuid | FK to `users` |
| generated_at | timestamp |  |
| snapshot_data | jsonb | Frozen generation data |

## 12. Users, Roles, and Audit

### 12.1 users

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools`, nullable for platform admin |
| name | varchar |  |
| email | varchar | Login email |
| password_hash | varchar |  |
| status | enum | `active`, `disabled`, `invited` |
| last_login_at | timestamp |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 12.2 roles

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | Nullable |
| code | varchar | `admin`, `principal`, `office_staff`, etc. |
| name | varchar |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

Initial roles:

- `system_admin`
- `school_admin`
- `principal`
- `office_staff`
- `academic_staff`
- `teacher`
- `read_only`

### 12.3 user_roles

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK to `users` |
| role_id | uuid | FK to `roles` |

### 12.4 permissions

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| code | varchar | Example: `students.view` |
| name | varchar |  |

### 12.5 role_permissions

| Column | Type | Notes |
|---|---|---|
| role_id | uuid | FK to `roles` |
| permission_id | uuid | FK to `permissions` |

### 12.6 audit_logs

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| user_id | uuid | FK to `users` |
| action | varchar | `create`, `update`, `delete`, `generate`, etc. |
| entity_type | varchar | Table/domain name |
| entity_id | uuid | Record id |
| before_data | jsonb | Nullable |
| after_data | jsonb | Nullable |
| ip_address | varchar |  |
| user_agent | text |  |
| created_at | timestamp |  |

## 13. Notifications and Reminders

### 13.1 reminders

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| target_type | varchar | `student`, `report`, `visa_case`, etc. |
| target_id | uuid | Target id |
| reminder_type | enum | `visa_expiry`, `passport_expiry`, `low_attendance`, `report_due`, `certificate_ready`, `custom` |
| title | varchar |  |
| message | text |  |
| due_date | date |  |
| status | enum | `open`, `done`, `dismissed` |
| assigned_user_id | uuid | FK to `users` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 14. Future Admission Module Tables

These are not required for the first core release, but the core design should leave room for them.

### 14.1 applications

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| person_id | uuid | FK to `persons` |
| application_number | varchar | Web application number |
| desired_course_id | uuid | FK to `courses` |
| desired_department_id | uuid | FK to `departments` |
| desired_admission_term | varchar |  |
| status | enum | `draft`, `submitted`, `documents_missing`, `under_review`, `accepted_for_exam`, `passed`, `failed`, `declined`, `cancelled` |
| submitted_at | timestamp |  |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 14.2 admission_procedures

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| application_id | uuid | FK to `applications` |
| status | enum | `not_started`, `in_progress`, `documents_missing`, `payment_pending`, `completed`, `cancelled` |
| completed_at | timestamp |  |
| converted_student_id | uuid | FK to `students` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 15. Future Academic Module Tables

### 15.1 subjects

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| school_id | uuid | FK to `schools` |
| department_id | uuid | FK to `departments` |
| code | varchar |  |
| name | varchar |  |
| credits | decimal |  |
| required_type | enum | `required`, `elective`, `optional` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

### 15.2 grade_records

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| student_id | uuid | FK to `students` |
| subject_id | uuid | FK to `subjects` |
| academic_year | integer |  |
| term | varchar |  |
| score | decimal |  |
| grade | varchar | Example: A, B, C |
| credits_earned | decimal |  |
| status | enum | `passed`, `failed`, `pending` |
| created_at | timestamp |  |
| updated_at | timestamp |  |

## 16. MVP Table List

For the first build, implement these tables first:

1. `schools`
2. `users`
3. `roles`
4. `permissions`
5. `role_permissions`
6. `user_roles`
7. `persons`
8. `students`
9. `addresses`
10. `courses`
11. `departments`
12. `classes`
13. `enrollment_histories`
14. `passports`
15. `residence_cards`
16. `part_time_activities`
17. `files`
18. `file_access_logs`
19. `attendance_sessions`
20. `attendance_records`
21. `attendance_monthly_summaries`
22. `attendance_period_summaries`
23. `student_status_changes`
24. `leaving_records`
25. `immigration_report_types`
26. `immigration_reports`
27. `immigration_report_items`
28. `immigration_report_files`
29. `certificate_types`
30. `certificate_issuances`
31. `document_templates`
32. `generated_documents`
33. `reminders`
34. `audit_logs`

## 17. Key MVP Screens Backed by This Schema

1. Student list
2. Student detail
3. New student registration
4. Residence card and passport management
5. File archive
6. Attendance input
7. Monthly attendance summary
8. Low-attendance report candidates
9. Withdrawal/leaving report
10. Immigration report batch detail
11. Certificate issue screen
12. Template management
13. Visa expiry reminders
14. Audit log viewer

## 18. Open Decisions

These should be confirmed before implementation:

1. Database: PostgreSQL is recommended because JSONB is useful for snapshots and configurable templates.
2. Student number rule: manual, automatic by school year, or school-specific pattern.
3. Attendance calculation: daily mode, period mode, or both.
4. Late/early-leave conversion rule: fixed minutes, percentage, or school-specific.
5. Report templates: collect current Excel/PDF/Word files used by the school.
6. Certificate numbering rule: school-year prefix, certificate type prefix, or global sequence.
7. File storage: local encrypted storage for MVP or S3-compatible storage.
8. Personal information policy: who can view/download residence cards and passports.
