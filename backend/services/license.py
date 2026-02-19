import hashlib
import hmac
import os
import struct
import base64
from datetime import date, timedelta
from typing import Optional, Tuple

from config import SECRET_KEY, KEY_EPOCH_DATE, beijing_today

KEY_TYPE_DAYS = {
    "2h": 0,
    "1d": 1,
    "2d": 2,
    "3d": 3,
    "4d": 4,
    "5d": 5,
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
    "permanent": 0xFFFF,
}

_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
_CHAR_MAP = {c: i for i, c in enumerate(_ALPHABET)}


def _base32_encode(data: bytes) -> str:
    result = []
    bits = 0
    buf = 0
    for byte in data:
        buf = (buf << 8) | byte
        bits += 8
        while bits >= 5:
            bits -= 5
            result.append(_ALPHABET[(buf >> bits) & 0x1F])
    if bits > 0:
        result.append(_ALPHABET[(buf << (5 - bits)) & 0x1F])
    return "".join(result)


def _base32_decode(s: str) -> bytes:
    bits = 0
    buf = 0
    result = []
    for c in s.upper():
        val = _CHAR_MAP.get(c)
        if val is None:
            raise ValueError(f"Invalid Base32 character: {c}")
        buf = (buf << 5) | val
        bits += 5
        if bits >= 8:
            bits -= 8
            result.append((buf >> bits) & 0xFF)
    return bytes(result)


def _hmac_sign(data: bytes) -> bytes:
    return hmac.new(SECRET_KEY.encode(), data, hashlib.sha256).digest()[:4]


def generate_key(key_type: str) -> str:
    days = KEY_TYPE_DAYS.get(key_type, 30)
    epoch_offset = (beijing_today() - KEY_EPOCH_DATE).days if days != 0xFFFF else 0
    expiry_days = epoch_offset + days if days != 0xFFFF else 0xFFFF

    # 6-byte payload + 4-byte sig = 10 bytes → exactly 16 base32 chars
    payload = bytes([1]) + struct.pack(">H", expiry_days) + os.urandom(3)
    sig = _hmac_sign(payload)
    raw = payload + sig  # 10 bytes
    encoded = _base32_encode(raw).upper()  # exactly 16 chars
    return f"STOP-{encoded[0:4]}-{encoded[4:8]}-{encoded[8:12]}-{encoded[12:16]}"


def parse_key(key: str) -> Tuple[bool, Optional[date], str]:
    """Returns (valid, expiry_date, error_msg)"""
    key = key.strip().upper().replace(" ", "").replace("-", "")
    if key.startswith("STOP"):
        key = key[4:]
    if len(key) != 16:
        return False, None, "Key 长度错误"

    try:
        raw = _base32_decode(key)
    except ValueError as e:
        return False, None, str(e)

    if len(raw) < 10:
        return False, None, "Key 格式错误"

    payload = raw[:6]
    sig = raw[6:10]
    expected_sig = _hmac_sign(payload)
    if not hmac.compare_digest(sig, expected_sig):
        return False, None, "Key 签名无效"

    version = payload[0]
    if version != 1:
        return False, None, "Key 版本不支持"

    expiry_days = struct.unpack(">H", payload[1:3])[0]
    if expiry_days == 0xFFFF:
        return True, None, ""

    expiry_date = KEY_EPOCH_DATE + timedelta(days=expiry_days)
    return True, expiry_date, ""


def hash_key(key: str) -> str:
    normalized = key.strip().upper().replace(" ", "").replace("-", "")
    if normalized.startswith("STOP"):
        normalized = normalized[4:]
    return hashlib.sha256(normalized.encode()).hexdigest()
