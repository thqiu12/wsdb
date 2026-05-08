"""SchoolCore 配置模块 - 所有配置集中管理"""
from __future__ import annotations
import os
from pathlib import Path

ROOT = Path(__file__).parent

# ── 目录配置 ────────────────────────────────────────────
DATA_DIR    = Path(os.environ.get("DATA_DIR",    str(ROOT / "data")))
EXPORT_DIR  = Path(os.environ.get("EXPORT_DIR",  str(ROOT / "exports")))
UPLOAD_DIR  = Path(os.environ.get("UPLOAD_DIR",  str(ROOT / "uploads")))
TEMPLATES_DIR = Path(os.environ.get("TEMPLATES_DIR", str(ROOT / "templates")))
STATIC_DIR  = ROOT / "static"

DB_PATH     = DATA_DIR / "schoolcore.db"

# 确保目录存在
for _d in [DATA_DIR, EXPORT_DIR, UPLOAD_DIR, TEMPLATES_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

# ── 认证配置 ─────────────────────────────────────────────
AUTH_TOKEN  = os.environ.get("AUTH_TOKEN", "schoolcore-dev-token")

# ── 服务配置 ─────────────────────────────────────────────
PORT        = int(os.environ.get("PORT", "8765"))

# ── 运行时配置 ────────────────────────────────────────────
BUNDLED_NODE   = Path(os.environ.get("SCHOOLCORE_NODE",   "/usr/bin/node"))
BUNDLED_PYTHON = Path(os.environ.get("SCHOOLCORE_PYTHON", "/usr/bin/python3"))

# ── 帳票模板路径（可通过环境变量覆盖）─────────────────────
def _tmpl(name: str) -> Path:
    """从 TEMPLATES_DIR 获取帳票模板路径"""
    return TEMPLATES_DIR / name

SEMIANNUAL_TEMPLATE_XLS         = _tmpl("semiannual_attendance.xls")
SEMIANNUAL_DETAIL_TEMPLATE_XLS  = _tmpl("semiannual_attendance_detail.xls")
MAY_NOVEMBER_TEMPLATE_XLS       = _tmpl("may_november.xls")
RESIDENCE_RENEWAL_LIST_TEMPLATE_XLS = _tmpl("residence_renewal_list.xls")
RESIDENCE_RENEWAL_FORM_TEMPLATE_XLS = _tmpl("residence_renewal_form.xls")
POOR_ATTENDANCE_TEMPLATE_XLSX   = _tmpl("poor_attendance.xlsx")
ANNUAL_COMPLETION_TEMPLATE_XLSX = _tmpl("annual_completion.xlsx")
ANNUAL_COMPLETION_LIST_TEMPLATE_XLSX = _tmpl("annual_completion_list.xlsx")
