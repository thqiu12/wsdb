# Immigration Template Catalog v1

## 1. Received Template Files

| No. | File | Format | Status |
|---:|---|---|---|
| 1 | 5月11月受け入れ状況在留者リスト-模板.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 2 | 在留期間更新許可五表_模板.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 3 | 在留更新申請者リスト-模板.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 4 | 入管半期毎出席率報告_模板.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 5 | 半年毎出席率報告の明細_総合1年コース-報告.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 6 | 離脱届-模板.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 7 | 入管5割出席率不佳報告_模板.xlsx | xlsx | Inspected and mappable |
| 8 | 資格外活動許可申請書_模板.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 9 | 定期報告書/渋谷外語学院/受け入れ状況届出表.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 10 | 定期報告書/渋谷外語学院/受け入れ状況在留者リスト.xls | xls | Registered, needs xlsx conversion for exact mapping |
| 11 | 年度終了報告-模板/リスト.xlsx | xlsx | Inspected and mappable |
| 12 | 年度終了報告-模板/報告様式.xlsx | xlsx | Inspected and mappable |
| 13 | 年度終了報告-模板/添付証明書1（45枚）.pdf | pdf | Attachment evidence, store as submitted/generated file |
| 14 | 年度終了報告-模板/添付証明書2（26枚）.pdf | pdf | Attachment evidence, store as submitted/generated file |
| 15 | 年度終了報告-模板/報告済みスクショ.png | image | Submission evidence screenshot |

## 2. Template Categories

| File | SchoolCore Module | Document Type |
|---|---|---|
| 5月11月受け入れ状況在留者リスト-模板.xls | Immigration Report | May/November acceptance/current resident list |
| 在留期間更新許可五表_模板.xls | Visa Management | Residence period renewal five forms |
| 在留更新申請者リスト-模板.xls | Visa Management | Residence renewal applicant list |
| 入管半期毎出席率報告_模板.xls | Immigration Report | Half-year attendance report |
| 半年毎出席率報告の明細_総合1年コース-報告.xls | Immigration Report | Half-year attendance detail by course |
| 離脱届-模板.xls | Leaving/Withdrawal | Leaving notification |
| 入管5割出席率不佳報告_模板.xlsx | Immigration Report | Low attendance below 50% report |
| 資格外活動許可申請書_模板.xls | Visa / Pre-arrival | Permission for activity other than permitted |
| 受け入れ状況届出表.xls | Periodic Report | Acceptance status notification form |
| 受け入れ状況在留者リスト.xls | Periodic Report | Acceptance/current resident list |
| 年度終了報告-模板/リスト.xlsx | Annual Completion Report | Annual completion student requirement list |
| 年度終了報告-模板/報告様式.xlsx | Annual Completion Report | Annual completion summary report |
| 年度終了報告-模板/添付証明書1（45枚）.pdf | Annual Completion Report | Attached certificate evidence |
| 年度終了報告-模板/添付証明書2（26枚）.pdf | Annual Completion Report | Attached certificate evidence |
| 年度終了報告-模板/報告済みスクショ.png | Annual Completion Report | Submission completion screenshot |

## 3. Low Attendance Below 50% Report Mapping

Source file:

`入管5割出席率不佳報告_模板.xlsx`

Sheet:

- `出席率`

### 3.1 Header / School Fields

| Template Cell / Label | SchoolCore Source |
|---|---|
| 日本語教育機関名 | `schools.name_ja` |
| 設置者名 | `schools.operator_name` or `schools.company_name` |
| 電話番号 | `schools.phone` |
| 提出日 | report generated/submitted date |
| 担当者氏名 | report responsible staff |
| 現在の「留学」に係る在籍者数 | count of active students with residence status `留学` at base date |
| 対象年月 | report month |

### 3.2 Student Detail Columns

| Column | Template Label | SchoolCore Source |
|---|---|---|
| A | 番号 | Row number |
| B | 国籍・地域 | `persons.nationality` |
| C | 氏名（英字表記） | `persons.full_name_roman` |
| D | 生年月日 | `persons.birth_date` |
| E | 性別 | `persons.gender` |
| F | 在留カード番号 | `residence_cards.card_number` |
| G | 入学した時期 | `students.admission_date` |
| H | 卒業見込み時期 | `students.expected_graduation_date` |
| I | 出席率 | target month `attendance_monthly_summaries.attendance_rate` |
| J | 前月の出席率 | previous month attendance rate |
| K | 資格外活動許可に係る活動を行う本邦の公私の機関の名称 | `part_time_activities.employer_name` or `なし` |
| L | 備考 | guidance/status notes |

