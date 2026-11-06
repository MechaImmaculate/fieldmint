import base64
import os
import struct
import uuid
from datetime import datetime, timezone

import base58
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import REVIEWER_WALLETS, User, current_user, require_role
from .db import get_db
from .models import Campaign
from .solana_rpc import RPC, get_parsed_tx

PROGRAM_ID = os.getenv("PROGRAM_ID", "")
TREASURY = os.getenv("TREASURY_ADDRESS", "")
FEE_BPS = int(os.getenv("FEE_BPS", "500"))

CAMPAIGN_DISC = bytes([50, 40, 49, 11, 157, 220, 229, 192])
CAMPAIGN_LEN = 147
RECEIPT_LEN = 121

router = APIRouter()


def rpc(method: str, params: list):
    try:
        data = httpx.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                          timeout=25).json()
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach the Solana RPC")
    if "error" in data:
        raise HTTPException(502, f"Solana RPC error: {data['error'].get('message')}")
    return data["result"]


def get_account(addr: str):
    value = rpc("getAccountInfo", [addr, {"encoding": "base64", "commitment": "confirmed"}])["value"]
    if not value:
        return None
    return {"owner": value["owner"], "lamports": value["lamports"], "data": base64.b64decode(value["data"][0])}


def b58(b: bytes) -> str:
    return base58.b58encode(b).decode()


def parse_campaign(data: bytes) -> dict:
    if len(data) < CAMPAIGN_LEN or data[:8] != CAMPAIGN_DISC:
        raise ValueError("not a campaign account")
    return {
        "owner": b58(data[8:40]), "reviewer": b58(data[40:72]), "treasury": b58(data[72:104]),
        "campaign_id": data[104:120],
        "reward_lamports": struct.unpack_from("<Q", data, 120)[0],
        "fee_bps": struct.unpack_from("<H", data, 128)[0],
        "max_payouts": struct.unpack_from("<I", data, 130)[0],
        "paid_count": struct.unpack_from("<I", data, 134)[0],
        "deadline": struct.unpack_from("<q", data, 138)[0],
    }


class FundIn(BaseModel):
    signature: str = Field(min_length=64, max_length=100)
    escrow: str = Field(min_length=32, max_length=64)


class CloseIn(BaseModel):
    signature: str = Field(min_length=64, max_length=100)


@router.get("/config")
def config():
    reviewer = sorted(REVIEWER_WALLETS)[0] if REVIEWER_WALLETS else ""
    return {"program_id": PROGRAM_ID, "treasury": TREASURY, "reviewer": reviewer,
            "fee_bps": FEE_BPS, "cluster": "devnet"}


@router.post("/campaigns/{campaign_id}/fund")
def fund_campaign(campaign_id: uuid.UUID, body: FundIn, user: User = Depends(require_role("org")),
                  db: Session = Depends(get_db)):
    from .main import to_out
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.owner_wallet != user.wallet:
        raise HTTPException(403, "Only the campaign owner can fund it")
    if c.status != "draft":
        raise HTTPException(409, "Campaign is already funded")
    if db.scalar(select(Campaign.id).where(Campaign.funding_signature == body.signature)):
        raise HTTPException(409, "This transaction was already used to fund a campaign")

    tx = get_parsed_tx(body.signature)
    if not tx or not tx.get("meta") or tx["meta"].get("err") is not None:
        raise HTTPException(422, "Transaction not found, failed, or not confirmed yet. Try again in a moment.")
    if not any(ix.get("programId") == PROGRAM_ID for ix in tx["transaction"]["message"]["instructions"]):
        raise HTTPException(422, "Transaction does not call the FieldMint escrow program")

    acct = get_account(body.escrow)
    if not acct or acct["owner"] != PROGRAM_ID:
        raise HTTPException(422, "Escrow account was not found or is not owned by the FieldMint program")
    try:
        s = parse_campaign(acct["data"])
    except ValueError:
        raise HTTPException(422, "Escrow account has unexpected contents")

    now = int(datetime.now(timezone.utc).timestamp())
    fee = c.reward_lamports * FEE_BPS // 10_000
    required = (c.reward_lamports + fee) * c.target_observations
    problems = []
    if s["owner"] != user.wallet: problems.append("owner")
    if s["campaign_id"] != c.id.bytes: problems.append("campaign id")
    if s["reward_lamports"] != c.reward_lamports: problems.append("reward")
    if s["max_payouts"] != c.target_observations: problems.append("payout count")
    if s["fee_bps"] != FEE_BPS: problems.append("fee")
    if s["treasury"] != TREASURY: problems.append("treasury")
    if s["reviewer"] not in REVIEWER_WALLETS: problems.append("reviewer")
    if s["deadline"] > now + 400 * 86400: problems.append("deadline")
    if acct["lamports"] < required: problems.append("locked amount")
    if problems:
        raise HTTPException(422, "On-chain escrow does not match this campaign: " + ", ".join(problems))

    c.status = "active"
    c.funding_signature = body.signature
    c.escrow_address = body.escrow
    c.deadline_at = datetime.fromtimestamp(s["deadline"], timezone.utc)
    c.funded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return to_out(c, db)


