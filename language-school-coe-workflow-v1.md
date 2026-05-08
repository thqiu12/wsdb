# Language School COE / Pre-Enrollment Workflow v1

## 1. Workflow Summary

This workflow describes the language school process before students enter Japan and start classes.

The core idea:

```text
Interview application
  -> Personal profile
  -> Application fee
  -> Interview
  -> Acceptance certificate
  -> Enrollment confirmation
  -> COE preparation
  -> Full application form / supporting materials
  -> Immigration-format file generation
  -> COE submission
  -> COE issued
  -> Tuition payment
  -> Receipt and full COE release
  -> Student visa at home country consulate
  -> Arrival date
  -> Japan address / phone
  -> Online oral test
  -> Class placement
  -> Start study
```

## 2. Attached Template Roles

### 2.1 SGG面试申请表(8).xlsx

Role:

- First intake form before interview.
- Used by staff to create an initial personal profile.

Detected major field groups:

- Application admission period
- Desired study length
- Personal identity
- Name, pinyin, Chinese name
- Date of birth
- Nationality
- Marital status
- Gender
- Family register address
- Phone number
- Education history from elementary school
- Final graduation / expected graduation date
- Passport status
- Passport expiry
- Japan entry history
- Japan visa refusal history
- Past Japanese visa/application history
- Family Japan residence/application/refusal history
- Japanese study history
- Japanese language test result
- Work history
- Financial sponsor information
- Parent information
- Sibling information
- Plan after language school

System usage:

- Creates `person`
- Creates `applicant`
- Creates early `education_history`
- Creates early `japan_application_history`
- Creates early `family_background`
- Creates early `financial_sponsor`
- Creates interview checklist

### 2.2 合格通知書_高田馬場校.xls

Role:

- Acceptance notification generated after interview/pass decision.

Current technical note:

- This is legacy `.xls` format.
- The current inspection confirmed workbook-level text such as `合格通知書`, `証明書発行`, and `証明書発行2`.
- For accurate cell mapping, this template should be converted to `.xlsx` once and then registered in SchoolCore template management.

System usage:

- Generated automatically after interview result is marked as passed.
- Uses applicant profile, admission period, school/campus, course, and issue date.
- Stores generated file in applicant/student file archive.

### 2.3 SGG高田马场愿书 - 学生姓名.xlsx

Role:

- Main application form for COE/immigration submission preparation.
- Used after student confirms enrollment.
- Enriches the personal profile created at interview stage.

Detected major field groups:

- School to enroll
- School application number
- Admission period
- Entry date
- Graduation due date
- Introducer memo
- Application memo
- Applicant name
- Nationality
- Sex
- Marital status
- Accompanying persons
- Admission course
- First year fees
- Date of birth
- Birth place
- Family register address
- Home address
- Phone
- Email
- Visa application place
- Occupation
- Port of entry
- Planned entry date
- Passport status
- Passport number
- Passport issue date
- Passport expiry date
- Plan after graduation
- Past COE application history
- Rejection history
- Criminal record
- Deportation/departure order history
- Japan entry/exit history

System usage:

- Updates the profile created from interview application.
- Completes COE application data.
- Feeds immigration-format generated files.
- Supports validation before submission.

## 3. Stage-by-Stage Workflow

## Stage 1: Interview Application Intake

### Business Description

Student first fills the interview application form. Staff enters or imports the content into the system and creates an initial personal profile.

### System Status

`applicant_status = interview_application_received`

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Create applicant profile | Office staff | Person/applicant record created |
| Enter interview form data | Office staff | Initial profile enriched |
| Upload interview application file | Office staff | File archived |
| Check required fields | System | Missing field checklist generated |

### Data Created

- Person identity
- Desired admission period
- Desired study length
- Education history
- Passport status
- Japan visa/application history
- Family application history
- Japanese learning history
- Financial sponsor information

### Required Sections

The interview application form must include these required sections:

1. 入学時期、語学学校滞在予定期間
2. 個人情報
3. 個人学歴
4. 個人申請歴
5. 経費支弁者情報

### Validation

| Check | Level |
|---|---|
| 入学時期 missing | Error |
| 語学学校滞在予定期間 missing | Error |
| 個人情報 section incomplete | Error |
| 個人学歴 section incomplete | Error |
| 個人申請歴 section incomplete | Error |
| 経費支弁者情報 section incomplete | Error |

