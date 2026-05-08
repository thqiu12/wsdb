#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from datetime import datetime

VENDOR = Path(__file__).resolve().parent / "_vendor"
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

import xlrd
from xlutils.copy import copy as copy_workbook


def format_birth_date(value: str) -> str:
    if not value:
        return ""
    return value.replace("-", "/")


def split_date(value: str) -> tuple[str, str, str]:
    if not value:
        return "", "", ""
    normalized = value.replace("-", "/")
    try:
        dt = datetime.strptime(normalized, "%Y/%m/%d")
        return str(dt.year), f"{dt.month:02d}", f"{dt.day:02d}"
    except ValueError:
        parts = normalized.split("/")
        if len(parts) == 3:
            return parts[0], parts[1], parts[2]
        return "", "", ""


def write_may_november_report(payload: dict) -> None:
    template_path = Path(payload["templatePath"])
    output_path = Path(payload["outputPath"])
    fields = payload.get("fields", {})
    students = fields.get("students", [])

    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    writable = copy_workbook(book)
    sheet = writable.get_sheet(0)

    sheet.write(0, 2, fields.get("school_name", ""))

    for row_idx in range(4, 104):
        for col_idx in range(8):
            sheet.write(row_idx, col_idx, "")

    for index, item in enumerate(students[:100], start=1):
        row = 3 + index
        sheet.write(row, 0, index)
        sheet.write(row, 1, item.get("nationality", ""))
        sheet.write(row, 2, item.get("name", ""))
        sheet.write(row, 3, item.get("gender", ""))
        sheet.write(row, 4, format_birth_date(item.get("birth_date", "")))
        sheet.write(row, 5, item.get("address_in_japan", ""))
        sheet.write(row, 6, item.get("residence_card_no", ""))
        sheet.write(row, 7, item.get("activity_details", ""))

    writable.save(str(output_path))


