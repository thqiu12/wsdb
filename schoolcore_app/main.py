"""SchoolCore V2 - FastAPI メインアプリ"""
from __future__ import annotations
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import STATIC_DIR, EXPORT_DIR, PORT
from db import init_db


def _allowed_origins() -> list[str]:
    raw = os.environ.get("SCHOOLCORE_CORS_ORIGINS", "")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"]


def create_app() -> FastAPI:
    app = FastAPI(title="SchoolCore API", version="2.0.0", docs_url="/api/docs")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "x-staff-session"],
    )

    @app.on_event("startup")
    async def _startup() -> None:
        init_db()

    # ── 导入并注册路由 ─────────────────────────────────────
    from routers import (
        dashboard, applicants, students, payments,
        coe, immigration, certificates, portal, audit, exports
    )

    app.include_router(dashboard.router,    prefix="/api", tags=["Dashboard"])
    app.include_router(applicants.router,   prefix="/api", tags=["Applicants"])
    app.include_router(students.router,     prefix="/api", tags=["Students"])
    app.include_router(payments.router,     prefix="/api", tags=["Payments"])
    app.include_router(coe.router,          prefix="/api", tags=["COE"])
    app.include_router(immigration.router,  prefix="/api", tags=["Immigration"])
    app.include_router(certificates.router, prefix="/api", tags=["Certificates"])
    app.include_router(portal.router,       prefix="/api/public", tags=["Portal"])
    app.include_router(audit.router,        prefix="/api", tags=["Audit"])
    app.include_router(exports.router,      prefix="/api", tags=["Exports"])

    # ── 静态文件 ──────────────────────────────────────────
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    # NOTE: /exports をディレクトリごと mount するとファイル名さえ知っていれば
    # 誰でもダウンロード可能になる。エクスポート生成エンドポイントを実装する際に、
    # export_files.access_token を検証するガード付きエンドポイントを追加すること。

    # ── 页面路由 ──────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/apply", include_in_schema=False)
    async def apply_page():
        return FileResponse(str(STATIC_DIR / "apply.html"))

    @app.get("/student", include_in_schema=False)
    async def student_page():
        return FileResponse(str(STATIC_DIR / "student.html"))

    @app.get("/api/health", include_in_schema=False)
    async def health():
        from db import now_iso
        return {"ok": True, "time": now_iso(), "version": "2.0.0"}

    return app


# ── 入口 ──────────────────────────────────────────────────
app = create_app()

if __name__ == "__main__":
    import uvicorn
    print(f"SchoolCore V2 starting on http://127.0.0.1:{PORT}")
    print(f"API Docs: http://127.0.0.1:{PORT}/api/docs")
    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=False)
