import math
import os
import uuid
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.shape import from_shape, to_shape
from pydantic import BaseModel, Field
from shapely.geometry import Point, box, mapping
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .models import Campaign, Task

# Approximate bounding boxes (west, south, east, north) for demo purposes.
# Replace with real county boundary polygons later.
REGIONS = {
    "Nakuru": (35.60, -1.20, 36.60, 0.20),
    "Uasin Gishu": (34.95, 0.25, 35.65, 0.90),
    "Trans Nzoia": (34.60, 0.80, 35.25, 1.25),
    "Kiambu": (36.55, -1.30, 37.10, -0.80),
    "Machakos": (36.95, -1.80, 37.80, -0.95),
    "Bungoma": (34.25, 0.45, 34.85, 1.00),
}

app = FastAPI(title="FieldMint API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def init_db():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.create_all(engine)


class CampaignIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = ""
    campaign_type: str = "crop_condition"
    region: str
    owner_wallet: str = Field(min_length=32, max_length=64)
    reward_lamports: int = Field(gt=0)
    target_observations: int = Field(ge=1, le=2000)


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
    created_at: datetime
    area: dict
    task_count: int


def sample_points(area, n):
    """Evenly spread n sampling points across a polygon using a grid."""
    minx, miny, maxx, maxy = area.bounds
    cols = max(1, math.ceil(math.sqrt(n * (maxx - minx) / (maxy - miny))))
    rows = max(1, math.ceil(n / cols))
    pts = []
    for r in range(rows):
        for c in range(cols):
            p = Point(minx + (c + 0.5) * (maxx - minx) / cols,
                      miny + (r + 0.5) * (maxy - miny) / rows)
            if area.contains(p):
                pts.append(p)
    if len(pts) > n:  # thin evenly rather than truncating one side
        pts = [pts[int(i * len(pts) / n)] for i in range(n)]
    return pts


def to_out(c: Campaign, db: Session) -> CampaignOut:
    count = db.scalar(select(func.count()).select_from(Task).where(Task.campaign_id == c.id)) or 0
    return CampaignOut(
        id=c.id, title=c.title, description=c.description, campaign_type=c.campaign_type,
        region=c.region, owner_wallet=c.owner_wallet, reward_lamports=c.reward_lamports,
        target_observations=c.target_observations,
        budget_lamports=c.reward_lamports * c.target_observations,
        status=c.status, created_at=c.created_at,
        area=mapping(to_shape(c.area)), task_count=count,
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/regions")
def regions():
    return [{"name": k, "bbox": v} for k, v in REGIONS.items()]


@app.post("/campaigns", response_model=CampaignOut, status_code=201)
def create_campaign(body: CampaignIn, db: Session = Depends(get_db)):
    bbox = REGIONS.get(body.region)
    if not bbox:
        raise HTTPException(422, f"Unknown region '{body.region}'")
    area = box(*bbox)
    c = Campaign(**body.model_dump(), area=from_shape(area, srid=4326))
    db.add(c)
    db.flush()
    for p in sample_points(area, body.target_observations):
        db.add(Task(campaign_id=c.id, location=from_shape(p, srid=4326)))
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
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "geometry": mapping(to_shape(t.location)),
             "properties": {"id": str(t.id), "status": t.status}}
            for t in tasks
        ],
    }