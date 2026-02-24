from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from config import beijing_today, beijing_now
from database import get_session
from models import License, ActivateRequest, ActivateResponse, VerifyRequest, VerifyResponse, TimeResponse
from services.license import parse_key, hash_key, KEY_TYPE_DAYS
from services.time_service import get_signed_time

router = APIRouter(prefix="/api", tags=["client"])


@router.get("/time", response_model=TimeResponse)
def get_time():
    return get_signed_time()


@router.post("/activate", response_model=ActivateResponse)
def activate(req: ActivateRequest, session: Session = Depends(get_session)):
    valid, _, err = parse_key(req.key)  # 忽略 Key 中的过期日期，以数据库为准
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Key 无效: {err}")

    time_info = get_signed_time()
    today = beijing_today()

    key_hash = hash_key(req.key)
    license_row = session.exec(select(License).where(License.key_hash == key_hash)).first()

    if license_row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Key 不存在")

    if license_row.is_revoked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Key 已被吊销")

    if license_row.expiry_date is not None and today > license_row.expiry_date:
        raise HTTPException(status_code=402, detail="License 已过期")

    if license_row.machine_id is not None and license_row.machine_id != req.machine_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该 Key 已在其他设备激活")

    if license_row.machine_id is None:
        license_row.machine_id = req.machine_id
        license_row.activated_at = beijing_now()
        # 激活时计算过期时间
        days = KEY_TYPE_DAYS.get(license_row.key_type, 30)
        if days == 0xFFFF:
            license_row.expiry_date = None  # 永久
        else:
            license_row.expiry_date = today + timedelta(days=days)
        session.add(license_row)
        session.commit()
        session.refresh(license_row)

    return ActivateResponse(
        valid=True,
        expiry_date=license_row.expiry_date,
        server_time=time_info["server_time"],
        message="激活成功",
    )


@router.post("/verify", response_model=VerifyResponse)
def verify(req: VerifyRequest, session: Session = Depends(get_session)):
    valid, _, err = parse_key(req.key)  # 忽略 Key 中的过期日期，以数据库为准
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Key 无效: {err}")

    time_info = get_signed_time()
    today = beijing_today()

    key_hash = hash_key(req.key)
    license_row = session.exec(select(License).where(License.key_hash == key_hash)).first()

    if license_row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Key 不存在")

    if license_row.is_revoked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Key 已被吊销")

    if license_row.expiry_date is not None and today > license_row.expiry_date:
        raise HTTPException(status_code=402, detail="License 已过期")

    if license_row.machine_id != req.machine_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="机器码不匹配")

    return VerifyResponse(
        valid=True,
        expiry_date=license_row.expiry_date,
        server_time=time_info["server_time"],
        message="验证通过",
    )
