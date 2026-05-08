#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import os
import re
import sqlite3
import subprocess
import uuid
import hashlib
import secrets
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote
from email.parser import BytesParser
from email.policy import default


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DB_PATH = ROOT / "schoolcore.sqlite3"
UPLOAD_DIR = ROOT / "uploads"
EXPORT_DIR = ROOT / "exports"
BUNDLED_PYTHON = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
BUNDLED_NODE = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
WITHDRAWAL_TEMPLATE_XLSX = Path("/Users/setsuiken/Desktop/工作/学生管理系统/離脱届-模板.xlsx")
POOR_ATTENDANCE_TEMPLATE_XLSX = Path("/Users/setsuiken/Desktop/工作/学生管理系统/入管5割出席率不佳報告_模板.xlsx")
MAY_NOVEMBER_TEMPLATE_XLS = Path("/Users/setsuiken/Desktop/工作/学生管理系统/5月11月受け入れ状況在留者リスト-模板.xls")
RESIDENCE_RENEWAL_LIST_TEMPLATE_XLS = Path("/Users/setsuiken/Desktop/工作/学生管理系统/在留更新申請者リスト-模板.xls")
RESIDENCE_RENEWAL_FORM_TEMPLATE_XLS = Path("/Users/setsuiken/Desktop/工作/学生管理系统/在留期間更新許可五表_模板.xls")
SEMIANNUAL_TEMPLATE_XLS = Path("/Users/setsuiken/Desktop/工作/学生管理系统/入管半期毎出席率報告_模板.xls")
SEMIANNUAL_DETAIL_TEMPLATE_XLS = Path("/Users/setsuiken/Desktop/工作/学生管理系统/半年毎出席率報告の明細_総合1年コース-報告.xls")
ANNUAL_COMPLETION_TEMPLATE_XLSX = Path("/Users/setsuiken/Desktop/工作/学生管理系统/年度終了報告-模板/報告様式.xlsx")
ANNUAL_COMPLETION_LIST_TEMPLATE_XLSX = Path("/Users/setsuiken/Desktop/工作/学生管理系统/年度終了報告-模板/リスト.xlsx")

REQUIRED_SECTIONS = [
    ("admission_plan", "入学時期・語学学校滞在予定期間"),
    ("personal_info", "個人情報"),
    ("education_history", "個人学歴"),
    ("application_history", "個人申請歴"),
    ("financial_sponsor", "経費支弁者情報"),
]

COE_MATERIALS = [
    ("application_form", "願書"),
    ("passport", "パスポート"),
    ("graduation_certificate", "卒業証明書"),
    ("sponsor_documents", "経費支弁者資料"),
    ("bank_balance", "銀行残高証明書"),
    ("photo", "証明写真"),
]


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str, salt: str | None = None) -> str:
    chosen_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), chosen_salt.encode("utf-8"), 120000).hex()
    return f"{chosen_salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    salt, _ = stored_hash.split("$", 1)
    return secrets.compare_digest(hash_password(password, salt), stored_hash)


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    UPLOAD_DIR.mkdir(exist_ok=True)
    EXPORT_DIR.mkdir(exist_ok=True)
    conn = connect()
    cur = conn.cursor()
    cur.executescript(
        """
        create table if not exists applicants (
          id text primary key,
          application_no text not null,
          name text not null,
          nationality text not null,
          admission_term text not null,
          desired_study_length text not null,
          agent_name text,
          status text not null,
          interview_result text not null,
          application_fee_status text not null,
          created_at text not null
        );

        create table if not exists students (
          id text primary key,
          student_no text not null,
          name text not null,
          nationality text not null,
          status text not null,
          class_name text,
          residence_card_no text,
          residence_expiry text,
          attendance_rate real,
          created_at text not null
        );

        create table if not exists payments (
          id text primary key,
          applicant_id text,
          student_id text,
          payment_type text not null,
          amount integer not null,
          payer_type text not null,
          payer_display_name text not null,
          status text not null,
          confirmed_at text,
          receipt_issued integer not null default 0,
          receipt_no text,
          created_at text not null
        );

        create table if not exists coe_cases (
          id text primary key,
          applicant_id text not null,
          stage text not null,
          deadline text not null,
          full_tuition_confirmed integer not null default 0,
          receipt_issued integer not null default 0,
          partial_coe_sent integer not null default 0,
          full_coe_sent integer not null default 0,
          ai_check_status text not null,
          updated_at text not null
        );

        create table if not exists audit_logs (
          id text primary key,
          actor text not null,
          event_type text not null,
          target_type text not null,
          target_id text not null,
          message text not null,
          created_at text not null
        );

        create table if not exists generated_documents (
          id text primary key,
          target_type text not null,
          target_id text not null,
          document_type text not null,
          document_no text not null,
          template_name text not null,
          status text not null,
          created_at text not null
        );

        create table if not exists applicant_required_sections (
          id text primary key,
          applicant_id text not null,
          section_key text not null,
          label text not null,
          completed integer not null default 0,
          updated_at text not null,
          unique(applicant_id, section_key)
        );

        create table if not exists coe_materials (
          id text primary key,
          coe_case_id text not null,
          material_key text not null,
          label text not null,
          collected integer not null default 0,
          checked integer not null default 0,
          updated_at text not null,
          unique(coe_case_id, material_key)
        );

        create table if not exists ai_check_issues (
          id text primary key,
          coe_case_id text not null,
          severity text not null,
          field text not null,
          message text not null,
          status text not null,
          resolution_note text,
          created_at text not null,
          resolved_at text
        );

        create table if not exists applicant_intake_forms (
          id text primary key,
          applicant_id text not null,
          source_type text not null,
          source_label text not null,
          contact_email text,
          contact_phone text,
          payload_json text not null,
          submitted_at text not null
        );

        create table if not exists import_batches (
          id text primary key,
          filename text not null,
          status text not null,
          total_rows integer not null default 0,
          imported_rows integer not null default 0,
          error_rows integer not null default 0,
          source_label text not null default '',
          note text not null default '',
          stored_path text not null default '',
          created_at text not null
        );

        create table if not exists import_batch_items (
          id text primary key,
          batch_id text not null,
          row_no integer not null,
          status text not null,
          applicant_id text,
          message text not null,
          raw_json text not null,
          created_at text not null
        );

        create table if not exists receipt_templates (
          id text primary key,
          name text not null,
          campus_name text not null default '',
          file_format text not null default '',
          status text not null,
          source_path text not null default '',
          notes text not null default '',
          created_at text not null
        );

        create table if not exists receipt_documents (
          id text primary key,
          payment_id text not null,
          template_id text,
          receipt_no text not null,
          issue_date text not null,
          payer_display_name text not null,
          student_name text not null,
          admission_term text not null,
          payment_type text not null,
          amount integer not null,
          line_note text not null default '',
          status text not null,
          created_at text not null
        );

        create table if not exists acceptance_notice_templates (
          id text primary key,
          name text not null,
          campus_name text not null default '',
          file_format text not null default '',
          status text not null,
          source_path text not null default '',
          notes text not null default '',
          created_at text not null
        );

        create table if not exists withdrawal_report_templates (
          id text primary key,
          name text not null,
          school_name text not null default '',
          file_format text not null default '',
          status text not null,
          source_path text not null default '',
          notes text not null default '',
          created_at text not null
        );

        create table if not exists export_files (
          id text primary key,
          export_key text not null unique,
          document_type text not null,
          target_id text not null,
          file_path text not null,
          file_url text not null,
          created_at text not null
        );

        create table if not exists annual_completion_results (
          id text primary key,
          student_id text not null,
          requirement text not null,
          destination text not null default '',
          certificate_no text not null default '',
          completion_date text not null,
          is_qualifying integer not null default 1,
          is_withdrawal integer not null default 0,
          category text not null,
          display_name text not null default '',
          score_text text not null default '',
          note text not null default '',
          created_at text not null
        );

        create table if not exists student_advancement_results (
          id text primary key,
          student_id text not null,
          school_name text not null,
          department_name text not null default '',
          completion_date text not null,
          note text not null default '',
          created_at text not null
        );

        create table if not exists student_employment_results (
          id text primary key,
          student_id text not null,
          company_name text not null,
          job_title text not null default '',
          completion_date text not null,
          note text not null default '',
          created_at text not null
        );

        create table if not exists student_exam_results (
          id text primary key,
          student_id text not null,
          exam_name text not null,
          score_text text not null default '',
          certificate_no text not null default '',
          completion_date text not null,
          note text not null default '',
          created_at text not null
        );

        create table if not exists student_withdrawal_outcomes (
          id text primary key,
          student_id text not null,
          outcome_type text not null,
          destination text not null default '',
          certificate_no text not null default '',
          completion_date text not null,
          score_text text not null default '',
          note text not null default '',
          category text not null,
          created_at text not null
        );

        create table if not exists certificate_requests (
          id text primary key,
          student_id text not null,
          certificate_type text not null,
          copies integer not null default 1,
          purpose text not null default '',
          requested_by text not null default 'student',
          status text not null,
          issued_by text not null default '',
          requested_at text not null,
          approved_at text,
          issued_at text,
          created_at text not null
        );

        create table if not exists student_portal_accounts (
          id text primary key,
          student_id text not null unique,
          login_id text not null unique,
          password_hash text not null default '',
          password_set_at text,
          created_at text not null,
          updated_at text not null
        );

        create table if not exists student_portal_sessions (
          id text primary key,
          student_id text not null,
          session_token text not null unique,
          created_at text not null,
          expires_at text not null
        );

        create table if not exists student_attendance_records (
          id text primary key,
          student_id text not null,
          class_date text not null,
          period_label text not null default '',
          status text not null,
          attendance_minutes integer not null default 0,
          scheduled_minutes integer not null default 0,
          note text not null default '',
          created_at text not null
        );

        create table if not exists student_leave_requests (
          id text primary key,
          student_id text not null,
          request_type text not null,
          request_date text not null,
          period_label text not null default '',
          reason text not null default '',
          detail text not null default '',
          status text not null,
          created_at text not null,
          reviewed_at text
        );

        create table if not exists student_consultation_records (
          id text primary key,
          student_id text not null,
          meeting_date text not null,
          staff_name text not null,
          category text not null,
          summary text not null,
          next_action text not null default '',
          created_at text not null
        );

        create table if not exists student_grade_records (
          id text primary key,
          student_id text not null,
          term_label text not null,
          subject_name text not null,
          score integer not null,
          grade text not null,
          comment text not null default '',
          created_at text not null
        );

        create table if not exists student_bulletin_posts (
          id text primary key,
          title text not null,
          body text not null,
          scope text not null default 'all',
          class_name text not null default '',
          pinned integer not null default 0,
          published_at text not null,
          created_at text not null
        );

        create table if not exists class_group_messages (
          id text primary key,
          class_name text not null,
          author_name text not null,
          author_role text not null,
          body text not null,
          posted_at text not null
        );

        create table if not exists student_homeroom_messages (
          id text primary key,
          student_id text not null,
          author_name text not null,
          author_role text not null,
          body text not null,
          posted_at text not null
        );

        create table if not exists student_homework_assignments (
          id text primary key,
          class_name text not null,
          subject_name text not null,
          title text not null,
          due_date text not null,
          description text not null default '',
          created_at text not null
        );

        create table if not exists student_homework_submissions (
          id text primary key,
          assignment_id text not null,
          student_id text not null,
          file_name text not null default '',
          file_path text not null default '',
          note text not null default '',
          status text not null,
          review_comment text not null default '',
          review_score integer,
          reviewed_by text not null default '',
          reviewed_at text,
          submitted_at text not null
        );
        """
    )
    ensure_student_columns(cur)
    ensure_student_portal_account_columns(cur)
    ensure_student_homework_columns(cur)
    ensure_student_bulletin_columns(cur)
    for applicant in cur.execute("select id from applicants").fetchall():
        ensure_applicant_sections(cur, applicant["id"])
    cur.execute("select count(*) as count from applicants")
    if cur.fetchone()["count"] == 0:
        seed(cur)
    for applicant in cur.execute("select id from applicants").fetchall():
        ensure_applicant_sections(cur, applicant["id"])
    cur.execute(
        """
        update applicant_required_sections
        set completed = 1, updated_at = ?
        where applicant_id in (
          select id from applicants where application_fee_status = '確認済'
          union
          select applicant_id from coe_cases
        )
        """,
        (now_iso(),),
    )
    cur.execute(
        """
        update applicants
        set status = '合格者'
        where id in (
          select target_id from generated_documents
          where target_type = 'applicant' and document_type = '合格通知書'
        )
        """
    )
    for coe_case in cur.execute("select id from coe_cases").fetchall():
        ensure_coe_materials(cur, coe_case["id"])
    ensure_receipt_template_seed(cur)
    ensure_acceptance_notice_template_seed(cur)
    ensure_withdrawal_template_seed(cur)
    ensure_demo_students(cur)
    ensure_student_portal_accounts(cur)
    ensure_student_attendance_seed(cur)
    ensure_student_portal_feature_seed(cur)
    ensure_annual_completion_seed(cur)
    if WITHDRAWAL_TEMPLATE_XLSX.exists():
        cur.execute(
            """
            update withdrawal_report_templates
            set file_format = 'xlsx',
                source_path = ?,
                notes = 'xlsx テンプレート接続済み。実テンプレートへ差し込み出力します。'
            where id = 'withdrawal-template-default'
            """,
            (str(WITHDRAWAL_TEMPLATE_XLSX),),
        )
    conn.commit()
    conn.close()


def ensure_student_columns(cur: sqlite3.Cursor) -> None:
    columns = {item["name"] for item in cur.execute("pragma table_info(students)").fetchall()}
    additions = [
        ("phone", "text"),
        ("address_japan", "text"),
        ("passport_no", "text"),
        ("birth_date", "text"),
        ("residence_status", "text"),
        ("admission_date", "text"),
        ("emergency_contact", "text"),
        ("notes", "text"),
    ]
    for name, kind in additions:
        if name not in columns:
            cur.execute(f"alter table students add column {name} {kind}")


def ensure_student_portal_account_columns(cur: sqlite3.Cursor) -> None:
    columns = {item["name"] for item in cur.execute("pragma table_info(student_portal_accounts)").fetchall()}
    if "settings_json" not in columns:
        cur.execute("alter table student_portal_accounts add column settings_json text not null default '{}'")


def ensure_student_homework_columns(cur: sqlite3.Cursor) -> None:
    columns = {item["name"] for item in cur.execute("pragma table_info(student_homework_submissions)").fetchall()}
    additions = [
        ("review_comment", "text not null default ''"),
        ("review_score", "integer"),
        ("reviewed_by", "text not null default ''"),
        ("reviewed_at", "text"),
    ]
    for name, definition in additions:
        if name not in columns:
            cur.execute(f"alter table student_homework_submissions add column {name} {definition}")


def ensure_student_bulletin_columns(cur: sqlite3.Cursor) -> None:
    columns = {item["name"] for item in cur.execute("pragma table_info(student_bulletin_posts)").fetchall()}
    if "pinned" not in columns:
        cur.execute("alter table student_bulletin_posts add column pinned integer not null default 0")


def ensure_student_portal_accounts(cur: sqlite3.Cursor) -> None:
    students = cur.execute("select id, student_no from students").fetchall()
    now = now_iso()
    for student in students:
        existing = cur.execute(
            "select id, password_hash from student_portal_accounts where student_id = ?",
            (student["id"],),
        ).fetchone()
        if not existing:
            password_hash = ""
            password_set_at = None
            if student["id"] == "student-lin":
                password_hash = hash_password("Lin2030!")
                password_set_at = now
            cur.execute(
                """
                insert into student_portal_accounts
                (id, student_id, login_id, password_hash, password_set_at, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), student["id"], student["student_no"], password_hash, password_set_at, now, now),
            )
        else:
            if not existing["password_hash"] and student["id"] == "student-lin":
                cur.execute(
                    """
                    update student_portal_accounts
                    set password_hash = ?, password_set_at = ?, updated_at = ?
                    where student_id = ?
                    """,
                    (hash_password("Lin2030!"), now, now, student["id"]),
                )


def ensure_student_attendance_seed(cur: sqlite3.Cursor) -> None:
    count = cur.execute("select count(*) as count from student_attendance_records").fetchone()["count"]
    if count:
        return
    records = [
        ("student-lin", "2026-04-28", "1-4限", "出席", 180, 180, ""),
        ("student-lin", "2026-04-29", "1-4限", "遅刻", 150, 180, "1限 30分遅刻"),
        ("student-lin", "2026-04-30", "1-4限", "欠席", 0, 180, "体調不良"),
        ("student-lin", "2026-05-01", "1-4限", "出席", 180, 180, ""),
        ("student-lin", "2026-05-02", "1-4限", "早退", 120, 180, "3限後に早退"),
        ("student-zhang", "2026-04-28", "1-4限", "出席", 180, 180, ""),
        ("student-zhang", "2026-04-29", "1-4限", "欠席", 0, 180, "無断欠席"),
        ("student-zhang", "2026-04-30", "1-4限", "遅刻", 120, 180, "アルバイト後の遅刻"),
        ("student-zhang", "2026-05-01", "1-4限", "出席", 180, 180, ""),
        ("student-mai", "2026-04-28", "1-4限", "出席", 180, 180, ""),
        ("student-mai", "2026-04-29", "1-4限", "公欠", 180, 180, "学校指定オリエンテーション"),
        ("student-mai", "2026-04-30", "1-4限", "出席", 180, 180, ""),
        ("student-nguyen", "2026-04-28", "1-4限", "出席", 180, 180, ""),
        ("student-nguyen", "2026-04-29", "1-4限", "出席", 180, 180, ""),
        ("student-kim", "2026-04-28", "1-4限", "出席", 180, 180, ""),
        ("student-kim", "2026-04-29", "1-4限", "早退", 150, 180, "病院受診"),
    ]
    now = now_iso()
    for student_id, class_date, period_label, status, attendance_minutes, scheduled_minutes, note in records:
        cur.execute(
            """
            insert into student_attendance_records
            (id, student_id, class_date, period_label, status, attendance_minutes, scheduled_minutes, note, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), student_id, class_date, period_label, status, attendance_minutes, scheduled_minutes, note, now),
        )

    leave_requests = [
        ("student-lin", "公欠", "2026-05-08", "1-4限", "在留更新手続き", "入管への更新手続きのため", "申請中"),
        ("student-zhang", "欠席", "2026-05-03", "1-2限", "体調不良", "発熱のため自宅療養", "承認済"),
    ]
    for student_id, request_type, request_date, period_label, reason, detail, status in leave_requests:
        cur.execute(
            """
            insert into student_leave_requests
            (id, student_id, request_type, request_date, period_label, reason, detail, status, created_at, reviewed_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), student_id, request_type, request_date, period_label, reason, detail, status, now, now if status != "申請中" else None),
        )


def ensure_student_portal_feature_seed(cur: sqlite3.Cursor) -> None:
    now = now_iso()
    if cur.execute("select count(*) as count from student_consultation_records").fetchone()["count"] == 0:
        consultation_rows = [
            ("student-lin", "2026-04-18", "佐藤先生", "出席面談", "遅刻が増えているため生活リズムを確認しました。", "5月上旬に再面談"),
            ("student-lin", "2026-03-22", "中島先生", "進路面談", "進学希望校の条件と日本語力の目標を確認しました。", "N2 模試結果を確認"),
            ("student-mai", "2026-04-10", "山田先生", "生活面談", "在留更新前の必要書類を共有しました。", "次回は5月中旬"),
        ]
        for student_id, meeting_date, staff_name, category, summary, next_action in consultation_rows:
            cur.execute(
                """
                insert into student_consultation_records
                (id, student_id, meeting_date, staff_name, category, summary, next_action, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), student_id, meeting_date, staff_name, category, summary, next_action, now),
            )

    if cur.execute("select count(*) as count from student_grade_records").fetchone()["count"] == 0:
        grade_rows = [
            ("student-lin", "2026年前期", "読解", 72, "B", "文法は安定。長文速度を強化。"),
            ("student-lin", "2026年前期", "聴解", 68, "B-", "聞き取り後半で集中力が落ちる。"),
            ("student-lin", "2026年前期", "作文", 75, "B", "構成は良い。助詞の見直しが必要。"),
            ("student-mai", "2026年前期", "会話", 88, "A", "発話量が多く安定。"),
        ]
        for student_id, term_label, subject_name, score, grade, comment in grade_rows:
            cur.execute(
                """
                insert into student_grade_records
                (id, student_id, term_label, subject_name, score, grade, comment, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), student_id, term_label, subject_name, score, grade, comment, now),
            )

    if cur.execute("select count(*) as count from student_bulletin_posts").fetchone()["count"] == 0:
        bulletin_rows = [
            ("5月学費納入の案内", "5月10日までに学費の確認をお願いします。領収書は発行後に学生端で確認できます。", "all", "", "2026-05-01T09:00:00"),
            ("A-1クラス 口頭試験のお知らせ", "5月8日の2限に口頭試験を行います。10分前までに教室へ集合してください。", "class", "A-1", "2026-05-01T10:00:00"),
        ]
        for title, body, scope, class_name, published_at in bulletin_rows:
            cur.execute(
                """
                insert into student_bulletin_posts
                (id, title, body, scope, class_name, published_at, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), title, body, scope, class_name, published_at, now),
            )

    if cur.execute("select count(*) as count from class_group_messages").fetchone()["count"] == 0:
        messages = [
            ("A-1", "佐藤先生", "staff", "明日の会話授業は 9:10 開始です。遅れないようにしてください。", "2026-05-01T08:45:00"),
            ("A-1", "LIN XIAO", "student", "了解しました。ありがとうございます。", "2026-05-01T08:52:00"),
            ("A-1", "NGUYEN THAO", "student", "教室はいつも通り 301 ですか。", "2026-05-01T08:54:00"),
        ]
        for class_name, author_name, author_role, body, posted_at in messages:
            cur.execute(
                """
                insert into class_group_messages
                (id, class_name, author_name, author_role, body, posted_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                (new_id(), class_name, author_name, author_role, body, posted_at),
            )

    if cur.execute("select count(*) as count from student_homeroom_messages").fetchone()["count"] == 0:
        homeroom_messages = [
            ("student-lin", "佐藤先生", "staff", "LIN さん、おはようございます。今週の遅刻について、放課後に5分だけ確認しましょう。", "2026-05-01T08:20:00"),
            ("student-lin", "LIN XIAO", "student", "はい、授業後に職員室へ行きます。", "2026-05-01T08:28:00"),
            ("student-lin", "佐藤先生", "staff", "ありがとうございます。必要なら生活リズムも一緒に相談しましょう。", "2026-05-01T08:31:00"),
        ]
        for student_id, author_name, author_role, body, posted_at in homeroom_messages:
            cur.execute(
                """
                insert into student_homeroom_messages
                (id, student_id, author_name, author_role, body, posted_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                (new_id(), student_id, author_name, author_role, body, posted_at),
            )

    if cur.execute("select count(*) as count from student_homework_assignments").fetchone()["count"] == 0:
        assignments = [
            ("A-1", "作文", "自己紹介作文", "2026-05-06", "400字で自己紹介を書いて提出してください。"),
            ("A-1", "読解", "新聞記事要約", "2026-05-09", "配布記事を200字で要約してください。"),
        ]
        assignment_ids = []
        for class_name, subject_name, title, due_date, description in assignments:
            assignment_id = new_id()
            assignment_ids.append((assignment_id, title))
            cur.execute(
                """
                insert into student_homework_assignments
                (id, class_name, subject_name, title, due_date, description, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (assignment_id, class_name, subject_name, title, due_date, description, now),
            )
        # seed one submission
        if assignment_ids:
            cur.execute(
                """
                insert into student_homework_submissions
                (id, assignment_id, student_id, file_name, file_path, note, status, submitted_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), assignment_ids[0][0], "student-lin", "jikoshokai.docx", "", "第一稿を提出しました。", "提出済", now),
            )


