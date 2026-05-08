from fastapi import APIRouter, Depends
from auth import require_auth
from db import rows

router = APIRouter()

@router.get("/audit-logs")
async def get_audit_logs(auth=Depends(require_auth)):
    return rows("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")
