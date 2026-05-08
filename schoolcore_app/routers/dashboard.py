from fastapi import APIRouter, Depends
from auth import require_auth
from db import row, rows, now_iso

router = APIRouter()

@router.get("/dashboard")
async def dashboard(auth=Depends(require_auth)):
    return {
        "applicant_count": row("SELECT COUNT(*) as c FROM applicants")["c"],
        "student_count":   row("SELECT COUNT(*) as c FROM students")["c"],
        "pending_receipts": row("SELECT COUNT(*) as c FROM payments WHERE status='confirmed' AND receipt_issued=0")["c"],
        "blocked_coe":     row("SELECT COUNT(*) as c FROM coe_cases WHERE full_tuition_confirmed=1 AND receipt_issued=0")["c"],
        "low_attendance":  row("SELECT COUNT(*) as c FROM students WHERE attendance_rate < 80 AND status='在籍'")["c"],
        "acceptance_notice_waiting": row("SELECT COUNT(*) as c FROM applicants WHERE status='合格通知待ち'")["c"],
        "coe_preparing":   row("SELECT COUNT(*) as c FROM coe_cases WHERE stage='COE準備'")["c"],
        "recent_audit":    rows("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10"),
        "expiring_soon":   rows("""
            SELECT id, student_no, name, nationality, class_name,
                   residence_expiry, attendance_rate,
                   CAST(julianday(residence_expiry) - julianday('now') AS INTEGER) AS days_left
            FROM students
            WHERE residence_expiry IS NOT NULL AND residence_expiry != ''
              AND CAST(julianday(residence_expiry) - julianday('now') AS INTEGER) <= 90
              AND status = '在籍'
            ORDER BY residence_expiry ASC LIMIT 10
        """),
        "recent_coe": rows("""
            SELECT c.*, a.name AS applicant_name, a.admission_term, a.agent_name
            FROM coe_cases c
            JOIN applicants a ON a.id = c.applicant_id
            ORDER BY c.deadline ASC LIMIT 8
        """),
    }


@router.get("/intake-summary")
async def intake_summary(auth=Depends(require_auth)):
    latest_batch = row("SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 1")
    return {
        "portal_url": "http://127.0.0.1:8765/apply",
        "portal_submissions": row("SELECT COUNT(*) as c FROM applicant_intake_forms WHERE source_type='student_portal'")["c"],
        "import_batches": row("SELECT COUNT(*) as c FROM import_batches")["c"],
        "latest_batch": latest_batch,
    }
