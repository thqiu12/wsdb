# SchoolCore API Specification v1

## 1. API Principles

This specification describes the first backend API surface for Phase 1.

General rules:

- UI language is Japanese, but API field names use English snake_case.
- All write APIs require authentication.
- All sensitive file operations create audit logs.
- High-risk operations require explicit action endpoints instead of silent field updates.
- Generated documents must store template version and snapshot data.
- Errors should include machine-readable code and Japanese message.

Example error:

```json
{
  "error": {
    "code": "COE_RELEASE_BLOCKED",
    "message": "学費全額入金と領収書発行が完了していないため、COE全体を送付できません。",
    "details": {
      "missing": ["full_tuition_confirmed", "receipt_issued"]
    }
  }
}
```

## 2. Auth and Current User

### GET /api/me

Returns current user, roles, permissions, school scope.

Response:

```json
{
  "user": {
    "id": "uuid",
    "name": "山田 花子",
    "email": "staff@example.jp",
    "roles": ["staff"],
    "school_ids": ["uuid"]
  },
  "permissions": [
    "student.update",
    "file.view_sensitive",
    "payment.confirm",
    "receipt.issue"
  ]
}
```

## 3. Master Data

### GET /api/schools

Lists schools/campuses visible to current user.

### POST /api/schools

Required role:

- manager

Creates school/campus settings.

### GET /api/courses

Query:

- `school_id`
- `active`

### POST /api/courses

Creates a course.

### GET /api/admission-terms

Lists admission terms, including standard 1/4/7/10 intakes and short-term intakes.

### POST /api/admission-terms

Creates admission term.

Important fields:

- `school_id`
- `name`
- `admission_month`
- `start_date`
- `is_short_term`
- `coe_default_deadline`

## 4. Applicants

### GET /api/applicants

Query:

- `school_id`
- `status`
- `admission_term_id`
- `keyword`
- `agent_id`

Returns applicant list with fee, interview, and COE summary.

### POST /api/applicants

Creates applicant and linked person.

Important fields:

- `school_id`
- `admission_term_id`
- `desired_study_length`
- `person`
- `education_histories`
- `application_histories`
- `financial_sponsor`
- `agent_id`

### GET /api/applicants/{id}

Returns full applicant detail.

### PATCH /api/applicants/{id}

Updates draft applicant data.

### POST /api/applicants/{id}/validate-interview-application

Checks required sections:

- 入学時期・語学学校滞在予定期間
- 個人情報
- 個人学歴
- 個人申請歴
- 経費支弁者情報

Response:

```json
{
  "status": "error",
  "errors": [
    {
      "section": "financial_sponsor",
      "message": "経費支弁者情報が不足しています。"
    }
  ],
  "warnings": []
}
```

### POST /api/applicants/{id}/convert-to-student

Creates student record from applicant without duplicating person.

Generates student number:

- Admission year/month + 3 random digits.

## 5. Application Fee and Payments

### POST /api/applicants/{id}/application-fee

Creates fixed 20,000 JPY application fee payment request.

### POST /api/payments/{id}/confirm

Required permission:

- `payment.confirm`

Fields:

- `paid_at`
- `payment_method`
- `amount`
- `payer_type`: `student` or `agent`
- `payer_display_name`
- `proof_file_id`

Rules:

- Application fee default amount is 20,000 JPY.
- Agent-collected payment displays agent name.
- Student remains linked in payment details.

### GET /api/payments

Query:

- `student_id`
- `applicant_id`
- `type`
- `status`

## 6. Interviews

### POST /api/applicants/{id}/interviews

Creates interview record.

Fields:

- `scheduled_at`
- `interviewer_user_id`
- `round`
- `notes`

### POST /api/interviews/{id}/result

Sets result:

- `passed`
- `hold`
- `re_interview`
- `failed`

Rules:

- `passed` enables acceptance notice generation.
- `re_interview` can create another interview record.

## 7. Templates and Generated Documents

### GET /api/templates

Query:

- `school_id`
- `campus_id`
- `document_type`
- `active`

### POST /api/templates

Uploads template.

Fields:

