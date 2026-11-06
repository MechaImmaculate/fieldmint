import base64
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone

import base58
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey
from pydantic import BaseModel

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")
ORG_WALLETS = {w.strip() for w in os.getenv("ORG_WALLETS", "").split(",") if w.strip()}
REVIEWER_WALLETS = {w.strip() for w in os.getenv("REVIEWER_WALLETS", "").split(",") if w.strip()}
NONCES: dict[str, float] = {}  # nonce -> expiry (in-memory is fine for the demo)

router = APIRouter()


class User(BaseModel):
    wallet: str
    roles: list[str]


def roles_for(wallet: str) -> list[str]:
    roles = ["contributor"]
    if wallet in ORG_WALLETS:
        roles.append("org")
    if wallet in REVIEWER_WALLETS:
        roles.append("reviewer")
    return roles


class ChallengeIn(BaseModel):
    wallet: str


class VerifyIn(BaseModel):
    wallet: str
    message: str
    signature: str  # base64


@router.post("/auth/challenge")
def challenge(body: ChallengeIn):
    nonce = secrets.token_hex(16)
    NONCES[nonce] = time.time() + 300
    message = f"FieldMint sign-in\nWallet: {body.wallet}\nNonce: {nonce}"
    return {"message": message}


@router.post("/auth/verify")
def verify(body: VerifyIn):
    m = re.search(r"Nonce: (\w+)", body.message)
    if not body.message.startswith("FieldMint sign-in") or f"Wallet: {body.wallet}" not in body.message or not m:
        raise HTTPException(400, "Malformed sign-in message")
    expiry = NONCES.pop(m.group(1), None)
    if not expiry or expiry < time.time():
        raise HTTPException(400, "Sign-in request expired, please try again")
    try:
        VerifyKey(base58.b58decode(body.wallet)).verify(
            body.message.encode(), base64.b64decode(body.signature)
        )
    except (BadSignatureError, ValueError):
        raise HTTPException(401, "Invalid signature")
    roles = roles_for(body.wallet)
    token = jwt.encode(
        {"sub": body.wallet, "roles": roles, "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token, "wallet": body.wallet, "roles": roles}


def current_user(authorization: str | None = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in with your wallet first")
    try:
        data = jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please sign in again")
    return User(wallet=data["sub"], roles=data["roles"])


def require_role(role: str):
    def dep(user: User = Depends(current_user)) -> User:
        if role not in user.roles:
            raise HTTPException(403, "This wallet is not authorized for that action")
        return user

    return dep