## Stage 2: Application Fee

### Business Description

Student pays application fee. Sometimes the agent collects on behalf of the school.

### System Status

`application_fee_status = unpaid / agent_collected / paid / waived / refunded`

Confirmed rule:

- Application fee amount is fixed at 20,000 JPY.
- If an agent collects the fee, the payment/receipt display name shows the agent name.
- The student remains linked to the payment and receipt details.
- Receipts are required for application fee, partial tuition, and full tuition.
- Receipts can be voided and reissued with history.

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Register fee request | Office staff | Payment record created |
| Mark as agent collected | Office staff | Agent collection flag saved |
| Upload receipt/proof | Office staff | Payment file archived |
| Confirm payment | Office staff | Applicant can proceed to interview |

### Data Needed

- Fee amount
- Currency
- Payment method
- Payment date
- Paid by student or agent
- Agent name, if applicable
- Receipt/proof file
- Receipt issue status
- Receipt void/reissue history

## Stage 3: Interview Arrangement

### Business Description

School arranges interview. Most students pass; some need a second interview.

### System Status

```text
interview_pending
  -> interview_scheduled
  -> first_interview_done
  -> re_interview_required
  -> second_interview_done
  -> passed / hold / failed / cancelled
```

Confirmed interview result statuses:

- `passed` / 合格
- `hold` / 保留
- `re_interview` / 复试
- `failed` / 不合格

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Schedule interview | Office staff | Interview event created |
| Record result | Staff/interviewer | Result saved |
| Request second interview | Interviewer | Status changed |
| Final pass decision | Responsible staff | Acceptance generation available |

### Data Needed

- Interview date/time
- Interview method
- Interviewer
- Result
- Comment
- Second interview requirement

## Stage 4: Acceptance Certificate

### Business Description

After passing the interview, the system generates the acceptance certificate automatically.

### System Status

`acceptance_status = generated`

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Mark interview passed | Staff | Acceptance generation enabled |
| Generate acceptance certificate | System/staff | Excel/PDF generated |
| Send to student/agent | Staff | Sent record saved |

### Template

- `合格通知書_高田馬場校.xls`
- Recommended: convert to `.xlsx` and register as `ACCEPTANCE_NOTICE_TAKADANOBABA`

Confirmed rule:

- Acceptance notice templates differ by campus.
- Template selection must support school/campus/template version.

### Generated Data

- Applicant name
- Admission period
- Course
- School/campus
- Issue date
- Acceptance result
- Staff/school representative

## Stage 5: Enrollment Confirmation

### Business Description

Student confirms intention to enroll. Then COE preparation begins.

### System Status

```text
accepted
  -> enrollment_confirmed
  -> coe_preparation_started
```

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Confirm enrollment | Staff | Enrollment intent saved |
| Set admission term/course | Staff | COE case can be created |
| Create COE case | Staff | COE preparation workflow starts |

### Data Needed

- Confirmed admission term
- Confirmed course
- Intended study period
- Applicant/agent confirmation date

## Stage 6: COE Preparation and Full Application Form

### Business Description

Student fills the full application form and prepares supporting documents. The system enriches the profile created during the interview stage.

### System Status

```text
coe_preparation_started
  -> application_form_requested
  -> application_form_received
  -> materials_collecting
  -> materials_complete
```

### Template

- `SGG高田马场愿书 - 学生姓名.xlsx`

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Send application form request | Staff | Request record saved |
| Import/enter application form | Staff | Existing profile updated |
| Upload supporting documents | Staff/student/agent | Files archived |
| Run COE validation | System | Missing/invalid checklist |
| Complete materials | Staff | Ready for immigration-format generation |

### Profile Enrichment Logic

The system should not create a duplicate person.

It should merge:

```text
Interview profile
  + full application form
  + uploaded supporting materials
  = COE-ready applicant profile
```

### Conflict Handling

If the same field differs between interview form and full application form:

| Example | System Behavior |
|---|---|
| Name spelling differs | Show conflict and require staff confirmation |
| Birth date differs | Error until confirmed |
| Passport number newly added | Update profile and keep history |
| Address updated | Store new address and keep old source |

