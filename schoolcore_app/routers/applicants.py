from __future__ import annotations
import json
import re
import uuid
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from auth import require_auth
from db import row, rows, connect, now_iso, new_id, write_audit, safe_serial

router = APIRouter()

REQUIRED_SECTIONS = [
    ("admission_plan",    "入学時期・語学学校滞在予定期間"),
    ("personal_info",     "個人情報"),
    ("education_history", "個人学歴"),
    ("application_history", "個人申請歴"),
    ("financial_sponsor", "経費支弁者情報"),
]

COE_MATERIALS = [
    ("application_form",    "願書"),
    ("photo",               "写真"),
    ("passport_copy",       "パスポートコピー"),
    ("residence_card_copy", "在留カードコピー"),
    ("certificate_of_enrollment", "在学証明書"),
    ("financial_statement", "経費支弁証明書"),
    ("bank_statement",      "銀行残高証明書"),
    ("academic_transcript", "成績証明書"),
]


def ensure_applicant_sections(cur, applicant_id: str) -> None:
    for key, label in REQUIRED_SECTIONS:
        cur.execute("""
            INSERT OR IGNORE INTO applicant_required_sections
            (id, applicant_id, section_key, label, completed, updated_at)
            VALUES (?,?,?,?,?,?)
        """, (new_id(), applicant_id, key, label, 1 if key == "admission_plan" else 0, now_iso()))


def applicant_sections(applicant_id: str) -> list:
    conn = connect()
    cur = conn.cursor()
    ensure_applicant_sections(cur, applicant_id)
    conn.commit()
    return [dict(r) for r in cur.execute("""
        SELECT section_key, label, completed, updated_at
        FROM applicant_required_sections
        WHERE applicant_id=? ORDER BY rowid
    """, (applicant_id,)).fetchall()]


def applicant_sections_complete(applicant_id: str) -> bool:
    sections = applicant_sections(applicant_id)
    return bool(sections) and all(s["completed"] for s in sections)


@router.get("/applicants")
async def list_applicants(auth=Depends(require_auth)):
    conn = connect()
    cur = conn.cursor()
    for a in cur.execute("SELECT id FROM applicants").fetchall():
        ensure_applicant_sections(cur, a["id"])
    conn.commit()
    return [dict(r) for r in cur.execute("""
        SELECT a.*,
          COALESCE((SELECT f.source_type FROM applicant_intake_forms f
                    WHERE f.applicant_id=a.id ORDER BY f.submitted_at DESC LIMIT 1), 'staff') AS source_type,
          EXISTS(SELECT 1 FROM generated_documents d
                 WHERE d.target_type='applicant' AND d.target_id=a.id
                   AND d.document_type='合格通知書') AS acceptance_notice_generated,
          EXISTS(SELECT 1 FROM coe_cases c WHERE c.applicant_id=a.id) AS coe_case_exists,
          (SELECT COUNT(*) FROM applicant_required_sections s
           WHERE s.applicant_id=a.id AND s.completed=1) AS required_complete_count,
          (SELECT COUNT(*) FROM applicant_required_sections s
           WHERE s.applicant_id=a.id) AS required_total_count
        FROM applicants a ORDER BY a.created_at DESC
    """).fetchall()]


class ApplicantCreate(BaseModel):
    name: str
    nationality: str
    admission_term: str
    desired_study_length: str
    agent_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""


