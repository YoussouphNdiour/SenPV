from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ValidationError(BaseModel):
    type: str  # e.g. "overvoltage", "overcurrent", "floating_node", "breaker_rating"
    severity: str  # "critical" or "warning"
    message: str
    nodes: list[str] | None = None  # affected node IDs


class SchematicNode(BaseModel):
    id: str
    type: str
    position: dict[str, float]  # {x, y}
    data: dict[str, Any]


class SchematicEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None
    type: str | None = None
    data: dict[str, Any] | None = None


class SchematicData(BaseModel):
    nodes: list[SchematicNode]
    edges: list[SchematicEdge]


class SchematicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    nodes: list[SchematicNode]
    edges: list[SchematicEdge]
    validation_errors: list[ValidationError]
    created_at: datetime
    updated_at: datetime


class SchematicUpdate(BaseModel):
    nodes: list[SchematicNode]
    edges: list[SchematicEdge]


class SchematicValidateResponse(BaseModel):
    validation_errors: list[ValidationError]


class SchematicGenerateResponse(BaseModel):
    nodes: list[SchematicNode]
    edges: list[SchematicEdge]
    validation_errors: list[ValidationError]