## Stage 7: Immigration-Format File Generation

### Business Description

After all materials are complete, staff generates files in the immigration-required format.

### System Status

`coe_case_status = ready_for_generation / generated / checked`

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Generate immigration format | Staff/system | Excel/PDF files generated |
| Run validation | System | Errors/warnings listed |
| Run AI COE material check | System/staff | AI issue list generated |
| Staff check | Staff | Confirmed |
| Final lock | Responsible staff | Submission package locked |

### AI COE Material Check

Before staff final check, the system should run an AI-assisted COE material review.

Goal:

- Find missing fields.
- Find inconsistent dates, names, addresses, and passport information.
- Compare interview application data with full application form data.
- Check whether supporting documents appear to match entered information.
- Produce a human-readable issue list for office staff.

AI check target materials:

- Interview application form
- Full application form / 願書
- Passport
- Graduation certificate
- Transcript
- Japanese study certificate
- Japanese language test certificate
- Financial sponsor documents
- Bank balance certificate
- Family relationship documents
- Employment, income, and tax documents of sponsor
- Past visa/COE history explanation

AI check result categories:

| Category | Examples |
|---|---|
| Missing item | Passport number missing, sponsor income document missing |
| Inconsistency | Birth date differs between interview form and 願書 |
| Date issue | Education history has unexplained gap |
| Risk note | Past refusal marked yes but reason is empty |
| Format issue | Date format not yyyy/mm/dd |
| Translation/name issue | Roman name differs from passport spelling |
| Staff confirmation | AI cannot determine document validity, needs manual check |

AI check status:

```text
not_run
running
completed_with_no_critical_issues
completed_with_warnings
completed_with_errors
staff_confirmed
```

Important rule:

AI check is an assistant for staff review. It must not be treated as final legal or immigration judgment. Staff must confirm before submission.

### Validation Examples

| Check | Level |
|---|---|
| Missing passport number | Error |
| Missing passport expiry | Error |
| Missing birth place | Error |
| Missing family register address | Error |
| Missing sponsor info | Error |
| Education history gap | Warning/Error |
| Past Japan application history unanswered | Error |
| Rejection history detail missing when yes | Error |
| Japanese study 150 hours unanswered | Warning/Error |
| Supporting document missing | Error |

## Stage 8: COE Submission

### Business Description

School submits the generated immigration package before the specified deadline.

### System Status

```text
ready_to_submit
  -> submitted
  -> under_review
  -> correction_required / coe_issued / rejected
```

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Register submission deadline | Staff | Deadline reminder |
| Mark submitted | Staff | Submission date saved |
| Upload submitted copy | Staff | File archived |
| Record receipt number | Staff | COE case updated |

### Data Needed

- Submission deadline
- Submission date
- Submission method
- Receipt number
- Submitted files
- Staff in charge

Confirmed deadline rule:

- The system must support both admission-term-level COE submission deadlines and student-level individual deadlines.
- Student-level deadline overrides the term-level default.
- School-corporation/法人校 rolling submission workflows must be supported.

## Stage 9: COE Issued

### Business Description

After COE is issued, school sends only the COE partial screenshot to the student first.

Confirmed rule:

- Before tuition payment, school sends a partial screenshot to the student.
- Full COE remains restricted until the configured payment condition is satisfied.

### System Status

`coe_status = issued_partial_released`

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Register COE issued | Staff | COE issue date saved |
| Upload full COE | Staff | Confidential file saved |
| Create partial screenshot | Staff/system | Student-shareable file |
| Send partial screenshot | Staff | Sent record saved |

### Access Control

| File | Access |
|---|---|
| Full COE | Office staff only until tuition full payment |
| Partial screenshot | Can be shared with student/agent |

## Stage 10: Full Tuition Payment and Receipt

### Business Description

Student pays full tuition. School issues receipt and releases full COE.

### System Status

```text
tuition_pending
  -> tuition_partially_paid
  -> tuition_fully_paid
  -> receipt_issued
  -> full_coe_released
```

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Register invoice/payment request | Staff | Tuition record |
| Confirm full payment | Staff | COE release enabled |
| Generate receipt | Staff/system | Receipt file generated automatically |
| Release full COE | Staff | Release log saved |

