import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Region(Base):
    """Administrative areas (counties). priority > 0 means open for campaigns."""
    __tablename__ = "regions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    priority: Mapped[int] = mapped_column(Integer, default=0)
    focus: Mapped[str] = mapped_column(String(200), default="")
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326))


class Campaign(Base):
    __tablename__ = "campaigns"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    campaign_type: Mapped[str] = mapped_column(String(50), default="crop_condition")
    region: Mapped[str] = mapped_column(String(80))
    owner_wallet: Mapped[str] = mapped_column(String(64), index=True)
    reward_lamports: Mapped[int] = mapped_column(BigInteger)
    target_observations: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    funding_signature: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    funded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # draft -> funded -> active -> closed
    escrow_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    area = mapped_column(Geometry("MULTIPOLYGON", srid=4326))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    location = mapped_column(Geometry("POINT", srid=4326))
    status: Mapped[str] = mapped_column(String(20), default="open")
    claimed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Profile(Base):
    __tablename__ = "profiles"
    wallet: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80))
    county: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now()) 

class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), unique=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    contributor_wallet: Mapped[str] = mapped_column(String(64), index=True)
    location = mapped_column(Geometry("POINT", srid=4326))
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_source: Mapped[str] = mapped_column(String(10), default="device")
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    crop_type: Mapped[str] = mapped_column(String(60), default="")
    growth_stage: Mapped[str] = mapped_column(String(60), default="")
    condition: Mapped[str] = mapped_column(String(60), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    photo_path: Mapped[str] = mapped_column(String(200))
    photo_sha256: Mapped[str] = mapped_column(String(64), index=True)
    record_hash: Mapped[str] = mapped_column(String(64))
    distance_m: Mapped[float] = mapped_column(Float)
    inside_area: Mapped[bool] = mapped_column(Boolean)
    checks: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="submitted", index=True)
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_signature: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())