from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import require_auth
from db import row, rows, connect, now_iso, new_id, write_audit

router = APIRouter()


def enrich_student(item: dict) -> dict:
    today = datetime.now().date()
    alerts = []
    days_to_expiry = None
    expiry_raw = item.get("residence_expiry") or ""
    if expiry_raw:
        try:
            expiry_date = datetime.strptime(expiry_raw, "%Y-%m-%d").date()
            days_to_expiry = (expiry_date - today).days
            item["days_to_expiry"] = days_to_expiry
            if days_to_expiry <= 90:
                alerts.append(f"在留期限 {days_to_expiry}日")
        except ValueError:
            item["days_to_expiry"] = None
    else:
        item["days_to_expiry"] = None
    attendance = float(item.get("attendance_rate") or 0)
    if attendance < 80 and item.get("status") == "在籍":
        alerts.append("出席率注意")
    item["alerts"] = alerts
    item["alert_level"] = (
        "red"    if any("在留期限" in t and (item.get("days_to_expiry") or 999) <= 30 for t in alerts)
        else "yellow" if alerts else "green"
    )
    return item


@router.get("/students")
async def list_students(auth=Depends(require_auth)):
    items = rows("SELECT * FROM students ORDER BY student_no ASC, created_at ASC")
    return [enrich_student(i) for i in items]


@router.get("/students/{student_id}")
async def get_student(student_id: str, auth=Depends(require_auth)):
    student = row("SELECT * FROM students WHERE id=?", (student_id,))
    if not student:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND", "message": "学生が見つかりません。"}})
    student = enrich_student(student)
    attendance_recs = rows("""
        SELECT * FROM student_attendance_records
        WHERE student_id=? ORDER BY class_date DESC, created_at DESC LIMIT 20
    """, (student_id,))
    leave_reqs = rows("""
        SELECT * FROM student_leave_requests
        WHERE student_id=? ORDER BY request_date DESC LIMIT 20
    """, (student_id,))
    cert_reqs = rows("""
        SELECT cr.*, gd.document_no, ef.file_url
        FROM certificate_requests cr
        LEFT JOIN generated_documents gd ON gd.target_type='certificate_request' AND gd.target_id=cr.id
        LEFT JOIN export_files ef ON ef.export_key=('certificate:'||cr.id||':'||gd.document_no)
        WHERE cr.student_id=? ORDER BY cr.requested_at DESC
    """, (student_id,))
    exams = rows("""
        SELECT exam_name, score_text, certificate_no, completion_date, note
        FROM student_exam_results WHERE student_id=? ORDER BY completion_date DESC LIMIT 20
    """, (student_id,))
    grades = rows("""
        SELECT term_label, subject_name, score, grade, comment
        FROM student_grade_records WHERE student_id=? ORDER BY created_at DESC LIMIT 20
    """, (student_id,))
    consultations = rows("""
        SELECT * FROM student_consultation_records
        WHERE student_id=? ORDER BY meeting_date DESC LIMIT 20
    """, (student_id,))
    return {
        "student": student,
        "attendance": {
            "records": attendance_recs,
            "leave_requests": leave_reqs,
        },
        "certificate_requests": cert_reqs,
        "exam_results": exams,
        "grades": grades,
        "consultations": consultations,
    }


class StudentUpdate(BaseModel):
    student_no: str
    name: str
    nationality: str
    status: str
    class_name: Optional[str] = ""
    residence_card_no: Optional[str] = ""
    residence_expiry: Optional[str] = ""
    attendance_rate: Optional[float] = 0
    phone: Optional[str] = ""
    address_japan: Optional[str] = ""
    passport_no: Optional[str] = ""
    birth_date: Optional[str] = ""
    residence_status: Optional[str] = ""
    admission_date: Optional[str] = ""
    emergency_contact: Optional[str] = ""
    notes: Optional[str] = ""


@router.patch("/students/{student_id}")
async def update_student(student_id: str, body: StudentUpdate, auth=Depends(require_auth)):
    student = row("SELECT * FROM students WHERE id=?", (student_id,))
    if not student:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND", "message": "学生が見つかりません。"}})
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        UPDATE students
        SET student_no=?, name=?, nationality=?, status=?, class_name=?,
            residence_card_no=?, residence_expiry=?, attendance_rate=?, phone=?,
            address_japan=?, passport_no=?, birth_date=?, residence_status=?,
            admission_date=?, emergency_contact=?, notes=?
        WHERE id=?
    """, (
        body.student_no, body.name, body.nationality, body.status, body.class_name or "",
        body.residence_card_no or "", body.residence_expiry or "", body.attendance_rate or 0,
        body.phone or "", body.address_japan or "", body.passport_no or "",
        body.birth_date or "", body.residence_status or "", body.admission_date or "",
        body.emergency_contact or "", body.notes or "", student_id,
    ))
    write_audit(cur, "student.update", "student", student_id, f"学生 {body.name} を更新しました。")
    conn.commit()
    updated = row("SELECT * FROM students WHERE id=?", (student_id,))
    return enrich_student(updated)


@router.get("/students/{student_id}/withdrawal-preview")
async def withdrawal_preview(student_id: str, auth=Depends(require_auth)):
    student = row("SELECT * FROM students WHERE id=?", (student_id,))
    if not student:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND", "message": "学生が見つかりません。"}})
    template = row("SELECT * FROM withdrawal_report_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1")
    existing = row("""
        SELECT * FROM generated_documents
        WHERE target_type='student' AND target_id=? AND document_type='離脱届'
    """, (student_id,))
    from db import safe_serial
    document_no = existing["document_no"] if existing else f"WD-{safe_serial()}"
    return {
        "template": template,
        "fields": {
            "document_no": document_no,
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "school_name": template.get("school_name") if template else "",
            "student_no": student["student_no"],
            "student_name": student["name"],
            "nationality": student["nationality"],
            "class_name": student.get("class_name") or "",
            "residence_card_no": student.get("residence_card_no") or "",
            "residence_expiry": student.get("residence_expiry") or "",
            "reason": "退学のため",
        },
    }