### Data Needed

- Tuition amount
- Payment amount
- Payment date
- Payer
- Agent collection flag
- Receipt number
- Receipt file
- Full COE release date

### Automatic Receipt Requirements

The system must be able to issue receipts automatically when payment is confirmed.

Receipt trigger options:

| Trigger | Behavior |
|---|---|
| Application fee confirmed | Generate application fee receipt |
| Tuition partial payment confirmed | Generate partial payment receipt |
| Full tuition confirmed | Generate full tuition receipt and unlock full COE release |
| Agent collection confirmed | Generate receipt/payment record with agent name shown |

Receipt data:

- Receipt number
- Student/applicant name
- Payer name
- Amount
- Currency
- Payment purpose
- Payment date
- Payment method
- Agent name, if collected by agent
- Student name, referenced in receipt detail even when agent name is displayed
- Issuer
- Issue date/time
- School name/address
- Template version

Receipt controls:

- Receipt number must be unique.
- Receipt number is automatically generated by issue date and admission period.
- Receipt file must be stored in file archive.
- Issuer and issue time must be recorded.
- Reissue creates a new version or copy, not silent overwrite.
- Void/cancel must require reason and keep history.
- Receipts must be issued for application fee, tuition payment, partial payment, and full payment.
- Full COE file must not be released until full tuition payment is confirmed and the required receipt is issued.

## Stage 11: Visa Application at Home Country Consulate

### Business Description

Student uses the full COE to apply for visa at the Japanese consulate in home country.

### System Status

```text
visa_application_preparing
  -> visa_applied
  -> visa_issued
  -> visa_problem
```

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Record consulate/visa application place | Staff/student | Visa application info saved |
| Mark visa applied | Staff | Status updated |
| Mark visa issued | Staff | Arrival planning enabled |

## Stage 12: Arrival Planning

### Business Description

Student confirms planned arrival date in Japan.

### System Status

`arrival_status = planned / changed / arrived / delayed`

### Data Needed

- Planned arrival date
- Port of entry
- Flight number, optional
- Airport pickup need, optional
- Japanese contact after arrival

## Stage 13: Pre-Enrollment Japan Contact Update

### Business Description

Before enrollment procedure, staff must know the student's Japanese address and phone number.

### System Status

`pre_enrollment_contact_status = incomplete / completed`

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Collect Japan address | Staff/student | Address updated |
| Collect Japan phone | Staff/student | Phone updated |
| Validate contact | Staff | Ready for enrollment |

### Validation

| Check | Level |
|---|---|
| Japan address missing | Error before enrollment |
| Japan phone missing | Warning/Error by setting |
| Residence card after arrival missing | Warning |

## Stage 14: Online Oral Test

### Business Description

Before classes start, student takes an online oral test for class placement.

### System Status

```text
placement_test_pending
  -> scheduled
  -> completed
  -> class_assigned
```

### Data Needed

- Test date/time
- Tester
- Oral score
- Japanese level
- Comment
- Recommended class

## Stage 15: Class Placement and Study Start

### Business Description

Based on oral test and student profile, staff assigns class. Student starts study.

### System Status

```text
pre_enrollment
  -> enrolled
```

### Main Actions

| Action | Actor | System Result |
|---|---|---|
| Assign class | Academic staff | Class membership created |
| Confirm enrollment procedure | Office staff | Student status becomes enrolled |
| Start attendance management | System | Student appears in class roster |

## 4. Recommended Status Model

### 4.1 Applicant Status

```text
interview_application_received
application_fee_pending
application_fee_confirmed
interview_scheduled
first_interview_done
second_interview_required
second_interview_done
passed
failed
accepted
enrollment_confirmed
coe_preparation_started
coe_materials_collecting
coe_materials_complete
coe_generated
coe_submitted
coe_under_review
coe_correction_required
coe_issued
coe_rejected
tuition_pending
tuition_fully_paid
full_coe_released
visa_applied
visa_issued
arrival_planned
arrived
placement_test_done
class_assigned
enrolled
cancelled
```

### 4.2 COE Case Status

```text
not_started
preparing
waiting_application_form
waiting_documents
validation_failed
ready_for_generation
generated
checked
submitted
under_review
correction_required
issued
rejected
closed
```

