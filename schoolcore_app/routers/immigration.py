from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends
from auth import require_auth
from db import row, rows, now_iso

router = APIRouter()


def _semiannual_course_name(class_name: str) -> str:
    if class_name.startswith("A"):
        return "総合1年コース"
    return "総合2年コース"


def _default_period() -> str:
    today = datetime.now()
    return f"{today.year}年{'上期' if today.month <= 6 else '下期'}"


@router.get("/immigration-reports/semiannual-attendance")
async def semiannual_attendance_report(period: str = None, auth=Depends(require_auth)):
    report_period = period or _default_period()
    students = rows("""
        SELECT id, student_no, name, nationality, class_name, status,
               residence_card_no, residence_expiry, attendance_rate
        FROM students ORDER BY class_name ASC, student_no ASC
    """)
    for s in students:
        rate = float(s.get("attendance_rate") or 0)
        lesson_hours = 60.0
        s["attended_hours"] = round(lesson_hours * rate / 100, 1)
        s["lesson_hours"] = lesson_hours
        s["attendance_percent_display"] = f"{rate:.1f}"
        s["course_name"] = _semiannual_course_name(s.get("class_name") or "")

    low_attendance = [s for s in students if float(s.get("attendance_rate") or 0) < 80]
    avg = round(sum(float(s.get("attendance_rate") or 0) for s in students) / len(students), 1) if students else 0
    return {
        "summary": {
            "report_period": report_period,
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "student_count": len(students),
            "low_attendance_count": len(low_attendance),
            "average_attendance": avg,
            "status": "要確認" if low_attendance else "提出準備完了",
            "school_name": "渋谷外語学院",
            "operator_name": "知日株式会社",
        },
        "students": students,
        "low_attendance_students": low_attendance,
    }


@router.get("/immigration-reports/poor-attendance")
async def poor_attendance_report(auth=Depends(require_auth)):
    students = rows("""
        SELECT id, student_no, name, nationality, class_name, status,
               residence_expiry, attendance_rate
        FROM students ORDER BY attendance_rate ASC, student_no ASC
    """)
    targets = [s for s in students if float(s.get("attendance_rate") or 0) < 80]
    return {
        "summary": {
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "target_count": len(targets),
            "status": "要提出" if targets else "対象なし",
            "school_name": "渋谷外語学院",
            "enrolled_count": len(students),
        },
        "targets": targets,
    }


@router.get("/immigration-reports/residence-renewal")
async def residence_renewal_report(auth=Depends(require_auth)):
    today = datetime.now().date()
    students = rows("""
        SELECT id, student_no, name, nationality, class_name, status,
               residence_card_no, residence_expiry, attendance_rate
        FROM students ORDER BY residence_expiry ASC, student_no ASC
    """)
    targets = []
    for s in students:
        expiry_raw = s.get("residence_expiry") or ""
        if expiry_raw:
            try:
                expiry_date = datetime.strptime(expiry_raw, "%Y-%m-%d").date()
                days_left = (expiry_date - today).days
                if days_left <= 90:
                    targets.append({**s, "days_left": days_left})
            except ValueError:
                pass
    return {
        "summary": {
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "target_count": len(targets),
            "status": "要確認" if targets else "対象なし",
        },
        "targets": targets,
    }


@router.get("/immigration-reports/may-november")
async def may_november_report(period: str = None, auth=Depends(require_auth)):
    today = datetime.now()
    report_period = period or f"{today.year}年{'5月' if today.month <= 5 else '11月'}"
    students = rows("""
        SELECT id, student_no, name, nationality, class_name, status,
               residence_card_no, residence_expiry, attendance_rate
        FROM students ORDER BY class_name ASC, student_no ASC
    """)
    return {
        "summary": {
            "report_period": report_period,
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "student_count": len(students),
            "status": "提出準備完了",
        },
        "students": students,
    }


