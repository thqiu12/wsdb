from fastapi import APIRouter, Depends
from auth import require_auth
from db import rows, row

router = APIRouter()

@router.get("/document-ledger")
async def document_ledger(auth=Depends(require_auth)):
    items = rows("""
        SELECT * FROM (
          SELECT '領収書' as document_type, rd.receipt_no as document_no,
                 rd.created_at, rd.payer_display_name as target_name,
                 rd.payment_type as category
          FROM receipt_documents rd WHERE rd.status='issued'
          UNION ALL
          SELECT gd.document_type, gd.document_no, gd.created_at,
                 COALESCE(a.name, s.name, '') as target_name,
                 '' as category
          FROM generated_documents gd
          LEFT JOIN applicants a ON gd.target_type='applicant' AND a.id=gd.target_id
          LEFT JOIN students s ON gd.target_type='student' AND s.id=gd.target_id
        )
        ORDER BY created_at DESC
    """)
    return {
        "summary": {
            "total_count": len(items),
            "receipt_count": sum(1 for i in items if i["document_type"] == "領収書"),
            "acceptance_count": sum(1 for i in items if i["document_type"] == "合格通知書"),
            "certificate_count": sum(1 for i in items if i["document_type"] in ("出席率証明書","成績証明書","修了証明書")),
        },
        "items": items,
    }


@router.get("/import-batches")
async def list_import_batches(auth=Depends(require_auth)):
    return rows("SELECT * FROM import_batches ORDER BY created_at DESC")
