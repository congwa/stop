from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func, col

from auth import require_admin
from database import get_session
from models import License, LicenseCreate, LicenseRead, StatsResponse
from services.license import generate_key, hash_key, KEY_TYPE_DAYS

router = APIRouter(prefix="/admin/api", tags=["admin"])


@router.get("/keys", response_model=dict)
def list_keys(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    _: str = Depends(require_admin),
):
    today = date.today()
    query = select(License)

    if status_filter == "activated":
        query = query.where(col(License.machine_id) != None)
    elif status_filter == "unactivated":
        query = query.where(License.machine_id == None)
    elif status_filter == "revoked":
        query = query.where(License.is_revoked == True)
    elif status_filter == "expired":
        query = query.where(
            col(License.expiry_date) != None,
            License.expiry_date < today,
        )

    total_query = select(func.count()).select_from(License)
    if status_filter == "activated":
        total_query = total_query.where(col(License.machine_id) != None)
    elif status_filter == "unactivated":
        total_query = total_query.where(License.machine_id == None)
    elif status_filter == "revoked":
        total_query = total_query.where(License.is_revoked == True)
    elif status_filter == "expired":
        total_query = total_query.where(
            col(License.expiry_date) != None,
            License.expiry_date < today,
        )

    total = session.exec(total_query).one()
    items = session.exec(query.offset((page - 1) * page_size).limit(page_size)).all()

    def _status(lic: License) -> str:
        if lic.is_revoked:
            return "revoked"
        if lic.expiry_date and today > lic.expiry_date:
            return "expired"
        if lic.machine_id:
            return "activated"
        return "unactivated"

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": lic.id,
                "key_hash": lic.key_hash[:12] + "...",
                "key_type": lic.key_type,
                "expiry_date": lic.expiry_date.isoformat() if lic.expiry_date else "永久",
                "machine_id": lic.machine_id,
                "activated_at": lic.activated_at.isoformat() if lic.activated_at else None,
                "is_revoked": lic.is_revoked,
                "note": lic.note,
                "created_at": lic.created_at.isoformat(),
                "status": _status(lic),
            }
            for lic in items
        ],
    }


@router.post("/keys/generate", response_model=dict)
def generate_keys(
    body: LicenseCreate,
    session: Session = Depends(get_session),
    _: str = Depends(require_admin),
):
    if body.count < 1 or body.count > 500:
        raise HTTPException(status_code=400, detail="count 必须在 1~500 之间")
    if body.key_type not in KEY_TYPE_DAYS:
        raise HTTPException(status_code=400, detail=f"key_type 无效，可选: {list(KEY_TYPE_DAYS.keys())}")

    days = KEY_TYPE_DAYS[body.key_type]
    today = date.today()
    expiry = None if days == 0xFFFF else today + timedelta(days=days)

    keys = []
    for _ in range(body.count):
        key = generate_key(body.key_type)
        kh = hash_key(key)
        lic = License(
            key_hash=kh,
            expiry_date=expiry,
            key_type=body.key_type,
            note=body.note,
        )
        session.add(lic)
        keys.append(key)

    session.commit()
    return {"generated": body.count, "keys": keys}


@router.put("/keys/{key_id}/revoke", response_model=dict)
def revoke_key(
    key_id: int,
    session: Session = Depends(get_session),
    _: str = Depends(require_admin),
):
    lic = session.get(License, key_id)
    if not lic:
        raise HTTPException(status_code=404, detail="Key 不存在")
    lic.is_revoked = True
    session.add(lic)
    session.commit()
    return {"success": True, "id": key_id}


@router.delete("/keys/{key_id}", response_model=dict)
def delete_key(
    key_id: int,
    session: Session = Depends(get_session),
    _: str = Depends(require_admin),
):
    lic = session.get(License, key_id)
    if not lic:
        raise HTTPException(status_code=404, detail="Key 不存在")
    session.delete(lic)
    session.commit()
    return {"success": True}


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    session: Session = Depends(get_session),
    _: str = Depends(require_admin),
):
    today = date.today()
    soon = today + timedelta(days=30)

    total = session.exec(select(func.count()).select_from(License)).one()
    activated = session.exec(
        select(func.count()).select_from(License).where(col(License.machine_id) != None)
    ).one()
    revoked = session.exec(
        select(func.count()).select_from(License).where(License.is_revoked == True)
    ).one()
    expired = session.exec(
        select(func.count()).select_from(License).where(
            col(License.expiry_date) != None,
            License.expiry_date < today,
        )
    ).one()
    today_start = datetime.combine(today, datetime.min.time())
    today_activated = session.exec(
        select(func.count()).select_from(License).where(
            col(License.activated_at) != None,
            License.activated_at >= today_start,
        )
    ).one()
    expiring_soon = session.exec(
        select(func.count()).select_from(License).where(
            col(License.expiry_date) != None,
            License.expiry_date >= today,
            License.expiry_date <= soon,
            License.is_revoked == False,
        )
    ).one()

    return StatsResponse(
        total=total,
        activated=activated,
        revoked=revoked,
        expired=expired,
        today_activated=today_activated,
        expiring_soon=expiring_soon,
    )
