import hashlib
import json
import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point, mapping
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import User, current_user
from .db import get_db
from .models import Campaign, Profile, Submission, Task

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
MAX_PHOTO = 8 * 1024 * 1024
MAX_OPEN_CLAIMS = 3
NEAR_M = 150
MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}

router = APIRouter()


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def sniff_ext(b: bytes) -> str | None:
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    return None


def is_staff(c: Campaign, user: User) -> bool:
    return ("org" in user.roles and c.owner_wallet == user.wallet) or "reviewer" in user.roles


def load_campaign(db: Session, campaign_id: uuid.UUID, user: User) -> Campaign:
    from .main import can_view
    c = db.get(Campaign, campaign_id)
    if not c or not can_view(c, user):
        raise HTTPException(404, "Campaign not found")
    return c


def load_task(db: Session, task_id: uuid.UUID, user: User):
    from .main import can_view
    t = db.get(Task, task_id)
    c = db.get(Campaign, t.campaign_id) if t else None
    if not t or not c or not can_view(c, user):
        raise HTTPException(404, "Task not found")
    return t, c


def sub_out(db: Session, s: Submission, t: Task, c: Campaign) -> dict:
    p, tp = to_shape(s.location), to_shape(t.location)
    prof = db.get(Profile, s.contributor_wallet)
    return {
        "id": str(s.id), "task_id": str(s.task_id), "campaign_id": str(s.campaign_id),
        "campaign_title": c.title, "reward_lamports": c.reward_lamports,
        "contributor_wallet": s.contributor_wallet,
        "contributor_name": prof.display_name if prof else None,
        "status": s.status, "crop_type": s.crop_type, "growth_stage": s.growth_stage,
        "condition": s.condition, "notes": s.notes,
        "lng": p.x, "lat": p.y, "target_lng": tp.x, "target_lat": tp.y,
        "distance_m": s.distance_m, "inside_area": s.inside_area, "accuracy_m": s.accuracy_m,
        "gps_source": s.gps_source, "captured_at": s.captured_at.isoformat(),
        "created_at": s.created_at.isoformat(), "checks": s.checks,
        "record_hash": s.record_hash, "photo_sha256": s.photo_sha256,
        "review_reason": s.review_reason, "reviewed_by": s.reviewed_by,
        "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
        "payment_signature": s.payment_signature,
    }


@router.get("/campaigns/{campaign_id}/map")
def campaign_map(campaign_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = load_campaign(db, campaign_id, user)
    tasks = db.scalars(select(Task).where(Task.campaign_id == c.id)).all()
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": mapping(to_shape(t.location)),
         "properties": {"id": str(t.id), "status": t.status, "mine": t.claimed_by == user.wallet}}
        for t in tasks]}