@router.post("/applicants", status_code=201)
async def create_applicant(body: ApplicantCreate, auth=Depends(require_auth)):
    conn = connect()
    cur = conn.cursor()
    applicant_id = new_id()
    today = datetime.now().strftime("%Y%m")
    application_no = f"APP-{today}-{str(secrets.randbelow(99999)).zfill(5)}"
    cur.execute("""
        INSERT INTO applicants
        (id, application_no, name, nationality, admission_term, desired_study_length,
         agent_name, status, interview_result, application_fee_status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (applicant_id, application_no, body.name, body.nationality,
          body.admission_term, body.desired_study_length, body.agent_name or "",
          "面接申請", "未設定", "未入金", now_iso()))
    ensure_applicant_sections(cur, applicant_id)
    if body.email or body.phone:
        cur.execute("""
            INSERT INTO applicant_intake_forms
            (id, applicant_id, source_type, source_label, contact_email, contact_phone, payload_json, submitted_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (new_id(), applicant_id, "staff", "事務局登録",
              body.email or "", body.phone or "",
              json.dumps(body.model_dump(), ensure_ascii=False), now_iso()))
    write_audit(cur, "create", "applicant", applicant_id, f"出願者 {body.name} を作成しました。")
    conn.commit()
    return row("SELECT * FROM applicants WHERE id=?", (applicant_id,))


@router.get("/applicants/{applicant_id}/sections")
async def get_sections(applicant_id: str, auth=Depends(require_auth)):
    applicant = row("SELECT id FROM applicants WHERE id=?", (applicant_id,))
    if not applicant:
        raise HTTPException(404)
    return applicant_sections(applicant_id)


class SectionsUpdate(BaseModel):
    completed_sections: List[str] = []


@router.post("/applicants/{applicant_id}/sections")
async def update_sections(applicant_id: str, body: SectionsUpdate, auth=Depends(require_auth)):
    applicant = row("SELECT id FROM applicants WHERE id=?", (applicant_id,))
    if not applicant:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    ensure_applicant_sections(cur, applicant_id)
    for key, _ in REQUIRED_SECTIONS:
        cur.execute("""
            UPDATE applicant_required_sections
            SET completed=?, updated_at=?
            WHERE applicant_id=? AND section_key=?
        """, (1 if key in body.completed_sections else 0, now_iso(), applicant_id, key))
    write_audit(cur, "applicant.required_sections", "applicant", applicant_id,
                "面接申請の必須情報チェックを更新しました。")
    conn.commit()
    return applicant_sections(applicant_id)


@router.post("/applicants/{applicant_id}/application-fee", status_code=201)
async def create_application_fee(applicant_id: str, auth=Depends(require_auth)):
    applicant = row("SELECT * FROM applicants WHERE id=?", (applicant_id,))
    if not applicant:
        raise HTTPException(404)
    existing = row("SELECT * FROM payments WHERE applicant_id=? AND payment_type='選考料'", (applicant_id,))
    if existing:
        return existing
    conn = connect()
    cur = conn.cursor()
    payment_id = new_id()
    payer_display_name = applicant.get("agent_name") or applicant["name"]
    payer_type = "agent" if applicant.get("agent_name") else "student"
    cur.execute("""
        INSERT INTO payments
        (id, applicant_id, payment_type, amount, payer_type, payer_display_name,
         status, confirmed_at, receipt_issued, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (payment_id, applicant_id, "選考料", 20000, payer_type, payer_display_name,
          "confirmed", now_iso(), 0, now_iso()))
    cur.execute("UPDATE applicants SET application_fee_status='確認済', status='面接待ち' WHERE id=?",
                (applicant_id,))
    write_audit(cur, "payment.confirm", "applicant", applicant_id,
                f"選考料 20,000円を確認しました。")
    conn.commit()
    return row("SELECT * FROM payments WHERE id=?", (payment_id,))


class InterviewResult(BaseModel):
    result: str


@router.post("/applicants/{applicant_id}/interview-result")
async def set_interview_result(applicant_id: str, body: InterviewResult, auth=Depends(require_auth)):
    applicant = row("SELECT * FROM applicants WHERE id=?", (applicant_id,))
    if not applicant:
        raise HTTPException(404)
    allowed = {"合格", "保留", "再面接", "不合格"}
    if body.result not in allowed:
        raise HTTPException(422, detail={"error": {"code": "VALIDATION_ERROR",
                                                    "message": "面接結果が不正です。"}})
    status_map = {"合格": "合格通知待ち", "保留": "保留",
                  "再面接": "再面接待ち", "不合格": "不合格"}
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE applicants SET interview_result=?, status=? WHERE id=?",
                (body.result, status_map[body.result], applicant_id))
    write_audit(cur, "interview.result", "applicant", applicant_id,
                f"面接結果を {body.result} に更新しました。")
    conn.commit()
    return row("SELECT * FROM applicants WHERE id=?", (applicant_id,))


@router.post("/applicants/{applicant_id}/acceptance-notice", status_code=201)
async def generate_acceptance_notice(applicant_id: str, auth=Depends(require_auth)):
    applicant = row("SELECT * FROM applicants WHERE id=?", (applicant_id,))
    if not applicant:
        raise HTTPException(404)
    if applicant["interview_result"] != "合格":
        raise HTTPException(409, detail={"error": {"code": "INTERVIEW_NOT_PASSED",
                                                    "message": "面接結果が合格の場合のみ合格通知書を生成できます。"}})
    existing = row("""
        SELECT * FROM generated_documents
        WHERE target_type='applicant' AND target_id=? AND document_type='合格通知書'
    """, (applicant_id,))
    if existing:
        return existing
    conn = connect()
    cur = conn.cursor()
    document_id = new_id()
    document_no = f"AC-{safe_serial()}"
    cur.execute("""
        INSERT INTO generated_documents
        (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (document_id, "applicant", applicant_id, "合格通知書", document_no, "合格通知書", "generated", now_iso()))
    cur.execute("UPDATE applicants SET status='合格者' WHERE id=?", (applicant_id,))
    # 自动创建 COE 案件
    if not row("SELECT id FROM coe_cases WHERE applicant_id=?", (applicant_id,)):
        coe_id = new_id()
        cur.execute("""
            INSERT INTO coe_cases
            (id, applicant_id, stage, deadline, full_tuition_confirmed,
             receipt_issued, partial_coe_sent, full_coe_sent, ai_check_status, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (coe_id, applicant_id, "COE準備", "2026-06-20", 0, 0, 0, 0, "未実行", now_iso()))
        for key, label in COE_MATERIALS:
            cur.execute("""
                INSERT OR IGNORE INTO coe_materials
                (id, coe_case_id, material_key, label, collected, checked, updated_at)
                VALUES (?,?,?,?,?,?,?)
            """, (new_id(), coe_id, key, label, 0, 0, now_iso()))
    write_audit(cur, "document.generate", "applicant", applicant_id,
                f"合格通知書 {document_no} を生成しました。")
    conn.commit()
    return row("SELECT * FROM generated_documents WHERE id=?", (document_id,))


@router.get("/applicants/{applicant_id}/acceptance-preview")
async def acceptance_preview(applicant_id: str, auth=Depends(require_auth)):
    applicant = row("SELECT * FROM applicants WHERE id=?", (applicant_id,))
    if not applicant:
        raise HTTPException(404)
    template = row("SELECT * FROM acceptance_notice_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1")
    existing = row("""
        SELECT * FROM generated_documents
        WHERE target_type='applicant' AND target_id=? AND document_type='合格通知書'
    """, (applicant_id,))
    document_no = existing["document_no"] if existing else f"AC-{safe_serial()}"
    return {
        "template": template,
        "fields": {
            "document_no": document_no,
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "campus_name": template.get("campus_name") if template else "",
            "student_name": applicant["name"],
            "admission_term": applicant["admission_term"],
            "study_length": applicant["desired_study_length"],
            "agent_name": applicant.get("agent_name") or "",
            "message": f"{applicant['admission_term']} の入学を認めます。",
        },
    }
