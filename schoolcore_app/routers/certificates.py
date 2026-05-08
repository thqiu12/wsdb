from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import require_auth
from db import row, rows, connect, now_iso, new_id, write_audit, safe_serial

router = APIRouter()


@router.get("/certificate-requests")
async def list_certificate_requests(auth=Depends(require_auth)):
    items = rows("""
        SELECT cr.*, s.student_no, s.name AS student_name, s.class_name, s.status AS student_status
        FROM certificate_requests cr
        LEFT JOIN students s ON s.id = cr.student_id
        ORDER BY cr.requested_at DESC, cr.created_at DESC
    """)
    return {
        "summary": {
            "total_count": len(items),
            "requested_count": sum(1 for i in items if i["status"] == "申請中"),
            "approved_count": sum(1 for i in items if i["status"] == "承認済"),
            "issued_count": sum(1 for i in items if i["status"] == "発行済"),
        },
        "items": items,
    }


class CertificateRequest(BaseModel):
    student_id: str
    certificate_type: str
    purpose: Optional[str] = ""
    copies: Optional[int] = 1
    requested_by: Optional[str] = "staff"


@router.post("/certificate-requests", status_code=201)
async def create_certificate_request(body: CertificateRequest, auth=Depends(require_auth)):
    student = row("SELECT id FROM students WHERE id=?", (body.student_id,))
    if not student:
        raise HTTPException(404)
    allowed = {"出席率証明書", "成績証明書", "修了証明書"}
    if body.certificate_type not in allowed:
        raise HTTPException(422, detail={"error": {"code": "VALIDATION_ERROR",
                                                    "message": "証明書種別が不正です。"}})
    copies = max(1, min(10, body.copies or 1))
    conn = connect()
    cur = conn.cursor()
    request_id = new_id()
    cur.execute("""
        INSERT INTO certificate_requests
        (id, student_id, certificate_type, copies, purpose, requested_by,
         status, issued_by, requested_at, approved_at, issued_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, (request_id, body.student_id, body.certificate_type, copies,
          body.purpose or "", body.requested_by or "staff",
          "申請中", "", now_iso(), None, None, now_iso()))
    write_audit(cur, "certificate.request", "student", body.student_id,
                f"{body.certificate_type} の申請を受け付けました。")
    conn.commit()
    return row("SELECT * FROM certificate_requests WHERE id=?", (request_id,))


@router.post("/certificate-requests/{request_id}/approve")
async def approve_certificate_request(request_id: str, auth=Depends(require_auth)):
    req = row("SELECT * FROM certificate_requests WHERE id=?", (request_id,))
    if not req:
        raise HTTPException(404)
    if req["status"] != "申請中":
        raise HTTPException(409, detail={"error": {"code": "STATUS_INVALID",
                                                    "message": "申請中の証明書のみ承認できます。"}})
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE certificate_requests SET status='承認済', approved_at=?, issued_by=? WHERE id=?",
                (now_iso(), "事務局 山田", request_id))
    write_audit(cur, "certificate.approve", "student", req["student_id"],
                f"{req['certificate_type']} を承認しました。")
    conn.commit()
    return row("SELECT * FROM certificate_requests WHERE id=?", (request_id,))


@router.post("/certificate-requests/{request_id}/issue")
async def issue_certificate_request(request_id: str, auth=Depends(require_auth)):
    req = row("SELECT * FROM certificate_requests WHERE id=?", (request_id,))
    if not req:
        raise HTTPException(404)
    if req["status"] not in {"承認済", "発行済"}:
        raise HTTPException(409, detail={"error": {"code": "STATUS_INVALID",
                                                    "message": "承認済みの証明書のみ発行できます。"}})
    existing = row("""
        SELECT * FROM generated_documents
        WHERE target_type='certificate_request' AND target_id=?
    """, (request_id,))
    if existing:
        return {"ok": True, "document": existing}
    conn = connect()
    cur = conn.cursor()
    document_id = new_id()
    document_no = f"CERT-{safe_serial()}"
    cur.execute("""
        INSERT INTO generated_documents
        (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (document_id, "certificate_request", request_id,
          req["certificate_type"], document_no, req["certificate_type"], "generated", now_iso()))
    cur.execute("UPDATE certificate_requests SET status='発行済', issued_at=?, issued_by=? WHERE id=?",
                (now_iso(), "事務局 山田", request_id))
    write_audit(cur, "certificate.issue", "student", req["student_id"],
                f"{req['certificate_type']} {document_no} を発行しました。")
    conn.commit()
    return {"ok": True, "document": row("SELECT * FROM generated_documents WHERE id=?", (document_id,))}
