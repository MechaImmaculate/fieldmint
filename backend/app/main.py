import json
import math
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.shape import from_shape, to_shape
from pydantic import BaseModel, Field
from shapely.geometry import MultiPolygon, Point, mapping, shape
from shapely.prepared import prep
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .auth import User, require_role
from .auth import router as auth_router
from .db import Base, SessionLocal, engine, get_db
from .models import Campaign, Region, Task
from .solana_rpc import ESCROW, get_parsed_tx, transferred_lamports

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
        created_at=c.created_at, area=mapping(to_shape(c.area)), task_count=count,
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/config")
def config():
    return {"escrow": ESCROW, "cluster": "devnet"}


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


@app.post("/campaigns/{campaign_id}/fund", response_model=CampaignOut)
def fund_campaign(campaign_id: uuid.UUID, body: FundIn,
                  user: User = Depends(require_role("org")), db: Session = Depends(get_db)):
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
    if not tx:
        raise HTTPException(422, "Transaction not found or not confirmed yet. Try verifying again in a moment.")
    paid = transferred_lamports(tx, c.owner_wallet, ESCROW)
    budget = c.reward_lamports * c.target_observations
    if paid < budget:
        raise HTTPException(422, f"Transfer of {paid} lamports to escrow is below the {budget} lamport budget")
    c.status = "active"
    c.funding_signature = body.signature
    c.funded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return to_out(c, db)


@app.get("/campaigns", response_model=list[CampaignOut])
def list_campaigns(owner: str | None = None, db: Session = Depends(get_db)):
    q = select(Campaign).order_by(Campaign.created_at.desc())
    if owner:
        q = q.where(Campaign.owner_wallet == owner)
    return [to_out(c, db) for c in db.scalars(q)]


@app.get("/campaigns/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: uuid.UUID, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return to_out(c, db)


@app.get("/campaigns/{campaign_id}/tasks")
def campaign_tasks(campaign_id: uuid.UUID, db: Session = Depends(get_db)):
    tasks = db.scalars(select(Task).where(Task.campaign_id == campaign_id)).all()
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": mapping(to_shape(t.location)),
         "properties": {"id": str(t.id), "status": t.status}} for t in tasks]}