- `school_id`
- `campus_id`
- `document_type`
- `name`
- `format`
- `file_id`

### POST /api/templates/{id}/versions

Adds a new template version.

### POST /api/generated-documents

Generates document from template.

Fields:

- `template_id`
- `target_type`
- `target_id`
- `document_type`
- `parameters`

Rules:

- Store template version.
- Store data snapshot.
- Store generated file.

## 8. Acceptance Notice

### POST /api/applicants/{id}/acceptance-notice

Required:

- Interview result is `passed`.
- Active campus template exists.

Creates generated acceptance notice.

## 9. COE Cases

### GET /api/coe-cases

Query:

- `school_id`
- `status`
- `admission_term_id`
- `deadline_from`
- `deadline_to`
- `keyword`

### POST /api/applicants/{id}/coe-case

Creates COE case after enrollment intention.

Fields:

- `admission_term_id`
- `student_level_deadline`
- `rolling_submission`

### GET /api/coe-cases/{id}

Returns COE case, stages, files, AI checks, payments, and release status.

### POST /api/coe-cases/{id}/stage

Updates stage status.

Fields:

- `stage`
- `status`
- `due_date`
- `responsible_user_id`
- `notes`

### POST /api/coe-cases/{id}/submit-to-immigration

Required permission:

- `immigration_report.generate` or `immigration_report.submit`

Rules:

- Required interview application errors must be cleared.
- Required COE material errors must be cleared or explicitly confirmed.

### POST /api/coe-cases/{id}/coe-issued

Stores COE issue status and file references.

Fields:

- `issued_at`
- `partial_screenshot_file_id`
- `full_coe_file_id`

## 10. AI COE Check

### POST /api/coe-cases/{id}/ai-checks

Starts AI-assisted check.

Input:

- Related applicant/student data.
- Selected files/materials.

Response:

```json
{
  "check_id": "uuid",
  "status": "queued"
}
```

### GET /api/ai-checks/{id}

Returns issue list.

Issue fields:

- `severity`: `error`, `warning`, `info`
- `category`
- `message`
- `source`
- `suggested_action`
- `staff_status`: `open`, `confirmed`, `dismissed`

### POST /api/ai-check-issues/{id}/confirm

Staff confirms issue.

### POST /api/ai-check-issues/{id}/dismiss

Staff dismisses issue with reason.

## 11. COE Release

### POST /api/coe-cases/{id}/send-partial-coe

Sends or records partial screenshot delivery.

Fields:

- `recipient_type`: `student` or `agent`
- `recipient_name`
- `file_id`
- `sent_method`
- `sent_at`

Rules:

- Allowed before full tuition.
- Must create audit log.

### POST /api/coe-cases/{id}/send-full-coe

Required permission:

- `coe.release_full`

Rules:

- Full tuition must be confirmed.
- Required receipt must be issued.
- Recipient may be student or agent.

Blocked response:

```json
{
  "error": {
    "code": "COE_RELEASE_BLOCKED",
    "message": "学費全額入金と領収書発行が完了していないため、COE全体を送付できません。"
  }
}
```

## 12. Students

### GET /api/students

Query:

- `school_id`
- `status`
- `course_id`
- `class_id`
- `nationality`
- `residence_expiry_from`
- `residence_expiry_to`
- `attendance_rate_lte`
- `keyword`

### POST /api/students

Creates student manually.

### GET /api/students/{id}

Returns full student detail.

### PATCH /api/students/{id}

Updates student basic/enrollment fields.

### POST /api/students/{id}/status-changes

High-risk status change endpoint.

Fields:

- `new_status`
- `effective_date`
- `reason`

Rules:

- Withdrawal/completion/graduation can create leaving record candidate.

## 13. Files

### POST /api/files

Uploads file metadata and binary.

Fields:

- `owner_type`
- `owner_id`
- `category`
- `visibility`
- `sensitive`

### GET /api/files/{id}

Returns file metadata.

### GET /api/files/{id}/download

Rules:

- Permission check.
- Student portal requires approved download request.
- Sensitive file access creates audit log.

## 14. Residence and Passport

