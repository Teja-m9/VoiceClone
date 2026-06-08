from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    """Base DTO: rejects unknown fields to catch client drift early."""

    model_config = ConfigDict(extra="forbid")
