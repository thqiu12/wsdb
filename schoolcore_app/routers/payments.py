from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth
from db import row, rows, connect, now_iso, new_id, write_audit, safe_serial

router = APIRouter()


@router.get("/payments")
async def list_payments(auth=Depends(require_auth)):
    return rows("""
        SELECT p.*, a.name AS applicant_name, a.admission_term, a.agent_name,
               rd.receipt_no AS receipt_doc_no, rd.issue_date AS receipt_issue_date,
               rd.status AS receipt_status
        FROM payments p
        LEFT JOIN applicants a ON a.id = p.applicant_id
        LEFT JOIN receipt_documents rd ON rd.payment_id = p.id AND rd.status='issued'
        ORDER BY p.created_at DESC
    """)


@router.post("/payments/{payment_id}/receipt")
async def issue_receipt(payment_id: str, auth=Depends(require_auth)):
    payment = row("""
        SELECT p.*, a.admission_term
        FROM payments p
        LEFT JOIN applicants a ON a.id = p.applicant_id
        WHERE p.id=?
    """, (payment_id,))
    if not payment:
        raise HTTPException(404)
    if payment["status"] != "confirmed":
        raise HTTPException(409, detail={"error": {"code": "PAYMENT_NOT_CONFIRMED",
                                                    "message": "入金確認後に領収書を発行できます。"}})
    if payment["receipt_issued"]:
        raise HTTPException(409, detail={"error": {"code": "RECEIPT_ALREADY_ISSUED",
                                                    "message": "この入金には既に領収書が発行されています。"}})
    number = f"RC-{safe_serial()}"
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE payments SET receipt_issued=1, receipt_no=? WHERE id=?",
                (number, payment_id))
    template = cur.execute("SELECT * FROM receipt_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1").fetchone()
    student_name = payment.get("applicant_name") or payment.get("payer_display_name") or ""
    cur.execute("""
        INSERT INTO receipt_documents
        (id, payment_id, template_id, receipt_no, issue_date, payer_display_name,
         student_name, admission_term, payment_type, amount, line_note, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        new_id(), payment_id,
        template["id"] if template else None,
        number,
        datetime.now().strftime("%Y-%m-%d"),
        payment["payer_display_name"],
        student_name,
        payment.get("admission_term") or "",
        payment["payment_type"],
        payment["amount"],
        f"{payment['payment_type']}として領収しました。",
        "issued", now_iso(),
    ))
    if payment["payment_type"] == "学費全額" and payment.get("applicant_id"):
        cur.execute("UPDATE coe_cases SET receipt_issued=1, updated_at=? WHERE applicant_id=?",
                    (now_iso(), payment["applicant_id"]))
    write_audit(cur, "receipt.issue", "payment", payment_id,
                f"領収書 {number} を発行しました。")
    conn.commit()
    return {"receipt_no": number,
            "payment": row("SELECT * FROM payments WHERE id=?", (payment_id,))}


@router.get("/payments/{payment_id}/receipt-preview")
async def receipt_preview(payment_id: str, auth=Depends(require_auth)):
    payment = row("""
        SELECT p.*, a.admission_term, a.name AS applicant_name
        FROM payments p
        LEFT JOIN applicants a ON a.id = p.applicant_id
        WHERE p.id=?
    """, (payment_id,))
    if not payment:
        raise HTTPException(404)
    template = row("SELECT * FROM receipt_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1")
    student_name = payment.get("applicant_name") or payment.get("payer_display_name") or ""
    payer_name = payment.get("payer_display_name") or student_name
    return {
        "template": template,
        "fields": {
            "receipt_no": payment.get("receipt_no") or f"RC-{safe_serial()}",
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "campus_name": template.get("campus_name") if template else "",
            "student_name": student_name,
            "payer_display_name": payer_name,
            "admission_term": payment.get("admission_term") or "",
            "payment_type": payment.get("payment_type") or "",
            "amount": payment.get("amount") or 0,
            "line_note": f"{payment.get('payment_type') or '入金'}として領収しました。",
        },
    }


@router.get("/receipt-config")
async def receipt_config(auth=Depends(require_auth)):
    template = row("SELECT * FROM receipt_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1")
    return {
        "active_template": template,
        "template_count": row("SELECT COUNT(*) as c FROM receipt_templates")["c"],
        "issued_count": row("SELECT COUNT(*) as c FROM receipt_documents WHERE status='issued'")["c"],
    }
