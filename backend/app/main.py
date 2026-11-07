import json
import math
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.shape import from_shape, to_shape
from pydantic import BaseModel, Field
from shapely.geometry import MultiPolygon, Point, mapping, shape
from shapely.prepared import prep
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .auth import User, current_user, require_role
from .auth import router as auth_router
from .db import Base, SessionLocal, engine, get_db
from .models import Campaign, Profile, Region, Task
from .escrow import router as escrow_router
from .tasks import router as tasks_router

DATA_FILE = Path(__file__).parent / "data" / "kenya_counties.geojson"

LAUNCH = {
    "transnzoia": (1, "Trans Nzoia", "Maize and crop-condition monitoring (primary launch region)"),
    "uasingishu": (2, "Uasin Gishu", "Maize and wheat, crop-stage monitoring (first expansion)"),
    "nakuru": (3, "Nakuru", "Diversified: maize, potatoes, beans, horticulture"),
    "bungoma": (4, "Bungoma", "Smallholder maize expansion"),
    "kiambu": (5, "Kiambu", "Coffee, horticulture, mixed smallholder farming"),
    "machakos": (6, "Machakos", "Dryland agriculture and crop resilience"),
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def seed_regions():
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Region)):
            return
        if not DATA_FILE.exists():
            raise RuntimeError(f"Missing {DATA_FILE}. Download the Kenya county boundaries first.")
        fc = json.loads(DATA_FILE.read_text())
        found = set()
        for f in fc["features"]:
            props = f["properties"]
            raw = props.get("shapeName") or props.get("NAME_1") or props.get("name") or ""
            key = norm(raw)
            geom = shape(f["geometry"]).buffer(0)
            if geom.geom_type == "Polygon":
                geom = MultiPolygon([geom])
            prio, name, focus = LAUNCH.get(key, (0, raw, ""))
            if key in LAUNCH:
                found.add(key)
            db.add(Region(slug=key, name=name, priority=prio, focus=focus,
                          geom=from_shape(geom, srid=4326)))
        db.commit()
        missing = set(LAUNCH) - found
        if missing:
            print(f"WARNING: launch counties not found in boundary file: {missing}")


