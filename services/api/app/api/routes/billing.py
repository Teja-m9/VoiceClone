from fastapi import APIRouter, Depends

from app.api.controllers import billing_controller
from app.api.deps import Principal, current_principal, get_stripe
from app.api.schemas.billing import CheckoutRequest, CheckoutResponse
from app.client.stripe_client import StripeClient

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    principal: Principal = Depends(current_principal),
    stripe: StripeClient = Depends(get_stripe),
) -> CheckoutResponse:
    return await billing_controller.create_checkout(stripe, principal.user_id, payload)
