import hashlib
import hmac
import time
from config import SECRET_KEY


def get_signed_time() -> dict:
    ts = str(int(time.time()))
    sig = hmac.new(SECRET_KEY.encode(), ts.encode(), hashlib.sha256).hexdigest()[:16]
    return {"server_time": ts, "signature": sig}


def verify_time_signature(ts: str, sig: str) -> bool:
    expected = hmac.new(SECRET_KEY.encode(), ts.encode(), hashlib.sha256).hexdigest()[:16]
    return hmac.compare_digest(expected, sig)
