"""認証依赖 - 開発モードは認証スキップ"""
from fastapi import Header, Query
from typing import Optional
from config import AUTH_TOKEN
import os

# DEV_MODE=true の場合は認証をスキップ（デフォルトON）
DEV_MODE = True  # 開発モード：認証スキップ


async def require_auth(
    authorization: str = Header(default=""),
    token: Optional[str] = Query(default=None),
):
    if DEV_MODE:
        return "dev"
    raw = token or authorization.removeprefix("Bearer ").strip()
    if raw != AUTH_TOKEN:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail={
            "error": {"code": "UNAUTHORIZED", "message": "認証が必要です。", "details": {}}
        })
    return raw
