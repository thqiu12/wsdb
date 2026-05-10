"""SchoolCore 数据库模块 - 线程安全连接 + 工具函数"""
from __future__ import annotations
import os
import sqlite3
import threading
import uuid
import secrets
import hashlib
from datetime import datetime
from config import DB_PATH

# PBKDF2 反復回数。OWASP 2023+ 推奨 600k だが、SQLite ローカル運用での
# 体感を加味し既定 200k。本番では SCHOOLCORE_PBKDF2_ITER で調整可。
PBKDF2_ITERATIONS = int(os.environ.get("SCHOOLCORE_PBKDF2_ITER", "200000"))

# ── 线程本地连接 ──────────────────────────────────────────
_local = threading.local()


def connect() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=NORMAL")
        _local.conn = conn
    return _local.conn


def rows(sql: str, params: tuple = ()) -> list[dict]:
    conn = connect()
    result = [dict(r) for r in conn.execute(sql, params).fetchall()]
    return result


def row(sql: str, params: tuple = ()) -> dict | None:
    conn = connect()
    found = conn.execute(sql, params).fetchone()
    return dict(found) if found else None


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def safe_serial(prefix: str = "") -> str:
    """日付プレフィックス付き一意系列番号。8 桁 hex（32bit）で衝突確率を最小化。"""
    today = datetime.now().strftime("%Y%m%d")
    suffix = secrets.token_hex(4).upper()
    return f"{prefix}{today}-{suffix}" if prefix else f"{today}-{suffix}"


# ── 密码工具 ──────────────────────────────────────────────
def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256。フォーマット: salt$digest（server.py レガシー版と互換）。"""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    # 新フォーマット: salt$digest (PBKDF2-HMAC-SHA256)
    if "$" in stored:
        try:
            salt, digest = stored.split("$", 1)
            calc = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
            ).hex()
            return secrets.compare_digest(calc, digest)
        except Exception:
            return False
    # 旧フォーマット: salt:digest (SHA-256 単一ラウンド)。
    # 既存アカウント救済用のマイグレーションパスのみ。新規は salt$digest を発行する。
    if ":" in stored:
        try:
            salt, digest = stored.split(":", 1)
            calc = hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()
            return secrets.compare_digest(calc, digest)
        except Exception:
            return False
    return False


# ── 审计日志 ──────────────────────────────────────────────
def write_audit(cur: sqlite3.Cursor, event_type: str, target_type: str,
                target_id: str, message: str, actor: str = "事務局 山田") -> None:
    cur.execute(
        """INSERT INTO audit_logs
           (id, actor, event_type, target_type, target_id, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (new_id(), actor, event_type, target_type, target_id, message, now_iso()),
    )