### 4.3 Payment Status

```text
unpaid
agent_collected
partially_paid
paid
waived
refunded
```

## 5. System Modules Needed

| Module | Purpose |
|---|---|
| Applicant management | Manage interview-stage candidates |
| Interview management | Schedule and record interviews |
| Payment management | Application fee and tuition status |
| COE case management | Prepare and track COE |
| Template generation | Acceptance notice, immigration forms, receipt |
| File archive | Store application form, COE, receipts, materials |
| Validation engine | Check missing/inconsistent data |
| Communication log | Record sent files and student/agent contact |
| Placement test | Online oral test and class assignment |
| Student conversion | Convert confirmed applicant to enrolled student |

## 6. New Tables Suggested

These tables extend the current database design.

### applicants

| Column | Notes |
|---|---|
| id | Primary key |
| school_id | School |
| person_id | Linked person |
| applicant_number | Application/interview number |
| admission_period | Desired admission term |
| desired_study_length | Desired study length |
| desired_course_id | Desired course |
| agent_id | Nullable |
| status | Applicant status |
| source_file_id | Interview form file |
| created_at |  |
| updated_at |  |

### application_fee_records

| Column | Notes |
|---|---|
| id | Primary key |
| applicant_id | Applicant |
| amount | Fee amount |
| currency | Currency |
| status | Payment status |
| collected_by | `school`, `agent`, `other` |
| agent_id | Nullable |
| paid_at | Payment date |
| proof_file_id | Receipt/proof |

### interviews

| Column | Notes |
|---|---|
| id | Primary key |
| applicant_id | Applicant |
| interview_no | 1 or 2 |
| scheduled_at | Date/time |
| method | Online/offline |
| interviewer_user_id | Interviewer |
| result | `passed`, `second_required`, `failed`, `pending` |
| score | Optional |
| comment | Internal comment |

### coe_cases

| Column | Notes |
|---|---|
| id | Primary key |
| applicant_id | Applicant |
| student_id | Nullable until enrollment |
| admission_period | Confirmed admission term |
| course_id | Confirmed course |
| submission_deadline | Deadline |
| submitted_at | Submission date |
| receipt_number | Optional |
| status | COE case status |
| issued_at | COE issue date |
| full_coe_file_id | Confidential file |
| partial_coe_file_id | Shareable screenshot |

### applicant_profile_conflicts

| Column | Notes |
|---|---|
| id | Primary key |
| applicant_id | Applicant |
| field_key | Field |
| old_value | Interview value |
| new_value | Application form value |
| status | `unresolved`, `accepted_new`, `kept_old`, `manual_fixed` |
| resolved_by | User |
| resolved_at | Time |

### tuition_payment_records

| Column | Notes |
|---|---|
| id | Primary key |
| applicant_id | Applicant |
| student_id | Nullable |
| amount_due | Amount due |
| amount_paid | Amount paid |
| currency | Currency |
| status | Payment status |
| collected_by | School/agent |
| paid_at | Payment date |
| receipt_number | Receipt number |
| receipt_file_id | Generated receipt |

### communication_logs

| Column | Notes |
|---|---|
| id | Primary key |
| person_id | Person |
| applicant_id | Nullable |
| student_id | Nullable |
| direction | `inbound`, `outbound` |
| channel | Email, WeChat, LINE, phone, other |
| subject | Subject |
| content_summary | Summary |
| file_id | Optional attachment |
| created_by | User |
| created_at | Time |

### placement_tests

| Column | Notes |
|---|---|
| id | Primary key |
| applicant_id | Applicant |
| student_id | Nullable |
| scheduled_at | Test time |
| tester_user_id | Tester |
| oral_score | Score |
| level | Placement level |
| recommended_class_id | Class |
| comment | Comment |
| status | Pending/scheduled/completed |

## 7. Field Mapping: Interview Form to System