@router.get("/tasks/{task_id}")
def task_detail(task_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t, c = load_task(db, task_id, user)
    mine = t.claimed_by == user.wallet
    sub = db.scalar(select(Submission).where(Submission.task_id == t.id))
    pt = to_shape(t.location)
    return {
        "task": {"id": str(t.id), "status": t.status, "lng": pt.x, "lat": pt.y, "mine": mine},
        "campaign": {"id": str(c.id), "title": c.title, "description": c.description,
                     "reward_lamports": c.reward_lamports, "status": c.status,
                     "area": mapping(to_shape(c.area))},
        "submission": sub_out(db, sub, t, c) if sub and (mine or is_staff(c, user)) else None,
    }


@router.post("/tasks/{task_id}/claim")
def claim_task(task_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t, c = load_task(db, task_id, user)
    if c.status != "active":
        raise HTTPException(409, "This campaign is not live")
    if not db.get(Profile, user.wallet):
        raise HTTPException(409, "Create your contributor profile first")
    if t.status != "open":
        raise HTTPException(409, "This point is no longer available")
    open_claims = db.scalar(select(func.count()).select_from(Task).where(
        Task.claimed_by == user.wallet, Task.status == "claimed")) or 0
    if open_claims >= MAX_OPEN_CLAIMS:
        raise HTTPException(409, f"You can hold at most {MAX_OPEN_CLAIMS} unsubmitted points. Submit or release one first.")
    t.status, t.claimed_by, t.claimed_at = "claimed", user.wallet, datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/release")
def release_task(task_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t, _ = load_task(db, task_id, user)
    if t.claimed_by != user.wallet or t.status != "claimed":
        raise HTTPException(409, "Nothing to release")
    t.status, t.claimed_by, t.claimed_at = "open", None, None
    db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/submit")
def submit_task(
    task_id: uuid.UUID,
    lat: float = Form(...),
    lng: float = Form(...),
    accuracy_m: float | None = Form(None),
    gps_source: str = Form("device"),
    captured_at: str | None = Form(None),
    crop_type: str = Form(""),
    growth_stage: str = Form(""),
    condition: str = Form(""),
    notes: str = Form(""),
    photo: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    t, c = load_task(db, task_id, user)
    if t.claimed_by != user.wallet or t.status != "claimed":
        raise HTTPException(409, "Claim this point before submitting")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(422, "Invalid coordinates")
    gps_source = "manual" if gps_source == "manual" else "device"

    data = photo.file.read(MAX_PHOTO + 1)
    if len(data) > MAX_PHOTO:
        raise HTTPException(413, "Photo is larger than 8 MB")
    ext = sniff_ext(data)
    if not ext:
        raise HTTPException(422, "Photo must be a JPEG, PNG or WebP image")

    now = datetime.now(timezone.utc)
    try:
        taken = datetime.fromisoformat((captured_at or "").replace("Z", "+00:00"))
        if taken.tzinfo is None:
            taken = taken.replace(tzinfo=timezone.utc)
    except ValueError:
        taken = now

    photo_sha = hashlib.sha256(data).hexdigest()
    target = to_shape(t.location)
    dist = haversine_m(target.y, target.x, lat, lng)
    inside = bool(to_shape(c.area).contains(Point(lng, lat)))
    dup = (db.scalar(select(func.count()).select_from(Submission)
                     .where(Submission.photo_sha256 == photo_sha)) or 0) > 0

    def chk(name: str, ok: bool, good: str, bad: str) -> dict:
        return {"name": name, "status": "pass" if ok else "flag",
                "detail": good if ok else bad, "source": "rules"}

    checks = [
        chk("Required fields", all(v.strip() for v in (crop_type, growth_stage, condition)),
            "Crop, growth stage and condition provided", "Crop, growth stage or condition is missing"),
        chk("Location inside campaign area", inside,
            f"Inside the {c.region} campaign area", "Outside the campaign area"),
        chk("Distance from assigned point", dist <= NEAR_M,
            f"{round(dist)} m from the assigned point",
            f"{round(dist)} m from the assigned point (limit {NEAR_M} m)"),
        chk("GPS source", gps_source == "device", "Captured from the device GPS",
            "Coordinates were entered manually"),
        chk("GPS accuracy", accuracy_m is not None and accuracy_m <= 50,
            f"Accuracy about {round(accuracy_m or 0)} m", "Accuracy unknown or worse than 50 m"),
        chk("Photo not reused", not dup, "This photo has not been submitted before",
            "This exact photo was submitted before"),
        chk("Capture time", now - timedelta(hours=48) <= taken <= now + timedelta(minutes=5),
            "Captured within the last 48 hours", "Capture time is old or in the future"),
    ]

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    (UPLOAD_DIR / fname).write_bytes(data)

    record = {
        "campaign_id": str(c.id), "task_id": str(t.id), "contributor": user.wallet,
        "lat": round(lat, 6), "lng": round(lng, 6), "captured_at": taken.isoformat(),
        "crop_type": crop_type.strip(), "growth_stage": growth_stage.strip(),
        "condition": condition.strip(), "notes": notes.strip(), "photo_sha256": photo_sha,
    }
    record_hash = hashlib.sha256(json.dumps(record, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    s = Submission(
        task_id=t.id, campaign_id=c.id, contributor_wallet=user.wallet,
        location=from_shape(Point(lng, lat), srid=4326), accuracy_m=accuracy_m, gps_source=gps_source,
        captured_at=taken, crop_type=crop_type.strip(), growth_stage=growth_stage.strip(),
        condition=condition.strip(), notes=notes.strip(), photo_path=fname, photo_sha256=photo_sha,
        record_hash=record_hash, distance_m=dist, inside_area=inside, checks=checks,
    )
    t.status = "submitted"
    db.add(s)
    db.commit()
    db.refresh(s)
    return sub_out(db, s, t, c)


@router.get("/me/submissions")
def my_submissions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Submission).where(Submission.contributor_wallet == user.wallet)
                      .order_by(Submission.created_at.desc())).all()
    return [sub_out(db, s, db.get(Task, s.task_id), db.get(Campaign, s.campaign_id)) for s in rows]


@router.get("/campaigns/{campaign_id}/submissions")
def campaign_submissions(campaign_id: uuid.UUID, user: User = Depends(current_user),
                         db: Session = Depends(get_db)):
    c = load_campaign(db, campaign_id, user)
    if not is_staff(c, user):
        raise HTTPException(403, "Not authorized")
    rows = db.scalars(select(Submission).where(Submission.campaign_id == c.id)
                      .order_by(Submission.created_at.desc())).all()
    return [sub_out(db, s, db.get(Task, s.task_id), c) for s in rows]


@router.get("/submissions/{submission_id}")
def one_submission(submission_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(Submission, submission_id)
    c = db.get(Campaign, s.campaign_id) if s else None
    if not s or not c or not (s.contributor_wallet == user.wallet or is_staff(c, user)):
        raise HTTPException(404, "Submission not found")
    return sub_out(db, s, db.get(Task, s.task_id), c)


@router.get("/submissions/{submission_id}/photo")
def submission_photo(submission_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = db.get(Submission, submission_id)
    c = db.get(Campaign, s.campaign_id) if s else None
    if not s or not c or not (s.contributor_wallet == user.wallet or is_staff(c, user)):
        raise HTTPException(404, "Photo not found")
    path = UPLOAD_DIR / s.photo_path
    if not path.exists():
        raise HTTPException(404, "Photo not found")
    return FileResponse(path, media_type=MIME.get(path.suffix[1:], "application/octet-stream"))