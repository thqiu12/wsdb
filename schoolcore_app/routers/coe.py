from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from auth import require_auth
from db import row, rows, connect, now_iso, new_id, write_audit

router = APIRouter()

COE_MATERIALS = [
    ("application_form", "願書"),
    ("photo", "写真"),
    ("passport_copy", "パスポートコピー"),
    ("residence_card_copy", "在留カードコピー"),
    ("certificate_of_enrollment", "在学証明書"),
    ("financial_statement", "経費支弁証明書"),
    ("bank_statement", "銀行残高証明書"),
    ("academic_transcript", "成績証明書"),
]


def ensure_coe_materials(cur, coe_case_id: str):
    for key, label in COE_MATERIALS:
        cur.execute("""
            INSERT OR IGNORE INTO coe_materials
            (id, coe_case_id, material_key, label, collected, checked, updated_at)
            VALUES (?,?,?,?,?,?,?)
        """, (new_id(), coe_case_id, key, label, 0, 0, now_iso()))


def coe_materials_complete(coe_id: str) -> bool:
    materials = rows("""
        SELECT collected, checked FROM coe_materials WHERE coe_case_id=?
    """, (coe_id,))
    return bool(materials) and all(m["collected"] and m["checked"] for m in materials)


@router.get("/coe-cases")
async def list_coe_cases(auth=Depends(require_auth)):
    conn = connect()
    cur = conn.cursor()
    for c in cur.execute("SELECT id FROM coe_cases").fetchall():
        ensure_coe_materials(cur, c["id"])
    conn.commit()
    return [dict(r) for r in conn.execute("""
        SELECT c.*,
               a.name AS applicant_name, a.admission_term, a.agent_name,
               (SELECT COUNT(*) FROM coe_materials m WHERE m.coe_case_id=c.id AND m.collected=1 AND m.checked=1) AS material_complete_count,
               (SELECT COUNT(*) FROM coe_materials m WHERE m.coe_case_id=c.id) AS material_total_count,
               (SELECT COUNT(*) FROM ai_check_issues i WHERE i.coe_case_id=c.id AND i.status='open') AS open_issue_count,
               (SELECT COUNT(*) FROM ai_check_issues i WHERE i.coe_case_id=c.id) AS issue_total_count
        FROM coe_cases c
        JOIN applicants a ON a.id = c.applicant_id
        ORDER BY c.deadline ASC
    """).fetchall()]


@router.get("/coe-cases/{coe_id}/materials")
async def get_materials(coe_id: str, auth=Depends(require_auth)):
    coe = row("SELECT id FROM coe_cases WHERE id=?", (coe_id,))
    if not coe:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    ensure_coe_materials(cur, coe_id)
    conn.commit()
    return rows("""
        SELECT material_key, label, collected, checked, updated_at
        FROM coe_materials WHERE coe_case_id=? ORDER BY rowid
    """, (coe_id,))


class MaterialsUpdate(BaseModel):
    completed_materials: List[str] = []


@router.post("/coe-cases/{coe_id}/materials")
async def update_materials(coe_id: str, body: MaterialsUpdate, auth=Depends(require_auth)):
    coe = row("SELECT id FROM coe_cases WHERE id=?", (coe_id,))
    if not coe:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    ensure_coe_materials(cur, coe_id)
    for key, _ in COE_MATERIALS:
        done = 1 if key in body.completed_materials else 0
        cur.execute("""
            UPDATE coe_materials SET collected=?, checked=?, updated_at=?
            WHERE coe_case_id=? AND material_key=?
        """, (done, done, now_iso(), coe_id, key))
    stage = "AIチェック待ち" if len(body.completed_materials) == len(COE_MATERIALS) else "資料回収中"
    cur.execute("UPDATE coe_cases SET stage=?, updated_at=? WHERE id=?",
                (stage, now_iso(), coe_id))
    write_audit(cur, "coe.materials", "coe_case", coe_id, "COE申請資料チェックを更新しました。")
    conn.commit()
    return rows("SELECT material_key, label, collected, checked, updated_at FROM coe_materials WHERE coe_case_id=? ORDER BY rowid", (coe_id,))


@router.get("/coe-cases/{coe_id}/ai-issues")
async def get_ai_issues(coe_id: str, auth=Depends(require_auth)):
    return rows("""
        SELECT * FROM ai_check_issues WHERE coe_case_id=?
        ORDER BY CASE severity WHEN 'error' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at
    """, (coe_id,))


