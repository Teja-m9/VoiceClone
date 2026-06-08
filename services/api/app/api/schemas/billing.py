from typing import Literal

from app.api.schemas.common import ApiModel


class CheckoutRequest(ApiModel):
    plan: Literal["monthly", "quarterly"]


class CheckoutResponse(ApiModel):
    url: str