def seed(cur: sqlite3.Cursor) -> None:
    t = now_iso()
    applicant_1 = "applicant-wang"
    applicant_2 = "applicant-le"
    student_1 = "student-mai"
    payment_1 = "payment-app-fee-wang"
    payment_2 = "payment-tuition-wang"
    coe_1 = "coe-wang"
    cur.executemany(
        """
        insert into applicants
        (id, application_no, name, nationality, admission_term, desired_study_length, agent_name, status, interview_result, application_fee_status, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (applicant_1, "APP-202607-001", "WANG HAO", "中国", "2026年7月期", "1年6か月", "SGG留学サポート", "COE準備中", "合格", "確認済", t),
            (applicant_2, "APP-202610-002", "LE THI MAI", "ベトナム", "2026年10月期", "2年", "", "面接待ち", "保留", "未入金", t),
        ],
    )
    cur.execute(
        """
        insert into students
        (id, student_no, name, nationality, status, class_name, residence_card_no, residence_expiry, attendance_rate, phone, address_japan, passport_no, birth_date, residence_status, admission_date, emergency_contact, notes, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            student_1,
            "202604125",
            "LE THI MAI",
            "ベトナム",
            "在学",
            "A-1",
            "AB12345678CD",
            "2026-09-12",
            86.4,
            "080-4321-8899",
            "東京都新宿区高田馬場 3-12-8 メゾン高田馬場 203",
            "P-VN-20240018",
            "2001-08-14",
            "留学",
            "2025-04-09",
            "NGUYEN VAN MAI / 090-5555-1122",
            "在籍情報テスト用",
            t,
        ),
    )
    cur.executemany(
        """
        insert into payments
        (id, applicant_id, student_id, payment_type, amount, payer_type, payer_display_name, status, confirmed_at, receipt_issued, receipt_no, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (payment_1, applicant_1, None, "選考料", 20000, "agent", "SGG留学サポート", "confirmed", t, 0, None, t),
            (payment_2, applicant_1, None, "学費全額", 877000, "agent", "SGG留学サポート", "confirmed", t, 0, None, t),
        ],
    )
    cur.execute(
        """
        insert into coe_cases
        (id, applicant_id, stage, deadline, full_tuition_confirmed, receipt_issued, partial_coe_sent, full_coe_sent, ai_check_status, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (coe_1, applicant_1, "COE交付", "2026-05-20", 1, 0, 1, 0, "要確認 7件", t),
    )
    cur.execute(
        """
        insert into audit_logs
        (id, actor, event_type, target_type, target_id, message, created_at)
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id(), "事務局 山田", "seed", "system", "system", "初期デモデータを作成しました。", t),
    )


def ensure_demo_students(cur: sqlite3.Cursor) -> None:
    demo_students = [
        {
            "id": "student-zhang",
            "student_no": "202604201",
            "name": "ZHANG WEI",
            "nationality": "中国",
            "status": "在学",
            "class_name": "A-2",
            "residence_card_no": "ZX12004567AB",
            "residence_expiry": "2026-06-18",
            "attendance_rate": 74.5,
            "phone": "070-2010-3201",
            "address_japan": "東京都北区田端 1-8-4 サンハイツ 402",
            "passport_no": "P-CN-9912881",
            "birth_date": "2000-06-11",
            "residence_status": "留学",
            "admission_date": "2024-07-10",
            "emergency_contact": "ZHANG LI / 0086-138-0000-5512",
            "notes": "出席率低下のため面談フォロー対象",
        },
        {
            "id": "student-nguyen",
            "student_no": "202604202",
            "name": "NGUYEN THAO",
            "nationality": "ベトナム",
            "status": "在学",
            "class_name": "B-1",
            "residence_card_no": "VN22004567CD",
            "residence_expiry": "2026-11-05",
            "attendance_rate": 92.3,
            "phone": "080-6677-1212",
            "address_japan": "埼玉県川口市西川口 2-4-9 グリーンコーポ 105",
            "passport_no": "P-VN-1103922",
            "birth_date": "2002-04-03",
            "residence_status": "留学",
            "admission_date": "2025-10-08",
            "emergency_contact": "NGUYEN PHUONG / 0084-90-123-8811",
            "notes": "進学希望ヒアリング済み",
        },
        {
            "id": "student-lin",
            "student_no": "202604203",
            "name": "LIN XIAO",
            "nationality": "中国",
            "status": "在学",
            "class_name": "A-1",
            "residence_card_no": "CN32004567EF",
            "residence_expiry": "2026-05-30",
            "attendance_rate": 67.8,
            "phone": "090-8844-0031",
            "address_japan": "東京都豊島区南大塚 2-17-1 ハイム南大塚 301",
            "passport_no": "P-CN-8831400",
            "birth_date": "2002-01-30",
            "residence_status": "留学",
            "admission_date": "2025-04-09",
            "emergency_contact": "LIN HONG / 0086-139-1200-4411",
            "notes": "在留更新優先確認対象",
        },
        {
            "id": "student-kim",
            "student_no": "202604204",
            "name": "KIM MINJI",
            "nationality": "韓国",
            "status": "在学",
            "class_name": "C-1",
            "residence_card_no": "KR42004567GH",
            "residence_expiry": "2026-08-15",
            "attendance_rate": 81.2,
            "phone": "080-7001-2345",
            "address_japan": "東京都板橋区大山町 20-2 パールハウス 502",
            "passport_no": "P-KR-4408128",
            "birth_date": "2001-11-02",
            "residence_status": "留学",
            "admission_date": "2024-10-09",
            "emergency_contact": "KIM SUNGHO / 0082-10-1100-0098",
            "notes": "年度終了報告の退学後進路サンプルあり",
        },
    ]
    for item in demo_students:
        student_id = item["id"]
        exists = cur.execute("select 1 from students where id = ?", (student_id,)).fetchone()
        if exists:
            cur.execute(
                """
                update students
                set student_no = ?, name = ?, nationality = ?, status = ?, class_name = ?,
                    residence_card_no = ?, residence_expiry = ?, attendance_rate = ?,
                    phone = ?, address_japan = ?, passport_no = ?, birth_date = ?,
                    residence_status = ?, admission_date = ?, emergency_contact = ?, notes = ?
                where id = ?
                """,
                (
                    item["student_no"],
                    item["name"],
                    item["nationality"],
                    item["status"],
                    item["class_name"],
                    item["residence_card_no"],
                    item["residence_expiry"],
                    item["attendance_rate"],
                    item["phone"],
                    item["address_japan"],
                    item["passport_no"],
                    item["birth_date"],
                    item["residence_status"],
                    item["admission_date"],
                    item["emergency_contact"],
                    item["notes"],
                    student_id,
                ),
            )
        else:
            cur.execute(
                """
                insert into students
                (id, student_no, name, nationality, status, class_name, residence_card_no, residence_expiry, attendance_rate, phone, address_japan, passport_no, birth_date, residence_status, admission_date, emergency_contact, notes, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    student_id,
                    item["student_no"],
                    item["name"],
                    item["nationality"],
                    item["status"],
                    item["class_name"],
                    item["residence_card_no"],
                    item["residence_expiry"],
                    item["attendance_rate"],
                    item["phone"],
                    item["address_japan"],
                    item["passport_no"],
                    item["birth_date"],
                    item["residence_status"],
                    item["admission_date"],
                    item["emergency_contact"],
                    item["notes"],
                    now_iso(),
                ),
            )


def poor_attendance_demo_detail(student_id: str) -> dict:
    demo = {
        "student-lin": {
            "birth_date": "2002/01/30",
            "gender": "女",
            "admission_date": "2025/04/09",
            "expected_graduation": "2026/03/19",
            "previous_attendance": "55.5%",
            "work_place": "なし",
            "note": "担任面談済。遅刻と欠席が続いているため保護者連絡予定。",
        },
        "student-zhang": {
            "birth_date": "2000/06/11",
            "gender": "男",
            "admission_date": "2024/07/10",
            "expected_graduation": "2026/03/19",
            "previous_attendance": "70.8%",
            "work_place": "なし",
            "note": "出席指導中。アルバイト時間の聞き取りを継続。",
        },
        "student-kim": {
            "birth_date": "2001/02/15",
            "gender": "女",
            "admission_date": "2025/07/10",
            "expected_graduation": "2027/03/19",
            "previous_attendance": "83.4%",
            "work_place": "なし",
            "note": "様子観察。",
        },
    }
    return demo.get(
        student_id,
        {
            "birth_date": "",
            "gender": "",
            "admission_date": "",
            "expected_graduation": "",
            "previous_attendance": "",
            "work_place": "",
            "note": "",
        },
    )


def resident_list_demo_detail(student_id: str) -> dict:
    demo = {
        "student-mai": {
            "birth_date": "2001/09/21",
            "gender": "女",
            "address_in_japan": "〒169-0075 東京都新宿区高田馬場2-14-5 シティハイツ高田馬場305",
            "activity_details": "",
        },
        "student-zhang": {
            "birth_date": "2000/06/11",
            "gender": "男",
            "address_in_japan": "〒169-0075 東京都新宿区高田馬場3-10-8 コーポ高田馬場202",
            "activity_details": "",
        },
        "student-nguyen": {
            "birth_date": "2002/12/03",
            "gender": "女",
            "address_in_japan": "〒116-0014 東京都荒川区東日暮里5-33-9 サンハイツ日暮里401",
            "activity_details": "",
        },
        "student-lin": {
            "birth_date": "2002/01/30",
            "gender": "女",
            "address_in_japan": "〒171-0021 東京都豊島区西池袋4-18-12 メゾン西池袋103",
            "activity_details": "",
        },
        "student-kim": {
            "birth_date": "2001/02/15",
            "gender": "女",
            "address_in_japan": "〒114-0002 東京都北区王子1-18-10 グラン王子502",
            "activity_details": "",
        },
    }
    return demo.get(
        student_id,
        {
            "birth_date": "",
            "gender": "",
            "address_in_japan": "",
            "activity_details": "",
        },
    )


def residence_renewal_demo_detail(student_id: str, attendance_rate: float | None, residence_expiry: str) -> dict:
    demo = {
        "student-mai": {"birth_date": "2001/09/21", "gender": "女", "current_period_start": "2025/10/01"},
        "student-zhang": {"birth_date": "2000/06/11", "gender": "男", "current_period_start": "2025/07/01"},
        "student-nguyen": {"birth_date": "2002/12/03", "gender": "女", "current_period_start": "2026/04/01"},
        "student-lin": {"birth_date": "2002/01/30", "gender": "女", "current_period_start": "2025/04/01"},
        "student-kim": {"birth_date": "2001/02/15", "gender": "女", "current_period_start": "2025/10/01"},
    }
    detail = demo.get(student_id, {"birth_date": "", "gender": "", "current_period_start": ""})
    rate = float(attendance_rate or 0)
    attendance_days = max(0, round(rate))
    lesson_days = 100
    attendance_hours = max(0, round(rate * 6))
    lesson_hours = 600
    return {
        **detail,
        "attendance_days_display": f"{attendance_days}日/ {lesson_days}日 ({rate:.1f}%)" if attendance_rate is not None else "",
        "attendance_hours_display": f"{attendance_hours}時間/ {lesson_hours}時間 ({rate:.1f}%)" if attendance_rate is not None else "",
        "period_display": f"{detail.get('current_period_start', '')} ~ {residence_expiry.replace('-', '/') if residence_expiry else ''}".strip(" ~"),
    }


def residence_renewal_form_detail(student_id: str) -> dict:
    demo = {
        "student-lin": {
            "birth_date": "2002/01/30",
            "gender": "女",
            "occupation": "学生",
            "home_address": "中国浙江省杭州市西湖区文三路218号",
            "address_in_japan": "〒171-0021 東京都豊島区西池袋4-18-12 メゾン西池袋103",
            "phone": "03-5985-1120",
            "mobile_phone": "080-5521-8843",
            "passport_no": "EJ3200456",
            "passport_expiry": "2030/08/21",
            "current_status": "留学",
            "current_period_text": "1年",
            "desired_period": "1年",
            "reason": "渋谷外語学院での日本語学習を継続し、専門学校進学準備を行うため。",
            "school_name": "渋谷外語学院",
            "school_address": "〒169-0075 東京都新宿区高田馬場１丁目３４－６ 八光ビル２階、３階",
            "school_phone": "03-6233-9963",
            "last_school_name": "杭州第二高級中学",
            "graduation_date": "2023/06/30",
            "support_amount": "学費（6か月毎）350,000\n生活費（月）80,000",
            "remittance_amount": "月額 80,000",
            "activity_permission": "無",
            "plan_after_graduation": "日本での進学",
            "corporation_name": "知日株式会社",
            "corporation_no": "9011101068735",
            "admission_date": "2025/04/01",
            "weekly_hours": "20",
            "representative_name": "中島 淳子",
        },
        "student-zhang": {
            "birth_date": "2000/06/11",
            "gender": "男",
            "occupation": "学生",
            "home_address": "中国遼寧省大連市中山区人民路88号",
            "address_in_japan": "〒169-0075 東京都新宿区高田馬場3-10-8 コーポ高田馬場202",
            "phone": "03-6380-4412",
            "mobile_phone": "080-7712-4438",
            "passport_no": "EA7780451",
            "passport_expiry": "2031/03/18",
            "current_status": "留学",
            "current_period_text": "1年",
            "desired_period": "1年",
            "reason": "渋谷外語学院での学習を継続し、日本国内での進学準備を進めるため。",
            "school_name": "渋谷外語学院",
            "school_address": "〒169-0075 東京都新宿区高田馬場１丁目３４－６ 八光ビル２階、３階",
            "school_phone": "03-6233-9963",
            "last_school_name": "大連外国語学校",
            "graduation_date": "2022/06/30",
            "support_amount": "学費（6か月毎）350,000\n生活費（月）90,000",
            "remittance_amount": "月額 90,000",
            "activity_permission": "有",
            "plan_after_graduation": "日本での就職",
            "corporation_name": "知日株式会社",
            "corporation_no": "9011101068735",
            "admission_date": "2025/07/01",
            "weekly_hours": "20",
            "representative_name": "中島 淳子",
        },
    }
    base = demo.get(
        student_id,
        {
            "birth_date": "2001/09/21",
            "gender": "女",
            "occupation": "学生",
            "home_address": "",
            "address_in_japan": "",
            "phone": "",
            "mobile_phone": "",
            "passport_no": "",
            "passport_expiry": "",
            "current_status": "留学",
            "current_period_text": "1年",
            "desired_period": "1年",
            "reason": "在学継続のため。",
            "school_name": "渋谷外語学院",
            "school_address": "〒169-0075 東京都新宿区高田馬場１丁目３４－６ 八光ビル２階、３階",
            "school_phone": "03-6233-9963",
            "last_school_name": "",
            "graduation_date": "",
            "support_amount": "学費（6か月毎）350,000\n生活費（月）80,000",
            "remittance_amount": "月額 80,000",
            "activity_permission": "無",
            "plan_after_graduation": "日本での進学",
            "corporation_name": "知日株式会社",
            "corporation_no": "9011101068735",
            "admission_date": "2025/04/01",
            "weekly_hours": "20",
            "representative_name": "中島 淳子",
        },
    )
    return base


def semiannual_course_name(class_name: str) -> str:
    if class_name.startswith("A"):
        return "総合1年コース"
    return "総合2年コース"


def semiannual_attendance_detail(student_id: str, attendance_rate: float | None) -> dict:
    rate = float(attendance_rate or 0)
    lesson_hours = 60.0
    attended_hours = round(lesson_hours * rate / 100, 1)
    return {
        "attended_hours": attended_hours,
        "lesson_hours": lesson_hours,
        "attendance_percent_display": f"{rate:.1f}",
    }


def annual_completion_demo_entries() -> list[dict]:
    return [
        {
            "student_id": "student-mai",
            "display_name": "LE THI MAI（黎 氏梅）",
            "requirement": "進学",
            "destination": "東京国際ビジネス専門学校 国際コミュニケーション学科",
            "certificate_no": "",
            "score_text": "",
            "note": "専門学校進学予定",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "a",
        },
        {
            "student_id": "student-mai",
            "display_name": "LE THI MAI（黎 氏梅）",
            "requirement": "日本語教育の参照枠（試験）",
            "destination": "日本語能力試験 N2 / 118点",
            "certificate_no": "N2A552104J",
            "score_text": "N2 / 118点",
            "note": "JLPT",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "c",
        },
        {
            "student_id": "student-lin",
            "display_name": "LIN XIAO（林 晓）",
            "requirement": "進学",
            "destination": "専門学校デジタルアーツ東京 Webデザイン学科",
            "certificate_no": "",
            "score_text": "",
            "note": "専門学校進学予定",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "a",
        },
        {
            "student_id": "student-lin",
            "display_name": "LIN XIAO（林 晓）",
            "requirement": "日本語教育の参照枠（試験）",
            "destination": "日本語能力試験 N2 / 126点",
            "certificate_no": "N2A319856J",
            "score_text": "N2 / 126点",
            "note": "JLPT",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "c",
        },
        {
            "student_id": "student-zhang",
            "display_name": "ZHANG WEI（张 伟）",
            "requirement": "就職",
            "destination": "株式会社未来教育 日本語サポート担当",
            "certificate_no": "",
            "score_text": "",
            "note": "就職内定",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "b",
        },
        {
            "student_id": "student-nguyen",
            "display_name": "NGUYEN THAO（阮 草）",
            "requirement": "進学",
            "destination": "東京観光専門学校 ホテル学科",
            "certificate_no": "",
            "score_text": "",
            "note": "専門学校進学予定",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "a",
        },
        {
            "student_id": "student-nguyen",
            "display_name": "NGUYEN THAO（阮 草）",
            "requirement": "日本語教育の参照枠（試験）",
            "destination": "日本留学試験 日本語 246点",
            "certificate_no": "EJU-2025-11-44382",
            "score_text": "EJU 246点",
            "note": "日本留学試験",
            "completion_date": "2026/03/19",
            "is_qualifying": True,
            "is_withdrawal": False,
            "category": "c",
        },
        {
            "student_id": "student-kim",
            "display_name": "KIM MINJI（金 敏智）",
            "requirement": "就職",
            "destination": "株式会社HAN東京 退職予定",
            "certificate_no": "",
            "score_text": "",
            "note": "退学前就職",
            "completion_date": "2025/11/20（退）",
            "is_qualifying": True,
            "is_withdrawal": True,
            "category": "b",
        },
        {
            "student_id": "student-kim",
            "display_name": "KIM MINJI（金 敏智）",
            "requirement": "日本語教育の参照枠（試験）",
            "destination": "日本語能力試験 N2 / 103点",
            "certificate_no": "N2A481467J",
            "score_text": "N2 / 103点",
            "note": "退学前取得",
            "completion_date": "2025/11/20（退）",
            "is_qualifying": True,
            "is_withdrawal": True,
            "category": "c",
        },
    ]


def ensure_annual_completion_seed(cur: sqlite3.Cursor) -> None:
    cur.execute("delete from annual_completion_results")
    cur.execute("delete from student_advancement_results")
    cur.execute("delete from student_employment_results")
    cur.execute("delete from student_exam_results")
    cur.execute("delete from student_withdrawal_outcomes")
    for item in annual_completion_demo_entries():
        row_id = f"annual-{item['student_id']}-{item['category']}-{item['requirement']}"
        cur.execute(
            """
            insert into annual_completion_results
            (id, student_id, requirement, destination, certificate_no, completion_date,
             is_qualifying, is_withdrawal, category, display_name, score_text, note, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
              requirement = excluded.requirement,
              destination = excluded.destination,
              certificate_no = excluded.certificate_no,
              completion_date = excluded.completion_date,
              is_qualifying = excluded.is_qualifying,
              is_withdrawal = excluded.is_withdrawal,
              category = excluded.category,
              display_name = excluded.display_name,
              score_text = excluded.score_text,
              note = excluded.note
            """,
            (
                row_id,
                item["student_id"],
                item["requirement"],
                item.get("destination", ""),
                item.get("certificate_no", ""),
                item["completion_date"],
                1 if item.get("is_qualifying") else 0,
                1 if item.get("is_withdrawal") else 0,
                item["category"],
                item.get("display_name", ""),
                item.get("score_text", ""),
                item.get("note", ""),
                now_iso(),
            ),
        )
        if item["requirement"] == "進学" and not item.get("is_withdrawal"):
            cur.execute(
                """
                insert into student_advancement_results
                (id, student_id, school_name, department_name, completion_date, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  school_name = excluded.school_name,
                  department_name = excluded.department_name,
                  completion_date = excluded.completion_date,
                  note = excluded.note
                """,
                (
                    row_id,
                    item["student_id"],
                    item.get("destination", ""),
                    "",
                    item["completion_date"],
                    item.get("note", ""),
                    now_iso(),
                ),
            )
        elif item["requirement"] == "就職" and not item.get("is_withdrawal"):
            cur.execute(
                """
                insert into student_employment_results
                (id, student_id, company_name, job_title, completion_date, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  company_name = excluded.company_name,
                  job_title = excluded.job_title,
                  completion_date = excluded.completion_date,
                  note = excluded.note
                """,
                (
                    row_id,
                    item["student_id"],
                    item.get("destination", ""),
                    "",
                    item["completion_date"],
                    item.get("note", ""),
                    now_iso(),
                ),
            )
        elif item["requirement"] == "日本語教育の参照枠（試験）" and not item.get("is_withdrawal"):
            cur.execute(
                """
                insert into student_exam_results
                (id, student_id, exam_name, score_text, certificate_no, completion_date, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  exam_name = excluded.exam_name,
                  score_text = excluded.score_text,
                  certificate_no = excluded.certificate_no,
                  completion_date = excluded.completion_date,
                  note = excluded.note
                """,
                (
                    row_id,
                    item["student_id"],
                    item.get("destination", ""),
                    item.get("score_text", ""),
                    item.get("certificate_no", ""),
                    item["completion_date"],
                    item.get("note", ""),
                    now_iso(),
                ),
            )
        if item.get("is_withdrawal"):
            cur.execute(
                """
                insert into student_withdrawal_outcomes
                (id, student_id, outcome_type, destination, certificate_no, completion_date, score_text, note, category, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(id) do update set
                  outcome_type = excluded.outcome_type,
                  destination = excluded.destination,
                  certificate_no = excluded.certificate_no,
                  completion_date = excluded.completion_date,
                  score_text = excluded.score_text,
                  note = excluded.note,
                  category = excluded.category
                """,
                (
                    f"{row_id}-withdrawal",
                    item["student_id"],
                    item["requirement"],
                    item.get("destination", ""),
                    item.get("certificate_no", ""),
                    item["completion_date"],
                    item.get("score_text", ""),
                    item.get("note", ""),
                    item["category"],
                    now_iso(),
                ),
            )


def rows(sql: str, params: tuple = ()) -> list[dict]:
    conn = connect()
    result = [dict(row) for row in conn.execute(sql, params).fetchall()]
    conn.close()
    return result


def row(sql: str, params: tuple = ()) -> dict | None:
    conn = connect()
    found = conn.execute(sql, params).fetchone()
    conn.close()
    return dict(found) if found else None


def write_audit(cur: sqlite3.Cursor, event_type: str, target_type: str, target_id: str, message: str) -> None:
    cur.execute(
        """
        insert into audit_logs
        (id, actor, event_type, target_type, target_id, message, created_at)
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        (new_id(), "事務局 山田", event_type, target_type, target_id, message, now_iso()),
    )


def ensure_applicant_sections(cur: sqlite3.Cursor, applicant_id: str) -> None:
    for key, label in REQUIRED_SECTIONS:
        completed = 1 if key == "admission_plan" else 0
        cur.execute(
            """
            insert or ignore into applicant_required_sections
            (id, applicant_id, section_key, label, completed, updated_at)
            values (?, ?, ?, ?, ?, ?)
            """,
            (new_id(), applicant_id, key, label, completed, now_iso()),
        )


def applicant_sections(applicant_id: str) -> list[dict]:
    conn = connect()
    cur = conn.cursor()
    ensure_applicant_sections(cur, applicant_id)
    conn.commit()
    result = [
        dict(row)
        for row in cur.execute(
            "select section_key, label, completed, updated_at from applicant_required_sections where applicant_id = ? order by rowid",
            (applicant_id,),
        ).fetchall()
    ]
    conn.close()
    return result


def applicant_sections_complete(applicant_id: str) -> bool:
    sections = applicant_sections(applicant_id)
    return bool(sections) and all(section["completed"] for section in sections)


def ensure_coe_materials(cur: sqlite3.Cursor, coe_case_id: str) -> None:
    for key, label in COE_MATERIALS:
        cur.execute(
            """
            insert or ignore into coe_materials
            (id, coe_case_id, material_key, label, collected, checked, updated_at)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), coe_case_id, key, label, 0, 0, now_iso()),
        )


