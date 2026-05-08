# WSDB Export Migration Mapping v1

## 1. Source File

Source:

`WSDB Data export.xlsx`

The file contains one sheet:

- `Sheet1`

Detected structure:

- Row 1: header
- Rows 2 onward: student records
- 55 columns

## 2. Migration Summary

This export can be used as the first data migration source for SchoolCore.

It includes enough data for:

- Student master
- Current enrollment status
- Admission period
- Course/class
- Nationality/gender/birth date
- Japan address
- Home/register/application addresses
- Residence status
- Passport
- Graduation/completion/leaving dates
- Final pathway plan
- Email
- Final education
- Pre-admission occupation
- Payment status notes
- Free/custom fields
- Last updater

It does not clearly include:

- Residence card number
- Residence expiry date
- Attendance history
- Detailed COE application history
- Uploaded files
- Certificate issue history
- Receipt history
- Immigration report history

These may need separate exports or manual migration.

## 3. Source Field List

| No. | Source Column |
|---:|---|
| 1 | 选择 |
| 2 | 照片 |
| 3 | 学籍号码 |
| 4 | 姓名(英文) |
| 5 | 昵称 |
| 6 | 代理商名称 |
| 7 | 注册状态 |
| 8 | 毕业判断 |
| 9 | 課程修了判定 |
| 10 | 入学時期 |
| 11 | 学部名 |
| 12 | 学科名 |
| 13 | course |
| 14 | 班级 |
| 15 | 适用年月 |
| 16 | 学年 |
| 17 | 国籍 |
| 18 | 性別 |
| 19 | 出生年月日 |
| 20 | 年龄 |
| 21 | 入学日期 |
| 22 | 预定学习完成日期 |
| 23 | 毕业（修了）年月日 |
| 24 | 脱离年月日 |
| 25 | 学生証有効期限 |
| 26 | 卒業希望年月 |
| 27 | 开始上课日期 |
| 28 | 上次出席日期 |
| 29 | 国内住所 |
| 30 | 申請時住所 |
| 31 | 户籍地址 |
| 32 | 再留资格 |
| 33 | 护照号码 |
| 34 | 签发日期 |
| 35 | 有効期限 |
| 36 | 最終進路区分 |
| 37 | 毕业后计划 |
| 38 | 退学理由 |
| 39 | 学校联系用电子邮件 |
| 40 | 最終学歴（学校名） |
| 41 | 日本語学校名（他校所属） |
| 42 | 入学前職業 |
| 43 | 納付状況 |
| 44 | 自由项目1 |
| 45 | 自由项目2 |
| 46 | 自由项目3 |
| 47 | 自由项目4 |
| 48 | 自由项目5 |
| 49 | 自由项目6 |
| 50 | 自由项目7 |
| 51 | 自由项目8 |
| 52 | 自由项目9 |
| 53 | 自由项目10 |
| 54 | 更新者名 |
| 55 | 更新者时间 |

## 4. Field Mapping

