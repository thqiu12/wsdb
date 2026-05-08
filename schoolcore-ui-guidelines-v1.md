# SchoolCore UI Guidelines v1

## 1. Product UI Direction

SchoolCore should feel like:

- Modern SaaS
- Clean and premium
- Calm and formal enough for school operations
- Efficient for office staff and teachers
- Trustworthy for students and applicants

The system has two visual layers:

1. Staff/admin backend
2. Student/applicant frontend

They should share the same brand, but not look identical.

## 2. Backend UI Direction

### Target Users

Primary users:

- Office staff
- Teachers involved in attendance and placement
- Staff responsible for COE, immigration reports, certificates, and student records

### Visual Goal

The backend should prioritize:

- Speed
- Clarity
- Low visual noise
- Easy scanning
- Visible risk and task priority
- Strong auditability

### Style Keywords

- Clean
- Structured
- Calm
- Professional
- SaaS
- Operations-first

### Layout

Preferred:

- Left sidebar navigation
- Clear top page title
- Dashboard cards for risk overview
- Dense but readable tables
- Workflow pipeline for COE and reports
- Detail pages with tabs
- Action buttons close to the relevant data

Avoid:

- Overly decorative pages
- Too much marketing copy
- Large empty hero sections in backend
- Heavy gradients
- Low-contrast text
- Hidden critical actions

### Information Density

Backend should support medium-high density because office staff need to handle many students.

Rules:

- Tables should show enough fields for quick decisions.
- Alerts must be visible without opening many screens.
- Student detail should summarize important risks at the top.
- COE and immigration workflows should show current step and next required action.

## 3. Student / Applicant Frontend Direction

### Target Users

- Prospective students
- Agents
- Confirmed applicants
- Pre-enrollment students

### Visual Goal

The student-facing side should be more polished and reassuring than the backend.

It should communicate:

- This is an official school procedure.
- My application is being handled properly.
- I know what step I am in.
- I know which documents are missing.
- I can trust the school with my personal information.

### Style Keywords

- Formal
- Clear
- Reassuring
- International
- Friendly but not casual
- Mobile-friendly

### Mobile-First Rule

- Student-facing pages must be designed mobile-first.
- Applicant pages, pre-arrival pages, and enrolled-student pages should all work comfortably on a smartphone.
- Desktop student pages can reuse the same content with a wider layout, but smartphone is the primary target.
- Required actions such as document upload, missing document confirmation, receipt download, arrival date input, address/phone update, certificate request, and school notice confirmation must be easy on mobile.
- Staff backend remains desktop-first.

### Layout

Preferred:

- Guided step-by-step forms
- Progress indicator
- Clear required field labels
- Upload checklist
- Confirmation screen before submission
- Status page after submission
- Download area for notices and receipts

Avoid:

- Admin-like dense tables
- Too many internal status names
- Overly technical wording
- Confusing upload requirements

## 4. Visual System

### Color Direction

Use a professional multi-color palette:

- Deep teal or blue-green for primary action and brand
- Cool neutral backgrounds
- White surfaces
- Amber for warnings
- Red for critical issues
- Blue/cyan for process status
- Green for completed/safe status

Avoid:

- Purple-heavy gradients
- Dark navy/slate-dominated UI
- Beige/brown/orange-dominated UI
- One-color monochrome palette

### Components

Backend:

- Compact cards
- Data tables
- Badges
- Workflow steps
- Tabs
- Modal forms
- Validation panels

Student frontend:

- Stepper
- Large form sections
- Upload tiles
- Confirmation cards
- Status timeline
- Clear call-to-action buttons

### Buttons

Primary button:

- Used for save, generate, submit, issue

Secondary button:

- Used for edit, upload, export, preview

Warning button:

- Used for AI check, validation, overdue/risk workflows

Destructive button:

- Used only for void/cancel/delete and must require confirmation.

## 5. Tone and Copy

Product UI language:

- Japanese is the default and primary system language.
- Backend menus, statuses, buttons, alerts, forms, and student-facing pages should be written in Japanese.
- Chinese can remain in requirement documents or internal notes when useful, but not as the main product UI language.
- Student names, country names, and uploaded document content may appear in their original language.

Backend copy:

- Short
- Operational
- Status-oriented
- Japanese first

Student/applicant copy:

- Polite
- Reassuring
- Clear about required actions
- Avoid internal jargon

Examples:

- Backend: `AI COEチェック`
- Student: `提出前の確認を行っています`
- Backend: `不足: 経費支弁者収入証明`
- Student: `経費支弁者の収入証明をアップロードしてください`

## 6. Priority Pages for UI Quality

Highest priority:

1. COE workflow
2. Applicant/student detail
3. AI COE check result
4. Receipt generation
5. Student-facing application form
6. Immigration report detail
7. Certificate issue preview

## 7. Demo UI Next Steps

The static demo should evolve in this order:

1. Make backend cleaner and more SaaS-like.
2. Add student-facing application portal preview.
3. Improve COE workflow with task ownership and status visibility.
4. Improve AI COE check result with grouped issues and confirm/dismiss actions.
5. Improve receipt preview with formal document style.
6. Add mobile view for student application form.