app = FastAPI(title="FieldMint API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(escrow_router)
app.include_router(tasks_router)

@app.on_event("startup")
def init_db():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.create_all(engine)
    seed_regions()


class CampaignIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = ""
    campaign_type: str = "crop_condition"
    region: str
    reward_lamports: int = Field(gt=0)
    target_observations: int = Field(ge=1, le=2000)


class FundIn(BaseModel):
    signature: str = Field(min_length=64, max_length=100)


class CampaignOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    campaign_type: str
    region: str
    owner_wallet: str
    reward_lamports: int
    target_observations: int
    budget_lamports: int
    status: str
    funding_signature: str | None = None
    funded_at: datetime | None = None
    escrow_address: str | None = None
    deadline_at: datetime | None = None
    created_at: datetime
    area: dict
    task_count: int


def sample_points(geom, n):
    inner = geom.buffer(-0.01)
    area = geom if inner.is_empty else inner
    prepared = prep(area)
    minx, miny, maxx, maxy = area.bounds
    step = math.sqrt(area.area / n)
    pts = []
    for _ in range(15):
        pts = []
        y = miny + step / 2
        while y < maxy:
            x = minx + step / 2
            while x < maxx:
                p = Point(x, y)
                if prepared.contains(p):
                    pts.append(p)
                x += step
            y += step
        if len(pts) >= n:
            break
        step *= 0.85
    if len(pts) > n:
        pts = [pts[int(i * len(pts) / n)] for i in range(n)]
    return pts


def to_out(c: Campaign, db: Session) -> CampaignOut:
    count = db.scalar(select(func.count()).select_from(Task).where(Task.campaign_id == c.id)) or 0
    return CampaignOut(
        id=c.id, title=c.title, description=c.description, campaign_type=c.campaign_type,
        region=c.region, owner_wallet=c.owner_wallet, reward_lamports=c.reward_lamports,
        target_observations=c.target_observations,
        budget_lamports=c.reward_lamports * c.target_observations,
        status=c.status, funding_signature=c.funding_signature, funded_at=c.funded_at,
        escrow_address=c.escrow_address, deadline_at=c.deadline_at,
        created_at=c.created_at, area=mapping(to_shape(c.area)), task_count=count,
    )


@app.get("/health")
def health():
    return {"status": "ok"}



@app.get("/regions")
def regions(db: Session = Depends(get_db)):
    rows = db.scalars(select(Region).where(Region.priority > 0).order_by(Region.priority)).all()
    return [{"name": r.name, "focus": r.focus, "priority": r.priority,
             "bbox": list(to_shape(r.geom).bounds)} for r in rows]


@app.post("/campaigns", response_model=CampaignOut, status_code=201)
def create_campaign(body: CampaignIn, user: User = Depends(require_role("org")),
                    db: Session = Depends(get_db)):
    region = db.scalar(select(Region).where(Region.slug == norm(body.region), Region.priority > 0))
    if not region:
        raise HTTPException(422, f"Region '{body.region}' is not open for campaigns")
    points = sample_points(to_shape(region.geom), body.target_observations)
    if not points:
        raise HTTPException(500, "Could not generate sampling points for this region")
    c = Campaign(**{**body.model_dump(), "region": region.name},
                 owner_wallet=user.wallet, area=region.geom)
    db.add(c)
    db.flush()
    for p in points:
        db.add(Task(campaign_id=c.id, location=from_shape(p, srid=4326)))
    db.commit()
    db.refresh(c)
    return to_out(c, db)




def can_view(c: Campaign, user: User) -> bool:
    if "org" in user.roles and c.owner_wallet == user.wallet:
        return True
    if "reviewer" in user.roles and c.status != "draft":
        return True
    return c.status == "active"


def can_view(c: Campaign, user: User) -> bool:
    if "org" in user.roles and c.owner_wallet == user.wallet:
        return True
    if "reviewer" in user.roles and c.status != "draft":
        return True
    return c.status == "active"


@app.get("/campaigns", response_model=list[CampaignOut])
def list_campaigns(view: str = Query("contribute", pattern="^(org|review|contribute)$"),
                   user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Campaign).order_by(Campaign.created_at.desc())
    if view == "org":
        if "org" not in user.roles:
            raise HTTPException(403, "Not authorized")
        q = q.where(Campaign.owner_wallet == user.wallet)
    elif view == "review":
        if "reviewer" not in user.roles:
            raise HTTPException(403, "Not authorized")
        q = q.where(Campaign.status != "draft")
    else:
        q = q.where(Campaign.status == "active")
    return [to_out(c, db) for c in db.scalars(q)]


@app.get("/campaigns/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: uuid.UUID, user: User = Depends(current_user),
                 db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c or not can_view(c, user):
        raise HTTPException(404, "Campaign not found")
    return to_out(c, db)


@app.get("/campaigns/{campaign_id}/tasks")
def campaign_tasks(campaign_id: uuid.UUID, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c or not can_view(c, user):
        raise HTTPException(404, "Campaign not found")
    tasks = db.scalars(select(Task).where(Task.campaign_id == campaign_id)).all()
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": mapping(to_shape(t.location)),
         "properties": {"id": str(t.id), "status": t.status}} for t in tasks]}


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    county: str = Field(min_length=2, max_length=80)


@app.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Profile, user.wallet)
    return {"wallet": user.wallet, "roles": user.roles,
            "profile": {"display_name": p.display_name, "county": p.county} if p else None}


@app.put("/me/profile")
def save_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Profile, user.wallet)
    if p:
        p.display_name, p.county = body.display_name, body.county
    else:
        db.add(Profile(wallet=user.wallet, display_name=body.display_name, county=body.county))
    db.commit()
    return {"ok": True}