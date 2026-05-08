# SchoolCore Data Migration Plan v1

## 1. Current Situation

Existing data is stored in another system.

Confirmed:

- The old system can export Excel files.
- Sample export reviewed: `WSDB Data export.xlsx`.
- The sample can be used as the first `Student Master Import` source.

Migration strategy:

```text
Old system Excel export
  -> Field mapping
  -> Data cleaning
  -> Validation
  -> Trial import
  -> Staff review
  -> Final import
  -> Post-import audit
```

## 2. Migration Goals

The migration should bring historical and current school data into SchoolCore without losing traceability.

Main goals:

- Create correct person/student records
- Preserve student numbers
- Import visa/residence/passport data
- Import current status
- Import course/class/enrollment data
- Import attendance summaries if available
- Import file references if available
- Keep original Excel files as source evidence
- Produce import error reports for staff review

## 3. Data Sources

Expected Excel exports from old system:

| Source | Required | Notes |
|---|---|---|
| Student master list | Yes | Core identity and school info |
| Address/contact list | Yes | Japan address, home address, phone, email |
| Residence card / visa list | Yes | Card number, status, expiry |
| Passport list | Yes | Passport number, expiry |
| Course/class list | Yes | Current course/class |
| Status history | Recommended | Withdrawal, graduation, leave history |
| Attendance summary | Recommended | Monthly rates if old records exist |
| Attendance detail | Optional | Large volume, import if needed |
| Certificate history | Optional | Past issued certificates |
| Immigration report history | Optional | Past submissions |
| Payment/receipt data | Optional | If old system has it |
| File archive list | Optional | If files can be exported |

## 4. Import Phases

### Phase 1: Sample Export Review

Input:

- One or more Excel exports from the old system

Tasks:

- Inspect sheets and columns
- Identify unique student key
- Identify required fields
- Identify date formats
- Identify code values/status names
- Identify missing/dirty data patterns

Output:

- Field mapping table
- Data issue list
- Import template draft

### Phase 2: Mapping Definition

Define how old system columns map to SchoolCore.

Example:

| Old Excel Column | SchoolCore Field |
|---|---|
| 学生番号 | students.student_number |
| 氏名 | persons.full_name |
| カナ | persons.full_name_kana |
| 生年月日 | persons.birth_date |
| 国籍 | persons.nationality |
| 性別 | persons.gender |
| 日本住所 | addresses.japan |
| 電話番号 | persons.phone |
| メール | persons.email |
| 在留カード番号 | residence_cards.card_number |
| 在留資格 | residence_cards.residence_status |
| 在留期限 | residence_cards.expiry_date |
| 旅券番号 | passports.passport_number |
| 旅券有効期限 | passports.expiry_date |
| コース | courses.name |
| クラス | classes.name |
| 状態 | students.current_status |
| 入学日 | students.admission_date |
| 卒業予定日 | students.expected_graduation_date |

### Phase 3: Trial Import

Use a copied/staging database.

Trial import should:

- Import a small sample first
- Validate field conversions
- Show duplicate candidates
- Show missing required data
- Show invalid dates
- Show unmatched courses/classes/statuses

Output:

- Trial import result
- Error report
- Warning report
- Data correction list

### Phase 4: Staff Review

Office staff reviews:

- Duplicate students
- Missing residence info
- Invalid address
- Unknown status
- Unmatched class/course
- Expired visa/passport

Staff decisions are recorded:

- Import as-is
- Correct and import
- Skip
- Merge with existing record

### Phase 5: Final Import

Final import should:

- Lock old export files as source
- Import into production
- Generate import log
- Generate imported record count
- Generate skipped/error record list

### Phase 6: Post-Import Audit

After import:

- Compare old record count vs imported count
- Check random sample of records
- Check all active students
- Check visa expiry list
- Check class rosters
- Check low-attendance candidates, if attendance data was imported

## 5. Duplicate Detection

Suggested duplicate matching rules:

Priority 1:

- Same student number

Priority 2:

- Same residence card number

Priority 3:

- Same passport number

Priority 4:

- Same name + birth date + nationality

Possible duplicate actions:

- Merge into existing person
- Create new student record under same person
- Skip import row
- Import as new person after staff confirmation

## 6. Status Mapping

Old system status values must be mapped to SchoolCore statuses.

Example:

| Old Status | SchoolCore Status |
|---|---|
| 在学 | enrolled |
| 入学前 | pre_enrollment |
| 休学 | leave_of_absence |
| 退学 | withdrawn |
| 除籍 | expelled |
| 所在不明 | missing |
| 卒業 | graduated |
| 修了 | completed |
| 転校 | transferred |
| 帰国 | returned_home |
| 取消 | cancelled |

Unknown values should not be silently imported. They should be listed in the warning report.

## 7. Date Handling

Migration must normalize:

- yyyy/mm/dd
- yyyy-mm-dd
- Japanese era dates, if any
- Excel serial dates
- Text dates
- Empty values

Invalid dates should be flagged.

Important date fields:

- Birth date
- Admission date
- Expected graduation date
- Actual graduation date
- Residence expiry
- Passport expiry
- Withdrawal/leaving date

## 8. Required Validation

### Error

Import row should be blocked when:

- Student number duplicated without merge decision
- Name missing
- Birth date invalid
- Current status unknown
- Residence expiry invalid for active international student
- Course/class cannot be mapped when required

### Warning

Import row can proceed with warning when:

- Japanese address missing
- Phone missing
- Email missing
- Passport missing
- Residence card number missing
- Passport expired
- Residence card expired
- Class missing for non-active student

## 9. File Migration

If the old system can export files:

Preferred:

- Export file list with student number and file category
- Export actual files in folder structure
- Import file metadata and copy files into SchoolCore storage

Required mapping:

| File Type | SchoolCore Category |
|---|---|
| Passport | passport |
| Residence card front | residence_card_front |
| Residence card back | residence_card_back |
| Student photo | student_photo |
| Certificate | certificate |
| Immigration report | immigration_report |
| COE | coe |
| Receipt | receipt |
| Other | other |

If files cannot be exported:

- Import only file metadata if available.
- Keep old system/archive accessible during transition.

## 10. Migration Tools Needed

SchoolCore should provide:

- Excel upload for import
- Mapping preview
- Validation preview
- Duplicate candidate list
- Import result report
- Downloadable error Excel
- Import batch history
- Rollback for failed batch, before staff confirmation

## 11. Import Batch Record

Each import batch should store:

- Batch id
- Source file
- Import type
- Uploaded by
- Uploaded at
- Total rows
- Imported rows
- Skipped rows
- Error rows
- Warning rows
- Status
- Validation report file

## 12. UI Requirements

### Data Migration Page

Steps:

1. Upload Excel
2. Select import type
3. Map columns
4. Preview validation
5. Resolve duplicates
6. Import
7. Download result report

### Validation Result UI

Must show:

- Errors
- Warnings
- Duplicate candidates
- Unmatched values
- Sample rows

### Migration History

Must show:

- Past import batches
- Source file
- Result count
- Operator
- Date/time
- Downloadable reports

## 13. Next Confirmation Needed

Need to confirm from old system:

1. What Excel files can be exported?
2. Are exports separated by module or one full workbook?
3. Does each row have student number?
4. Can residence card/passport data be exported?
5. Can attendance history be exported?
6. Can file attachments be exported?
7. Can certificate/immigration report history be exported?
8. What are the exact status names in the old system?
9. Are there multiple schools/campuses in one export?
10. Are there historical students in the same export as active students?
