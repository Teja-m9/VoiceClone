"""FastAPI entry point. Creates the app, configures logging, registers routers, and maps
domain errors → the consistent JSON error envelope {"error": {"code","message"}}."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes import billing, health, jobs, uploads, voice_profiles, webhooks
from app.constants.errors import ErrorCode
from app.errors import DomainError
from app.utils.logging_config import configure_logging, get_logger
from config import config

configure_logging(config.log_level)
log = get_logger("api")


def create_app() -> FastAPI:
    app = FastAPI(title="RealMVP API", version="0.1.0")

    app.include_router(health.router)
    app.include_router(uploads.router)
    app.include_router(voice_profiles.router)
    app.include_router(jobs.router)
    app.include_router(billing.router)
    app.include_router(webhooks.router)

    @app.exception_handler(DomainError)
    async def _domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": exc.code.value, "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": ErrorCode.INTERNAL.value,
                    "message": "Internal error",
                    # TEMP debug detail — revert to hide once the integration is verified.
                    "details": {"type": type(exc).__name__, "detail": str(exc)[:300]},
                }
            },
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