def write_residence_renewal_list(payload: dict) -> None:
    template_path = Path(payload["templatePath"])
    output_path = Path(payload["outputPath"])
    fields = payload.get("fields", {})
    targets = fields.get("targets", [])

    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    writable = copy_workbook(book)

    for sheet_index in range(book.nsheets):
        sheet = writable.get_sheet(sheet_index)
        original = book.sheet_by_index(sheet_index)

        sheet.write(5, 15, f"学校名  {fields.get('school_name', '')}")
        sheet.write(6, 15, f"TEL      {fields.get('phone', '')}")
        sheet.write(7, 15, f"申請取次者氏名  {fields.get('agent_name', '')}")
        sheet.write(5, 5, fields.get("issue_date", ""))
        sheet.write(6, 5, fields.get("issue_date", ""))

        for slot in range(7):
            target_index = sheet_index * 7 + slot
            row = 13 + slot * 4
            if target_index >= len(targets):
                for offset in range(4):
                    for col in range(4, 13):
                        sheet.write(row + offset, col, "")
                continue

            item = targets[target_index]
            sheet.write(row, 4, target_index + 1)
            sheet.write(row, 5, f"①　{item.get('nationality', '')}")
            sheet.write(row + 1, 5, f"②　{item.get('name', '')}")
            sheet.write(row + 2, 5, "③")
            sheet.write(row + 2, 7, "■" if item.get("gender") == "男" else "□")
            sheet.write(row + 2, 9, "■" if item.get("gender") == "女" else "□")
            sheet.write(row + 3, 5, "④")
            sheet.write(row + 3, 6, f"{item.get('birth_date', '')}生" if item.get("birth_date") else "")

            sheet.write(row, 11, f"①　{item.get('period_display', '')}")
            sheet.write(row + 1, 11, "")
            sheet.write(row + 2, 11, f"②　{item.get('attendance_days_display', '')}")
            sheet.write(row + 3, 11, f"③　{item.get('attendance_hours_display', '')}")

        if sheet_index > ((len(targets) - 1) // 7 if targets else 0):
            for row in range(13, original.nrows):
                for col in range(4, min(13, original.ncols)):
                    sheet.write(row, col, "")

    writable.save(str(output_path))


def write_residence_renewal_form(payload: dict) -> None:
    template_path = Path(payload["templatePath"])
    output_path = Path(payload["outputPath"])
    f = payload.get("fields", {})

    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    writable = copy_workbook(book)

    birth_y, birth_m, birth_d = split_date(f.get("birth_date", ""))
    pass_y, pass_m, pass_d = split_date(f.get("passport_expiry", ""))
    exp_y, exp_m, exp_d = split_date(f.get("residence_expiry", ""))
    grad_y, grad_m, _ = split_date(f.get("graduation_date", ""))
    admit_y, admit_m, admit_d = split_date(f.get("admission_date", ""))
    issue_y, issue_m, issue_d = split_date(f.get("issue_date", ""))
    corp_no = list((f.get("corporation_no", "") + " " * 13)[:13])

    sheet = writable.get_sheet(0)
    sheet.write(14, 6, f.get("nationality", ""))
    sheet.write(14, 22, birth_y)
    sheet.write(14, 28, birth_m)
    sheet.write(14, 32, birth_d)
    sheet.write(17, 6, f.get("student_name", ""))
    sheet.write(20, 4, "男" if f.get("gender") == "男" else "")
    sheet.write(20, 6, "女" if f.get("gender") == "女" else "")
    sheet.write(23, 4, f.get("occupation", ""))
    sheet.write(23, 20, f.get("home_address", ""))
    sheet.write(26, 6, f.get("address_in_japan", ""))
    sheet.write(29, 6, f.get("phone", ""))
    sheet.write(29, 24, f.get("mobile_phone", ""))
    sheet.write(32, 8, f.get("passport_no", ""))
    sheet.write(32, 23, pass_y)
    sheet.write(32, 29, pass_m)
    sheet.write(32, 33, pass_d)
    sheet.write(35, 8, f.get("current_status", ""))
    sheet.write(35, 25, f.get("current_period_text", ""))
    sheet.write(38, 8, exp_y)
    sheet.write(38, 14, exp_m)
    sheet.write(38, 18, exp_d)
    sheet.write(41, 8, f.get("residence_card_no", ""))
    sheet.write(44, 8, f.get("desired_period", ""))
    sheet.write(47, 8, f.get("reason", ""))

    sheet = writable.get_sheet(1)
    sheet.write(4, 6, f.get("school_name", ""))
    sheet.write(7, 5, f.get("school_address", ""))
    sheet.write(7, 24, f.get("school_phone", ""))
    sheet.write(22, 7, f.get("last_school_name", ""))
    sheet.write(22, 23, grad_y)
    sheet.write(22, 28, grad_m.lstrip("0") or grad_m)
    sheet.write(56, 18, "■")
    sheet.write(56, 26, f.get("support_amount", ""))
    sheet.write(66, 18, "■")
    sheet.write(66, 26, f.get("remittance_amount", ""))

    sheet = writable.get_sheet(2)
    sheet.write(28, 28, f.get("activity_permission", ""))
    if f.get("plan_after_graduation") == "日本での進学":
        sheet.write(44, 12, "■")
        sheet.write(47, 1, "□")
    else:
        sheet.write(44, 12, "□")
        sheet.write(47, 1, "■")

    sheet = writable.get_sheet(3)
    sheet.write(5, 4, f.get("student_name", ""))
    sheet.write(5, 25, f.get("residence_card_no", ""))
    sheet.write(9, 6, f.get("school_name", ""))
    sheet.write(12, 6, f.get("school_address", ""))
    sheet.write(15, 6, f.get("school_phone", ""))
    sheet.write(18, 6, f.get("corporation_name", ""))
    for idx, char in enumerate(corp_no, start=14):
        sheet.write(21, idx, char.strip())
    sheet.write(45, 8, admit_y)
    sheet.write(45, 14, admit_m)
    sheet.write(45, 18, admit_d)
    sheet.write(48, 13, f.get("weekly_hours", ""))

    sheet = writable.get_sheet(4)
    sheet.write(47, 1, f"{f.get('school_name', '')}　{f.get('representative_name', '')}")
    sheet.write(47, 27, issue_y)
    sheet.write(47, 31, issue_m)
    sheet.write(47, 35, issue_d)

    writable.save(str(output_path))


def write_semiannual_attendance_report(payload: dict) -> None:
    template_path = Path(payload["templatePath"])
    output_path = Path(payload["outputPath"])
    f = payload.get("fields", {})
    course_summaries = f.get("course_summaries", [])
    totals = f.get("summary_totals", {})

    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    writable = copy_workbook(book)
    sheet = writable.get_sheet(0)

    sheet.write(2, 5, f.get("issue_date", ""))
    sheet.write(2, 16, f.get("school_year", ""))
    sheet.write(3, 0, f"日本語教育機関名：{f.get('school_name', '')}")
    sheet.write(4, 0, f"設置者名：{f.get('operator_name', '')}")
    sheet.write(5, 0, f"担当者氏名：{f.get('staff_name', '')}")
    sheet.write(6, 0, f"電話番号：{f.get('phone', '')}")

    row_starts = [10, 14]
    for idx, row in enumerate(row_starts):
        course = course_summaries[idx] if idx < len(course_summaries) else None
        sheet.write(row, 0, str(course.get("no", "")) if course else "")
        sheet.write(row, 4, course.get("course_name", "") if course else "")
        sheet.write(row, 8, course.get("total_lesson_hours", "") if course else "")
        sheet.write(row, 12, course.get("required_hours", "") if course else "")
        sheet.write(row, 16, course.get("attended_hours", "") if course else "")

    sheet.write(18, 12, totals.get("required_hours", ""))
    sheet.write(18, 16, totals.get("attended_hours", ""))

    writable.save(str(output_path))


def write_semiannual_attendance_detail(payload: dict) -> None:
    template_path = Path(payload["templatePath"])
    output_path = Path(payload["outputPath"])
    f = payload.get("fields", {})
    students = f.get("students", [])

    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    writable = copy_workbook(book)
    sheet = writable.get_sheet(0)

    sheet.write(1, 0, f.get("school_name", ""))

    for row in range(3, 90):
        for col in [0, 4, 8, 12, 16]:
            sheet.write(row, col, "")

    for index, item in enumerate(students[:29], start=1):
        row = 3 + (index - 1) * 3
        sheet.write(row, 0, index)
        sheet.write(row, 4, item.get("name", ""))
        sheet.write(row, 8, item.get("student_no", ""))
        sheet.write(row, 12, item.get("residence_card_no", ""))
        sheet.write(row, 16, item.get("attended_hours", ""))
        sheet.write(row + 1, 16, item.get("lesson_hours", ""))
        sheet.write(row + 2, 16, item.get("attendance_percent_display", ""))

    writable.save(str(output_path))


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("payload path required")
    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    document_type = payload.get("documentType", "")
    if document_type == "may_november_report":
        write_may_november_report(payload)
    elif document_type == "residence_renewal_report":
        write_residence_renewal_list(payload)
    elif document_type == "residence_renewal_form":
        write_residence_renewal_form(payload)
    elif document_type == "semiannual_attendance_report":
        write_semiannual_attendance_report(payload)
    elif document_type == "semiannual_attendance_detail":
        write_semiannual_attendance_detail(payload)
    else:
        raise SystemExit(f"unsupported xls document type: {document_type}")
    print(payload["outputPath"])


if __name__ == "__main__":
    main()