### POST /api/students/{id}/passport

Adds passport record.

### POST /api/students/{id}/residence-cards

Adds residence card record.

Fields:

- `card_number`
- `residence_status`
- `period_of_stay`
- `permission_date`
- `expiry_date`
- `work_permission`
- `front_file_id`
- `back_file_id`

Rules:

- Current card history is retained.

### GET /api/residence-expiry-alerts

Query:

- `school_id`
- `days`: 90, 60, 30, 14, 7

## 15. Attendance

### GET /api/attendance-rules

Lists school attendance rule settings.

### POST /api/attendance-rules

Creates new rule version.

Fields:

- `late_policy`
- `early_leave_policy`
- `official_absence_policy`
- `period_minutes`
- `day_summary_policy`

### POST /api/attendance-sessions

Creates class/date/session.

### POST /api/attendance-sessions/{id}/records

Bulk saves period attendance records.

Statuses:

- `present`
- `absent`
- `late`
- `early_leave`
- `official_absence`
- `unknown`

### POST /api/attendance/monthly-summaries/recalculate

Recalculates monthly summary.

Fields:

- `school_id`
- `year_month`
- `class_id`

### POST /api/attendance/monthly-summaries/{id}/lock

Locks monthly summary with user/time.

## 16. Immigration Reports

### GET /api/immigration-reports

Query:

- `school_id`
- `report_type`
- `status`
- `due_date_from`
- `due_date_to`

### POST /api/immigration-reports

Creates report batch.

Report types:

- `low_attendance_below_50`
- `leaving_notification`
- `half_year_attendance`
- `may_november_acceptance`
- `annual_completion`
- `visa_renewal`

### POST /api/immigration-reports/{id}/extract-candidates

Extracts report candidates.

### POST /api/immigration-reports/{id}/validate

Validates report batch.

### POST /api/immigration-reports/{id}/generate`

Generates report file from template.

### POST /api/immigration-reports/{id}/mark-submitted

Required permission:

- `immigration_report.submit`

Fields:

- `submitted_at`
- `submission_method`
- `receipt_number`
- `evidence_file_id`

## 17. Receipts

### POST /api/payments/{id}/receipt

Issues receipt.

Rules:

- Payment must be confirmed.
- Receipt number generated from issue date and admission period.
- Issuer and issue time recorded.

### POST /api/receipts/{id}/void

Fields:

- `reason`

Rules:

- Old receipt remains in history.
- Audit log required.

### POST /api/receipts/{id}/reissue

Reissues receipt.

Rules:

- Must not overwrite original receipt.

## 18. Certificates

### POST /api/certificate-requests

Student or staff creates certificate request.

Types:

- `enrollment`
- `attendance`
- `grade`
- `completion`
- `graduation`

### POST /api/certificate-requests/{id}/approve

Staff approves request.

### POST /api/certificate-requests/{id}/reject

Staff rejects request with reason.

### POST /api/certificate-requests/{id}/issue

Issues certificate.

Rules:

- Certificate number: issue date + 3 random digits.
- Issuer/time recorded.
- Generated file stored.

### POST /api/certificates/{id}/void

Voids certificate with reason.

## 19. Student Portal

### GET /api/portal/me

Returns applicant/student portal profile.

### GET /api/portal/status

Returns application or enrolled-student status.

### POST /api/portal/files

Student uploads requested file.

### POST /api/portal/certificate-requests

Student requests certificate.

### GET /api/portal/downloads

Lists approved downloadable files only.

## 20. Data Migration

### POST /api/migration-batches

Uploads old system Excel.

### POST /api/migration-batches/{id}/mapping

Saves field mapping.

### POST /api/migration-batches/{id}/trial-import

Runs validation without writing final data.

### POST /api/migration-batches/{id}/commit

Commits import after review.

Rules:

- Original Excel stored as evidence.
- Duplicate and missing data warnings must be visible before commit.

## 21. Audit Logs

### GET /api/audit-logs

Query:

- `actor_user_id`
- `target_type`
- `target_id`
- `event_type`
- `from`
- `to`

Access:

- manager or authorized audit viewer.