# ── 数据库初始化 ──────────────────────────────────────────
def init_db() -> None:
    """初始化数据库表结构（保持与原版完全兼容）"""
    conn = connect()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT,
        password_hash TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY, actor TEXT, event_type TEXT,
        target_type TEXT, target_id TEXT, message TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS schools (
        id TEXT PRIMARY KEY, name TEXT, campus_name TEXT,
        address TEXT, phone TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY, school_id TEXT, name TEXT, duration_months INTEGER,
        tuition_amount INTEGER, active INTEGER DEFAULT 1, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS admission_terms (
        id TEXT PRIMARY KEY, school_id TEXT, name TEXT, admission_month INTEGER,
        start_date TEXT, is_short_term INTEGER DEFAULT 0,
        coe_default_deadline TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY, school_id TEXT, name TEXT, course_id TEXT,
        admission_term_id TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY, name TEXT, nationality TEXT, birth_date TEXT,
        gender TEXT, passport_no TEXT, passport_expiry TEXT,
        phone TEXT, email TEXT, address TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS applicants (
        id TEXT PRIMARY KEY, application_no TEXT UNIQUE,
        name TEXT, nationality TEXT, admission_term TEXT,
        desired_study_length TEXT, agent_name TEXT,
        status TEXT DEFAULT '面接申請',
        interview_result TEXT DEFAULT '未設定',
        application_fee_status TEXT DEFAULT '未入金',
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS applicant_required_sections (
        id TEXT PRIMARY KEY, applicant_id TEXT, section_key TEXT,
        label TEXT, completed INTEGER DEFAULT 0, updated_at TEXT,
        UNIQUE(applicant_id, section_key)
    );
    CREATE TABLE IF NOT EXISTS applicant_intake_forms (
        id TEXT PRIMARY KEY, applicant_id TEXT, source_type TEXT,
        source_label TEXT, contact_email TEXT, contact_phone TEXT,
        payload_json TEXT, submitted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY, student_no TEXT, name TEXT, nationality TEXT,
        class_name TEXT, status TEXT DEFAULT '在籍',
        residence_card_no TEXT, residence_expiry TEXT,
        residence_status TEXT, attendance_rate REAL DEFAULT 0,
        phone TEXT, address_japan TEXT, passport_no TEXT,
        birth_date TEXT, admission_date TEXT,
        emergency_contact TEXT, notes TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_portal_accounts (
        id TEXT PRIMARY KEY, student_id TEXT UNIQUE, login_id TEXT UNIQUE,
        password_hash TEXT, password_set_at TEXT,
        settings_json TEXT, updated_at TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_portal_sessions (
        id TEXT PRIMARY KEY, student_id TEXT, session_token TEXT UNIQUE,
        created_at TEXT, expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY, applicant_id TEXT, student_id TEXT,
        payment_type TEXT, amount INTEGER, payer_type TEXT,
        payer_display_name TEXT, status TEXT DEFAULT 'pending',
        confirmed_at TEXT, receipt_issued INTEGER DEFAULT 0,
        receipt_no TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS receipt_templates (
        id TEXT PRIMARY KEY, name TEXT, campus_name TEXT,
        file_format TEXT, status TEXT DEFAULT 'active',
        source_path TEXT, notes TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS receipt_documents (
        id TEXT PRIMARY KEY, payment_id TEXT, template_id TEXT,
        receipt_no TEXT, issue_date TEXT, payer_display_name TEXT,
        student_name TEXT, admission_term TEXT, payment_type TEXT,
        amount INTEGER, line_note TEXT, status TEXT DEFAULT 'issued',
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS acceptance_notice_templates (
        id TEXT PRIMARY KEY, name TEXT, campus_name TEXT,
        file_format TEXT, status TEXT DEFAULT 'active',
        source_path TEXT, notes TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS withdrawal_report_templates (
        id TEXT PRIMARY KEY, name TEXT, school_name TEXT,
        file_format TEXT, status TEXT DEFAULT 'active',
        source_path TEXT, notes TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY, school_id TEXT, campus_id TEXT,
        document_type TEXT, name TEXT, format TEXT,
        file_id TEXT, active INTEGER DEFAULT 1, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS generated_documents (
        id TEXT PRIMARY KEY, target_type TEXT, target_id TEXT,
        document_type TEXT, document_no TEXT, template_name TEXT,
        status TEXT DEFAULT 'generated', created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS export_files (
        id TEXT PRIMARY KEY, export_key TEXT UNIQUE, document_type TEXT,
        target_id TEXT, file_path TEXT, file_url TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS coe_cases (
        id TEXT PRIMARY KEY, applicant_id TEXT,
        stage TEXT DEFAULT 'COE準備', deadline TEXT,
        full_tuition_confirmed INTEGER DEFAULT 0,
        receipt_issued INTEGER DEFAULT 0,
        partial_coe_sent INTEGER DEFAULT 0,
        full_coe_sent INTEGER DEFAULT 0,
        ai_check_status TEXT DEFAULT '未実行',
        updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS coe_materials (
        id TEXT PRIMARY KEY, coe_case_id TEXT, material_key TEXT,
        label TEXT, collected INTEGER DEFAULT 0,
        checked INTEGER DEFAULT 0, updated_at TEXT,
        UNIQUE(coe_case_id, material_key)
    );
    CREATE TABLE IF NOT EXISTS ai_check_issues (
        id TEXT PRIMARY KEY, coe_case_id TEXT, severity TEXT,
        field TEXT, message TEXT, status TEXT DEFAULT 'open',
        resolution_note TEXT, created_at TEXT, resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS certificate_requests (
        id TEXT PRIMARY KEY, student_id TEXT, certificate_type TEXT,
        copies INTEGER DEFAULT 1, purpose TEXT, requested_by TEXT,
        status TEXT DEFAULT '申請中', issued_by TEXT,
        requested_at TEXT, approved_at TEXT, issued_at TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS attendance_rule_settings (
        id TEXT PRIMARY KEY, school_id TEXT, late_policy TEXT,
        early_leave_policy TEXT, official_absence_policy TEXT,
        period_minutes INTEGER DEFAULT 45, day_summary_policy TEXT,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_attendance_records (
        id TEXT PRIMARY KEY, student_id TEXT, class_date TEXT,
        period_label TEXT, status TEXT, attendance_minutes INTEGER DEFAULT 0,
        scheduled_minutes INTEGER DEFAULT 0, note TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_leave_requests (
        id TEXT PRIMARY KEY, student_id TEXT, request_type TEXT,
        request_date TEXT, period_label TEXT, reason TEXT,
        detail TEXT, status TEXT DEFAULT '申請中',
        created_at TEXT, reviewed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_consultation_records (
        id TEXT PRIMARY KEY, student_id TEXT, meeting_date TEXT,
        staff_name TEXT, content TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_exam_results (
        id TEXT PRIMARY KEY, student_id TEXT, exam_name TEXT,
        score_text TEXT, certificate_no TEXT, completion_date TEXT,
        note TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_grade_records (
        id TEXT PRIMARY KEY, student_id TEXT, term_label TEXT,
        subject_name TEXT, score REAL, grade TEXT, comment TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_bulletin_posts (
        id TEXT PRIMARY KEY, title TEXT, body TEXT,
        scope TEXT DEFAULT 'all', class_name TEXT,
        pinned INTEGER DEFAULT 0, published_at TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS class_group_messages (
        id TEXT PRIMARY KEY, class_name TEXT, author_name TEXT,
        author_role TEXT, body TEXT, posted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_homeroom_messages (
        id TEXT PRIMARY KEY, student_id TEXT, author_name TEXT,
        author_role TEXT, body TEXT, posted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_homework_assignments (
        id TEXT PRIMARY KEY, class_name TEXT, title TEXT,
        subject_name TEXT, due_date TEXT, description TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_homework_submissions (
        id TEXT PRIMARY KEY, assignment_id TEXT, student_id TEXT,
        file_name TEXT, file_path TEXT, note TEXT,
        status TEXT DEFAULT '提出済', review_comment TEXT,
        review_score INTEGER, reviewed_by TEXT,
        reviewed_at TEXT, submitted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS immigration_report_batches (
        id TEXT PRIMARY KEY, report_type TEXT, school_id TEXT,
        status TEXT DEFAULT 'draft', due_date TEXT,
        submitted_at TEXT, submission_method TEXT,
        receipt_number TEXT, evidence_file_id TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS immigration_report_items (
        id TEXT PRIMARY KEY, batch_id TEXT, student_id TEXT,
        include INTEGER DEFAULT 1, note TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY, filename TEXT, status TEXT,
        total_rows INTEGER DEFAULT 0, imported_rows INTEGER DEFAULT 0,
        error_rows INTEGER DEFAULT 0, source_label TEXT,
        note TEXT, stored_path TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS import_batch_items (
        id TEXT PRIMARY KEY, batch_id TEXT, row_no INTEGER,
        status TEXT, applicant_id TEXT, message TEXT,
        raw_json TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS annual_completion_results (
        id TEXT PRIMARY KEY, student_id TEXT, requirement TEXT,
        destination TEXT, certificate_no TEXT, completion_date TEXT,
        is_qualifying INTEGER DEFAULT 1, is_withdrawal INTEGER DEFAULT 0,
        category TEXT, display_name TEXT, score_text TEXT,
        note TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_advancement_results (
        id TEXT PRIMARY KEY, student_id TEXT, school_name TEXT,
        department_name TEXT, completion_date TEXT, note TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_employment_results (
        id TEXT PRIMARY KEY, student_id TEXT, company_name TEXT,
        job_title TEXT, completion_date TEXT, note TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS student_withdrawal_outcomes (
        id TEXT PRIMARY KEY, student_id TEXT, outcome_type TEXT,
        destination TEXT, certificate_no TEXT, completion_date TEXT,
        score_text TEXT, note TEXT, category TEXT, created_at TEXT
    );
    """)
    conn.commit()
    _seed_demo_data(conn)


# ── Demo 种子数据 ──────────────────────────────────────────
def _seed_demo_data(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    # 只在空库时插入示例数据
    if cur.execute("SELECT COUNT(*) FROM students").fetchone()[0] > 0:
        return

    from datetime import date, timedelta
    today = date.today()

    # 示例学生
    demo_students = [
        ("student-mai",    "S2025001", "LE THI MAI（黎 氏梅）",    "ベトナム", "Aクラス", "在籍",
         "RC2025001", str(today + timedelta(days=45)),  "留学", 95.0, "2025-04-01"),
        ("student-lin",    "S2025002", "LIN XIAO（林 晓）",         "中国",     "Aクラス", "在籍",
         "RC2025002", str(today + timedelta(days=120)), "留学", 88.5, "2025-04-01"),
        ("student-zhang",  "S2025003", "ZHANG WEI（张 伟）",        "中国",     "Bクラス", "在籍",
         "RC2025003", str(today + timedelta(days=200)), "留学", 72.3, "2025-07-01"),
        ("student-nguyen", "S2025004", "NGUYEN THAO（阮 草）",      "ベトナム", "Bクラス", "在籍",
         "RC2025004", str(today + timedelta(days=25)),  "留学", 91.2, "2025-07-01"),
        ("student-kim",    "S2025005", "KIM MINJI（金 敏智）",      "韓国",     "Cクラス", "退学",
         "RC2025005", str(today - timedelta(days=30)),  "留学", 45.0, "2024-10-01"),
    ]
    for s in demo_students:
        cur.execute("""
            INSERT OR IGNORE INTO students
            (id, student_no, name, nationality, class_name, status,
             residence_card_no, residence_expiry, residence_status, attendance_rate,
             admission_date, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (*s, now_iso()))
        # 创建门户账户
        cur.execute("""
            INSERT OR IGNORE INTO student_portal_accounts
            (id, student_id, login_id, created_at)
            VALUES (?,?,?,?)
        """, (new_id(), s[0], s[1], now_iso()))

    # 示例出願者
    demo_applicants = [
        ("app-001", "APP-202507-001", "WANG FANG（王 芳）",   "中国",     "2025年10月", "1年", "知日エージェント", "COE準備中", "合格", "確認済"),
        ("app-002", "APP-202507-002", "PARK JISOO（朴 智秀）","韓国",     "2025年10月", "2年", "",               "面接待ち",  "未設定", "確認済"),
        ("app-003", "APP-202507-003", "NGUYEN DUC（阮 徳）",  "ベトナム", "2026年1月",  "1年", "知日エージェント", "面接申請",  "未設定", "未入金"),
    ]
    for a in demo_applicants:
        cur.execute("""
            INSERT OR IGNORE INTO applicants
            (id, application_no, name, nationality, admission_term,
             desired_study_length, agent_name, status, interview_result,
             application_fee_status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (*a, now_iso()))

    # 示例 COE 案件
    cur.execute("""
        INSERT OR IGNORE INTO coe_cases
        (id, applicant_id, stage, deadline, full_tuition_confirmed,
         receipt_issued, partial_coe_sent, full_coe_sent, ai_check_status, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, ("coe-001", "app-001", "AIチェック待ち", str(today + timedelta(days=30)),
          1, 1, 1, 0, "要修正 3件", now_iso()))

    # 示例入金
    cur.execute("""
        INSERT OR IGNORE INTO payments
        (id, applicant_id, payment_type, amount, payer_type, payer_display_name,
         status, confirmed_at, receipt_issued, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, ("pay-001", "app-001", "選考料", 20000, "student", "WANG FANG",
          "confirmed", now_iso(), 0, now_iso()))
    cur.execute("""
        INSERT OR IGNORE INTO payments
        (id, applicant_id, payment_type, amount, payer_type, payer_display_name,
         status, confirmed_at, receipt_issued, receipt_no, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, ("pay-002", "app-002", "選考料", 20000, "agent", "知日エージェント",
          "confirmed", now_iso(), 1, "RC-20250508-202510-001", now_iso()))

    # 示例帳票模板
    cur.execute("""
        INSERT OR IGNORE INTO receipt_templates
        (id, name, campus_name, file_format, status, source_path, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, ("receipt-template-default", "領収書標準テンプレート", "高田馬場校",
          "xlsx", "active", "", "標準テンプレート", now_iso()))

    cur.execute("""
        INSERT OR IGNORE INTO acceptance_notice_templates
        (id, name, campus_name, file_format, status, source_path, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, ("acceptance-template-default", "高田馬場校 合格通知書", "高田馬場校",
          "template_pending", "active", "", "校舎別テンプレート接続予定", now_iso()))

    cur.execute("""
        INSERT OR IGNORE INTO withdrawal_report_templates
        (id, name, school_name, file_format, status, source_path, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, ("withdrawal-template-default", "離脱届標準テンプレート", "渋谷外語学院",
          "xlsx", "active", "", "標準テンプレート", now_iso()))

    conn.commit()
