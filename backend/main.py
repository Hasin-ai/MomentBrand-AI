"""
MomentBrand AI — FastAPI Backend
Main application entry point with CORS and all router registrations.
"""
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.exceptions import HTTPException as StarletteHTTPException

load_dotenv()

from config import settings
from routers import brain, brands, campaigns, events, export
from compositor.renderer import startup_browser, shutdown_browser
from services.db import apply_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    apply_schema()
    await startup_browser()
    yield
    await shutdown_browser()


app = FastAPI(
    lifespan=lifespan,
    title="MomentBrand AI API",
    description="AI-powered brand intelligence and creative direction platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
        "http://host.docker.internal:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(brands.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(brain.router, prefix="/api")

def _error_detail(message: str, code: str, status_code: int, **extra):
    return {
        "detail": {
            "message": message,
            "code": code,
            "status": status_code,
            **extra,
        }
    }


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        message = detail.get("message") or detail.get("error") or str(detail)
        code = detail.get("code") or detail.get("error_type") or "http_error"
        extra = {k: v for k, v in detail.items() if k not in {"message", "code", "error", "error_type", "status"}}
    else:
        message = str(detail)
        code = "http_error"
        extra = {}
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_detail(message, code, exc.status_code, **extra),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    fields = [
        {
            "field": ".".join(str(part) for part in err.get("loc", []) if part != "body"),
            "message": err.get("msg", "Invalid value"),
            "type": err.get("type", "validation_error"),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=_error_detail(
            "Please check the campaign inputs and try again.",
            "validation_error",
            422,
            fields=fields,
        ),
    )

uploads_root = Path(settings.UPLOADS_DIR).expanduser()
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_root)), name="uploads")


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Returns API health status. Used by frontend to verify backend is running."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "environment": settings.APP_ENV,
    }