def coe_materials(coe_case_id: str) -> list[dict]:
    conn = connect()
    cur = conn.cursor()
    ensure_coe_materials(cur, coe_case_id)
    conn.commit()
    result = [
        dict(row)
        for row in cur.execute(
            "select material_key, label, collected, checked, updated_at from coe_materials where coe_case_id = ? order by rowid",
            (coe_case_id,),
        ).fetchall()
    ]
    conn.close()
    return result


def coe_materials_complete(coe_case_id: str) -> bool:
    materials = coe_materials(coe_case_id)
    return bool(materials) and all(item["collected"] and item["checked"] for item in materials)


def receipt_no(admission_term: str) -> str:
    match = re.search(r"(\d{4})\D*(\d{1,2})", admission_term)
    term = f"{match.group(1)}{int(match.group(2)):02d}" if match else "000000"
    today = datetime.now().strftime("%Y%m%d")
    return f"RC-{today}-{term}-{str(uuid.uuid4().int % 1000).zfill(3)}"


def certificate_document_no() -> str:
    today = datetime.now().strftime("%Y%m%d")
    return f"CERT-{today}-{str(uuid.uuid4().int % 1000).zfill(3)}"


def ensure_receipt_template_seed(cur: sqlite3.Cursor) -> None:
    existing = cur.execute("select count(*) as count from receipt_templates").fetchone()["count"]
    if existing:
        return
    cur.execute(
        """
        insert into receipt_templates
        (id, name, campus_name, file_format, status, source_path, notes, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "receipt-template-default",
            "領収書標準テンプレート",
            "高田馬場校",
            "xls",
            "active",
            "/Users/setsuiken/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/thqiu12_402a/temp/drag/202601_T2601002_CHIENWANJU_26IV04-0451_領収書_2026042020260417_1.xls",
            "現行の実運用領収書。xls のため帳票セルマップは xlsx 化後に接続予定です。",
            now_iso(),
        ),
    )


def ensure_acceptance_notice_template_seed(cur: sqlite3.Cursor) -> None:
    existing = cur.execute("select count(*) as count from acceptance_notice_templates").fetchone()["count"]
    if existing:
        return
    cur.execute(
        """
        insert into acceptance_notice_templates
        (id, name, campus_name, file_format, status, source_path, notes, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "acceptance-template-default",
            "高田馬場校 合格通知書",
            "高田馬場校",
            "template_pending",
            "active",
            "",
            "現在は通知書番号と票面項目を生成。校舎別テンプレート接続は次段階で追加予定です。",
            now_iso(),
        ),
    )