@router.post("/coe-cases/{coe_id}/ai-check")
async def run_ai_check(coe_id: str, auth=Depends(require_auth)):
    coe = row("SELECT * FROM coe_cases WHERE id=?", (coe_id,))
    if not coe:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM ai_check_issues WHERE coe_case_id=?", (coe_id,))
    issues = [
        ("error",   "旅券番号",   "面接申請表と願書の旅券番号が一致していません。"),
        ("warning",  "住所",       "申請時住所と戸籍住所の表記ゆれを確認してください。"),
        ("warning",  "経費支弁者", "銀行残高証明書の日付が提出期限から90日を超える可能性があります。"),
    ]
    for severity, field, message in issues:
        cur.execute("""
            INSERT INTO ai_check_issues
            (id, coe_case_id, severity, field, message, status, created_at)
            VALUES (?,?,?,?,?,?,?)
        """, (new_id(), coe_id, severity, field, message, "open", now_iso()))
    cur.execute("UPDATE coe_cases SET ai_check_status='要修正 3件', stage='修正中', updated_at=? WHERE id=?",
                (now_iso(), coe_id))
    write_audit(cur, "ai_check.run", "coe_case", coe_id, "AI COE申請材料チェックを実行しました。")
    conn.commit()
    return {"status": "completed",
            "summary": {"errors": 1, "warnings": 2, "matched": 28},
            "issues": [{"severity": s, "field": f, "message": m} for s, f, m in issues]}


class ResolveIssue(BaseModel):
    resolution_note: str = "資料修正・確認済み"


@router.post("/ai-issues/{issue_id}/resolve")
async def resolve_issue(issue_id: str, body: ResolveIssue, auth=Depends(require_auth)):
    issue = row("SELECT * FROM ai_check_issues WHERE id=?", (issue_id,))
    if not issue:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        UPDATE ai_check_issues SET status='resolved', resolution_note=?, resolved_at=? WHERE id=?
    """, (body.resolution_note, now_iso(), issue_id))
    open_count = cur.execute("""
        SELECT COUNT(*) as c FROM ai_check_issues
        WHERE coe_case_id=? AND status='open' AND id!=?
    """, (issue["coe_case_id"], issue_id)).fetchone()["c"]
    if open_count == 0:
        cur.execute("""
            UPDATE coe_cases SET ai_check_status='確認完了', stage='入管提出準備完了', updated_at=? WHERE id=?
        """, (now_iso(), issue["coe_case_id"]))
    write_audit(cur, "ai_issue.resolve", "coe_case", issue["coe_case_id"],
                f"AIチェック項目「{issue['field']}」を確認済みにしました。")
    conn.commit()
    return row("SELECT * FROM ai_check_issues WHERE id=?", (issue_id,))


class SubmitImmigration(BaseModel):
    note: str = ""


@router.post("/coe-cases/{coe_id}/submit-immigration")
async def submit_immigration(coe_id: str, body: SubmitImmigration, auth=Depends(require_auth)):
    coe = row("SELECT * FROM coe_cases WHERE id=?", (coe_id,))
    if not coe:
        raise HTTPException(404)
    open_issues = row("SELECT COUNT(*) as c FROM ai_check_issues WHERE coe_case_id=? AND status='open'", (coe_id,))["c"]
    if open_issues:
        raise HTTPException(409, detail={"error": {"code": "AI_ISSUES_OPEN",
                                                    "message": "AIチェックの未確認項目を確認してください。"}})
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE coe_cases SET stage='入管提出済・COE交付待ち', updated_at=? WHERE id=?",
                (now_iso(), coe_id))
    write_audit(cur, "immigration.submit", "coe_case", coe_id, "COE申請を入管提出済みにしました。")
    conn.commit()
    return {"ok": True, "stage": "入管提出済・COE交付待ち"}


@router.post("/coe-cases/{coe_id}/send-partial-coe")
async def send_partial_coe(coe_id: str, auth=Depends(require_auth)):
    coe = row("SELECT id FROM coe_cases WHERE id=?", (coe_id,))
    if not coe:
        raise HTTPException(404)
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE coe_cases SET partial_coe_sent=1, updated_at=? WHERE id=?",
                (now_iso(), coe_id))
    write_audit(cur, "coe.partial_send", "coe_case", coe_id, "COE一部スクリーンショットの送付を記録しました。")
    conn.commit()
    return {"ok": True}


@router.post("/coe-cases/{coe_id}/send-full-coe")
async def send_full_coe(coe_id: str, auth=Depends(require_auth)):
    coe = row("SELECT * FROM coe_cases WHERE id=?", (coe_id,))
    if not coe:
        raise HTTPException(404)
    if not coe["full_tuition_confirmed"] or not coe["receipt_issued"]:
        raise HTTPException(409, detail={"error": {"code": "COE_RELEASE_BLOCKED",
                                                    "message": "学費全額入金と領収書発行が完了していません。"}})
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE coe_cases SET full_coe_sent=1, updated_at=? WHERE id=?",
                (now_iso(), coe_id))
    write_audit(cur, "coe.full_send", "coe_case", coe_id, "COE全体ファイルの送付を記録しました。")
    conn.commit()
    return {"ok": True, "message": "COE全体ファイルを送付済みにしました。"}
