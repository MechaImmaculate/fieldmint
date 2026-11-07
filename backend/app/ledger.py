import base64
import struct

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import User, current_user
from .db import get_db
from .escrow import PROGRAM_ID, RECEIPT_LEN, b58, parse_campaign, rpc
from .models import Campaign, Submission

router = APIRouter()


def paid_totals(db: Session, *conds) -> tuple[int, int]:
    row = db.execute(
        select(func.coalesce(func.sum(Campaign.reward_lamports), 0), func.count(Submission.id))
        .select_from(Submission).join(Campaign, Submission.campaign_id == Campaign.id)
        .where(Submission.status == "paid", *conds)
    ).one()
    return int(row[0]), int(row[1])


@router.get("/me/ledger")
def my_ledger(user: User = Depends(current_user), db: Session = Depends(get_db)):
    titles = {c.escrow_address: c.title for c in db.scalars(
        select(Campaign).where(Campaign.escrow_address.is_not(None)))}

    # Earnings: every payout receipt on-chain naming this wallet as the contributor
    raw = rpc("getProgramAccounts", [PROGRAM_ID, {
        "encoding": "base64", "commitment": "confirmed",
        "filters": [{"dataSize": RECEIPT_LEN}, {"memcmp": {"offset": 40, "bytes": user.wallet}}],
    }])
    receipts = []
    for item in raw:
        d = base64.b64decode(item["account"]["data"][0])
        receipts.append({
            "address": item["pubkey"],
            "campaign_title": titles.get(b58(d[8:40]), "Campaign"),
            "amount_lamports": struct.unpack_from("<Q", d, 104)[0],
            "paid_at": struct.unpack_from("<q", d, 112)[0],
            "submission_hash": d[72:104].hex(),
        })
    receipts.sort(key=lambda r: r["paid_at"], reverse=True)
    out: dict = {"earned": {
        "total_lamports": sum(r["amount_lamports"] for r in receipts),
        "count": len(receipts), "receipts": receipts[:50]}}

    if "org" in user.roles:
        live = db.scalars(select(Campaign).where(
            Campaign.owner_wallet == user.wallet, Campaign.status == "active",
            Campaign.escrow_address.is_not(None))).all()
        camps, held = [], 0
        if live:
            res = rpc("getMultipleAccounts", [[c.escrow_address for c in live],
                                              {"encoding": "base64", "commitment": "confirmed"}])
            for c, v in zip(live, res["value"]):
                lam, paid, mx = 0, 0, c.target_observations
                if v and v["owner"] == PROGRAM_ID:
                    try:
                        st = parse_campaign(base64.b64decode(v["data"][0]))
                        lam, paid, mx = v["lamports"], st["paid_count"], st["max_payouts"]
                    except ValueError:
                        pass
                held += lam
                camps.append({"id": str(c.id), "title": c.title, "escrow": c.escrow_address,
                              "balance_lamports": lam, "paid_count": paid, "max_payouts": mx})
        paid_out, _ = paid_totals(db, Campaign.owner_wallet == user.wallet)
        out["escrow"] = {"held_lamports": held, "paid_out_lamports": paid_out, "campaigns": camps}

    if "reviewer" in user.roles:
        total, count = paid_totals(db, Submission.reviewed_by == user.wallet)
        out["released"] = {"total_lamports": total, "count": count}
    return out