@router.get("/campaigns/{campaign_id}/chain")
def campaign_chain(campaign_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from .main import can_view
    c = db.get(Campaign, campaign_id)
    if not c or not can_view(c, user):
        raise HTTPException(404, "Campaign not found")
    if not c.escrow_address:
        return {"funded": False}

    acct = get_account(c.escrow_address)
    state = None
    if acct and acct["owner"] == PROGRAM_ID:
        try:
            state = parse_campaign(acct["data"])
        except ValueError:
            state = None

    raw = rpc("getProgramAccounts", [PROGRAM_ID, {
        "encoding": "base64", "commitment": "confirmed",
        "filters": [{"dataSize": RECEIPT_LEN}, {"memcmp": {"offset": 8, "bytes": c.escrow_address}}],
    }])
    receipts = []
    for item in raw:
        d = base64.b64decode(item["account"]["data"][0])
        receipts.append({
            "address": item["pubkey"], "contributor": b58(d[40:72]), "submission_hash": d[72:104].hex(),
            "amount_lamports": struct.unpack_from("<Q", d, 104)[0],
            "paid_at": struct.unpack_from("<q", d, 112)[0],
        })
    receipts.sort(key=lambda r: r["paid_at"])

    return {
        "funded": True, "escrow": c.escrow_address, "closed": state is None,
        "balance_lamports": acct["lamports"] if state else 0,
        "paid_count": state["paid_count"] if state else len(receipts),
        "max_payouts": state["max_payouts"] if state else c.target_observations,
        "deadline": state["deadline"] if state else int(c.deadline_at.timestamp()) if c.deadline_at else 0,
        "reviewer": state["reviewer"] if state else "",
        "treasury": state["treasury"] if state else TREASURY,
        "receipts": receipts,
    }


@router.post("/campaigns/{campaign_id}/close")
def close_campaign(campaign_id: uuid.UUID, body: CloseIn, user: User = Depends(require_role("org")),
                   db: Session = Depends(get_db)):
    from .main import to_out
    c = db.get(Campaign, campaign_id)
    if not c or c.owner_wallet != user.wallet:
        raise HTTPException(404, "Campaign not found")
    if c.status != "active" or not c.escrow_address:
        raise HTTPException(409, "Campaign is not active")
    tx = get_parsed_tx(body.signature)
    if not tx or not tx.get("meta") or tx["meta"].get("err") is not None:
        raise HTTPException(422, "Transaction not found, failed, or not confirmed yet")
    if get_account(c.escrow_address) is not None:
        raise HTTPException(422, "The escrow account still exists on-chain")
    c.status = "closed"
    db.commit()
    db.refresh(c)
    return to_out(c, db)