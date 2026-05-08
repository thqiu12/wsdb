from __future__ import annotations
import json
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import row, rows, connect, now_iso, new_id, write_audit, hash_password, verify_password

router = APIRouter()


def _issue_session(student_id: str) -> str:
    conn = connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM student_portal_sessions WHERE student_id=?", (student_id,))
    token = secrets.token_urlsafe(32)
    now = datetime.now()
    expires = now.replace(hour=23, minute=59, second=59).isoformat()
    cur.execute("""
        INSERT INTO student_portal_sessions (id, student_id, session_token, created_at, expires_at)
        VALUES (?,?,?,?,?)
    """, (new_id(), student_id, token, now.replace(microsecond=0).isoformat(), expires))
    conn.commit()
    return token


def _student_by_token(token: str) -> dict | None:
    if not token:
        return None
    return row("""
        SELECT s.* FROM student_portal_sessions sp
        LEFT JOIN students s ON s.id = sp.student_id
        WHERE sp.session_token=? AND sp.expires_at >= ?
    """, (token, now_iso()))


def _build_portal_payload(student: dict) -> dict:
    token_payload = {
        "ok": True,
        "student": student,
        "attendance": {"records": [], "leave_requests": []},
        "exam_results": rows("SELECT * FROM student_exam_results WHERE student_id=? ORDER BY completion_date DESC LIMIT 10", (student["id"],)),
        "grades": rows("SELECT * FROM student_grade_records WHERE student_id=? LIMIT 20", (student["id"],)),
        "bulletin_posts": rows("""
            SELECT title, body, scope, class_name, pinned, published_at
            FROM student_bulletin_posts
            WHERE scope='all' OR (scope='class' AND class_name=?)
            ORDER BY pinned DESC, published_at DESC LIMIT 20
        """, (student.get("class_name") or "",)),
        "certificate_requests": rows("SELECT * FROM certificate_requests WHERE student_id=? ORDER BY created_at DESC", (student["id"],)),
        "certificate_types": ["出席率証明書", "成績証明書", "修了証明書"],
        "student_card": {
            "school_name": "渋谷外語学院",
            "student_no": student.get("student_no") or "",
            "name": student.get("name") or "",
            "class_name": student.get("class_name") or "",
            "admission_date": student.get("admission_date") or "",
        },
    }
    return token_payload


class StudentLookup(BaseModel):
    student_no: str
    birth_date: str


@router.post("/student-lookup")
async def student_lookup(body: StudentLookup):
    student = row("SELECT * FROM students WHERE student_no=? AND birth_date=?",
                  (body.student_no.strip(), body.birth_date.strip()))
    if not student:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND",
                                                    "message": "一致する学生情報が見つかりません。"}})
    return _build_portal_payload(student)


class SetupPassword(BaseModel):
    student_no: str
    birth_date: str
    password: str
    password_confirm: str


@router.post("/student-password/setup")
async def setup_password(body: SetupPassword):
    if len(body.password) < 8:
        raise HTTPException(422, detail={"error": {"code": "VALIDATION_ERROR",
                                                    "message": "パスワードは8文字以上で入力してください。"}})
    if body.password != body.password_confirm:
        raise HTTPException(422, detail={"error": {"code": "VALIDATION_ERROR",
                                                    "message": "パスワード確認が一致しません。"}})
    student = row("SELECT * FROM students WHERE student_no=? AND birth_date=?",
                  (body.student_no.strip(), body.birth_date.strip()))
    if not student:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        UPDATE student_portal_accounts
        SET password_hash=?, password_set_at=?, updated_at=?
        WHERE student_id=?
    """, (hash_password(body.password), now_iso(), now_iso(), student["id"]))
    write_audit(cur, "student.portal_password", "student", student["id"],
                "学生ポータルのパスワードを設定しました。")
    conn.commit()
    session_token = _issue_session(student["id"])
    payload = _build_portal_payload(student)
    payload["session_token"] = session_token
    payload["login_id"] = body.student_no
    return payload


class StudentLogin(BaseModel):
    login_id: str
    password: str


@router.post("/student-login")
async def student_login(body: StudentLogin):
    account = row("""
        SELECT spa.*, s.*
        FROM student_portal_accounts spa
        LEFT JOIN students s ON s.id = spa.student_id
        WHERE spa.login_id=?
    """, (body.login_id.strip(),))
    if not account:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND",
                                                    "message": "学生アカウントが見つかりません。"}})
    if not account.get("password_hash"):
        raise HTTPException(409, detail={"error": {"code": "PASSWORD_NOT_SET",
                                                    "message": "パスワードが設定されていません。"}})
    if not verify_password(body.password, account["password_hash"]):
        raise HTTPException(401, detail={"error": {"code": "AUTH_FAILED",
                                                    "message": "学生番号またはパスワードが正しくありません。"}})
    student = row("SELECT * FROM students WHERE id=?", (account["student_id"],))
    session_token = _issue_session(student["id"])
    payload = _build_portal_payload(student)
    payload["session_token"] = session_token
    payload["login_id"] = body.login_id
    return payload


class SessionCheck(BaseModel):
    session_token: str


@router.post("/student-session")
async def student_session(body: SessionCheck):
    student = _student_by_token(body.session_token.strip())
    if not student:
        raise HTTPException(401, detail={"error": {"code": "AUTH_FAILED",
                                                    "message": "セッションが無効です。"}})
    payload = _build_portal_payload(student)
    payload["session_token"] = body.session_token
    return payload


class LeaveRequest(BaseModel):
    session_token: str
    request_type: str
    request_date: str
    period_label: Optional[str] = ""
    reason: str
    detail: Optional[str] = ""


@router.post("/leave-request")
async def create_leave_request(body: LeaveRequest):
    student = _student_by_token(body.session_token)
    if not student:
        raise HTTPException(401)
    if body.request_type not in {"公欠", "欠席"}:
        raise HTTPException(422)
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO student_leave_requests
        (id, student_id, request_type, request_date, period_label, reason, detail, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (new_id(), student["id"], body.request_type, body.request_date,
          body.period_label or "", body.reason, body.detail or "", "申請中", now_iso()))
    write_audit(cur, "student.leave_request", "student", student["id"],
                f"{body.request_type}申請を受け付けました。")
    conn.commit()
    return {"ok": True}


class CertRequest(BaseModel):
    session_token: str
    certificate_type: str
    purpose: Optional[str] = ""
    copies: Optional[int] = 1


@router.post("/certificate-request")
async def create_public_certificate_request(body: CertRequest):
    student = _student_by_token(body.session_token)
    if not student:
        raise HTTPException(401)
    allowed = {"出席率証明書", "成績証明書", "修了証明書"}
    if body.certificate_type not in allowed:
        raise HTTPException(422)
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO certificate_requests
        (id, student_id, certificate_type, copies, purpose, requested_by,
         status, issued_by, requested_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (new_id(), student["id"], body.certificate_type, body.copies or 1,
          body.purpose or "", "student", "申請中", "", now_iso(), now_iso()))
    write_audit(cur, "certificate.request", "student", student["id"],
                f"{body.certificate_type} の申請を受け付けました。")
    conn.commit()
    return {"ok": True}