| Interview Form Field | System Field Group |
|---|---|
| 申请入学时期 | applicant.admission_period |
| 希望在语校呆多久 | applicant.desired_study_length |
| 姓 / 名 / 姓名拼音 / 汉字 | person.name fields |
| 出生年月日 | person.birth_date |
| 国籍 | person.nationality |
| 有无配偶 | person.marital_status |
| 性别 | person.gender |
| 户籍地址 | address.family_register |
| 个人手机号码 | person.phone |
| 个人学历 | education_histories |
| 最终学历毕业时间 | education_histories.final_graduation_date |
| 是否有护照 | passports.status |
| 护照到期日期 | passports.expiry_date |
| 赴日经历 | japan_entry_histories |
| 拒签经历 | japan_application_histories |
| 家族申请经历 | family_japan_histories |
| 日语学习履历 | japanese_study_histories |
| 日语等级考试 | japanese_exam_results |
| 工作经历 | work_histories |
| 经费支付人信息 | financial_sponsors |
| 父母信息 | family_members |
| 兄弟姐妹信息 | family_members |
| 语言学校毕业后的打算 | post_graduation_plan |

## 8. Field Mapping: Full Application Form to System

| Application Form Field | System Field Group |
|---|---|
| 入学予定学校 | coe_case.school |
| 学校管理用申請番号 | applicant.school_application_number |
| 入学時期 | coe_case.admission_period |
| 入学年月日 | enrollment.expected_entry_date |
| 卒業予定日 | enrollment.expected_completion_date |
| 申請者名 | person.name fields |
| 国籍 | person.nationality |
| 性別 | person.gender |
| 婚姻状況 | person.marital_status |
| 同伴者 | accompanying_persons |
| 入学希望コース | coe_case.course |
| 初年度学費 | tuition_payment_records.amount_due |
| 生年月日 | person.birth_date |
| 出生地点 | person.birth_place |
| 戸籍住所 | address.family_register |
| 本国現住所 | address.home_country |
| 電話 | person.phone |
| Email | person.email |
| 査証申請予定地 | visa_application.place |
| 職業 | person.occupation |
| 上陸予定港 | arrival_plan.port_of_entry |
| 入国予定年月日 | arrival_plan.planned_entry_date |
| 旅券番号 | passports.passport_number |
| 旅券発行日 | passports.issue_date |
| 旅券有効期限 | passports.expiry_date |
| 卒業後予定 | post_graduation_plan |
| COE申請歴 | japan_application_histories |
| 犯罪歴 | legal_history.criminal_record |
| 退去強制歴 | legal_history.deportation_history |
| 出入国履歴 | japan_entry_histories |

## 9. MVP Screen Additions

### 9.1 Applicant List

Filters:

- Admission period
- Status
- Agent
- Application fee status
- Interview status
- COE status
- Tuition status

Actions:

- Create applicant from interview form
- Schedule interview
- Generate acceptance notice
- Start COE case
- Convert to student

### 9.2 Applicant Detail

Tabs:

- Overview
- Interview form data
- Fee
- Interview
- Acceptance notice
- COE application
- Materials
- Payments
- Communication
- Placement test
- Student conversion

### 9.3 COE Case Detail

Sections:

- Applicant snapshot
- Required fields checklist
- Supporting material checklist
- Template generation
- Submission tracking
- COE issued files
- Tuition and release control

### 9.4 Placement Test

Functions:

- Schedule oral test
- Record level/score
- Recommend class
- Assign class

## 10. Demo Update Recommendation

The current demo should add a dedicated language-school admission workflow page:

```text
面接申請
  -> 報名費
  -> 面接
  -> 合格通知
  -> 入学確認
  -> COE準備
  -> 入管提出
  -> COE交付
  -> 学費納入
  -> 来日予定
  -> 口語テスト
  -> クラス分け
```

This page should show each applicant's progress as a pipeline.

## 11. Implementation Priority

### Phase A: Applicant and Interview

1. Applicant profile
2. Interview application import/manual entry
3. Application fee status
4. Interview scheduling/result
5. Acceptance notice generation

### Phase B: COE Preparation

1. COE case
2. Full application form data entry/import
3. Profile conflict check
4. Material checklist
5. Immigration-format generation
6. Submission tracking

### Phase C: COE Issued to Enrollment

1. COE issue record
2. Partial/full COE file control
3. Tuition full payment
4. Receipt generation
5. Visa application status
6. Arrival date
7. Japan address/phone update
8. Online oral test
9. Class placement
10. Convert to enrolled student
