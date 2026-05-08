# SchoolCore Figma Design Brief v1

## 1. Project Overview

SchoolCore is a modern SaaS-style school operations platform for institutions with many international students.

It supports:

- Japanese language schools
- Vocational schools
- Shared international student workflows

The product must handle:

- Web application
- Interview application
- Application fee
- Interview
- Acceptance notice
- COE preparation
- AI COE material check
- Immigration report generation
- Tuition payment and receipt
- COE release
- Arrival preparation
- Placement test
- Student enrollment
- Attendance
- Visa/residence management
- Certificates

## 2. Visual Direction

### Backend

Style:

- Modern SaaS
- Clean and premium
- Calm and formal
- Efficient for office staff and teachers

User feeling:

- Reliable
- Fast to scan
- Clear next actions
- Risk and deadlines are visible

Avoid:

- Overly decorative admin pages
- Dense dark enterprise UI
- Purple-heavy gradients
- Casual student-app feeling

### Student / Applicant Portal

Style:

- More polished than backend
- Formal and trustworthy
- Friendly but not casual
- Mobile-friendly
- Clear progress and document checklist

User feeling:

- This is an official school procedure.
- My documents are safely submitted.
- I know what I need to do next.

## 3. Design Targets

### Primary Backend Users

- Office staff
- Teachers handling attendance/placement
- COE and immigration staff
- Certificate issuing staff

### Student-Facing Users

- Applicants
- Accepted students
- Agents, if access is provided later
- Pre-arrival students

## 4. Information Architecture

### Backend Navigation

```text
Dashboard
Web出願
学生端 Preview
COE進行
学生管理
出席管理
在留管理
入管報告
証明書
テンプレート
設定
```

### Future Navigation

```text
入学手续
学費管理
進路管理
成績・単位
監査ログ
```

## 5. Required Figma Pages

Create these Figma pages:

1. Cover
2. Design System
3. Backend - Dashboard
4. Backend - COE Workflow
5. Backend - Applicant Detail
6. Backend - Student Detail
7. Backend - AI COE Check
8. Backend - Receipt Issue
9. Backend - Immigration Report
10. Backend - Certificate Issue
11. Student Portal
12. Mobile Student Portal
13. Components

## 6. Design System Requirements

### Color Tokens

Create semantic color tokens:

| Token | Usage |
|---|---|
| `brand.primary` | Main action, active nav |
| `brand.primaryDark` | Header/action emphasis |
| `surface.page` | App background |
| `surface.card` | Cards, modals |
| `surface.soft` | Subtle panels |
| `border.default` | Borders |
| `text.primary` | Main text |
| `text.secondary` | Muted text |
| `status.success` | Completed, safe |
| `status.warning` | Needs attention |
| `status.danger` | Error, deadline, blocked |
| `status.info` | In progress |

Recommended direction:

- Primary: deep teal / blue-green
- Neutral: cool gray
- Warning: amber
- Danger: red
- Info: cyan/blue
- Success: green

### Typography

Backend:

- Clear Japanese UI font
- Compact table text
- Strong but not oversized headings

Student portal:

- Larger section headings
- More whitespace
- Clear instructions

### Radius and Shadows

- Border radius: 8px or less
- Cards: subtle shadow
- Modals: stronger shadow
- Avoid large pill-like rounded corners

## 7. Core Components

Design these components as variants:

### Navigation

- Sidebar item: default / hover / active / disabled
- Sidebar with product logo

### Buttons

- Primary
- Secondary
- Warning
- Danger
- Ghost
- Disabled
- Loading

### Badges

- Success
- Warning
- Danger
- Info
- Neutral

Badge examples:

- `在学`
- `確認待ち`
- `未着手`
- `COE準備`
- `Error`
- `Warning`
- `OK`

### Cards

- KPI card
- Risk card
- Task card
- Document card
- Student summary card

### Tables

- Standard data table
- Dense student table
- Clickable row
- Empty state
- Warning row
- Error row

### Forms

- Text input
- Select
- Date input
- File upload
- Text area
- Required field marker
- Error state
- Warning state

### Workflow

- Horizontal stepper
- Pipeline step card
- Current step
- Completed step
- Blocked step

### Modal

- Standard form modal
- Document preview modal
- AI check result modal
- Confirmation modal

### Document Preview

- Receipt preview
- Certificate preview
- Acceptance notice preview

### Upload

- Upload tile
- Uploaded state
- Missing state
- Needs replacement state

## 8. Backend Page Specs

## 8.1 Dashboard

Purpose:

Daily work queue and risk overview for office staff.

Must show:

- Current enrolled students
- Visa expiry within 30 days
- Attendance below 50%
- Pending immigration reports
- Priority action list
- Recent operations

Primary actions:

- Create report
- Open student
- Open COE workflow
- Issue certificate

Design notes:

- Clear KPI row at top
- Cards should use subtle status color strips
- Staff should know what to handle today within 5 seconds

## 8.2 COE Workflow

Purpose:

Manage language school pre-enrollment COE pipeline.

Pipeline steps:

1. 面接申請
2. 报名费
3. 面接
4. 合格通知
5. COE準備
6. 入管提出
7. COE交付
8. 学費納入
9. 来日予定
10. 分班入学

Must show:

- Counts by stage
- Students currently in process
- Missing action per student
- Assigned staff
- Deadline
- AI COE check button
- Receipt issue button
- Immigration file generation button

Confirmed rules to reflect:

- Application fee is fixed.
- Receipt for agent-collected payment displays agent name.
- Interview statuses: 合格 / 保留 / 复试 / 不合格.
- COE deadline supports both intake-level and student-level deadlines.
- Before tuition payment, school sends partial COE screenshot.
- Full COE requires full tuition confirmation.

## 8.3 Applicant Detail

Purpose:

Single applicant profile from interview application to enrollment.

Tabs:

- Overview
- 面试申请表
- 报名费
- 面试
- 合格通知书
- COE申请
- 材料
- 学费/领收书
- 沟通记录
- 口语测试
- 学籍化

Overview must show:

- Applicant number
- Name
- Admission period
- Desired course
- Current status
- Assigned staff
- Next action
- Deadline
- Missing materials

## 8.4 Student Detail

Purpose:

Student master record after enrollment.

Tabs:

- Overview
- Basic Info
- Enrollment
- Visa / Passport
- Attendance
- Immigration Reports
- Certificates
- Files
- Status History
- Audit

Must show at top:

- Current status
- Course/class
- Residence expiry
- Latest attendance rate
- Missing documents
- Open reminders

## 8.5 AI COE Check

Purpose:

AI-assisted pre-submission review.

Must show:

- Check target documents
- Summary count: Error / Warning / OK
- Issue table
- Severity
- Field/document
- AI finding
- Suggested action
- Staff decision
- Confirm/dismiss controls

Important UX:

- Clearly state AI check is support, not final immigration judgment.
- Errors must feel blocking.
- Warnings must be easy to assign/resolve.

## 8.6 Receipt Issue

Purpose:

Issue receipt for application fee, tuition, partial payment, full payment, and agent-collected payment.

Must show:

- Student/applicant
- Payment type
- Amount
- Payment date
- Payment method
- Display name
- Agent name when relevant
- Receipt preview
- Issue button
- Void/reissue controls

Confirmed rules:

- Receipt is required for application fee, tuition, partial payment, and full payment.
- Receipt number generated by issue date and admission period.
- Agent-collected display shows agent name.
- Receipt can be voided/reissued.
- Full COE release requires full tuition confirmation.

## 8.7 Immigration Report

Purpose:

Create and submit immigration reports.

Must show:

- Report type
- Period
- Candidate students
- Validation errors
- Generated files
- Submission status
- Receipt/submission number

Report types:

- New student report
- Completion report
- Low attendance report
- Withdrawal/leaving report
- Half-year report
- May/November report
- Annual completion report

## 8.8 Certificate Issue

Purpose:

Issue certificates and keep issuance history.

Certificates:

- Enrollment certificate
- Attendance certificate
- Grade certificate
- Completion certificate
- Graduation certificate
- Expected graduation certificate

Must show:

- Student selector
- Certificate type
- Period
- Purpose
- Preview
- Certificate number
- Issuer/time
- Void/reissue controls

## 9. Student Portal Page Specs

## 9.1 Student Portal Home

Purpose:

Let student/applicant understand current process and required actions.

Must show:

- Current step
- Missing documents
- Next deadline
- School messages
- Procedure timeline
- Upload checklist
- Download area

Tone:

- Polite
- Clear
- Reassuring

Avoid:

- Internal staff terms
- Dense tables
- Too many status codes

## 9.2 Student Application Form

Purpose:

Replace Google Form with formal web application.

Sections:

1. Desired course/admission term
2. Basic identity
3. Contact information
4. Education history
5. Passport/visa history
6. Family/sponsor information
7. Japanese study history
8. Upload documents
9. Confirmation

Must include:

- Progress indicator
- Autosave state
- Required field indicators
- Upload checklist
- Final confirmation screen

## 9.3 Mobile Student Portal

Must support:

- Document upload from phone
- Status check
- Missing material list
- School messages
- Arrival date input
- Japan address/phone input

Mobile-first requirement:

- Student-facing pages must be designed mobile-first.
- Include mobile frames for both applicant/pre-arrival portal and enrolled-student portal.
- The primary mobile size is 390 x 844.
- Forms, upload areas, notices, certificate requests, attendance view, residence expiry view, and address/phone update must be designed for one-handed smartphone use where possible.
- Backend screens remain desktop-first.

## 10. Prototype Priority

Design first:

1. Backend Dashboard
2. COE Workflow
3. Applicant Detail
4. AI COE Check
5. Receipt Issue
6. Student Portal Home
7. Student Application Form

Design second:

1. Student Detail
2. Immigration Report
3. Certificate Issue
4. Template Management
5. Settings

## 11. Figma Frame Suggestions

Desktop backend:

- 1440 x 1024

Student portal desktop:

- 1440 x 1200

Student portal mobile:

- 390 x 844

Modal examples:

- 860 x auto
- 620 x auto

## 12. Current Local Prototype Reference

Reference HTML prototype:

- `schoolcore-demo.html`

Reference documents:

- `schoolcore-ui-guidelines-v1.md`
- `language-school-coe-workflow-v1.md`
- `schoolcore-mvp-spec-v1.md`
- `schoolcore-confirmation-log-v1.md`