| Source Column | SchoolCore Target | Import Rule |
|---|---|---|
| 学籍号码 | `students.student_number` | Required, unique |
| 姓名(英文) | `persons.full_name_roman`, `persons.full_name` | Required |
| 昵称 | `persons.notes` or `students.preferred_name` | Optional |
| 代理商名称 | `agents.name` / `applicants.agent_id` | Create/match agent master |
| 注册状态 | `students.current_status` | Map status values |
| 毕业判断 | `students.graduation_judgment_status` or custom field | Optional |
| 課程修了判定 | `students.completion_judgment_status` or custom field | Optional |
| 入学時期 | `students.admission_term` | Normalize to yyyyMM or term master |
| 学部名 | `departments.name` | Optional for language school |
| 学科名 | `courses.name` or `departments.name` | Optional |
| course | `courses.name` | Create/match course master |
| 班级 | `classes.name` | Create/match class master |
| 适用年月 | `enrollment_histories.start_period` or custom field | Optional |
| 学年 | `students.current_grade_year` | Optional |
| 国籍 | `persons.nationality` | Required for international students |
| 性別 | `persons.gender` | Map 男/女 etc. |
| 出生年月日 | `persons.birth_date` | Required, date normalization |
| 年龄 | Not imported or calculated | Derive from birth date |
| 入学日期 | `students.admission_date` | Required if enrolled |
| 预定学习完成日期 | `students.expected_graduation_date` | Date |
| 毕业（修了）年月日 | `students.actual_graduation_date` / `leaving_records.leaving_date` | If present |
| 脱离年月日 | `leaving_records.leaving_date` | If present |
| 学生証有効期限 | `students.student_card_expiry_date` or custom field | Optional |
| 卒業希望年月 | `students.desired_graduation_period` or custom field | Optional |
| 开始上课日期 | `enrollment_histories.start_date` or `students.class_start_date` | Optional |
| 上次出席日期 | `students.last_attendance_date` or attendance summary | Optional |
| 国内住所 | `addresses` type `japan` | Current Japan address |
| 申請時住所 | `addresses` type `application_address` | Optional |
| 户籍地址 | `addresses` type `family_register` | Optional |
| 再留资格 | `residence_cards.residence_status` | Likely typo/source label for 在留資格 |
| 护照号码 | `passports.passport_number` | Passport |
| 签发日期 | `passports.issue_date` | Date |
| 有効期限 | `passports.expiry_date` | Date |
| 最終進路区分 | `leaving_records.next_destination_type` / `career_pathways` | Optional |
| 毕业后计划 | `students.post_graduation_plan` | Optional |
| 退学理由 | `leaving_records.reason` | If withdrawn |
| 学校联系用电子邮件 | `persons.email` | Email |
| 最終学歴（学校名） | `education_histories.school_name` | Optional |
| 日本語学校名（他校所属） | `education_histories.school_name` or custom field | Optional |
| 入学前職業 | `persons.occupation_before_admission` | Optional |
| 納付状況 | `payment_notes` or `tuition_payment_records.status_note` | Needs mapping |
| 自由项目1-10 | `custom_fields` | Preserve raw values |
| 更新者名 | `migration_source.updated_by` / audit note | Preserve |
| 更新者时间 | `migration_source.updated_at` / audit note | Preserve |

## 5. Status Mapping Draft

Detected sample value:

| Source Value | SchoolCore Status |
|---|---|
| 在学中 | enrolled |

Need more exported rows or full unique-value scan to map:

- 退学
- 卒業
- 修了
- 休学
- 除籍
- 入学前
- その他

## 6. Master Data to Create or Match

During import, SchoolCore should create or match:

- Agents from `代理商名称`
- Courses from `course`
- Classes from `班级`
- Departments/courses from `学部名`, `学科名`
- Nationality values from `国籍`
- Status values from `注册状态`
- Payment status values from `納付状況`

## 7. Important Validation Rules

### Blocking Errors

- Missing `学籍号码`
- Duplicate `学籍号码`
- Missing `姓名(英文)`
- Invalid `出生年月日`
- Unknown `注册状态`
- Invalid `入学日期` for active students

### Warnings

- Missing `国内住所`
- Missing `学校联系用电子邮件`
- Missing `再留资格`
- Missing `护照号码`
- Passport expired from `有効期限`
- Missing `班级` for enrolled students
- Unmapped `course` or `班级`
- `脱离年月日` exists but status is still active

## 8. Data Gaps / Additional Exports Needed

Ask old system for additional exports if available:

1. Residence card number and residence expiry date
2. Attendance records or monthly attendance summaries
3. File attachments: passport, residence card, COE, student photo
4. Certificate issuance history
5. Immigration report submission history
6. Receipt/payment details
7. Exam results
8. Status change history

## 9. Migration Implementation Recommendation

Use this WSDB export as `Student Master Import`.

Import order:

1. Agents
2. Courses
3. Classes
4. Persons
5. Students
6. Addresses
7. Passports
8. Residence status records
9. Leaving records, if leaving/graduation dates exist
10. Custom fields and migration audit metadata

Every imported row should preserve raw source data as `migration_snapshot` for audit.
