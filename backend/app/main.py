from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.core.neo4j_client import neo4j_client
from app.core.seed import seed_demo_data
from app.core.vector_client import vector_client
from app.routers import analytics, auth, career, chat, goals, graph, memory, users, voice
from app.services.graph_engine import graph_engine

ERROR_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    500: "INTERNAL_ERROR",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        if await neo4j_client.connect():
            await neo4j_client.init_schema()
    except Exception:
        pass
    try:
        await graph_engine.seed_benchmark_roles()
    except Exception:
        pass
    if settings.SEED_DEMO_DATA:
        try:
            await seed_demo_data()
        except Exception as exc:  # pragma: no cover - non fatal
            print(f"[OmniLife] demo seeding skipped: {exc}")
    yield
    await neo4j_client.close()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="OmniLife Digital Twin - personal cognitive clone and life/career OS.",
    lifespan=lifespan,
)

# Allowed origins include localhost, 127.0.0.1, and RFC 1918 local area network subnets (e.g. 192.168.x.x, 10.x.x.x)
LAN_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": ERROR_CODES.get(exc.status_code, "ERROR"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        headers=getattr(exc, "headers", None),
    )


api_router = APIRouter(prefix=settings.API_V1_PREFIX)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(memory.router)
api_router.include_router(graph.router)
api_router.include_router(chat.router)
api_router.include_router(goals.router)
api_router.include_router(career.router)
api_router.include_router(analytics.router)
api_router.include_router(voice.router)
app.include_router(api_router)


@app.get(f"{settings.API_V1_PREFIX}/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "services": {
            "neo4j": "connected" if neo4j_client.available else "fallback",
            "vector_store": "chroma" if vector_client.available else "fallback",
            "llm": settings.PRIMARY_MODEL,
        },
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "name": settings.APP_NAME,
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
    }