def ensure_withdrawal_template_seed(cur: sqlite3.Cursor) -> None:
    existing = cur.execute("select count(*) as count from withdrawal_report_templates").fetchone()["count"]
    if existing:
        return
    cur.execute(
        """
        insert into withdrawal_report_templates
        (id, name, school_name, file_format, status, source_path, notes, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "withdrawal-template-default",
            "離脱届標準テンプレート",
            "渋谷外語学院",
            "xls",
            "active",
            "/Users/setsuiken/Desktop/工作/学生管理系统/離脱届-模板.xls",
            "現行の離脱届テンプレート。xls のため帳票セルマップは xlsx 化後に接続予定です。",
            now_iso(),
        ),
    )


def student_portal_url() -> str:
    return "http://127.0.0.1:{port}/apply".format(port=os.environ.get("PORT", "8765"))


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def safe_file_stem(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9一-龥ぁ-んァ-ン_-]+", "_", value.strip())
    return text.strip("_") or "document"


def portal_payload_to_sections(payload: dict) -> set[str]:
    completed: set[str] = set()
    if payload.get("admission_term") and payload.get("desired_study_length"):
        completed.add("admission_plan")
    if any(payload.get(key) for key in ["name", "nationality", "email", "phone", "birth_date", "passport_no", "address"]):
        completed.add("personal_info")
    if any(payload.get(key) for key in ["highest_education", "school_name", "graduation_year", "education_notes"]):
        completed.add("education_history")
    if any(payload.get(key) for key in ["previous_application", "japanese_study_history", "visa_history", "application_notes"]):
        completed.add("application_history")
    if any(payload.get(key) for key in ["sponsor_name", "sponsor_relationship", "sponsor_phone", "sponsor_income", "financial_notes"]):
        completed.add("financial_sponsor")
    return completed


def save_applicant_sections(cur: sqlite3.Cursor, applicant_id: str, completed_keys: set[str]) -> None:
    ensure_applicant_sections(cur, applicant_id)
    for key, _ in REQUIRED_SECTIONS:
        cur.execute(
            "update applicant_required_sections set completed = ?, updated_at = ? where applicant_id = ? and section_key = ?",
            (1 if key in completed_keys else 0, now_iso(), applicant_id, key),
        )


def create_applicant_record(
    cur: sqlite3.Cursor,
    payload: dict,
    *,
    source_type: str,
    source_label: str = "",
    status: str = "面接申請",
    interview_result: str = "未設定",
    application_fee_status: str = "未入金",
    completed_sections: set[str] | None = None,
) -> str:
    applicant_id = new_id()
    today = datetime.now().strftime("%Y%m")
    application_no = f"APP-{today}-{str(uuid.uuid4().int % 1000).zfill(3)}"
    cur.execute(
        """
        insert into applicants
        (id, application_no, name, nationality, admission_term, desired_study_length, agent_name, status, interview_result, application_fee_status, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            applicant_id,
            application_no,
            payload["name"],
            payload["nationality"],
            payload["admission_term"],
            payload["desired_study_length"],
            payload.get("agent_name", ""),
            status,
            interview_result,
            application_fee_status,
            now_iso(),
        ),
    )
    save_applicant_sections(cur, applicant_id, completed_sections or set())
    cur.execute(
        """
        insert into applicant_intake_forms
        (id, applicant_id, source_type, source_label, contact_email, contact_phone, payload_json, submitted_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id(),
            applicant_id,
            source_type,
            source_label,
            payload.get("email", ""),
            payload.get("phone", ""),
            json.dumps(payload, ensure_ascii=False),
            now_iso(),
        ),
    )
    return applicant_id


def parse_spreadsheet_with_helper(file_path: Path) -> dict:
    candidates: list[Path] = []
    env_python = os.environ.get("SCHOOLCORE_PYTHON")
    if env_python:
        candidates.append(Path(env_python))
    candidates.extend([BUNDLED_PYTHON, Path("/usr/bin/python3")])
    python_bin = next((candidate for candidate in candidates if str(candidate) and candidate.exists()), None)
    if not python_bin:
        return {"ok": False, "message": "Excel 解析ランタイムが見つかりません。"}
    helper = ROOT / "excel_import_reader.py"
    try:
        completed = subprocess.run(
            [str(python_bin), str(helper), str(file_path)],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        return {"ok": False, "message": f"Excel 解析を起動できませんでした: {exc}"}
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "Excel 解析に失敗しました。"
        return {"ok": False, "message": message}
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "message": "Excel 解析結果を読み取れませんでした。"}


def export_xlsx_document(document_type: str, fields: dict, filename_prefix: str, template_path: str = "") -> dict:
    payload_path = EXPORT_DIR / f"{uuid.uuid4().hex}.json"
    filename = f"{filename_prefix}-{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    output_path = EXPORT_DIR / filename
    payload = {"documentType": document_type, "fields": fields, "outputPath": str(output_path), "templatePath": template_path}
    payload_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    try:
        completed = subprocess.run(
            [str(BUNDLED_NODE), str(ROOT / "export_document.mjs"), str(payload_path)],
            check=False,
            capture_output=True,
            text=True,
            cwd=str(ROOT),
        )
    finally:
        payload_path.unlink(missing_ok=True)
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "帳票出力に失敗しました。"
        return {"ok": False, "message": message}
    return {"ok": True, "path": str(output_path), "url": f"/exports/{filename}", "filename": filename}


def export_xls_document(document_type: str, fields: dict, filename_prefix: str, template_path: str) -> dict:
    payload_path = EXPORT_DIR / f"{uuid.uuid4().hex}.json"
    filename = f"{filename_prefix}-{datetime.now().strftime('%Y%m%d%H%M%S')}.xls"
    output_path = EXPORT_DIR / filename
    payload = {"documentType": document_type, "fields": fields, "outputPath": str(output_path), "templatePath": template_path}
    payload_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    helper = ROOT / "export_template_xls.py"
    try:
        completed = subprocess.run(
            [str(BUNDLED_PYTHON), str(helper), str(payload_path)],
            check=False,
            capture_output=True,
            text=True,
            cwd=str(ROOT),
        )
    finally:
        payload_path.unlink(missing_ok=True)
    if completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "帳票出力に失敗しました。"
        return {"ok": False, "message": message}
    return {"ok": True, "path": str(output_path), "url": f"/exports/{filename}", "filename": filename}


def cached_export(export_key: str) -> dict | None:
    cached = row("select * from export_files where export_key = ?", (export_key,))
    if not cached:
        return None
    path = Path(cached["file_path"])
    if not path.exists():
        return None
    return {"ok": True, "path": cached["file_path"], "url": cached["file_url"], "filename": path.name, "cached": True}


def save_export_cache(export_key: str, document_type: str, target_id: str, result: dict) -> None:
    conn = connect()
    cur = conn.cursor()
    cur.execute(
        """
        insert into export_files
        (id, export_key, document_type, target_id, file_path, file_url, created_at)
        values (?, ?, ?, ?, ?, ?, ?)
        on conflict(export_key) do update set
          file_path = excluded.file_path,
          file_url = excluded.file_url,
          created_at = excluded.created_at
        """,
        (new_id(), export_key, document_type, target_id, result["path"], result["url"], now_iso()),
    )
    conn.commit()
    conn.close()


def warm_export_cache(export_key: str, document_type: str, target_id: str, exporter) -> dict | None:
    cached = cached_export(export_key)
    if cached:
        return cached
    result = exporter()
    if result.get("ok"):
        save_export_cache(export_key, document_type, target_id, result)
        return result
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "SchoolCoreMVP/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/":
            return self.serve_file(STATIC_DIR / "index.html")
        if path == "/apply":
            return self.serve_file(STATIC_DIR / "apply.html")
        if path == "/student":
            return self.serve_file(STATIC_DIR / "student.html")
        if path.startswith("/exports/"):
            return self.serve_file(EXPORT_DIR / Path(unquote(path.removeprefix("/exports/"))).name)
        if path.startswith("/static/"):
            return self.serve_file(STATIC_DIR / path.removeprefix("/static/"))
        if path == "/api/health":
            return self.json({"ok": True, "time": now_iso()})
        if path == "/api/dashboard":
            return self.json(self.dashboard())
        if path == "/api/intake-summary":
            return self.json(self.intake_summary())
        if path == "/api/receipt-config":
            return self.json(self.receipt_config())
        if path == "/api/acceptance-config":
            return self.json(self.acceptance_config())
        if path == "/api/withdrawal-config":
            return self.json(self.withdrawal_config())
        if path == "/api/document-ledger":
            return self.json(self.document_ledger())
        if path == "/api/immigration-reports/semiannual-attendance":
            query = parse_qs(parsed.query)
            return self.json(self.semiannual_attendance_report(query.get("period", [""])[0] or None))
        if path == "/api/immigration-reports/may-november":
            query = parse_qs(parsed.query)
            return self.json(self.may_november_report(query.get("period", [""])[0] or None))
        if path == "/api/immigration-reports/residence-renewal":
            return self.json(self.residence_renewal_report())
        if path == "/api/immigration-reports/poor-attendance":
            return self.json(self.poor_attendance_report())
        if path == "/api/immigration-reports/annual-completion":
            return self.json(self.annual_completion_report())
        if path == "/api/annual-results":
            return self.json(self.annual_results_overview())
        if path == "/api/certificate-requests":
            return self.json(self.certificate_requests())
        if path == "/api/student-portal-admin":
            return self.json(self.student_portal_admin())
        if path == "/api/public/student-lookup":
            return self.json_error("METHOD_NOT_ALLOWED", "POST で呼び出してください。", status=405)
        if path == "/api/applicants":
            return self.json(self.applicants())
        if path == "/api/import-batches":
            return self.json(self.import_batches())
        if path == "/api/payments":
            return self.json(self.payments())
        if path.startswith("/api/payments/") and path.endswith("/receipt-preview"):
            payment_id = path.split("/")[3]
            return self.json(self.receipt_preview(payment_id))
        if path.startswith("/api/payments/") and path.endswith("/receipt-export"):
            payment_id = path.split("/")[3]
            return self.json(self.export_receipt(payment_id))
        if path.startswith("/api/applicants/") and path.endswith("/sections"):
            applicant_id = path.split("/")[3]
            return self.json(applicant_sections(applicant_id))
        if path.startswith("/api/applicants/") and path.endswith("/acceptance-preview"):
            applicant_id = path.split("/")[3]
            return self.json(self.acceptance_preview(applicant_id))
        if path.startswith("/api/applicants/") and path.endswith("/acceptance-export"):
            applicant_id = path.split("/")[3]
            return self.json(self.export_acceptance_notice(applicant_id))
        if path == "/api/students":
            return self.json(self.students())
        if path.startswith("/api/students/") and path.count("/") == 3:
            student_id = path.split("/")[3]
            detail = self.student_detail(student_id)
            if not detail:
                return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
            return self.json(detail)
        if path.startswith("/api/students/") and path.endswith("/withdrawal-preview"):
            student_id = path.split("/")[3]
            return self.json(self.withdrawal_preview(student_id))
        if path.startswith("/api/students/") and path.endswith("/withdrawal-export"):
            student_id = path.split("/")[3]
            return self.json(self.export_withdrawal_document(student_id))
        if path == "/api/coe-cases":
            return self.json(self.coe_cases())
        if path.startswith("/api/coe-cases/") and path.endswith("/materials"):
            coe_id = path.split("/")[3]
            return self.json(coe_materials(coe_id))
        if path.startswith("/api/coe-cases/") and path.endswith("/ai-issues"):
            coe_id = path.split("/")[3]
            return self.json(self.ai_issues(coe_id))
        if path == "/api/audit-logs":
            return self.json(rows("select * from audit_logs order by created_at desc limit 50"))
        self.send_error(404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/import-batches/upload":
            return self.upload_import_batch()
        if path == "/api/public/homework-submission":
            return self.create_public_homework_submission()
        body = self.read_json()

        if path == "/api/applicants":
            return self.create_applicant(body)
        if path == "/api/public/apply":
            return self.submit_public_application(body)
        if path == "/api/public/student-password/setup":
            return self.setup_student_portal_password(body)
        if path == "/api/public/student-password/change":
            return self.change_student_portal_password(body)
        if path == "/api/public/student-login":
            return self.public_student_login(body)
        if path == "/api/public/student-session":
            return self.public_student_session(body)
        if path == "/api/public/student-settings":
            return self.update_public_student_settings(body)
        if path == "/api/public/group-message":
            return self.create_public_group_message(body)
        if path == "/api/public/leave-request":
            return self.create_public_leave_request(body)
        if path == "/api/public/student-lookup":
            return self.public_student_lookup(body)
        if path == "/api/public/certificate-request":
            return self.create_public_certificate_request(body)
        if path.startswith("/api/applicants/") and path.endswith("/application-fee"):
            applicant_id = path.split("/")[3]
            return self.create_application_fee(applicant_id, body)
        if path.startswith("/api/applicants/") and path.endswith("/sections"):
            applicant_id = path.split("/")[3]
            return self.update_applicant_sections(applicant_id, body)
        if path.startswith("/api/applicants/") and path.endswith("/interview-result"):
            applicant_id = path.split("/")[3]
            return self.set_interview_result(applicant_id, body)
        if path.startswith("/api/applicants/") and path.endswith("/acceptance-notice"):
            applicant_id = path.split("/")[3]
            return self.generate_acceptance_notice(applicant_id)
        if path.startswith("/api/applicants/") and path.endswith("/coe-case"):
            applicant_id = path.split("/")[3]
            return self.create_coe_case(applicant_id, body)
        if path.startswith("/api/payments/") and path.endswith("/receipt"):
            payment_id = path.split("/")[3]
            return self.issue_receipt(payment_id)
        if path.startswith("/api/students/") and path.endswith("/withdrawal-document"):
            student_id = path.split("/")[3]
            return self.generate_withdrawal_document(student_id)
        if path.startswith("/api/students/") and path.count("/") == 3:
            student_id = path.split("/")[3]
            return self.update_student(student_id, body)
        if path.startswith("/api/students/") and path.endswith("/residence-renewal-form/export"):
            student_id = path.split("/")[3]
            return self.export_residence_renewal_form(student_id)
        if path == "/api/immigration-reports/semiannual-attendance/export":
            return self.export_semiannual_attendance_report(body)
        if path == "/api/immigration-reports/semiannual-attendance-detail/export":
            return self.export_semiannual_attendance_detail_report(body)
        if path == "/api/immigration-reports/may-november/export":
            return self.export_may_november_report(body)
        if path == "/api/immigration-reports/residence-renewal/export":
            return self.export_residence_renewal_report()
        if path == "/api/immigration-reports/poor-attendance/export":
            return self.export_poor_attendance_report()
        if path == "/api/immigration-reports/annual-completion/export":
            return self.export_annual_completion_report()
        if path == "/api/immigration-reports/annual-completion-list/export":
            return self.export_annual_completion_list()
        if path == "/api/annual-results":
            return self.create_annual_result(body)
        if path == "/api/certificate-requests":
            return self.create_certificate_request(body)
        if path == "/api/student-bulletins":
            return self.create_student_bulletin(body)
        if path.startswith("/api/student-bulletins/") and path.endswith("/pin"):
            bulletin_id = path.split("/")[3]
            return self.toggle_student_bulletin_pin(bulletin_id, body)
        if path == "/api/class-group-messages":
            return self.create_admin_group_message(body)
        if path.startswith("/api/student-leave-requests/") and path.endswith("/review"):
            request_id = path.split("/")[3]
            return self.review_student_leave_request(request_id, body)
        if path.startswith("/api/student-homework-submissions/") and path.endswith("/review"):
            submission_id = path.split("/")[3]
            return self.review_student_homework_submission(submission_id, body)
        if path.startswith("/api/class-group-messages/") and path.endswith("/delete"):
            message_id = path.split("/")[3]
            return self.delete_group_message(message_id)
        if path.startswith("/api/certificate-requests/") and path.endswith("/approve"):
            request_id = path.split("/")[3]
            return self.approve_certificate_request(request_id)
        if path.startswith("/api/certificate-requests/") and path.endswith("/issue"):
            request_id = path.split("/")[3]
            return self.issue_certificate_request(request_id)
        if path.startswith("/api/annual-results/") and path.endswith("/update"):
            result_id = path.split("/")[3]
            return self.update_annual_result(result_id, body)
        if path.startswith("/api/annual-results/") and path.endswith("/delete"):
            result_id = path.split("/")[3]
            return self.delete_annual_result(result_id)
        if path.startswith("/api/coe-cases/") and path.endswith("/ai-check"):
            coe_id = path.split("/")[3]
            return self.run_ai_check(coe_id)
        if path.startswith("/api/coe-cases/") and path.endswith("/materials"):
            coe_id = path.split("/")[3]
            return self.update_coe_materials(coe_id, body)
        if path.startswith("/api/ai-issues/") and path.endswith("/resolve"):
            issue_id = path.split("/")[3]
            return self.resolve_ai_issue(issue_id, body)
        if path.startswith("/api/coe-cases/") and path.endswith("/submit-immigration"):
            coe_id = path.split("/")[3]
            return self.submit_immigration(coe_id, body)
        if path.startswith("/api/coe-cases/") and path.endswith("/send-full-coe"):
            coe_id = path.split("/")[3]
            return self.send_full_coe(coe_id)
        if path.startswith("/api/coe-cases/") and path.endswith("/send-partial-coe"):
            coe_id = path.split("/")[3]
            return self.send_partial_coe(coe_id)

        self.send_error(404)

    def dashboard(self) -> dict:
        return {
            "applicant_count": row("select count(*) as count from applicants")["count"],
            "student_count": row("select count(*) as count from students")["count"],
            "pending_receipts": row("select count(*) as count from payments where status = 'confirmed' and receipt_issued = 0")["count"],
            "blocked_coe": row("select count(*) as count from coe_cases where full_tuition_confirmed = 1 and receipt_issued = 0")["count"],
            "low_attendance": row("select count(*) as count from students where attendance_rate < 80")["count"],
            "acceptance_notice_waiting": row("select count(*) as count from applicants where status = '合格通知待ち'")["count"],
            "coe_preparing": row("select count(*) as count from coe_cases where stage = 'COE準備'")["count"],
        }

    def intake_summary(self) -> dict:
        latest_batch = row("select * from import_batches order by created_at desc limit 1")
        return {
            "portal_url": student_portal_url(),
            "portal_submissions": row("select count(*) as count from applicant_intake_forms where source_type = 'student_portal'")["count"],
            "import_batches": row("select count(*) as count from import_batches")["count"],
            "latest_batch": latest_batch,
        }

    def students(self) -> list[dict]:
        items = rows("select * from students order by student_no asc, created_at asc")
        today = datetime.now().date()
        for item in items:
            alerts = []
            expiry_raw = item.get("residence_expiry") or ""
            if expiry_raw:
                try:
                    expiry_date = datetime.strptime(expiry_raw, "%Y-%m-%d").date()
                    days_left = (expiry_date - today).days
                    item["days_to_expiry"] = days_left
                    if days_left <= 90:
                        alerts.append(f"在留期限 {days_left}日")
                except ValueError:
                    item["days_to_expiry"] = None
            else:
                item["days_to_expiry"] = None
            attendance = float(item.get("attendance_rate") or 0)
            if attendance < 80:
                alerts.append("出席率注意")
            item["alerts"] = alerts
            item["alert_level"] = "red" if any("在留期限" in text and (item.get("days_to_expiry") or 999) <= 30 for text in alerts) else ("yellow" if alerts else "green")
        return items

    def student_detail(self, student_id: str) -> dict:
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return None
        annual = self.annual_results_overview()
        results = []
        for key in ("advancement", "employment", "exams", "withdrawals"):
            results.extend([item for item in annual.get(key, []) if item["student_id"] == student_id])
        results.sort(key=lambda item: (item.get("completion_date") or "", item.get("result_type") or ""), reverse=True)
        today = datetime.now().date()
        days_to_expiry = None
        if student.get("residence_expiry"):
            try:
                expiry_date = datetime.strptime(student["residence_expiry"], "%Y-%m-%d").date()
                days_to_expiry = (expiry_date - today).days
            except ValueError:
                days_to_expiry = None
        return {
            "student": dict(student),
            "summary": {
                "days_to_expiry": days_to_expiry,
                "attendance_warning": float(student.get("attendance_rate") or 0) < 80,
                "annual_result_count": len(results),
            },
            "annual_results": results[:5],
        }

    def certificate_requests_for_student(self, student_id: str) -> list[dict]:
        return rows(
            """
            select
              cr.*,
              gd.document_no,
              ef.file_url
            from certificate_requests cr
            left join generated_documents gd
              on gd.target_type = 'certificate_request' and gd.target_id = cr.id
            left join export_files ef
              on ef.export_key = ('certificate:' || cr.id || ':' || gd.document_no)
            where cr.student_id = ?
            order by cr.requested_at desc, cr.created_at desc
            """,
            (student_id,),
        )

    def attendance_overview_for_student(self, student_id: str) -> dict:
        records = rows(
            """
            select *
            from student_attendance_records
            where student_id = ?
            order by class_date desc, created_at desc
            limit 20
            """,
            (student_id,),
        )
        leave_requests = rows(
            """
            select *
            from student_leave_requests
            where student_id = ?
            order by request_date desc, created_at desc
            limit 20
            """,
            (student_id,),
        )
        scheduled_total = sum(int(item.get("scheduled_minutes") or 0) for item in records)
        attended_total = sum(int(item.get("attendance_minutes") or 0) for item in records)
        monthly = [item for item in records if (item.get("class_date") or "").startswith("2026-05")]
        monthly_scheduled = sum(int(item.get("scheduled_minutes") or 0) for item in monthly)
        monthly_attended = sum(int(item.get("attendance_minutes") or 0) for item in monthly)
        rate = round((attended_total / scheduled_total) * 100, 1) if scheduled_total else 0
        month_rate = round((monthly_attended / monthly_scheduled) * 100, 1) if monthly_scheduled else 0
        return {
            "summary": {
                "overall_rate": rate,
                "monthly_rate": month_rate,
                "scheduled_hours": round(scheduled_total / 60, 1),
                "attended_hours": round(attended_total / 60, 1),
                "absence_count": sum(1 for item in records if item["status"] == "欠席"),
                "official_absence_count": sum(1 for item in records if item["status"] == "公欠"),
            },
            "records": records,
            "leave_requests": leave_requests,
        }

    def consultation_records_for_student(self, student_id: str) -> list[dict]:
        return rows(
            """
            select *
            from student_consultation_records
            where student_id = ?
            order by meeting_date desc, created_at desc
            limit 20
            """,
            (student_id,),
        )

    def exam_results_for_student(self, student_id: str) -> list[dict]:
        return rows(
            """
            select exam_name, score_text, certificate_no, completion_date, note
            from student_exam_results
            where student_id = ?
            order by completion_date desc, created_at desc
            limit 20
            """,
            (student_id,),
        )

    def grade_records_for_student(self, student_id: str) -> list[dict]:
        return rows(
            """
            select term_label, subject_name, score, grade, comment
            from student_grade_records
            where student_id = ?
            order by created_at desc, subject_name asc
            limit 20
            """,
            (student_id,),
        )

    def bulletin_posts_for_student(self, class_name: str) -> list[dict]:
        return rows(
            """
            select title, body, scope, class_name, pinned, published_at
            from student_bulletin_posts
            where scope = 'all' or (scope = 'class' and class_name = ?)
            order by pinned desc, published_at desc, created_at desc
            limit 20
            """,
            (class_name,),
        )

    def class_group_messages_for_student(self, class_name: str) -> list[dict]:
        return rows(
            """
            select *
            from class_group_messages
            where class_name = ?
            order by posted_at asc
            limit 20
            """,
            (class_name,),
        )

    def homeroom_messages_for_student(self, student_id: str) -> list[dict]:
        return rows(
            """
            select *
            from student_homeroom_messages
            where student_id = ?
            order by posted_at asc
            limit 50
            """,
            (student_id,),
        )

    def homework_overview_for_student(self, student_id: str, class_name: str) -> dict:
        assignments = rows(
            """
            select
              a.*,
              s.id as submission_id,
              s.file_name,
              s.note as submission_note,
              s.status as submission_status,
              s.review_comment,
              s.review_score,
              s.reviewed_by,
              s.reviewed_at,
              s.submitted_at
            from student_homework_assignments a
            left join student_homework_submissions s
              on s.assignment_id = a.id and s.student_id = ?
            where a.class_name = ?
            order by a.due_date asc, a.created_at desc
            limit 20
            """,
            (student_id, class_name),
        )
        return {"assignments": assignments}

    def student_portal_settings(self, student_id: str) -> dict:
        account = row("select settings_json from student_portal_accounts where student_id = ?", (student_id,))
        defaults = {
            "push_attendance": True,
            "push_homework": True,
            "push_bulletin": True,
            "display_language": "ja",
        }
        if not account or not account.get("settings_json"):
            return defaults
        try:
            loaded = json.loads(account["settings_json"])
        except json.JSONDecodeError:
            loaded = {}
        return {**defaults, **loaded}

    def build_student_portal_payload(self, student: dict) -> dict:
        today = datetime.now().date()
        days_to_expiry = None
        alerts = []
        if student.get("residence_expiry"):
            try:
                expiry_date = datetime.strptime(student["residence_expiry"], "%Y-%m-%d").date()
                days_to_expiry = (expiry_date - today).days
                if days_to_expiry <= 90:
                    alerts.append(f"在留期限 {days_to_expiry}日")
            except ValueError:
                days_to_expiry = None
        attendance_rate = float(student.get("attendance_rate") or 0)
        if attendance_rate < 80:
            alerts.append("出席率注意")
        requests = self.certificate_requests_for_student(student["id"])
        attendance = self.attendance_overview_for_student(student["id"])
        consultations = self.consultation_records_for_student(student["id"])
        exams = self.exam_results_for_student(student["id"])
        grades = self.grade_records_for_student(student["id"])
        bulletin = self.bulletin_posts_for_student(student.get("class_name") or "")
        class_group_chat = self.class_group_messages_for_student(student.get("class_name") or "")
        homeroom_chat = self.homeroom_messages_for_student(student["id"])
        homework = self.homework_overview_for_student(student["id"], student.get("class_name") or "")
        settings = self.student_portal_settings(student["id"])
        return {
            "ok": True,
            "student": student,
            "summary": {
                "days_to_expiry": days_to_expiry,
                "attendance_warning": attendance_rate < 80,
                "request_count": len(requests),
                "alerts": alerts,
            },
            "attendance": attendance,
            "student_card": {
                "school_name": "渋谷外語学院",
                "student_no": student.get("student_no") or "",
                "name": student.get("name") or "",
                "class_name": student.get("class_name") or "",
                "admission_date": student.get("admission_date") or "",
                "residence_status": student.get("residence_status") or "",
            },
            "consultations": consultations,
            "exam_results": exams,
            "grades": grades,
            "bulletin_posts": bulletin,
            "group_chat": class_group_chat,
            "chat_threads": {
                "classroom": class_group_chat,
                "homeroom": homeroom_chat,
            },
            "homework": homework,
            "settings": settings,
            "certificate_requests": requests,
            "certificate_types": ["出席率証明書", "成績証明書", "修了証明書"],
        }

    def issue_student_portal_session(self, student_id: str) -> str:
        conn = connect()
        cur = conn.cursor()
        cur.execute("delete from student_portal_sessions where student_id = ?", (student_id,))
        session_token = secrets.token_urlsafe(32)
        now = datetime.now()
        expires_at = now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
        cur.execute(
            """
            insert into student_portal_sessions
            (id, student_id, session_token, created_at, expires_at)
            values (?, ?, ?, ?, ?)
            """,
            (new_id(), student_id, session_token, now.replace(microsecond=0).isoformat(), expires_at),
        )
        conn.commit()
        conn.close()
        return session_token

    def student_by_session_token(self, session_token: str) -> dict | None:
        if not session_token:
            return None
        session_row = row(
            """
            select s.*
            from student_portal_sessions sp
            left join students s on s.id = sp.student_id
            where sp.session_token = ? and sp.expires_at >= ?
            """,
            (session_token, now_iso()),
        )
        return session_row

    def lookup_student_for_portal(self, student_no: str, birth_date: str) -> dict | None:
        if not student_no or not birth_date:
            return None
        return row(
            """
            select
              id,
              student_no,
              name,
              nationality,
              class_name,
              status,
              admission_date,
              birth_date,
              attendance_rate,
              residence_status,
              residence_card_no,
              residence_expiry,
              phone,
              address_japan,
              emergency_contact
            from students
            where student_no = ? and birth_date = ?
            """,
            (student_no, birth_date),
        )

    def public_student_lookup(self, body: dict) -> None:
        student_no = (body.get("student_no") or "").strip()
        birth_date = (body.get("birth_date") or "").strip()
        if not student_no or not birth_date:
            return self.json_error("VALIDATION_ERROR", "学生番号と生年月日を入力してください。", status=422)
        student = self.lookup_student_for_portal(student_no, birth_date)
        if not student:
            return self.json_error("NOT_FOUND", "一致する学生情報が見つかりません。", status=404)
        return self.json(self.build_student_portal_payload(student))

    def setup_student_portal_password(self, body: dict) -> None:
        student_no = (body.get("student_no") or "").strip()
        birth_date = (body.get("birth_date") or "").strip()
        password = body.get("password") or ""
        password_confirm = body.get("password_confirm") or ""
        if not student_no or not birth_date:
            return self.json_error("VALIDATION_ERROR", "学生番号と生年月日を入力してください。", status=422)
        if len(password) < 8:
            return self.json_error("VALIDATION_ERROR", "パスワードは 8 文字以上で入力してください。", status=422)
        if password != password_confirm:
            return self.json_error("VALIDATION_ERROR", "パスワード確認が一致しません。", status=422)
        student = self.lookup_student_for_portal(student_no, birth_date)
        if not student:
            return self.json_error("NOT_FOUND", "一致する学生情報が見つかりません。", status=404)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            update student_portal_accounts
            set password_hash = ?, password_set_at = ?, updated_at = ?
            where student_id = ?
            """,
            (hash_password(password), now_iso(), now_iso(), student["id"]),
        )
        write_audit(cur, "student.portal_password", "student", student["id"], f"学生ポータルのパスワードを設定しました。")
        conn.commit()
        conn.close()
        session_token = self.issue_student_portal_session(student["id"])
        payload = self.build_student_portal_payload(student)
        payload["session_token"] = session_token
        payload["login_id"] = student_no
        return self.json(payload)

    def change_student_portal_password(self, body: dict) -> None:
        session_token = (body.get("session_token") or "").strip()
        current_password = body.get("current_password") or ""
        new_password = body.get("new_password") or ""
        new_password_confirm = body.get("new_password_confirm") or ""
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        if not current_password:
            return self.json_error("VALIDATION_ERROR", "現在のパスワードを入力してください。", status=422)
        if len(new_password) < 8:
            return self.json_error("VALIDATION_ERROR", "新しいパスワードは 8 文字以上で入力してください。", status=422)
        if new_password != new_password_confirm:
            return self.json_error("VALIDATION_ERROR", "新しいパスワード確認が一致しません。", status=422)
        account = row("select * from student_portal_accounts where student_id = ?", (student["id"],))
        if not account or not account.get("password_hash"):
            return self.json_error("NOT_FOUND", "学生アカウントが見つかりません。", status=404)
        if not verify_password(current_password, account["password_hash"]):
            return self.json_error("AUTH_FAILED", "現在のパスワードが正しくありません。", status=401)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            update student_portal_accounts
            set password_hash = ?, password_set_at = ?, updated_at = ?
            where student_id = ?
            """,
            (hash_password(new_password), now_iso(), now_iso(), student["id"]),
        )
        write_audit(cur, "student.portal_password_change", "student", student["id"], "学生ポータルのパスワードを変更しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def public_student_login(self, body: dict) -> None:
        login_id = (body.get("login_id") or "").strip()
        password = body.get("password") or ""
        if not login_id or not password:
            return self.json_error("VALIDATION_ERROR", "学生番号とパスワードを入力してください。", status=422)
        account = row(
            """
            select spa.*, s.*
            from student_portal_accounts spa
            left join students s on s.id = spa.student_id
            where spa.login_id = ?
            """,
            (login_id,),
        )
        if not account or not account.get("id"):
            return self.json_error("NOT_FOUND", "学生アカウントが見つかりません。", status=404)
        if not account["password_hash"]:
            return self.json_error("PASSWORD_NOT_SET", "まだパスワードが設定されていません。初回設定を行ってください。", status=409)
        if not verify_password(password, account["password_hash"]):
            return self.json_error("AUTH_FAILED", "学生番号またはパスワードが正しくありません。", status=401)
        student = row("select * from students where id = ?", (account["student_id"],))
        session_token = self.issue_student_portal_session(student["id"])
        payload = self.build_student_portal_payload(student)
        payload["session_token"] = session_token
        payload["login_id"] = login_id
        return self.json(payload)

    def public_student_session(self, body: dict) -> None:
        session_token = (body.get("session_token") or "").strip()
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        payload = self.build_student_portal_payload(student)
        payload["session_token"] = session_token
        payload["login_id"] = student.get("student_no") or ""
        return self.json(payload)

    def certificate_requests(self) -> dict:
        items = rows(
            """
            select
              cr.*,
              s.student_no,
              s.name as student_name,
              s.class_name,
              s.status as student_status
            from certificate_requests cr
            left join students s on s.id = cr.student_id
            order by cr.requested_at desc, cr.created_at desc
            """
        )
        return {
            "summary": {
                "total_count": len(items),
                "requested_count": sum(1 for item in items if item["status"] == "申請中"),
                "approved_count": sum(1 for item in items if item["status"] == "承認済"),
                "issued_count": sum(1 for item in items if item["status"] == "発行済"),
            },
            "students": self.students(),
            "items": items,
        }

    def student_portal_admin(self) -> dict:
        leave_requests = rows(
            """
            select
              lr.*,
              s.student_no,
              s.name as student_name,
              s.class_name
            from student_leave_requests lr
            left join students s on s.id = lr.student_id
            order by
              case when lr.status = '申請中' then 0 else 1 end,
              lr.request_date desc,
              lr.created_at desc
            """
        )
        homework_submissions = rows(
            """
            select
              hs.*,
              ha.title as assignment_title,
              ha.subject_name,
              ha.due_date,
              s.student_no,
              s.name as student_name,
              s.class_name
            from student_homework_submissions hs
            left join student_homework_assignments ha on ha.id = hs.assignment_id
            left join students s on s.id = hs.student_id
            order by hs.submitted_at desc
            """
        )
        bulletin_posts = rows(
            """
            select *
            from student_bulletin_posts
            order by pinned desc, published_at desc, created_at desc
            limit 20
            """
        )
        recent_group_messages = rows(
            """
            select *
            from class_group_messages
            order by posted_at desc
            limit 20
            """
        )
        return {
            "summary": {
                "leave_pending_count": sum(1 for item in leave_requests if item["status"] == "申請中"),
                "homework_submission_count": len(homework_submissions),
                "bulletin_count": len(bulletin_posts),
                "group_message_count": len(recent_group_messages),
            },
            "leave_requests": leave_requests,
            "homework_submissions": homework_submissions,
            "bulletin_posts": bulletin_posts,
            "recent_group_messages": recent_group_messages,
        }

    def period_minutes(self, period_label: str) -> int:
        text = (period_label or "").strip()
        if not text:
            return 180
        if text == "1-2限":
            return 90
        if text == "3-4限":
            return 90
        if text == "1-4限":
            return 180
        numbers = re.findall(r"\d+", text)
        if len(numbers) >= 2:
            try:
                start = int(numbers[0])
                end = int(numbers[1])
                if end >= start:
                    return max(45, (end - start + 1) * 45)
            except ValueError:
                pass
        return 180

    def receipt_config(self) -> dict:
        template = row("select * from receipt_templates where status = 'active' order by created_at desc limit 1")
        return {
            "active_template": template,
            "template_count": row("select count(*) as count from receipt_templates")["count"],
            "issued_count": row("select count(*) as count from receipt_documents where status = 'issued'")["count"],
        }

    def acceptance_config(self) -> dict:
        template = row("select * from acceptance_notice_templates where status = 'active' order by created_at desc limit 1")
        return {
            "active_template": template,
            "template_count": row("select count(*) as count from acceptance_notice_templates")["count"],
            "issued_count": row(
                "select count(*) as count from generated_documents where target_type = 'applicant' and document_type = '合格通知書'"
            )["count"],
        }

    def withdrawal_config(self) -> dict:
        template = row("select * from withdrawal_report_templates where status = 'active' order by created_at desc limit 1")
        return {
            "active_template": template,
            "template_count": row("select count(*) as count from withdrawal_report_templates")["count"],
            "issued_count": row(
                "select count(*) as count from generated_documents where target_type = 'student' and document_type = '離脱届'"
            )["count"],
        }

    def default_semiannual_period(self) -> str:
        today = datetime.now()
        half = "上期" if today.month <= 6 else "下期"
        return f"{today.year}年{half}"

    def default_may_november_period(self) -> str:
        today = datetime.now()
        month = "5月" if today.month <= 5 else "11月"
        return f"{today.year}年{month}"

    def residence_renewal_report(self) -> dict:
        today = datetime.now().date()
        students = rows(
            """
            select
              id,
              student_no,
              name,
              nationality,
              class_name,
              status,
              residence_card_no,
              residence_expiry,
              attendance_rate
            from students
            order by residence_expiry asc, student_no asc
            """
        )
        renewal_targets = []
        for item in students:
            expiry_raw = item.get("residence_expiry") or ""
            days_left = None
            if expiry_raw:
                try:
                    expiry_date = datetime.strptime(expiry_raw, "%Y-%m-%d").date()
                    days_left = (expiry_date - today).days
                except ValueError:
                    days_left = None
            if days_left is not None and days_left <= 90:
                renewal_targets.append(
                    {
                        **item,
                        "days_left": days_left,
                        **residence_renewal_demo_detail(item["id"], item.get("attendance_rate"), item.get("residence_expiry") or ""),
                    }
                )
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = 'residence-renewal' and document_type = '在留期間更新五表'",
        )
        document_no = existing["document_no"] if existing else f"RV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        return {
            "summary": {
                "document_no": document_no,
                "issue_date": datetime.now().strftime("%Y-%m-%d"),
                "target_count": len(renewal_targets),
                "next_expiry": renewal_targets[0]["residence_expiry"] if renewal_targets else "",
                "status": "要確認" if renewal_targets else "対象なし",
            },
            "targets": renewal_targets,
        }

    def poor_attendance_report(self) -> dict:
        students = rows(
            """
            select
              id,
              student_no,
              name,
              nationality,
              class_name,
              status,
              residence_expiry,
              attendance_rate
            from students
            order by attendance_rate asc, student_no asc
            """
        )
        targets = []
        for item in students:
            if float(item.get("attendance_rate") or 0) < 80:
                targets.append({**item, **poor_attendance_demo_detail(item["id"])})
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = 'poor-attendance' and document_type = '出席率不佳報告'",
        )
        document_no = existing["document_no"] if existing else f"PA-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        return {
            "summary": {
                "document_no": document_no,
                "issue_date": datetime.now().strftime("%Y-%m-%d"),
                "target_count": len(targets),
                "lowest_attendance": targets[0]["attendance_rate"] if targets else "",
                "status": "要提出" if targets else "対象なし",
                "school_name": "渋谷外語学院",
                "operator_name": "知日株式会社",
                "phone": "03-6233-9963",
                "staff_name": "中島 淳子",
                "report_month": datetime.now().strftime("%Y年%m月"),
                "enrolled_count": len(students),
            },
            "targets": targets,
        }

    def annual_completion_report(self) -> dict:
        students = {
            item["id"]: item
            for item in rows("select id, name, residence_card_no, class_name from students order by student_no asc")
        }
        display_names = {
            item["student_id"]: item["display_name"]
            for item in rows("select student_id, max(display_name) as display_name from annual_completion_results group by student_id")
            if item.get("display_name")
        }
        source_entries = []
        for item in rows(
            """
            select student_id, school_name, department_name, completion_date, note
            from student_advancement_results
            order by completion_date asc, student_id asc
            """
        ):
            source_entries.append(
                {
                    "student_id": item["student_id"],
                    "requirement": "進学",
                    "destination": item["school_name"],
                    "certificate_no": "",
                    "completion_date": item["completion_date"],
                    "is_qualifying": 1,
                    "is_withdrawal": 0,
                    "category": "a",
                    "display_name": display_names.get(item["student_id"], ""),
                    "score_text": "",
                    "note": item.get("note", ""),
                }
            )
        for item in rows(
            """
            select student_id, company_name, job_title, completion_date, note
            from student_employment_results
            order by completion_date asc, student_id asc
            """
        ):
            source_entries.append(
                {
                    "student_id": item["student_id"],
                    "requirement": "就職",
                    "destination": item["company_name"],
                    "certificate_no": "",
                    "completion_date": item["completion_date"],
                    "is_qualifying": 1,
                    "is_withdrawal": 0,
                    "category": "b",
                    "display_name": display_names.get(item["student_id"], ""),
                    "score_text": "",
                    "note": item.get("note", ""),
                }
            )
        for item in rows(
            """
            select student_id, exam_name, score_text, certificate_no, completion_date, note
            from student_exam_results
            order by completion_date asc, student_id asc
            """
        ):
            source_entries.append(
                {
                    "student_id": item["student_id"],
                    "requirement": "日本語教育の参照枠（試験）",
                    "destination": item["exam_name"],
                    "certificate_no": item["certificate_no"],
                    "completion_date": item["completion_date"],
                    "is_qualifying": 1,
                    "is_withdrawal": 0,
                    "category": "c",
                    "display_name": display_names.get(item["student_id"], ""),
                    "score_text": item.get("score_text", ""),
                    "note": item.get("note", ""),
                }
            )
        for item in rows(
            """
            select student_id, outcome_type, destination, certificate_no, completion_date, score_text, note, category
            from student_withdrawal_outcomes
            order by completion_date asc, student_id asc
            """
        ):
            source_entries.append(
                {
                    "student_id": item["student_id"],
                    "requirement": item["outcome_type"],
                    "destination": item["destination"],
                    "certificate_no": item["certificate_no"],
                    "completion_date": item["completion_date"],
                    "is_qualifying": 1,
                    "is_withdrawal": 1,
                    "category": item["category"],
                    "display_name": display_names.get(item["student_id"], ""),
                    "score_text": item.get("score_text", ""),
                    "note": item.get("note", ""),
                }
            )
        source_entries.sort(key=lambda item: (item["completion_date"], item["student_id"], item["category"], item["requirement"]))
        entries = []
        for index, item in enumerate(source_entries, start=1):
            student = students.get(item["student_id"])
            if not student:
                continue
            entries.append(
                {
                    "no": index,
                    "student_name": item.get("display_name") or student["name"],
                    "residence_card_no": student.get("residence_card_no") or "",
                    "requirement": item["requirement"],
                    "destination": item["destination"],
                    "certificate_no": item["certificate_no"],
                    "completion_date": item["completion_date"],
                    "course_name": semiannual_course_name(student.get("class_name") or ""),
                    "category": item["category"],
                    "is_qualifying": item["is_qualifying"],
                    "is_withdrawal": item["is_withdrawal"],
                    "score_text": item.get("score_text") or "",
                    "note": item.get("note") or "",
                }
            )

        unique_completion_targets = {item["student_id"] for item in source_entries if not item["is_withdrawal"]}
        unique_qualifying_targets = {item["student_id"] for item in source_entries if item["is_qualifying"]}
        unique_withdrawal_targets = {item["student_id"] for item in source_entries if item["is_withdrawal"]}
        completed_count = len(unique_completion_targets)
        qualifying_count = len(unique_qualifying_targets)
        withdrawal_count = len(unique_withdrawal_targets)
        denominator = completed_count + withdrawal_count
        ratio = round((qualifying_count / denominator) * 100, 1) if denominator else 0
        course_breakdown = {"総合2年コース": {"a": 0, "b": 0, "c": 0}, "総合1年コース": {"a": 0, "b": 0, "c": 0}}
        for item in entries:
            course = item["course_name"]
            category = item["category"]
            if course in course_breakdown and category in course_breakdown[course]:
                course_breakdown[course][category] += 1
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = 'annual-completion' and document_type = '年度終了報告'",
        )
        document_no = existing["document_no"] if existing else f"YR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        return {
            "summary": {
                "document_no": document_no,
                "issue_date": datetime.now().strftime("%Y-%m-%d"),
                "school_name": "渋谷外語学院",
                "operator_name": "知日株式会社",
                "ratio_display": f"{ratio:.1f}%",
                "completed_count": completed_count,
                "qualifying_count": qualifying_count,
                "withdrawal_count": withdrawal_count,
                "compliance_mark": "〇" if ratio >= 70 else "×",
                "status": "基準適合" if ratio >= 70 else "要確認",
                "course_breakdown": course_breakdown,
            },
            "entries": entries,
        }

    def annual_results_overview(self) -> dict:
        students = rows(
            """
            select id, student_no, name, class_name, status
            from students
            order by student_no asc, created_at asc
            """
        )
        student_map = {item["id"]: item for item in students}
        display_names = {
            item["student_id"]: item["display_name"]
            for item in rows("select student_id, max(display_name) as display_name from annual_completion_results group by student_id")
            if item.get("display_name")
        }

        def with_student_meta(item: dict, result_type: str, title: str, detail: str = "", certificate_no: str = "", score_text: str = "") -> dict:
            student = student_map.get(item["student_id"], {})
            return {
                "id": item["id"],
                "result_type": result_type,
                "student_id": item["student_id"],
                "student_no": student.get("student_no", ""),
                "student_name": student.get("name", ""),
                "display_name": display_names.get(item["student_id"], "") or student.get("name", ""),
                "class_name": student.get("class_name", ""),
                "status": student.get("status", ""),
                "title": title,
                "main_name": title,
                "sub_name": detail if detail else score_text,
                "detail": detail,
                "certificate_no": certificate_no,
                "score_text": score_text,
                "completion_date": item.get("completion_date", ""),
                "note": item.get("note", ""),
            }

        advancement = [
            with_student_meta(
                item,
                "advancement",
                item["school_name"],
                item.get("department_name", ""),
            )
            for item in rows(
                """
                select id, student_id, school_name, department_name, completion_date, note
                from student_advancement_results
                order by completion_date desc, created_at desc
                """
            )
        ]
        employment = [
            with_student_meta(
                item,
                "employment",
                item["company_name"],
                item.get("job_title", ""),
            )
            for item in rows(
                """
                select id, student_id, company_name, job_title, completion_date, note
                from student_employment_results
                order by completion_date desc, created_at desc
                """
            )
        ]
        exams = [
            with_student_meta(
                item,
                "exam",
                item["exam_name"],
                "",
                item.get("certificate_no", ""),
                item.get("score_text", ""),
            )
            for item in rows(
                """
                select id, student_id, exam_name, score_text, certificate_no, completion_date, note
                from student_exam_results
                order by completion_date desc, created_at desc
                """
            )
        ]
        withdrawals = [
            {
                **with_student_meta(
                    item,
                    "withdrawal",
                    item["destination"],
                    item["outcome_type"],
                    item.get("certificate_no", ""),
                    item.get("score_text", ""),
                ),
                "category": item.get("category", ""),
                "outcome_type": item.get("outcome_type", ""),
            }
            for item in rows(
                """
                select id, student_id, outcome_type, destination, certificate_no, completion_date, score_text, note, category
                from student_withdrawal_outcomes
                order by completion_date desc, created_at desc
                """
            )
        ]
        return {
            "summary": {
                "student_count": len(students),
                "advancement_count": len(advancement),
                "employment_count": len(employment),
                "exam_count": len(exams),
                "withdrawal_count": len(withdrawals),
                "total_count": len(advancement) + len(employment) + len(exams) + len(withdrawals),
            },
            "students": students,
            "advancement": advancement,
            "employment": employment,
            "exams": exams,
            "withdrawals": withdrawals,
        }

    def clear_export_cache_prefixes(self, prefixes: list[str]) -> None:
        conn = connect()
        cur = conn.cursor()
        for prefix in prefixes:
            cached_rows = cur.execute("select file_path from export_files where export_key like ?", (f"{prefix}%",)).fetchall()
            cur.execute("delete from export_files where export_key like ?", (f"{prefix}%",))
            for item in cached_rows:
                path = Path(item["file_path"])
                if path.exists() and path.is_file():
                    try:
                        path.unlink()
                    except OSError:
                        pass
        conn.commit()
        conn.close()

    def create_annual_result(self, body: dict) -> None:
        result_type = (body.get("result_type") or "").strip()
        student_id = (body.get("student_id") or "").strip()
        completion_date = (body.get("completion_date") or "").strip()
        display_name = (body.get("display_name") or "").strip()
        note = (body.get("note") or "").strip()
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        if not completion_date:
            return self.json_error("VALIDATION_ERROR", "完了日を入力してください。", status=400)

        conn = connect()
        cur = conn.cursor()
        created_id = new_id()
        annual_result_id = new_id()
        now = now_iso()

        if result_type == "advancement":
            school_name = (body.get("main_name") or "").strip()
            department_name = (body.get("sub_name") or "").strip()
            if not school_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "進学先学校名を入力してください。", status=400)
            cur.execute(
                """
                insert into student_advancement_results
                (id, student_id, school_name, department_name, completion_date, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (created_id, student_id, school_name, department_name, completion_date, note, now),
            )
            cur.execute(
                """
                insert into annual_completion_results
                (id, student_id, requirement, destination, certificate_no, completion_date, is_qualifying, is_withdrawal, category, display_name, score_text, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (annual_result_id, student_id, "進学", school_name, "", completion_date, 1, 0, "a", display_name, "", note, now),
            )
            audit_message = f"年度終了結果に進学先「{school_name}」を追加しました。"
        elif result_type == "employment":
            company_name = (body.get("main_name") or "").strip()
            job_title = (body.get("sub_name") or "").strip()
            if not company_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "就職先会社名を入力してください。", status=400)
            cur.execute(
                """
                insert into student_employment_results
                (id, student_id, company_name, job_title, completion_date, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (created_id, student_id, company_name, job_title, completion_date, note, now),
            )
            cur.execute(
                """
                insert into annual_completion_results
                (id, student_id, requirement, destination, certificate_no, completion_date, is_qualifying, is_withdrawal, category, display_name, score_text, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (annual_result_id, student_id, "就職", company_name, "", completion_date, 1, 0, "b", display_name, "", note, now),
            )
            audit_message = f"年度終了結果に就職先「{company_name}」を追加しました。"
        elif result_type == "exam":
            exam_name = (body.get("main_name") or "").strip()
            score_text = (body.get("sub_name") or "").strip()
            certificate_no = (body.get("certificate_no") or "").strip()
            if not exam_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "試験名を入力してください。", status=400)
            cur.execute(
                """
                insert into student_exam_results
                (id, student_id, exam_name, score_text, certificate_no, completion_date, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (created_id, student_id, exam_name, score_text, certificate_no, completion_date, note, now),
            )
            cur.execute(
                """
                insert into annual_completion_results
                (id, student_id, requirement, destination, certificate_no, completion_date, is_qualifying, is_withdrawal, category, display_name, score_text, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (annual_result_id, student_id, "日本語教育の参照枠（試験）", exam_name, certificate_no, completion_date, 1, 0, "c", display_name, score_text, note, now),
            )
            audit_message = f"年度終了結果に試験「{exam_name}」を追加しました。"
        elif result_type == "withdrawal":
            outcome_type = (body.get("outcome_type") or "").strip() or "就職"
            destination = (body.get("main_name") or "").strip()
            score_text = (body.get("sub_name") or "").strip()
            certificate_no = (body.get("certificate_no") or "").strip()
            category_map = {
                "進学": "a",
                "就職": "b",
                "日本語教育の参照枠（試験）": "c",
            }
            category = category_map.get(outcome_type, "b")
            if not destination:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "退学後の進路内容を入力してください。", status=400)
            cur.execute(
                """
                insert into student_withdrawal_outcomes
                (id, student_id, outcome_type, destination, certificate_no, completion_date, score_text, note, category, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (created_id, student_id, outcome_type, destination, certificate_no, completion_date, score_text, note, category, now),
            )
            cur.execute(
                """
                insert into annual_completion_results
                (id, student_id, requirement, destination, certificate_no, completion_date, is_qualifying, is_withdrawal, category, display_name, score_text, note, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (annual_result_id, student_id, outcome_type, destination, certificate_no, completion_date, 1, 1, category, display_name, score_text, note, now),
            )
            audit_message = f"年度終了結果に退学後進路「{destination}」を追加しました。"
        else:
            conn.close()
            return self.json_error("VALIDATION_ERROR", "結果種別が不正です。", status=400)

        write_audit(cur, "annual_result.create", "student", student_id, audit_message)
        conn.commit()
        conn.close()
        self.clear_export_cache_prefixes(["annual_completion:", "annual_completion_list:"])
        return self.json({"ok": True, "overview": self.annual_results_overview()})

    def update_student(self, student_id: str, body: dict) -> None:
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        required = ["name", "nationality", "status", "student_no"]
        missing = [key for key in required if not (body.get(key) or "").strip()]
        if missing:
            return self.json_error("VALIDATION_ERROR", "必須項目が不足しています。", {"missing": missing}, 422)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            update students
            set student_no = ?, name = ?, nationality = ?, status = ?, class_name = ?,
                residence_card_no = ?, residence_expiry = ?, attendance_rate = ?, phone = ?,
                address_japan = ?, passport_no = ?, birth_date = ?, residence_status = ?,
                admission_date = ?, emergency_contact = ?, notes = ?
            where id = ?
            """,
            (
                body.get("student_no", "").strip(),
                body.get("name", "").strip(),
                body.get("nationality", "").strip(),
                body.get("status", "").strip(),
                body.get("class_name", "").strip(),
                body.get("residence_card_no", "").strip(),
                body.get("residence_expiry", "").strip(),
                float(body.get("attendance_rate") or 0),
                body.get("phone", "").strip(),
                body.get("address_japan", "").strip(),
                body.get("passport_no", "").strip(),
                body.get("birth_date", "").strip(),
                body.get("residence_status", "").strip(),
                body.get("admission_date", "").strip(),
                body.get("emergency_contact", "").strip(),
                body.get("notes", "").strip(),
                student_id,
            ),
        )
        write_audit(cur, "student.update", "student", student_id, f"学生主档案 {body.get('name', '').strip()} を更新しました。")
        conn.commit()
        conn.close()
        return self.json(self.student_detail(student_id))

    def create_certificate_request(self, body: dict) -> None:
        student_id = (body.get("student_id") or "").strip()
        certificate_type = (body.get("certificate_type") or "").strip()
        purpose = (body.get("purpose") or "").strip()
        requested_by = (body.get("requested_by") or "student").strip()
        try:
            copies = int(body.get("copies") or 1)
        except (TypeError, ValueError):
            copies = 1
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        allowed = {"出席率証明書", "成績証明書", "修了証明書"}
        if certificate_type not in allowed:
            return self.json_error("VALIDATION_ERROR", "証明書種別が不正です。", {"allowed": sorted(allowed)}, 422)
        if copies < 1 or copies > 10:
            return self.json_error("VALIDATION_ERROR", "部数は 1 から 10 の間で入力してください。", status=422)
        conn = connect()
        cur = conn.cursor()
        request_id = new_id()
        cur.execute(
            """
            insert into certificate_requests
            (id, student_id, certificate_type, copies, purpose, requested_by, status, issued_by, requested_at, approved_at, issued_at, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (request_id, student_id, certificate_type, copies, purpose, requested_by, "申請中", "", now_iso(), None, None, now_iso()),
        )
        write_audit(cur, "certificate.request", "student", student_id, f"{certificate_type} の申請を受け付けました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True, "request": row("select * from certificate_requests where id = ?", (request_id,))})

    def create_public_certificate_request(self, body: dict) -> None:
        session_token = (body.get("session_token") or "").strip()
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        payload = {
            "student_id": student["id"],
            "certificate_type": body.get("certificate_type"),
            "purpose": body.get("purpose"),
            "copies": body.get("copies"),
            "requested_by": "student",
        }
        self.create_certificate_request(payload)

    def create_public_leave_request(self, body: dict) -> None:
        session_token = (body.get("session_token") or "").strip()
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        request_type = (body.get("request_type") or "").strip()
        request_date = (body.get("request_date") or "").strip()
        period_label = (body.get("period_label") or "").strip()
        reason = (body.get("reason") or "").strip()
        detail = (body.get("detail") or "").strip()
        if request_type not in {"公欠", "欠席"}:
            return self.json_error("VALIDATION_ERROR", "申請種別が不正です。", status=422)
        if not request_date:
            return self.json_error("VALIDATION_ERROR", "日付を入力してください。", status=422)
        if not reason:
            return self.json_error("VALIDATION_ERROR", "理由を入力してください。", status=422)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into student_leave_requests
            (id, student_id, request_type, request_date, period_label, reason, detail, status, created_at, reviewed_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), student["id"], request_type, request_date, period_label, reason, detail, "申請中", now_iso(), None),
        )
        write_audit(cur, "student.leave_request", "student", student["id"], f"{request_type}申請を受け付けました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def update_public_student_settings(self, body: dict) -> None:
        session_token = (body.get("session_token") or "").strip()
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        settings = {
            "push_attendance": bool(body.get("push_attendance")),
            "push_homework": bool(body.get("push_homework")),
            "push_bulletin": bool(body.get("push_bulletin")),
            "display_language": (body.get("display_language") or "ja").strip() or "ja",
        }
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            "update student_portal_accounts set settings_json = ?, updated_at = ? where student_id = ?",
            (json.dumps(settings, ensure_ascii=False), now_iso(), student["id"]),
        )
        write_audit(cur, "student.settings", "student", student["id"], "学生ポータル設定を更新しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True, "settings": settings})

    def create_public_group_message(self, body: dict) -> None:
        session_token = (body.get("session_token") or "").strip()
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        message = (body.get("message") or "").strip()
        channel = (body.get("channel") or "classroom").strip()
        if not message:
            return self.json_error("VALIDATION_ERROR", "メッセージを入力してください。", status=422)
        if channel not in {"classroom", "homeroom"}:
            return self.json_error("VALIDATION_ERROR", "送信先が不正です。", status=422)
        conn = connect()
        cur = conn.cursor()
        if channel == "homeroom":
            cur.execute(
                """
                insert into student_homeroom_messages
                (id, student_id, author_name, author_role, body, posted_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                (new_id(), student["id"], student.get("name") or student.get("student_no") or "", "student", message, now_iso()),
            )
            write_audit(cur, "student.homeroom_message", "student", student["id"], "班主任チャットへメッセージを送信しました。")
        else:
            cur.execute(
                """
                insert into class_group_messages
                (id, class_name, author_name, author_role, body, posted_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                (new_id(), student.get("class_name") or "", student.get("name") or student.get("student_no") or "", "student", message, now_iso()),
            )
            write_audit(cur, "student.group_message", "student", student["id"], "クラスグループへメッセージを送信しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def create_public_homework_submission(self) -> None:
        form = self.read_multipart_form()
        session_token = (form.get("session_token", {}) or {}).get("value", "").strip()
        student = self.student_by_session_token(session_token)
        if not student:
            return self.json_error("AUTH_FAILED", "ログイン状態を確認できません。もう一度ログインしてください。", status=401)
        assignment_id = (form.get("assignment_id", {}) or {}).get("value", "").strip()
        note = (form.get("note", {}) or {}).get("value", "").strip()
        assignment = row("select * from student_homework_assignments where id = ?", (assignment_id,))
        if not assignment:
            return self.json_error("NOT_FOUND", "課題が見つかりません。", status=404)
        upload = form.get("file")
        file_name = ""
        file_path = ""
        if upload and upload.get("filename"):
            homework_dir = UPLOAD_DIR / "student_homework"
            homework_dir.mkdir(parents=True, exist_ok=True)
            file_name = Path(upload["filename"]).name
            stored_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}-{file_name}"
            destination = homework_dir / stored_name
            destination.write_bytes(upload.get("content") or b"")
            file_path = str(destination)
        existing = row(
            "select * from student_homework_submissions where assignment_id = ? and student_id = ?",
            (assignment_id, student["id"]),
        )
        conn = connect()
        cur = conn.cursor()
        if existing:
            cur.execute(
                """
                update student_homework_submissions
                set file_name = ?, file_path = ?, note = ?, status = ?, submitted_at = ?
                where id = ?
                """,
                (file_name or existing["file_name"], file_path or existing["file_path"], note, "再提出", now_iso(), existing["id"]),
            )
        else:
            cur.execute(
                """
                insert into student_homework_submissions
                (id, assignment_id, student_id, file_name, file_path, note, status, submitted_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), assignment_id, student["id"], file_name, file_path, note, "提出済", now_iso()),
            )
        write_audit(cur, "student.homework_submission", "student", student["id"], f"課題 {assignment['title']} を提出しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def approve_certificate_request(self, request_id: str) -> None:
        request = row("select * from certificate_requests where id = ?", (request_id,))
        if not request:
            return self.json_error("NOT_FOUND", "証明書申請が見つかりません。", status=404)
        if request["status"] != "申請中":
            return self.json_error("STATUS_INVALID", "申請中の証明書のみ承認できます。", status=409)
        conn = connect()
        cur = conn.cursor()
        cur.execute("update certificate_requests set status = '承認済', approved_at = ?, issued_by = ? where id = ?", (now_iso(), "事務局 山田", request_id))
        write_audit(cur, "certificate.approve", "student", request["student_id"], f"{request['certificate_type']} を承認しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True, "request": row("select * from certificate_requests where id = ?", (request_id,))})

    def certificate_export_fields(self, request_id: str) -> dict | None:
        request = row(
            """
            select cr.*, s.student_no, s.name as student_name, s.nationality, s.class_name, s.attendance_rate, s.admission_date
            from certificate_requests cr
            left join students s on s.id = cr.student_id
            where cr.id = ?
            """,
            (request_id,),
        )
        if not request:
            return None
        certificate_no = f"CERT-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        return {
            "document_no": certificate_no,
            "issue_date": datetime.now().strftime("%Y-%m-%d"),
            "certificate_type": request["certificate_type"],
            "student_no": request.get("student_no") or "",
            "student_name": request.get("student_name") or "",
            "nationality": request.get("nationality") or "",
            "class_name": request.get("class_name") or "",
            "attendance_rate": request.get("attendance_rate") or "",
            "admission_date": request.get("admission_date") or "",
            "purpose": request.get("purpose") or "",
            "copies": request.get("copies") or 1,
            "issued_by": "事務局 山田",
        }

    def prewarm_certificate_export(self, request_id: str, document: dict | None = None) -> dict | None:
        document = document or row(
            "select * from generated_documents where target_type = 'certificate_request' and target_id = ?",
            (request_id,),
        )
        if not document:
            return None
        fields = self.certificate_export_fields(request_id)
        if not fields:
            return None
        fields["document_no"] = document["document_no"]
        export_key = f"certificate:{request_id}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "student_certificate",
            request_id,
            lambda: export_xlsx_document(
                "student_certificate",
                fields,
                f"certificate-{safe_file_stem(fields['student_name'])}",
            ),
        )

    def issue_certificate_request(self, request_id: str) -> None:
        request = row("select * from certificate_requests where id = ?", (request_id,))
        if not request:
            return self.json_error("NOT_FOUND", "証明書申請が見つかりません。", status=404)
        if request["status"] not in {"承認済", "発行済"}:
            return self.json_error("STATUS_INVALID", "承認済みの証明書のみ発行できます。", status=409)
        existing = row("select * from generated_documents where target_type = 'certificate_request' and target_id = ?", (request_id,))
        if existing:
            export = self.prewarm_certificate_export(request_id, existing)
            return self.json({"ok": True, "document": existing, "export": export})
        document_id = new_id()
        document_no = certificate_document_no()
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "certificate_request", request_id, request["certificate_type"], document_no, request["certificate_type"], "generated", now_iso()),
        )
        cur.execute(
            "update certificate_requests set status = '発行済', issued_at = ?, issued_by = ? where id = ?",
            (now_iso(), "事務局 山田", request_id),
        )
        write_audit(cur, "certificate.issue", "student", request["student_id"], f"{request['certificate_type']} {document_no} を発行しました。")
        conn.commit()
        conn.close()
        document = row("select * from generated_documents where id = ?", (document_id,))
        export = self.prewarm_certificate_export(request_id, document)
        return self.json({"ok": True, "document": document, "export": export})

    def review_student_leave_request(self, request_id: str, body: dict) -> None:
        leave_request = row("select * from student_leave_requests where id = ?", (request_id,))
        if not leave_request:
            return self.json_error("NOT_FOUND", "申請が見つかりません。", status=404)
        new_status = (body.get("status") or "").strip()
        if new_status not in {"承認済", "差戻し"}:
            return self.json_error("VALIDATION_ERROR", "状態が不正です。", status=422)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            "update student_leave_requests set status = ?, reviewed_at = ? where id = ?",
            (new_status, now_iso(), request_id),
        )
        if new_status == "承認済":
            scheduled_minutes = self.period_minutes(leave_request.get("period_label") or "")
            existing_record = cur.execute(
                """
                select * from student_attendance_records
                where student_id = ? and class_date = ? and period_label = ?
                """,
                (leave_request["student_id"], leave_request["request_date"], leave_request.get("period_label") or ""),
            ).fetchone()
            note = leave_request.get("detail") or leave_request.get("reason") or ""
            if existing_record:
                cur.execute(
                    """
                    update student_attendance_records
                    set status = ?, attendance_minutes = ?, scheduled_minutes = ?, note = ?
                    where id = ?
                    """,
                    (leave_request["request_type"], scheduled_minutes, scheduled_minutes, note, existing_record["id"]),
                )
            else:
                cur.execute(
                    """
                    insert into student_attendance_records
                    (id, student_id, class_date, period_label, status, attendance_minutes, scheduled_minutes, note, created_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id(),
                        leave_request["student_id"],
                        leave_request["request_date"],
                        leave_request.get("period_label") or "",
                        leave_request["request_type"],
                        scheduled_minutes,
                        scheduled_minutes,
                        note,
                        now_iso(),
                    ),
                )
        write_audit(cur, "student.leave_review", "student", leave_request["student_id"], f"{leave_request['request_type']}申請を {new_status} に更新しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def create_student_bulletin(self, body: dict) -> None:
        title = (body.get("title") or "").strip()
        message = (body.get("body") or "").strip()
        scope = (body.get("scope") or "all").strip()
        class_name = (body.get("class_name") or "").strip()
        if not title or not message:
            return self.json_error("VALIDATION_ERROR", "タイトルと内容を入力してください。", status=422)
        if scope not in {"all", "class"}:
            return self.json_error("VALIDATION_ERROR", "公開範囲が不正です。", status=422)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into student_bulletin_posts
            (id, title, body, scope, class_name, published_at, created_at)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), title, message, scope, class_name, now_iso(), now_iso()),
        )
        write_audit(cur, "student.bulletin_create", "system", class_name or "all", f"学生掲示板に「{title}」を掲載しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def toggle_student_bulletin_pin(self, bulletin_id: str, body: dict) -> None:
        bulletin = row("select * from student_bulletin_posts where id = ?", (bulletin_id,))
        if not bulletin:
            return self.json_error("NOT_FOUND", "掲示が見つかりません。", status=404)
        pinned = 1 if body.get("pinned") else 0
        conn = connect()
        cur = conn.cursor()
        cur.execute("update student_bulletin_posts set pinned = ? where id = ?", (pinned, bulletin_id))
        write_audit(cur, "student.bulletin_pin", "system", bulletin_id, f"学生掲示板の置頂状態を {pinned} に更新しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def create_admin_group_message(self, body: dict) -> None:
        class_name = (body.get("class_name") or "").strip()
        message = (body.get("message") or "").strip()
        if not class_name or not message:
            return self.json_error("VALIDATION_ERROR", "クラス名とメッセージを入力してください。", status=422)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into class_group_messages
            (id, class_name, author_name, author_role, body, posted_at)
            values (?, ?, ?, ?, ?, ?)
            """,
            (new_id(), class_name, "事務局 山田", "staff", message, now_iso()),
        )
        write_audit(cur, "student.group_message_admin", "class", class_name, "クラスグループへ事務局メッセージを送信しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def delete_group_message(self, message_id: str) -> None:
        message = row("select * from class_group_messages where id = ?", (message_id,))
        if not message:
            return self.json_error("NOT_FOUND", "メッセージが見つかりません。", status=404)
        conn = connect()
        cur = conn.cursor()
        cur.execute("delete from class_group_messages where id = ?", (message_id,))
        write_audit(cur, "student.group_message_delete", "class", message.get("class_name") or "", "クラスグループメッセージを削除しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def review_student_homework_submission(self, submission_id: str, body: dict) -> None:
        submission = row("select * from student_homework_submissions where id = ?", (submission_id,))
        if not submission:
            return self.json_error("NOT_FOUND", "提出物が見つかりません。", status=404)
        status = (body.get("status") or "").strip()
        review_comment = (body.get("review_comment") or "").strip()
        review_score_raw = body.get("review_score")
        review_score = None
        if review_score_raw not in (None, ""):
            try:
                review_score = int(review_score_raw)
            except (TypeError, ValueError):
                return self.json_error("VALIDATION_ERROR", "点数は整数で入力してください。", status=422)
        if status not in {"確認済", "再提出依頼"}:
            return self.json_error("VALIDATION_ERROR", "状態が不正です。", status=422)
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            update student_homework_submissions
            set status = ?, review_comment = ?, review_score = ?, reviewed_by = ?, reviewed_at = ?
            where id = ?
            """,
            (status, review_comment, review_score, "事務局 山田", now_iso(), submission_id),
        )
        write_audit(cur, "student.homework_review", "student", submission["student_id"], f"課題提出を {status} に更新しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def annual_result_source(self, result_id: str) -> dict | None:
        advancement = row("select * from student_advancement_results where id = ?", (result_id,))
        if advancement:
            return {"result_type": "advancement", "row": advancement}
        employment = row("select * from student_employment_results where id = ?", (result_id,))
        if employment:
            return {"result_type": "employment", "row": employment}
        exam = row("select * from student_exam_results where id = ?", (result_id,))
        if exam:
            return {"result_type": "exam", "row": exam}
        withdrawal = row("select * from student_withdrawal_outcomes where id = ?", (result_id,))
        if withdrawal:
            return {"result_type": "withdrawal", "row": withdrawal}
        return None

    def find_annual_completion_row_id(self, cur: sqlite3.Cursor, result_type: str, source_row: dict) -> str | None:
        if result_type == "advancement":
            matched = cur.execute(
                """
                select id from annual_completion_results
                where student_id = ? and requirement = '進学' and destination = ? and completion_date = ? and category = 'a'
                order by created_at desc limit 1
                """,
                (source_row["student_id"], source_row["school_name"], source_row["completion_date"]),
            ).fetchone()
        elif result_type == "employment":
            matched = cur.execute(
                """
                select id from annual_completion_results
                where student_id = ? and requirement = '就職' and destination = ? and completion_date = ? and category = 'b'
                order by created_at desc limit 1
                """,
                (source_row["student_id"], source_row["company_name"], source_row["completion_date"]),
            ).fetchone()
        elif result_type == "exam":
            matched = cur.execute(
                """
                select id from annual_completion_results
                where student_id = ? and requirement = '日本語教育の参照枠（試験）' and destination = ? and certificate_no = ? and completion_date = ? and category = 'c'
                order by created_at desc limit 1
                """,
                (source_row["student_id"], source_row["exam_name"], source_row["certificate_no"], source_row["completion_date"]),
            ).fetchone()
        else:
            matched = cur.execute(
                """
                select id from annual_completion_results
                where student_id = ? and requirement = ? and destination = ? and certificate_no = ? and completion_date = ? and category = ? and is_withdrawal = 1
                order by created_at desc limit 1
                """,
                (
                    source_row["student_id"],
                    source_row["outcome_type"],
                    source_row["destination"],
                    source_row["certificate_no"],
                    source_row["completion_date"],
                    source_row["category"],
                ),
            ).fetchone()
        return matched["id"] if matched else None

    def update_annual_result(self, result_id: str, body: dict) -> None:
        source = self.annual_result_source(result_id)
        if not source:
            return self.json_error("NOT_FOUND", "年度結果が見つかりません。", status=404)
        result_type = source["result_type"]
        source_row = source["row"]
        student_id = source_row["student_id"]
        display_name = (body.get("display_name") or "").strip()
        note = (body.get("note") or "").strip()
        completion_date = (body.get("completion_date") or "").strip()
        main_name = (body.get("main_name") or "").strip()
        sub_name = (body.get("sub_name") or "").strip()
        certificate_no = (body.get("certificate_no") or "").strip()
        if not completion_date:
            return self.json_error("VALIDATION_ERROR", "完了日を入力してください。", status=400)
        annual_row_id = None
        conn = connect()
        cur = conn.cursor()
        annual_row_id = self.find_annual_completion_row_id(cur, result_type, source_row)

        if result_type == "advancement":
            if not main_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "進学先学校名を入力してください。", status=400)
            cur.execute(
                "update student_advancement_results set school_name = ?, department_name = ?, completion_date = ?, note = ? where id = ?",
                (main_name, sub_name, completion_date, note, result_id),
            )
            if annual_row_id:
                cur.execute(
                    "update annual_completion_results set destination = ?, completion_date = ?, note = ? where id = ?",
                    (main_name, completion_date, note, annual_row_id),
                )
            audit_message = f"年度終了結果の進学先「{main_name}」を更新しました。"
        elif result_type == "employment":
            if not main_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "就職先会社名を入力してください。", status=400)
            cur.execute(
                "update student_employment_results set company_name = ?, job_title = ?, completion_date = ?, note = ? where id = ?",
                (main_name, sub_name, completion_date, note, result_id),
            )
            if annual_row_id:
                cur.execute(
                    "update annual_completion_results set destination = ?, completion_date = ?, note = ? where id = ?",
                    (main_name, completion_date, note, annual_row_id),
                )
            audit_message = f"年度終了結果の就職先「{main_name}」を更新しました。"
        elif result_type == "exam":
            if not main_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "試験名を入力してください。", status=400)
            cur.execute(
                "update student_exam_results set exam_name = ?, score_text = ?, certificate_no = ?, completion_date = ?, note = ? where id = ?",
                (main_name, sub_name, certificate_no, completion_date, note, result_id),
            )
            if annual_row_id:
                cur.execute(
                    "update annual_completion_results set destination = ?, score_text = ?, certificate_no = ?, completion_date = ?, note = ? where id = ?",
                    (main_name, sub_name, certificate_no, completion_date, note, annual_row_id),
                )
            audit_message = f"年度終了結果の試験「{main_name}」を更新しました。"
        else:
            outcome_type = (body.get("outcome_type") or "").strip() or "就職"
            category_map = {"進学": "a", "就職": "b", "日本語教育の参照枠（試験）": "c"}
            category = category_map.get(outcome_type, "b")
            if not main_name:
                conn.close()
                return self.json_error("VALIDATION_ERROR", "退学後の進路内容を入力してください。", status=400)
            cur.execute(
                """
                update student_withdrawal_outcomes
                set outcome_type = ?, destination = ?, certificate_no = ?, completion_date = ?, score_text = ?, note = ?, category = ?
                where id = ?
                """,
                (outcome_type, main_name, certificate_no, completion_date, sub_name, note, category, result_id),
            )
            if annual_row_id:
                cur.execute(
                    """
                    update annual_completion_results
                    set requirement = ?, destination = ?, certificate_no = ?, completion_date = ?, score_text = ?, note = ?, category = ?
                    where id = ?
                    """,
                    (outcome_type, main_name, certificate_no, completion_date, sub_name, note, category, annual_row_id),
                )
            audit_message = f"年度終了結果の退学後進路「{main_name}」を更新しました。"

        if display_name:
            cur.execute("update annual_completion_results set display_name = ? where student_id = ?", (display_name, student_id))
        write_audit(cur, "annual_result.update", "student", student_id, audit_message)
        conn.commit()
        conn.close()
        self.clear_export_cache_prefixes(["annual_completion:", "annual_completion_list:"])
        return self.json({"ok": True, "overview": self.annual_results_overview()})

    def delete_annual_result(self, result_id: str) -> None:
        source = self.annual_result_source(result_id)
        if not source:
            return self.json_error("NOT_FOUND", "年度結果が見つかりません。", status=404)
        result_type = source["result_type"]
        source_row = source["row"]
        conn = connect()
        cur = conn.cursor()
        annual_row_id = self.find_annual_completion_row_id(cur, result_type, source_row)
        if result_type == "advancement":
            cur.execute("delete from student_advancement_results where id = ?", (result_id,))
            audit_message = f"年度終了結果の進学先「{source_row['school_name']}」を削除しました。"
        elif result_type == "employment":
            cur.execute("delete from student_employment_results where id = ?", (result_id,))
            audit_message = f"年度終了結果の就職先「{source_row['company_name']}」を削除しました。"
        elif result_type == "exam":
            cur.execute("delete from student_exam_results where id = ?", (result_id,))
            audit_message = f"年度終了結果の試験「{source_row['exam_name']}」を削除しました。"
        else:
            cur.execute("delete from student_withdrawal_outcomes where id = ?", (result_id,))
            audit_message = f"年度終了結果の退学後進路「{source_row['destination']}」を削除しました。"
        if annual_row_id:
            cur.execute("delete from annual_completion_results where id = ?", (annual_row_id,))
        write_audit(cur, "annual_result.delete", "student", source_row["student_id"], audit_message)
        conn.commit()
        conn.close()
        self.clear_export_cache_prefixes(["annual_completion:", "annual_completion_list:"])
        return self.json({"ok": True, "overview": self.annual_results_overview()})

    def semiannual_attendance_report(self, period: str | None = None) -> dict:
        report_period = period or self.default_semiannual_period()
        students = rows(
            """
            select
              id,
              student_no,
              name,
              nationality,
              class_name,
              status,
              residence_card_no,
              residence_expiry,
              attendance_rate
            from students
            order by class_name asc, student_no asc
            """
        )
        students = [
            {
                **item,
                "course_name": semiannual_course_name(item.get("class_name") or ""),
                **semiannual_attendance_detail(item["id"], item.get("attendance_rate")),
            }
            for item in students
        ]
        low_attendance_students = [item for item in students if float(item.get("attendance_rate") or 0) < 80]
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = ? and document_type = '半期毎出席率報告'",
            (report_period,),
        )
        document_no = existing["document_no"] if existing else f"SA-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        average_attendance = (
            round(sum(float(item.get("attendance_rate") or 0) for item in students) / len(students), 1) if students else 0
        )
        period_match = re.match(r"(\d{4})", report_period)
        school_year = f"{period_match.group(1) if period_match else datetime.now().year}年度"
        course_summaries = []
        for index, course_name in enumerate(["総合1年コース", "総合2年コース"], start=1):
            course_students = [item for item in students if item.get("course_name") == course_name]
            if not course_students:
                continue
            total_lesson_hours = 400.0
            required_hours = round(sum(float(item.get("lesson_hours") or 0) for item in course_students), 1)
            attended_hours = round(sum(float(item.get("attended_hours") or 0) for item in course_students), 1)
            course_summaries.append(
                {
                    "no": index,
                    "course_name": course_name,
                    "total_lesson_hours": total_lesson_hours,
                    "required_hours": required_hours,
                    "attended_hours": attended_hours,
                }
            )
        summary_totals = {
            "required_hours": round(sum(item["required_hours"] for item in course_summaries), 1),
            "attended_hours": round(sum(item["attended_hours"] for item in course_summaries), 1),
        }
        return {
            "summary": {
                "report_period": report_period,
                "issue_date": datetime.now().strftime("%Y-%m-%d"),
                "document_no": document_no,
                "student_count": len(students),
                "low_attendance_count": len(low_attendance_students),
                "average_attendance": average_attendance,
                "status": "要確認" if low_attendance_students else "提出準備完了",
                "school_name": "渋谷外語学院",
                "operator_name": "知日株式会社",
                "staff_name": "中島 淳子",
                "phone": "03-6233-9963",
                "school_year": school_year,
            },
            "students": students,
            "low_attendance_students": low_attendance_students,
            "course_summaries": course_summaries,
            "summary_totals": summary_totals,
        }

    def may_november_report(self, period: str | None = None) -> dict:
        report_period = period or self.default_may_november_period()
        students = rows(
            """
            select
              id,
              student_no,
              name,
              nationality,
              class_name,
              status,
              residence_card_no,
              residence_expiry,
              attendance_rate
            from students
            order by class_name asc, student_no asc
            """
        )
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = ? and document_type = '5月11月在留者報告'",
            (report_period,),
        )
        document_no = existing["document_no"] if existing else f"MN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        students = [{**item, **resident_list_demo_detail(item["id"])} for item in students]
        expiring_students = [item for item in students if (item.get("residence_expiry") or "")[:7] <= "2026-09"]
        return {
            "summary": {
                "report_period": report_period,
                "issue_date": datetime.now().strftime("%Y-%m-%d"),
                "document_no": document_no,
                "student_count": len(students),
                "expiring_count": len(expiring_students),
                "status": "要確認" if expiring_students else "提出準備完了",
            },
            "students": students,
            "expiring_students": expiring_students,
        }

    def document_ledger(self) -> dict:
        items = rows(
            """
            select * from (
              select
                '領収書' as document_type,
                rd.receipt_no as document_no,
                rd.created_at as created_at,
                coalesce(rd.issue_date, substr(rd.created_at, 1, 10)) as issue_date,
                rd.payment_id as target_id,
                p.payment_type as category,
                coalesce(rd.student_name, rd.payer_display_name, '') as target_name,
                rd.payer_display_name as subject_name,
                ef.file_url,
                ef.file_path,
                case when ef.file_url is not null then '出力済み' else '未出力' end as export_status
              from receipt_documents rd
              left join payments p on p.id = rd.payment_id
              left join export_files ef on ef.export_key = ('receipt:' || rd.payment_id || ':' || rd.receipt_no)
              where rd.status = 'issued'

              union all

              select
                gd.document_type as document_type,
                gd.document_no as document_no,
                gd.created_at as created_at,
                substr(gd.created_at, 1, 10) as issue_date,
                gd.target_id as target_id,
                coalesce(cr.purpose, '') as category,
                coalesce(s.name, '') as target_name,
                coalesce(s.student_no, '') as subject_name,
                ef.file_url as file_url,
                ef.file_path as file_path,
                case when ef.file_url is not null then '出力済み' else '未出力' end as export_status
              from generated_documents gd
              left join certificate_requests cr on gd.target_type = 'certificate_request' and cr.id = gd.target_id
              left join students s on cr.student_id = s.id
              left join export_files ef on ef.export_key = ('certificate:' || gd.target_id || ':' || gd.document_no)
              where gd.document_type in ('出席率証明書', '成績証明書', '修了証明書')

              union all

              select
                gd.document_type as document_type,
                gd.document_no as document_no,
                gd.created_at as created_at,
                substr(gd.created_at, 1, 10) as issue_date,
                gd.target_id as target_id,
                case
                  when gd.document_type = '合格通知書' then a.admission_term
                  when gd.document_type = '離脱届' then s.status
                  when gd.document_type = '半期毎出席率報告' then gd.target_id
                  when gd.document_type = '5月11月在留者報告' then gd.target_id
                  when gd.document_type = '在留期間更新五表' then '更新対象一覧'
                  when gd.document_type = '出席率不佳報告' then '80%未満対象'
                  else ''
                end as category,
                case
                  when gd.document_type = '合格通知書' then coalesce(a.name, '')
                  when gd.document_type = '離脱届' then coalesce(s.name, '')
                  when gd.document_type = '半期毎出席率報告' then '半期報告'
                  when gd.document_type = '5月11月在留者報告' then '5月/11月報告'
                  when gd.document_type = '在留期間更新五表' then '在留期間更新'
                  when gd.document_type = '出席率不佳報告' then '出席率不佳報告'
                  else ''
                end as target_name,
                case
                  when gd.document_type = '合格通知書' then coalesce(a.agent_name, '')
                  when gd.document_type = '離脱届' then coalesce(s.student_no, '')
                  when gd.document_type = '半期毎出席率報告' then '入管提出用'
                  when gd.document_type = '5月11月在留者報告' then '入管提出用'
                  when gd.document_type = '在留期間更新五表' then '更新五表'
                  when gd.document_type = '出席率不佳報告' then '要指導対象'
                  else ''
                end as subject_name,
                ef.file_url as file_url,
                ef.file_path as file_path,
                case when ef.file_url is not null then '出力済み' else '未出力' end as export_status
              from generated_documents gd
              left join applicants a on gd.target_type = 'applicant' and a.id = gd.target_id
              left join students s on gd.target_type = 'student' and s.id = gd.target_id
              left join export_files ef on ef.export_key =
                case
                  when gd.document_type = '合格通知書' then ('acceptance:' || gd.target_id || ':' || gd.document_no)
                  when gd.document_type = '離脱届' then ('withdrawal:' || gd.target_id || ':' || gd.document_no)
                  when gd.document_type = '半期毎出席率報告' then ('semiannual_attendance:' || gd.target_id || ':' || gd.document_no)
                  when gd.document_type = '5月11月在留者報告' then ('may_november:' || gd.target_id || ':' || gd.document_no)
                  when gd.document_type = '在留期間更新五表' then ('residence_renewal:' || gd.target_id || ':' || gd.document_no)
                  when gd.document_type = '出席率不佳報告' then ('poor_attendance:' || gd.target_id || ':' || gd.document_no)
                  else ''
                end
              where gd.document_type in ('合格通知書', '離脱届', '半期毎出席率報告', '5月11月在留者報告', '在留期間更新五表', '出席率不佳報告')
            )
            order by created_at desc
            """
        )
        return {
            "summary": {
                "total_count": len(items),
                "exported_count": sum(1 for item in items if item.get("file_url")),
                "receipt_count": sum(1 for item in items if item["document_type"] == "領収書"),
                "acceptance_count": sum(1 for item in items if item["document_type"] == "合格通知書"),
                "withdrawal_count": sum(1 for item in items if item["document_type"] == "離脱届"),
                "semiannual_count": sum(1 for item in items if item["document_type"] == "半期毎出席率報告"),
                "may_november_count": sum(1 for item in items if item["document_type"] == "5月11月在留者報告"),
                "renewal_count": sum(1 for item in items if item["document_type"] == "在留期間更新五表"),
                "poor_attendance_count": sum(1 for item in items if item["document_type"] == "出席率不佳報告"),
                "certificate_count": sum(1 for item in items if item["document_type"] in ("出席率証明書", "成績証明書", "修了証明書")),
            },
            "items": items,
        }

    def applicants(self) -> list[dict]:
        conn = connect()
        cur = conn.cursor()
        for applicant in cur.execute("select id from applicants").fetchall():
            ensure_applicant_sections(cur, applicant["id"])
        conn.commit()
        result = [
            dict(row)
            for row in cur.execute(
                """
                select
                  a.*,
                  coalesce((select f.source_type from applicant_intake_forms f where f.applicant_id = a.id order by f.submitted_at desc limit 1), 'staff') as source_type,
                  coalesce((select f.source_label from applicant_intake_forms f where f.applicant_id = a.id order by f.submitted_at desc limit 1), '') as source_label,
                  exists(select 1 from generated_documents d where d.target_type = 'applicant' and d.target_id = a.id and d.document_type = '合格通知書') as acceptance_notice_generated,
                  exists(select 1 from coe_cases c where c.applicant_id = a.id) as coe_case_exists,
                  (select count(*) from applicant_required_sections s where s.applicant_id = a.id and s.completed = 1) as required_complete_count,
                  (select count(*) from applicant_required_sections s where s.applicant_id = a.id) as required_total_count
                from applicants a
                order by a.created_at desc
                """
            ).fetchall()
        ]
        conn.close()
        return result

    def import_batches(self) -> list[dict]:
        return rows(
            """
            select
              b.*,
              (select count(*) from import_batch_items i where i.batch_id = b.id and i.status = 'imported') as imported_count_actual
            from import_batches b
            order by b.created_at desc
            """
        )

    def payments(self) -> list[dict]:
        return rows(
            """
            select
              p.*,
              a.name as applicant_name,
              a.admission_term,
              a.agent_name,
              rd.template_id as receipt_template_id,
              rd.issue_date as receipt_issue_date,
              rd.line_note as receipt_line_note,
              rd.status as receipt_status
            from payments p
            left join applicants a on a.id = p.applicant_id
            left join receipt_documents rd on rd.payment_id = p.id and rd.status = 'issued'
            order by p.created_at desc
            """
        )

    def receipt_preview_data(self, payment_id: str) -> dict | None:
        payment = row(
            """
            select
              p.*,
              a.name as applicant_name,
              a.admission_term,
              a.agent_name
            from payments p
            left join applicants a on a.id = p.applicant_id
            where p.id = ?
            """,
            (payment_id,),
        )
        if not payment:
            return None
        template = row("select * from receipt_templates where status = 'active' order by created_at desc limit 1")
        student_name = payment.get("applicant_name") or payment.get("payer_display_name") or ""
        payer_name = payment.get("payer_display_name") or student_name
        issue_date = datetime.now().strftime("%Y-%m-%d")
        return {
            "template": template,
            "fields": {
                "receipt_no": payment.get("receipt_no") or receipt_no(payment.get("admission_term") or ""),
                "issue_date": issue_date,
                "campus_name": template.get("campus_name") if template else "",
                "student_name": student_name,
                "payer_display_name": payer_name,
                "admission_term": payment.get("admission_term") or "",
                "payment_type": payment.get("payment_type") or "",
                "amount": payment.get("amount") or 0,
                "line_note": f"{payment.get('payment_type') or '入金'}として領収しました。",
                "template_status": "xls 原本あり / xlsx 変換待ち" if template and template.get("file_format") == "xls" else "帳票接続済み",
            },
        }

    def receipt_preview(self, payment_id: str) -> dict:
        preview = self.receipt_preview_data(payment_id)
        if not preview:
            return self.json_error("NOT_FOUND", "入金記録が見つかりません。", status=404)
        return preview

    def acceptance_preview_data(self, applicant_id: str) -> dict | None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return None
        template = row("select * from acceptance_notice_templates where status = 'active' order by created_at desc limit 1")
        existing = row(
            "select * from generated_documents where target_type = 'applicant' and target_id = ? and document_type = '合格通知書'",
            (applicant_id,),
        )
        document_no = existing["document_no"] if existing else f"AC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
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
                "template_status": "校舎別テンプレート接続待ち" if template and template.get("file_format") == "template_pending" else "帳票接続済み",
            },
        }

    def acceptance_preview(self, applicant_id: str) -> dict:
        preview = self.acceptance_preview_data(applicant_id)
        if not preview:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        return preview

    def withdrawal_preview_data(self, student_id: str) -> dict | None:
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return None
        template = row("select * from withdrawal_report_templates where status = 'active' order by created_at desc limit 1")
        existing = row(
            "select * from generated_documents where target_type = 'student' and target_id = ? and document_type = '離脱届'",
            (student_id,),
        )
        document_no = existing["document_no"] if existing else f"WD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
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
                "template_status": "xls 原本あり / xlsx 変換待ち" if template and template.get("file_format") == "xls" else "帳票接続済み",
            },
        }

    def withdrawal_preview(self, student_id: str) -> dict:
        preview = self.withdrawal_preview_data(student_id)
        if not preview:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        return preview

    def coe_cases(self) -> list[dict]:
        conn = connect()
        cur = conn.cursor()
        for coe_case in cur.execute("select id from coe_cases").fetchall():
            ensure_coe_materials(cur, coe_case["id"])
        conn.commit()
        result = [
            dict(row)
            for row in cur.execute(
                """
                select
                  c.*,
                  a.name as applicant_name,
                  a.admission_term,
                  a.agent_name,
                  (select count(*) from coe_materials m where m.coe_case_id = c.id and m.collected = 1 and m.checked = 1) as material_complete_count,
                  (select count(*) from coe_materials m where m.coe_case_id = c.id) as material_total_count,
                  (select count(*) from ai_check_issues i where i.coe_case_id = c.id and i.status = 'open') as open_issue_count,
                  (select count(*) from ai_check_issues i where i.coe_case_id = c.id) as issue_total_count
                from coe_cases c
                join applicants a on a.id = c.applicant_id
                order by c.deadline
                """
            ).fetchall()
        ]
        conn.close()
        return result

    def ai_issues(self, coe_id: str) -> list[dict]:
        return rows(
            "select * from ai_check_issues where coe_case_id = ? order by case severity when 'error' then 1 when 'warning' then 2 else 3 end, created_at",
            (coe_id,),
        )

    def create_applicant(self, body: dict) -> None:
        required = ["name", "nationality", "admission_term", "desired_study_length"]
        missing = [field for field in required if not body.get(field)]
        if missing:
            return self.json_error("VALIDATION_ERROR", "必須項目が不足しています。", {"missing": missing}, 422)

        conn = connect()
        cur = conn.cursor()
        applicant_id = create_applicant_record(
            cur,
            body,
            source_type="staff",
            source_label="事務局登録",
            completed_sections={"admission_plan"},
        )
        write_audit(cur, "create", "applicant", applicant_id, f"出願者 {body['name']} を作成しました。")
        conn.commit()
        conn.close()
        return self.json(row("select * from applicants where id = ?", (applicant_id,)), 201)

    def submit_public_application(self, body: dict) -> None:
        required = ["name", "nationality", "admission_term", "desired_study_length", "email", "phone"]
        missing = [field for field in required if not body.get(field)]
        if missing:
            return self.json_error("VALIDATION_ERROR", "入力が不足しています。", {"missing": missing}, 422)
        conn = connect()
        cur = conn.cursor()
        completed_sections = portal_payload_to_sections(body)
        applicant_id = create_applicant_record(
            cur,
            body,
            source_type="student_portal",
            source_label="学生入力フォーム",
            completed_sections=completed_sections,
        )
        write_audit(cur, "portal.submit", "applicant", applicant_id, f"学生フォームから {body['name']} の出願を受け付けました。")
        conn.commit()
        conn.close()
        created = row("select * from applicants where id = ?", (applicant_id,))
        return self.json({"ok": True, "application_no": created["application_no"], "applicant_id": applicant_id}, 201)

    def upload_import_batch(self) -> None:
        form = self.read_multipart_form()
        upload = form.get("file")
        if not upload or not upload["filename"]:
            return self.json_error("VALIDATION_ERROR", "Excel ファイルを選択してください。", status=422)
        filename = Path(upload["filename"]).name
        stored_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}-{filename}"
        stored_path = UPLOAD_DIR / stored_name
        stored_path.write_bytes(upload["content"])
        source_label = normalize_text(form.get("source_label", {}).get("value")) if isinstance(form.get("source_label"), dict) else ""

        parsed = parse_spreadsheet_with_helper(stored_path)
        conn = connect()
        cur = conn.cursor()
        batch_id = new_id()
        status = "completed" if parsed.get("ok") else "needs_review"
        total_rows = len(parsed.get("rows") or []) if parsed.get("ok") else 0
        imported_rows = 0
        error_rows = 0
        note = parsed.get("message", "")
        cur.execute(
            """
            insert into import_batches
            (id, filename, status, total_rows, imported_rows, error_rows, source_label, note, stored_path, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, filename, status, total_rows, 0, 0, source_label, note, str(stored_path), now_iso()),
        )
        if parsed.get("ok"):
            for row_no, raw in enumerate(parsed.get("rows") or [], start=2):
                normalized = {key: normalize_text(value) for key, value in raw.items()}
                missing = [field for field in ["name", "nationality", "admission_term", "desired_study_length"] if not normalized.get(field)]
                if missing:
                    error_rows += 1
                    cur.execute(
                        """
                        insert into import_batch_items
                        (id, batch_id, row_no, status, applicant_id, message, raw_json, created_at)
                        values (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            new_id(),
                            batch_id,
                            row_no,
                            "error",
                            None,
                            f"必須列不足: {', '.join(missing)}",
                            json.dumps(raw, ensure_ascii=False),
                            now_iso(),
                        ),
                    )
                    continue
                completed_sections = portal_payload_to_sections(normalized)
                applicant_id = create_applicant_record(
                    cur,
                    normalized,
                    source_type="excel_import",
                    source_label=source_label or filename,
                    completed_sections=completed_sections,
                )
                imported_rows += 1
                cur.execute(
                    """
                    insert into import_batch_items
                    (id, batch_id, row_no, status, applicant_id, message, raw_json, created_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id(),
                        batch_id,
                        row_no,
                        "imported",
                        applicant_id,
                        "出願者として取り込みました。",
                        json.dumps(raw, ensure_ascii=False),
                        now_iso(),
                    ),
                )
            status = "completed" if error_rows == 0 else "partial"
        cur.execute(
            "update import_batches set status = ?, imported_rows = ?, error_rows = ?, note = ? where id = ?",
            (status, imported_rows, error_rows, note, batch_id),
        )
        write_audit(cur, "import.upload", "import_batch", batch_id, f"{filename} を取り込み、{imported_rows}件登録しました。")
        conn.commit()
        conn.close()
        return self.json(row("select * from import_batches where id = ?", (batch_id,)), 201)

    def update_applicant_sections(self, applicant_id: str, body: dict) -> None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        completed_keys = set(body.get("completed_sections") or [])
        allowed_keys = {key for key, _ in REQUIRED_SECTIONS}
        unknown = sorted(completed_keys - allowed_keys)
        if unknown:
            return self.json_error("VALIDATION_ERROR", "必須情報区分が不正です。", {"unknown": unknown}, 422)

        conn = connect()
        cur = conn.cursor()
        ensure_applicant_sections(cur, applicant_id)
        for key, _ in REQUIRED_SECTIONS:
            cur.execute(
                "update applicant_required_sections set completed = ?, updated_at = ? where applicant_id = ? and section_key = ?",
                (1 if key in completed_keys else 0, now_iso(), applicant_id, key),
            )
        write_audit(cur, "applicant.required_sections", "applicant", applicant_id, "面接申請の必須情報チェックを更新しました。")
        conn.commit()
        conn.close()
        return self.json(applicant_sections(applicant_id))

    def create_application_fee(self, applicant_id: str, body: dict) -> None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        if not applicant_sections_complete(applicant_id):
            return self.json_error("APPLICANT_REQUIRED_SECTIONS_INCOMPLETE", "面接申請の必須情報をすべて確認してから選考料を登録してください。", status=409)
        existing = row("select * from payments where applicant_id = ? and payment_type = '選考料'", (applicant_id,))
        if existing:
            return self.json(existing)

        payment_id = new_id()
        payer_type = body.get("payer_type") or ("agent" if applicant.get("agent_name") else "student")
        payer_display_name = body.get("payer_display_name") or applicant.get("agent_name") or applicant["name"]
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into payments
            (id, applicant_id, student_id, payment_type, amount, payer_type, payer_display_name, status, confirmed_at, receipt_issued, receipt_no, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (payment_id, applicant_id, None, "選考料", 20000, payer_type, payer_display_name, "confirmed", now_iso(), 0, None, now_iso()),
        )
        cur.execute("update applicants set application_fee_status = ?, status = ? where id = ?", ("確認済", "面接待ち", applicant_id))
        write_audit(cur, "payment.confirm", "applicant", applicant_id, f"選考料 20,000円を確認しました。表示名: {payer_display_name}")
        conn.commit()
        conn.close()
        return self.json(row("select * from payments where id = ?", (payment_id,)), 201)

    def set_interview_result(self, applicant_id: str, body: dict) -> None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        result = body.get("result")
        allowed = {"合格", "保留", "再面接", "不合格"}
        if result not in allowed:
            return self.json_error("VALIDATION_ERROR", "面接結果が不正です。", {"allowed": sorted(allowed)}, 422)
        has_notice = row(
            "select 1 as found from generated_documents where target_type = 'applicant' and target_id = ? and document_type = '合格通知書'",
            (applicant_id,),
        )
        has_coe = row("select 1 as found from coe_cases where applicant_id = ?", (applicant_id,))
        status_by_result = {
            "合格": "合格通知待ち",
            "保留": "保留",
            "再面接": "再面接待ち",
            "不合格": "不合格",
        }
        next_status = status_by_result[result]
        if result == "合格" and has_notice:
            next_status = "COE準備待ち"
        if result == "合格" and has_coe:
            next_status = "COE準備中"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            "update applicants set interview_result = ?, status = ? where id = ?",
            (result, next_status, applicant_id),
        )
        write_audit(cur, "interview.result", "applicant", applicant_id, f"面接結果を {result} に更新しました。")
        conn.commit()
        conn.close()
        return self.json(row("select * from applicants where id = ?", (applicant_id,)))

    def generate_acceptance_notice(self, applicant_id: str) -> None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        if applicant["interview_result"] != "合格":
            return self.json_error("INTERVIEW_NOT_PASSED", "面接結果が合格の場合のみ合格通知書を生成できます。", status=409)
        document = self.ensure_acceptance_notice_document(applicant_id)
        self.ensure_accepted_applicant_linkage(applicant_id)
        export_result = self.prewarm_acceptance_export(applicant_id, document)
        return self.json({**document, "export": export_result}, 201)

    def ensure_acceptance_notice_document(self, applicant_id: str) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'applicant' and target_id = ? and document_type = '合格通知書'",
            (applicant_id,),
        )
        if existing:
            return existing
        template = row("select * from acceptance_notice_templates where status = 'active' order by created_at desc limit 1")
        document_id = new_id()
        document_no = f"AC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                "applicant",
                applicant_id,
                "合格通知書",
                document_no,
                template["name"] if template else "合格通知書",
                "generated",
                now_iso(),
            ),
        )
        write_audit(cur, "document.generate", "applicant", applicant_id, f"合格通知書 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        document = row("select * from generated_documents where id = ?", (document_id,))
        self.prewarm_acceptance_export(applicant_id, document)
        return document

    def generate_withdrawal_document(self, student_id: str) -> None:
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        document = self.ensure_withdrawal_document(student_id)
        export_result = self.prewarm_withdrawal_export(student_id, document)
        return self.json({**document, "export": export_result}, 201)

    def ensure_withdrawal_document(self, student_id: str) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'student' and target_id = ? and document_type = '離脱届'",
            (student_id,),
        )
        if existing:
            return existing
        template = row("select * from withdrawal_report_templates where status = 'active' order by created_at desc limit 1")
        document_id = new_id()
        document_no = f"WD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                "student",
                student_id,
                "離脱届",
                document_no,
                template["name"] if template else "離脱届",
                "generated",
                now_iso(),
            ),
        )
        write_audit(cur, "document.generate", "student", student_id, f"離脱届 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        document = row("select * from generated_documents where id = ?", (document_id,))
        self.prewarm_withdrawal_export(student_id, document)
        return document

    def ensure_accepted_applicant_linkage(self, applicant_id: str) -> None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return
        existing = row("select * from coe_cases where applicant_id = ?", (applicant_id,))
        conn = connect()
        cur = conn.cursor()
        cur.execute("update applicants set status = ? where id = ?", ("合格者", applicant_id))
        if not existing:
            coe_id = new_id()
            cur.execute(
                """
                insert into coe_cases
                (id, applicant_id, stage, deadline, full_tuition_confirmed, receipt_issued, partial_coe_sent, full_coe_sent, ai_check_status, updated_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (coe_id, applicant_id, "COE準備", "2026-06-20", 0, 0, 0, 0, "未実行", now_iso()),
            )
            ensure_coe_materials(cur, coe_id)
            write_audit(cur, "coe.create", "applicant", applicant_id, "合格者を COE進行へ自動連携しました。")
        conn.commit()
        conn.close()

    def create_coe_case(self, applicant_id: str, body: dict) -> None:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        if applicant["interview_result"] != "合格":
            return self.json_error("INTERVIEW_NOT_PASSED", "面接結果が合格の場合のみ COE 案件を作成できます。", status=409)
        notice = row(
            "select * from generated_documents where target_type = 'applicant' and target_id = ? and document_type = '合格通知書'",
            (applicant_id,),
        )
        if not notice:
            return self.json_error("ACCEPTANCE_NOTICE_REQUIRED", "COE案件作成前に合格通知書を生成してください。", status=409)
        existing = row("select * from coe_cases where applicant_id = ?", (applicant_id,))
        if existing:
            conn = connect()
            cur = conn.cursor()
            cur.execute("update applicants set status = ? where id = ?", ("COE準備中", applicant_id))
            conn.commit()
            conn.close()
            return self.json(existing)
        coe_id = new_id()
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into coe_cases
            (id, applicant_id, stage, deadline, full_tuition_confirmed, receipt_issued, partial_coe_sent, full_coe_sent, ai_check_status, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (coe_id, applicant_id, "COE準備", body.get("deadline") or "2026-06-20", 0, 0, 0, 0, "未実行", now_iso()),
        )
        ensure_coe_materials(cur, coe_id)
        cur.execute("update applicants set status = ? where id = ?", ("COE準備中", applicant_id))
        write_audit(cur, "coe.create", "applicant", applicant_id, "COE案件を作成しました。")
        conn.commit()
        conn.close()
        return self.json(row("select * from coe_cases where id = ?", (coe_id,)), 201)

    def update_coe_materials(self, coe_id: str, body: dict) -> None:
        coe = row("select * from coe_cases where id = ?", (coe_id,))
        if not coe:
            return self.json_error("NOT_FOUND", "COE案件が見つかりません。", status=404)
        completed_keys = set(body.get("completed_materials") or [])
        allowed_keys = {key for key, _ in COE_MATERIALS}
        unknown = sorted(completed_keys - allowed_keys)
        if unknown:
            return self.json_error("VALIDATION_ERROR", "COE資料区分が不正です。", {"unknown": unknown}, 422)

        conn = connect()
        cur = conn.cursor()
        ensure_coe_materials(cur, coe_id)
        for key, _ in COE_MATERIALS:
            completed = 1 if key in completed_keys else 0
            cur.execute(
                "update coe_materials set collected = ?, checked = ?, updated_at = ? where coe_case_id = ? and material_key = ?",
                (completed, completed, now_iso(), coe_id, key),
            )
        stage = "AIチェック待ち" if len(completed_keys) == len(COE_MATERIALS) else "資料回収中"
        cur.execute("update coe_cases set stage = ?, updated_at = ? where id = ?", (stage, now_iso(), coe_id))
        write_audit(cur, "coe.materials", "coe_case", coe_id, "COE申請資料チェックを更新しました。")
        conn.commit()
        conn.close()
        return self.json(coe_materials(coe_id))

    def issue_receipt(self, payment_id: str) -> None:
        payment = row(
            """
            select p.*, a.admission_term
            from payments p
            left join applicants a on a.id = p.applicant_id
            where p.id = ?
            """,
            (payment_id,),
        )
        if not payment:
            return self.json_error("NOT_FOUND", "入金記録が見つかりません。", status=404)
        if payment["status"] != "confirmed":
            return self.json_error("PAYMENT_NOT_CONFIRMED", "入金確認後に領収書を発行できます。", status=409)
        if payment["receipt_issued"]:
            return self.json_error("RECEIPT_ALREADY_ISSUED", "この入金には既に領収書が発行されています。", status=409)

        number = receipt_no(payment.get("admission_term") or "")
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            "update payments set receipt_issued = 1, receipt_no = ? where id = ?",
            (number, payment_id),
        )
        template = cur.execute("select * from receipt_templates where status = 'active' order by created_at desc limit 1").fetchone()
        student_name = payment.get("applicant_name") or payment.get("payer_display_name") or ""
        cur.execute(
            """
            insert into receipt_documents
            (id, payment_id, template_id, receipt_no, issue_date, payer_display_name, student_name, admission_term, payment_type, amount, line_note, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(),
                payment_id,
                template["id"] if template else None,
                number,
                datetime.now().strftime("%Y-%m-%d"),
                payment["payer_display_name"],
                student_name,
                payment.get("admission_term") or "",
                payment["payment_type"],
                payment["amount"],
                f"{payment['payment_type']}として領収しました。",
                "issued",
                now_iso(),
            ),
        )
        if payment["payment_type"] == "学費全額" and payment["applicant_id"]:
            cur.execute(
                "update coe_cases set receipt_issued = 1, updated_at = ? where applicant_id = ?",
                (now_iso(), payment["applicant_id"]),
            )
        write_audit(cur, "receipt.issue", "payment", payment_id, f"領収書 {number} を発行しました。")
        conn.commit()
        conn.close()
        export_result = self.prewarm_receipt_export(payment_id, number)
        return self.json(
            {
                "receipt_no": number,
                "payment": row("select * from payments where id = ?", (payment_id,)),
                "export": export_result,
            }
        )

    def prewarm_receipt_export(self, payment_id: str, receipt_no: str) -> dict | None:
        export_key = f"receipt:{payment_id}:{receipt_no or ''}"
        preview = self.receipt_preview_data(payment_id)
        if not preview:
            return None
        return warm_export_cache(
            export_key,
            "receipt",
            payment_id,
            lambda: export_xlsx_document(
                "receipt",
                preview["fields"],
                f"receipt-{safe_file_stem(preview['fields']['student_name'])}",
            ),
        )

    def prewarm_acceptance_export(self, applicant_id: str, document: dict | None = None) -> dict | None:
        document = document or row(
            "select * from generated_documents where target_type = 'applicant' and target_id = ? and document_type = '合格通知書'",
            (applicant_id,),
        )
        if not document:
            return None
        preview = self.acceptance_preview_data(applicant_id)
        if not preview:
            return None
        export_key = f"acceptance:{applicant_id}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "acceptance_notice",
            applicant_id,
            lambda: export_xlsx_document(
                "acceptance_notice",
                preview["fields"],
                f"acceptance-{safe_file_stem(preview['fields']['student_name'])}",
            ),
        )

    def prewarm_withdrawal_export(self, student_id: str, document: dict | None = None) -> dict | None:
        document = document or row(
            "select * from generated_documents where target_type = 'student' and target_id = ? and document_type = '離脱届'",
            (student_id,),
        )
        if not document:
            return None
        preview = self.withdrawal_preview_data(student_id)
        if not preview:
            return None
        export_key = f"withdrawal:{student_id}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "withdrawal_report",
            student_id,
            lambda: export_xlsx_document(
                "withdrawal_report",
                preview["fields"],
                f"withdrawal-{safe_file_stem(preview['fields']['student_name'])}",
                preview["template"]["source_path"] if preview.get("template") else "",
            ),
        )

    def ensure_semiannual_attendance_document(self, report_period: str) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = ? and document_type = '半期毎出席率報告'",
            (report_period,),
        )
        if existing:
            return existing
        document_id = new_id()
        document_no = f"SA-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "report", report_period, "半期毎出席率報告", document_no, "半期毎出席率報告", "generated", now_iso()),
        )
        write_audit(cur, "document.generate", "report", report_period, f"半期毎出席率報告 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        return row("select * from generated_documents where id = ?", (document_id,))

    def prewarm_semiannual_attendance_export(self, report_period: str, document: dict | None = None) -> dict | None:
        document = document or self.ensure_semiannual_attendance_document(report_period)
        report = self.semiannual_attendance_report(report_period)
        export_key = f"semiannual_attendance:{report_period}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "semiannual_attendance_report",
            report_period,
            lambda: (
                export_xls_document(
                    "semiannual_attendance_report",
                    {
                        **report["summary"],
                        "students": report["students"],
                        "low_attendance_students": report["low_attendance_students"],
                        "course_summaries": report["course_summaries"],
                        "summary_totals": report["summary_totals"],
                    },
                    f"semiannual-attendance-{safe_file_stem(report_period)}",
                    str(SEMIANNUAL_TEMPLATE_XLS),
                )
                if SEMIANNUAL_TEMPLATE_XLS.exists()
                else export_xlsx_document(
                    "semiannual_attendance_report",
                    {
                        **report["summary"],
                        "students": report["students"],
                        "low_attendance_students": report["low_attendance_students"],
                    },
                    f"semiannual-attendance-{safe_file_stem(report_period)}",
                )
            ),
        )

    def prewarm_semiannual_attendance_detail_export(self, report_period: str, document: dict | None = None) -> dict | None:
        document = document or self.ensure_semiannual_attendance_document(report_period)
        report = self.semiannual_attendance_report(report_period)
        export_key = f"semiannual_attendance_detail:{report_period}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "semiannual_attendance_detail",
            report_period,
            lambda: (
                export_xls_document(
                    "semiannual_attendance_detail",
                    {
                        **report["summary"],
                        "students": report["students"],
                    },
                    f"semiannual-attendance-detail-{safe_file_stem(report_period)}",
                    str(SEMIANNUAL_DETAIL_TEMPLATE_XLS),
                )
                if SEMIANNUAL_DETAIL_TEMPLATE_XLS.exists()
                else export_xlsx_document(
                    "semiannual_attendance_report",
                    {
                        **report["summary"],
                        "students": report["students"],
                    },
                    f"semiannual-attendance-detail-{safe_file_stem(report_period)}",
                )
            ),
        )

    def ensure_may_november_document(self, report_period: str) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = ? and document_type = '5月11月在留者報告'",
            (report_period,),
        )
        if existing:
            return existing
        document_id = new_id()
        document_no = f"MN-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "report", report_period, "5月11月在留者報告", document_no, "5月11月在留者報告", "generated", now_iso()),
        )
        write_audit(cur, "document.generate", "report", report_period, f"5月11月在留者報告 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        return row("select * from generated_documents where id = ?", (document_id,))

    def prewarm_may_november_export(self, report_period: str, document: dict | None = None) -> dict | None:
        document = document or self.ensure_may_november_document(report_period)
        report = self.may_november_report(report_period)
        export_key = f"may_november:{report_period}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "may_november_report",
            report_period,
            lambda: (
                export_xls_document(
                    "may_november_report",
                    {
                        **report["summary"],
                        "students": report["students"],
                        "expiring_students": report["expiring_students"],
                        "school_name": "渋谷外語学院",
                    },
                    f"may-november-report-{safe_file_stem(report_period)}",
                    str(MAY_NOVEMBER_TEMPLATE_XLS),
                )
                if MAY_NOVEMBER_TEMPLATE_XLS.exists()
                else export_xlsx_document(
                    "may_november_report",
                    {
                        **report["summary"],
                        "students": report["students"],
                        "expiring_students": report["expiring_students"],
                    },
                    f"may-november-report-{safe_file_stem(report_period)}",
                )
            ),
        )

    def ensure_residence_renewal_document(self) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = 'residence-renewal' and document_type = '在留期間更新五表'",
        )
        if existing:
            return existing
        document_id = new_id()
        document_no = f"RV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "report", "residence-renewal", "在留期間更新五表", document_no, "在留期間更新五表", "generated", now_iso()),
        )
        write_audit(cur, "document.generate", "report", "residence-renewal", f"在留期間更新五表 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        return row("select * from generated_documents where id = ?", (document_id,))

    def ensure_residence_renewal_form_document(self, student_id: str) -> dict | None:
        existing = row(
            "select * from generated_documents where target_type = 'student' and target_id = ? and document_type = '在留更新許可申請書'",
            (student_id,),
        )
        if existing:
            return existing
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return None
        document_id = new_id()
        document_no = f"RVF-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "student", student_id, "在留更新許可申請書", document_no, "在留期間更新許可五表", "generated", now_iso()),
        )
        write_audit(cur, "document.generate", "student", student_id, f"在留更新許可申請書 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        return row("select * from generated_documents where id = ?", (document_id,))

    def prewarm_residence_renewal_export(self, document: dict | None = None) -> dict | None:
        document = document or self.ensure_residence_renewal_document()
        report = self.residence_renewal_report()
        export_key = f"residence_renewal:residence-renewal:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "residence_renewal_report",
            "residence-renewal",
            lambda: (
                export_xls_document(
                    "residence_renewal_report",
                    {
                        **report["summary"],
                        "targets": report["targets"],
                        "school_name": "渋谷外語学院",
                        "phone": "03-6233-9963",
                        "agent_name": "中島 淳子",
                    },
                    "residence-renewal-report",
                    str(RESIDENCE_RENEWAL_LIST_TEMPLATE_XLS),
                )
                if RESIDENCE_RENEWAL_LIST_TEMPLATE_XLS.exists()
                else export_xlsx_document(
                    "residence_renewal_report",
                    {
                        **report["summary"],
                        "targets": report["targets"],
                    },
                    "residence-renewal-report",
                )
            ),
        )

    def prewarm_residence_renewal_form_export(self, student_id: str, document: dict | None = None) -> dict | None:
        document = document or self.ensure_residence_renewal_form_document(student_id)
        student = row("select * from students where id = ?", (student_id,))
        if not document or not student:
            return None
        detail = {
            **residence_renewal_demo_detail(student_id, student.get("attendance_rate"), student.get("residence_expiry") or ""),
            **residence_renewal_form_detail(student_id),
        }
        export_key = f"residence_renewal_form:{student_id}:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "residence_renewal_form",
            student_id,
            lambda: (
                export_xls_document(
                    "residence_renewal_form",
                    {
                        "document_no": document["document_no"],
                        "issue_date": datetime.now().strftime("%Y-%m-%d"),
                        "student_no": student["student_no"],
                        "student_name": student["name"],
                        "nationality": student["nationality"],
                        "residence_card_no": student.get("residence_card_no") or "",
                        "residence_expiry": student.get("residence_expiry") or "",
                        "attendance_rate": student.get("attendance_rate"),
                        **detail,
                    },
                    f"residence-renewal-form-{safe_file_stem(student['name'])}",
                    str(RESIDENCE_RENEWAL_FORM_TEMPLATE_XLS),
                )
                if RESIDENCE_RENEWAL_FORM_TEMPLATE_XLS.exists()
                else export_xlsx_document(
                    "residence_renewal_report",
                    {"targets": [student]},
                    f"residence-renewal-form-{safe_file_stem(student['name'])}",
                )
            ),
        )

    def ensure_poor_attendance_document(self) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = 'poor-attendance' and document_type = '出席率不佳報告'",
        )
        if existing:
            return existing
        document_id = new_id()
        document_no = f"LA-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "report", "poor-attendance", "出席率不佳報告", document_no, "出席率不佳報告", "generated", now_iso()),
        )
        write_audit(cur, "document.generate", "report", "poor-attendance", f"出席率不佳報告 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        return row("select * from generated_documents where id = ?", (document_id,))

    def ensure_annual_completion_document(self) -> dict:
        existing = row(
            "select * from generated_documents where target_type = 'report' and target_id = 'annual-completion' and document_type = '年度終了報告'",
        )
        if existing:
            return existing
        document_id = new_id()
        document_no = f"YR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4().int % 1000).zfill(3)}"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            """
            insert into generated_documents
            (id, target_type, target_id, document_type, document_no, template_name, status, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (document_id, "report", "annual-completion", "年度終了報告", document_no, "年度終了報告", "generated", now_iso()),
        )
        write_audit(cur, "document.generate", "report", "annual-completion", f"年度終了報告 {document_no} を生成しました。")
        conn.commit()
        conn.close()
        return row("select * from generated_documents where id = ?", (document_id,))

    def prewarm_poor_attendance_export(self, document: dict | None = None) -> dict | None:
        document = document or self.ensure_poor_attendance_document()
        report = self.poor_attendance_report()
        export_key = f"poor_attendance:poor-attendance:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "poor_attendance_report",
            "poor-attendance",
            lambda: export_xlsx_document(
                "poor_attendance_report",
                {
                    **report["summary"],
                    "targets": report["targets"],
                },
                "poor-attendance-report",
                str(POOR_ATTENDANCE_TEMPLATE_XLSX) if POOR_ATTENDANCE_TEMPLATE_XLSX.exists() else "",
            ),
        )

    def prewarm_annual_completion_export(self, document: dict | None = None) -> dict | None:
        document = document or self.ensure_annual_completion_document()
        report = self.annual_completion_report()
        export_key = f"annual_completion:annual-completion:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "annual_completion_report",
            "annual-completion",
            lambda: export_xlsx_document(
                "annual_completion_report",
                {**report["summary"], "entries": report["entries"]},
                "annual-completion-report",
                str(ANNUAL_COMPLETION_TEMPLATE_XLSX) if ANNUAL_COMPLETION_TEMPLATE_XLSX.exists() else "",
            ),
        )

    def prewarm_annual_completion_list_export(self, document: dict | None = None) -> dict | None:
        document = document or self.ensure_annual_completion_document()
        report = self.annual_completion_report()
        export_key = f"annual_completion_list:annual-completion:{document['document_no']}"
        return warm_export_cache(
            export_key,
            "annual_completion_list",
            "annual-completion",
            lambda: export_xlsx_document(
                "annual_completion_list",
                {**report["summary"], "entries": report["entries"]},
                "annual-completion-list",
                str(ANNUAL_COMPLETION_LIST_TEMPLATE_XLSX) if ANNUAL_COMPLETION_LIST_TEMPLATE_XLSX.exists() else "",
            ),
        )

    def export_receipt(self, payment_id: str) -> dict:
        payment = row("select * from payments where id = ?", (payment_id,))
        if not payment:
            return self.json_error("NOT_FOUND", "入金記録が見つかりません。", status=404)
        if not payment["receipt_issued"]:
            return self.json_error("RECEIPT_NOT_ISSUED", "先に領収書を発行してください。", status=409)
        export_key = f"receipt:{payment_id}:{payment['receipt_no'] or ''}"
        cached = cached_export(export_key)
        if cached:
            return cached
        result = self.prewarm_receipt_export(payment_id, payment["receipt_no"])
        if not result:
            return self.json_error("NOT_FOUND", "入金記録が見つかりません。", status=404)
        if not result["ok"]:
            return self.json_error("EXPORT_FAILED", result["message"], status=500)
        return result

    def export_acceptance_notice(self, applicant_id: str) -> dict:
        applicant = row("select * from applicants where id = ?", (applicant_id,))
        if not applicant:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        if applicant["interview_result"] != "合格":
            return self.json_error("INTERVIEW_NOT_PASSED", "面接結果が合格の場合のみ出力できます。", status=409)
        document = self.ensure_acceptance_notice_document(applicant_id)
        self.ensure_accepted_applicant_linkage(applicant_id)
        export_key = f"acceptance:{applicant_id}:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return cached
        result = self.prewarm_acceptance_export(applicant_id, document)
        if not result:
            return self.json_error("NOT_FOUND", "出願者が見つかりません。", status=404)
        if not result["ok"]:
            return self.json_error("EXPORT_FAILED", result["message"], status=500)
        return result

    def export_withdrawal_document(self, student_id: str) -> dict:
        document = self.ensure_withdrawal_document(student_id)
        export_key = f"withdrawal:{student_id}:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return cached
        result = self.prewarm_withdrawal_export(student_id, document)
        if not result:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        if not result["ok"]:
            return self.json_error("EXPORT_FAILED", result["message"], status=500)
        return result

    def export_semiannual_attendance_report(self, body: dict) -> None:
        report_period = body.get("period") or self.default_semiannual_period()
        document = self.ensure_semiannual_attendance_document(report_period)
        export_key = f"semiannual_attendance:{report_period}:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_semiannual_attendance_export(report_period, document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "半期毎出席率報告を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_semiannual_attendance_detail_report(self, body: dict) -> None:
        report_period = body.get("period") or self.default_semiannual_period()
        document = self.ensure_semiannual_attendance_document(report_period)
        export_key = f"semiannual_attendance_detail:{report_period}:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_semiannual_attendance_detail_export(report_period, document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "半期毎出席率報告の明細を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_may_november_report(self, body: dict) -> None:
        report_period = body.get("period") or self.default_may_november_period()
        document = self.ensure_may_november_document(report_period)
        export_key = f"may_november:{report_period}:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_may_november_export(report_period, document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "5月11月報告を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_residence_renewal_report(self) -> None:
        document = self.ensure_residence_renewal_document()
        export_key = f"residence_renewal:residence-renewal:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_residence_renewal_export(document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "在留期間更新五表を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_residence_renewal_form(self, student_id: str) -> None:
        student = row("select * from students where id = ?", (student_id,))
        if not student:
            return self.json_error("NOT_FOUND", "学生が見つかりません。", status=404)
        document = self.ensure_residence_renewal_form_document(student_id)
        if not document:
            return self.json_error("NOT_FOUND", "更新帳票を生成できませんでした。", status=404)
        export_key = f"residence_renewal_form:{student_id}:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_residence_renewal_form_export(student_id, document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "在留更新許可申請書を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_poor_attendance_report(self) -> None:
        document = self.ensure_poor_attendance_document()
        export_key = f"poor_attendance:poor-attendance:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_poor_attendance_export(document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "出席率不佳報告を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_annual_completion_report(self) -> None:
        document = self.ensure_annual_completion_document()
        export_key = f"annual_completion:annual-completion:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_annual_completion_export(document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "年度終了報告を出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def export_annual_completion_list(self) -> None:
        document = self.ensure_annual_completion_document()
        export_key = f"annual_completion_list:annual-completion:{document['document_no']}"
        cached = cached_export(export_key)
        if cached:
            return self.json({"document": document, "export": cached})
        result = self.prewarm_annual_completion_list_export(document)
        if not result or not result.get("ok"):
            return self.json_error("EXPORT_FAILED", "年度終了報告リストを出力できませんでした。", status=500)
        return self.json({"document": document, "export": result})

    def run_ai_check(self, coe_id: str) -> None:
        coe = row("select * from coe_cases where id = ?", (coe_id,))
        if not coe:
            return self.json_error("NOT_FOUND", "COE案件が見つかりません。", status=404)
        if not coe_materials_complete(coe_id):
            return self.json_error("COE_MATERIALS_INCOMPLETE", "COE申請資料をすべて回収・確認してから AI チェックを実行してください。", status=409)
        conn = connect()
        cur = conn.cursor()
        cur.execute("delete from ai_check_issues where coe_case_id = ?", (coe_id,))
        issues = [
            ("error", "旅券番号", "面接申請表と願書の旅券番号が一致していません。"),
            ("warning", "住所", "申請時住所と戸籍住所の表記ゆれを確認してください。"),
            ("warning", "経費支弁者", "銀行残高証明書の日付が提出期限から90日を超える可能性があります。"),
        ]
        for severity, field, message in issues:
            cur.execute(
                """
                insert into ai_check_issues
                (id, coe_case_id, severity, field, message, status, resolution_note, created_at, resolved_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id(), coe_id, severity, field, message, "open", None, now_iso(), None),
            )
        cur.execute("update coe_cases set ai_check_status = ?, stage = ?, updated_at = ? where id = ?", ("要修正 3件", "修正中", now_iso(), coe_id))
        write_audit(cur, "ai_check.run", "coe_case", coe_id, "AI COE申請材料チェックを実行しました。")
        conn.commit()
        conn.close()
        return self.json(
            {
                "status": "completed",
                "summary": {"errors": 1, "warnings": 2, "matched": 28},
                "issues": [
                    {"severity": "error", "field": "旅券番号", "message": "面接申請表と願書の旅券番号が一致していません。"},
                    {"severity": "warning", "field": "住所", "message": "申請時住所と戸籍住所の表記ゆれを確認してください。"},
                    {"severity": "warning", "field": "経費支弁者", "message": "銀行残高証明書の日付が提出期限から90日を超える可能性があります。"},
                ],
            }
        )

    def resolve_ai_issue(self, issue_id: str, body: dict) -> None:
        issue = row("select * from ai_check_issues where id = ?", (issue_id,))
        if not issue:
            return self.json_error("NOT_FOUND", "AIチェック項目が見つかりません。", status=404)
        note = body.get("resolution_note") or "資料修正・確認済み"
        conn = connect()
        cur = conn.cursor()
        cur.execute(
            "update ai_check_issues set status = 'resolved', resolution_note = ?, resolved_at = ? where id = ?",
            (note, now_iso(), issue_id),
        )
        open_count = cur.execute(
            "select count(*) as count from ai_check_issues where coe_case_id = ? and status = 'open' and id <> ?",
            (issue["coe_case_id"], issue_id),
        ).fetchone()["count"]
        if open_count == 0:
            cur.execute(
                "update coe_cases set ai_check_status = ?, stage = ?, updated_at = ? where id = ?",
                ("確認完了", "入管提出準備完了", now_iso(), issue["coe_case_id"]),
            )
        write_audit(cur, "ai_issue.resolve", "coe_case", issue["coe_case_id"], f"AIチェック項目「{issue['field']}」を確認済みにしました。")
        conn.commit()
        conn.close()
        return self.json(row("select * from ai_check_issues where id = ?", (issue_id,)))

    def submit_immigration(self, coe_id: str, body: dict) -> None:
        coe = row("select * from coe_cases where id = ?", (coe_id,))
        if not coe:
            return self.json_error("NOT_FOUND", "COE案件が見つかりません。", status=404)
        if not coe_materials_complete(coe_id):
            return self.json_error("COE_MATERIALS_INCOMPLETE", "COE申請資料をすべて回収・確認してから入管提出してください。", status=409)
        open_issues = row("select count(*) as count from ai_check_issues where coe_case_id = ? and status = 'open'", (coe_id,))["count"]
        total_issues = row("select count(*) as count from ai_check_issues where coe_case_id = ?", (coe_id,))["count"]
        if total_issues == 0:
            return self.json_error("AI_CHECK_REQUIRED", "入管提出前に AI チェックを実行してください。", status=409)
        if open_issues:
            return self.json_error("AI_ISSUES_OPEN", "AIチェックの未確認項目をすべて確認してから入管提出してください。", {"open_issues": open_issues}, 409)
        conn = connect()
        cur = conn.cursor()
        cur.execute("update coe_cases set stage = ?, updated_at = ? where id = ?", ("入管提出済・COE交付待ち", now_iso(), coe_id))
        write_audit(cur, "immigration.submit", "coe_case", coe_id, "COE申請を入管提出済みにしました。COE交付待ちです。")
        conn.commit()
        conn.close()
        return self.json({"ok": True, "stage": "入管提出済・COE交付待ち"})

    def send_partial_coe(self, coe_id: str) -> None:
        coe = row("select * from coe_cases where id = ?", (coe_id,))
        if not coe:
            return self.json_error("NOT_FOUND", "COE案件が見つかりません。", status=404)
        conn = connect()
        cur = conn.cursor()
        cur.execute("update coe_cases set partial_coe_sent = 1, updated_at = ? where id = ?", (now_iso(), coe_id))
        write_audit(cur, "coe.partial_send", "coe_case", coe_id, "COE一部スクリーンショットの送付を記録しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True})

    def send_full_coe(self, coe_id: str) -> None:
        coe = row("select * from coe_cases where id = ?", (coe_id,))
        if not coe:
            return self.json_error("NOT_FOUND", "COE案件が見つかりません。", status=404)
        missing = []
        if not coe["full_tuition_confirmed"]:
            missing.append("full_tuition_confirmed")
        if not coe["receipt_issued"]:
            missing.append("receipt_issued")
        if missing:
            return self.json_error(
                "COE_RELEASE_BLOCKED",
                "学費全額入金と領収書発行が完了していないため、COE全体を送付できません。",
                {"missing": missing},
                409,
            )
        conn = connect()
        cur = conn.cursor()
        cur.execute("update coe_cases set full_coe_sent = 1, updated_at = ? where id = ?", (now_iso(), coe_id))
        write_audit(cur, "coe.full_send", "coe_case", coe_id, "COE全体ファイルの送付を記録しました。")
        conn.commit()
        conn.close()
        return self.json({"ok": True, "message": "COE全体ファイルを送付済みにしました。"})

    def read_json(self) -> dict:
        length = int(self.headers.get("content-length") or 0)
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def read_multipart_form(self) -> dict:
        content_type = self.headers.get("content-type") or ""
        match = re.search(r'boundary="?([^";]+)"?', content_type)
        if "multipart/form-data" not in content_type or not match:
            return {}
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes(
            b"Content-Type: " + content_type.encode("utf-8") + b"\r\nMIME-Version: 1.0\r\n\r\n" + body
        )
        fields: dict = {}
        for part in message.iter_parts():
            disposition = part.get("Content-Disposition", "")
            name_match = re.search(r'name="([^"]+)"', disposition)
            if not name_match:
                continue
            name = name_match.group(1)
            filename_match = re.search(r'filename="([^"]*)"', disposition)
            if filename_match and filename_match.group(1):
                fields[name] = {
                    "filename": filename_match.group(1),
                    "content": part.get_payload(decode=True) or b"",
                    "content_type": part.get_content_type(),
                }
            else:
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                fields[name] = {"value": payload.decode(charset, errors="replace").strip()}
        return fields

    def json(self, payload: object, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def json_error(self, code: str, message: str, details: dict | None = None, status: int = 400) -> None:
        return self.json({"error": {"code": code, "message": message, "details": details or {}}}, status)

    def serve_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[{now_iso()}] {self.address_string()} {fmt % args}")


def main() -> None:
    init_db()
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"SchoolCore MVP running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