@router.get("/immigration-reports/annual-completion")
async def annual_completion_report(auth=Depends(require_auth)):
    advancements = rows("SELECT * FROM student_advancement_results ORDER BY completion_date ASC")
    employments  = rows("SELECT * FROM student_employment_results ORDER BY completion_date ASC")
    exams        = rows("SELECT * FROM student_exam_results ORDER BY completion_date ASC")
    withdrawals  = rows("SELECT * FROM student_withdrawal_outcomes ORDER BY completion_date ASC")
    all_students = {s["id"]: s for s in rows("SELECT id, name, class_name, residence_card_no FROM students")}

    entries = []
    idx = 1
    for item in advancements:
        s = all_students.get(item["student_id"], {})
        entries.append({"no": idx, "student_name": s.get("name",""), "requirement": "進学",
                        "destination": item["school_name"], "certificate_no": "",
                        "completion_date": item["completion_date"],
                        "course_name": _semiannual_course_name(s.get("class_name","")),
                        "category": "a", "is_qualifying": True, "is_withdrawal": False})
        idx += 1
    for item in employments:
        s = all_students.get(item["student_id"], {})
        entries.append({"no": idx, "student_name": s.get("name",""), "requirement": "就職",
                        "destination": item["company_name"], "certificate_no": "",
                        "completion_date": item["completion_date"],
                        "course_name": _semiannual_course_name(s.get("class_name","")),
                        "category": "b", "is_qualifying": True, "is_withdrawal": False})
        idx += 1
    for item in exams:
        s = all_students.get(item["student_id"], {})
        entries.append({"no": idx, "student_name": s.get("name",""), "requirement": "日本語教育の参照枠（試験）",
                        "destination": item["exam_name"], "certificate_no": item.get("certificate_no",""),
                        "completion_date": item["completion_date"],
                        "course_name": _semiannual_course_name(s.get("class_name","")),
                        "category": "c", "is_qualifying": True, "is_withdrawal": False,
                        "score_text": item.get("score_text","")})
        idx += 1

    total = len(advancements) + len(employments) + len(exams) + len(withdrawals)
    denominator = len(advancements) + len(employments) + len(exams)
    ratio = round(denominator / max(total, 1) * 100, 1)
    return {
        "summary": {
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "school_name": "渋谷外語学院",
            "ratio_display": f"{ratio:.1f}%",
            "completed_count": denominator,
            "qualifying_count": denominator,
            "withdrawal_count": len(withdrawals),
            "compliance_mark": "〇" if ratio >= 70 else "×",
            "status": "基準適合" if ratio >= 70 else "要確認",
        },
        "entries": entries,
    }


@router.get("/annual-results")
async def annual_results(auth=Depends(require_auth)):
    students = rows("SELECT id, student_no, name, class_name, status FROM students ORDER BY student_no ASC")
    student_map = {s["id"]: s for s in students}
    advancements = rows("SELECT * FROM student_advancement_results ORDER BY completion_date DESC")
    employments  = rows("SELECT * FROM student_employment_results ORDER BY completion_date DESC")
    exams        = rows("SELECT * FROM student_exam_results ORDER BY completion_date DESC")
    withdrawals  = rows("SELECT * FROM student_withdrawal_outcomes ORDER BY completion_date DESC")

    def enrich(items, result_type, title_key, detail_key=""):
        out = []
        for item in items:
            s = student_map.get(item["student_id"], {})
            out.append({
                "id": item["id"], "result_type": result_type,
                "student_id": item["student_id"],
                "student_no": s.get("student_no",""),
                "student_name": s.get("name",""),
                "class_name": s.get("class_name",""),
                "title": item.get(title_key,""),
                "detail": item.get(detail_key,"") if detail_key else "",
                "completion_date": item.get("completion_date",""),
                "note": item.get("note",""),
            })
        return out

    return {
        "summary": {"student_count": len(students),
                    "advancement_count": len(advancements),
                    "employment_count": len(employments),
                    "exam_count": len(exams),
                    "withdrawal_count": len(withdrawals)},
        "students": students,
        "advancement": enrich(advancements, "advancement", "school_name", "department_name"),
        "employment":  enrich(employments,  "employment",  "company_name", "job_title"),
        "exams":       enrich(exams,         "exam",        "exam_name", "score_text"),
        "withdrawals": enrich(withdrawals,   "withdrawal",  "destination", "outcome_type"),
    }
