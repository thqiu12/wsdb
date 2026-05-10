"""認証依赖 - DEV_MODE は環境変数で制御（本番ではデフォルト OFF）"""
import os
from fastapi import Header, Query, HTTPException
from typing import Optional
from config import AUTH_TOKEN

# 開発時のみ認証をスキップしたい場合は SCHOOLCORE_DEV_MODE=1 を設定する。
# 本番環境では絶対に有効化しないこと。
DEV_MODE = os.environ.get("SCHOOLCORE_DEV_MODE") == "1"


async def require_auth(
    authorization: str = Header(default=""),
    token: Optional[str] = Query(default=None),
):
    if DEV_MODE:
        return "dev"
    raw = token or authorization.removeprefix("Bearer ").strip()
    if not raw or raw != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail={
            "error": {"code": "UNAUTHORIZED", "message": "認証が必要です。", "details": {}}
        })
    return raw