### 3.3 Generation Rule

Candidate extraction:

- Report target month attendance rate below 50%.
- Student has active or relevant enrollment status.
- Student has residence status `留学`.

Submission due:

- By the end of the month following the month where attendance rate fell below 50%.

Validation:

| Check | Level |
|---|---|
| Missing nationality | Error |
| Missing roman name | Error |
| Missing birth date | Error |
| Missing gender | Error |
| Missing residence card number | Error |
| Missing admission date | Error |
| Missing expected graduation/completion date | Error |
| Target month attendance not calculated | Error |
| Previous month attendance not calculated | Warning |
| Work permission exists but employer name missing | Warning/Error by setting |
| Guidance/status note missing | Warning |

## 4. Required Data for Other Templates

Even before exact cell mapping, the system should prepare the following data groups.

### 4.1 May/November Acceptance / Resident List

Likely required data:

- Student number
- Name
- Nationality
- Birth date
- Gender
- Residence status
- Residence card number
- Residence expiry
- Admission date
- Course/class
- Address
- Current status

### 4.1A Acceptance Status Notification Form

Likely required data:

- School name
- Establishing company/operator
- Representative
- Reporting period/base date
- Total accepted/current students
- New students
- Leaving/completed/withdrawn students
- Students by residence status
- Students by course/intake
- Staff in charge
- Submission date

This template belongs to the same periodic report workflow as the May/November resident list.

### 4.2 Residence Period Renewal Five Forms

Likely required data:

- Student identity
- Nationality
- Birth date
- Gender
- Passport number
- Residence card number
- Residence status
- Residence expiry
- Address
- School info
- Course
- Attendance
- Grades/certificates
- Financial/sponsor info when required

### 4.3 Residence Renewal Applicant List

Likely required data:

- Student number
- Name
- Nationality
- Residence card number
- Residence expiry
- Renewal case status
- Submitted date
- Approved date
- Assigned staff

### 4.4 Half-Year Attendance Report

Likely required data:

- Course
- Class
- Student identity
- Monthly attendance rates
- Six-month attendance rate
- Required/attended hours or minutes
- Enrollment status

### 4.5 Half-Year Attendance Detail

Likely required data:

- Course-specific student list
- Month-by-month attendance
- Total attendance
- Remarks

### 4.6 Leaving Notification

Likely required data:

- Student identity
- Nationality
- Residence card number
- Leaving date
- Leaving type/reason
- Final address
- Final residence status
- Next destination
- Submission date

### 4.7 Permission for Activity Other Than Permitted

Likely required data:

- Student identity
- Nationality
- Birth date
- Passport number
- COE/entry-related information
- Planned activity/work permission info
- School information

### 4.8 Annual Completion Report

The annual completion report is a package, not a single file.

Package files:

- `リスト.xlsx`
- `報告様式.xlsx`
- Attached certificate PDFs
- Submission completion screenshot

#### 4.8.1 Annual Requirement List Mapping

Source:

`年度終了報告-模板/リスト.xlsx`

Sheet:

- `リスト`

Columns:

| Column | Template Label | SchoolCore Source |
|---|---|---|
| A | 番号 | Row number |
| B | 氏名 | `persons.full_name` plus roman/local name as needed |
| C | 在留カード番号 | `residence_cards.card_number` |
| D | 該当要件 | Annual requirement category |
| E | 合格試験及び点数等 / 進学先 / 就職先 | Exam result / next school / employer |
| F | 試験受験番号，合格証明書番号，成績証明書番号等 | Certificate/exam number |
| G | 課程修了年月日 | `students.actual_graduation_date` or `leaving_records.leaving_date` |

Observed requirement categories:

- `就職`
- `進学`
- `日本語教育の参照枠（試験）`

This list may contain multiple rows for one student when one student satisfies multiple requirement categories.

#### 4.8.2 Annual Summary Report Mapping

Source:

`年度終了報告-模板/報告様式.xlsx`

Sheet:

- `報告様式`

Key fields:

| Template Label | SchoolCore Source |
|---|---|
| 作成年月日 | Generated date |
| 日本語教育機関名 | `schools.name_ja` |
| 設置者名 | `schools.operator_name` |
| 基準適合性 | Calculated result |
| 基準該当者割合 | `qualified_count / (completed_count + exception_withdrawn_count)` |
| 課程修了者数 | Completion count |
| 基準該当者合計数（実人数） | Distinct qualified student count |
| 退学者数（44号ただし書き） | Applicable withdrawn exception count |
| コース別進学者数 | Career/pathway by course |
| コース別在留資格変更許可者数 | Status-change approved count by course |
| コース別試験等証明者数 | Exam/certificate qualified count by course |
| 公表の方法 | Publication method, manual or configured field |

The sample report shows:

- 基準該当者割合: 76.8%
- 課程修了者数: 203
- 基準該当者合計数: 163
- 退学者数: 9
- Course columns: 総合2年コース, 総合1年コース

#### 4.8.3 Attached Certificate PDFs

Attached certificate PDFs should be stored as files linked to the annual report batch.

They may include:

- JLPT certificate copies
- EJU result copies
- Other proof documents accepted for the Japanese language reference framework

System requirements:

- Upload/generated file archive
- File count
- Linked report batch
- Submitted attachment flag
- Access log

#### 4.8.4 Submission Completion Screenshot

The screenshot showing completion should be stored as submission evidence.

It contains:

- Submission completion message
- 整理番号
- パスワード

Security note:

- Because the screenshot contains整理番号 and password, it should be treated as confidential.
- Access should be staff-only and logged.

## 5. Template Registration Plan

Each template should be registered in `document_templates` with:

- Template code
- Template name
- Module
- Document type
- Format
- School/campus
- Version
- Active flag
- Required data schema
- Mapping configuration

Suggested template codes:

| File | Suggested Code |
|---|---|
| 5月11月受け入れ状況在留者リスト-模板.xls | `IMMIGRATION_MAY_NOV_RESIDENT_LIST` |
| 在留期間更新許可五表_模板.xls | `VISA_RENEWAL_FIVE_FORMS` |
| 在留更新申請者リスト-模板.xls | `VISA_RENEWAL_APPLICANT_LIST` |
| 入管半期毎出席率報告_模板.xls | `IMMIGRATION_HALF_YEAR_ATTENDANCE` |
| 半年毎出席率報告の明細_総合1年コース-報告.xls | `IMMIGRATION_HALF_YEAR_ATTENDANCE_DETAIL_1Y` |
| 離脱届-模板.xls | `IMMIGRATION_LEAVING_NOTICE` |
| 入管5割出席率不佳報告_模板.xlsx | `IMMIGRATION_LOW_ATTENDANCE_BELOW_50` |
| 資格外活動許可申請書_模板.xls | `VISA_WORK_PERMISSION_AT_LANDING` |
| 定期報告書/渋谷外語学院/受け入れ状況届出表.xls | `PERIODIC_ACCEPTANCE_STATUS_NOTIFICATION` |
| 定期報告書/渋谷外語学院/受け入れ状況在留者リスト.xls | `PERIODIC_ACCEPTANCE_RESIDENT_LIST` |
| 年度終了報告-模板/リスト.xlsx | `ANNUAL_COMPLETION_REQUIREMENT_LIST` |
| 年度終了報告-模板/報告様式.xlsx | `ANNUAL_COMPLETION_SUMMARY_REPORT` |
| 年度終了報告-模板/添付証明書1（45枚）.pdf | `ANNUAL_COMPLETION_ATTACHMENT_CERTIFICATES_1` |
| 年度終了報告-模板/添付証明書2（26枚）.pdf | `ANNUAL_COMPLETION_ATTACHMENT_CERTIFICATES_2` |
| 年度終了報告-模板/報告済みスクショ.png | `ANNUAL_COMPLETION_SUBMISSION_SCREENSHOT` |

## 6. Next Technical Step

To create exact field/cell mappings for the seven `.xls` templates:

1. Open each `.xls` in Excel or Numbers.
2. Save as `.xlsx`.
3. Provide the converted files.
4. Run cell inspection.
5. Create mapping tables like the low-attendance report mapping above.

Until conversion, the system can still register these templates by name and module, but automatic generation cannot be safely implemented.
