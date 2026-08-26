import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchematicCreate(BaseModel):
    project_id: uuid.UUID
    schema_data: dict
    networkx_graph: dict | None = None
    validation_errors: dict | None = None
    svg_snapshot: str | None = None


class SchematicUpdate(BaseModel):
    schema_data: dict | None = None
    networkx_graph: dict | None = None
    validation_errors: dict | None = None
    svg_snapshot: str | None = None


class SchematicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    schema_data: dict
    networkx_graph: dict | None = None
    validation_errors: dict | None = None
    svg_snapshot: str | None = None
    created_at: datetime
    updated_at: datetime
