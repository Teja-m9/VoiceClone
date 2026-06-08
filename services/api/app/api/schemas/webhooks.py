from pydantic import BaseModel


class RunpodWebhook(BaseModel):
    """Runpod serverless posts the job result here. `id` is Runpod's job id; `output` is
    whatever our handler returned (we make it carry our `job_id` + result keys)."""

    id: str
    status: str  # COMPLETED | FAILED (and intermediate states we ignore)
    output: dict | None = None
