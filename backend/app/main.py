from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import exiger_api_key
from .config import get_settings
from .db import init_db
from .push import configure as push_configure
from .routers import auth as routes_auth
from .routers import courses, llm, plats, produits, push, reglages


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Frigo API",
    version="2.0.0",
    description="Backend de Frigo : inventaire du frigo, statistiques et appels Gemini.",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
def health() -> dict:
    """Ouvert sans cle : sert de sonde et indique ce qui est configure."""
    return {
        "status": "ok",
        "auth_active": bool(settings.api_key),
        "gemini_configure": bool(settings.gemini_api_key),
        "push_configure": push_configure(),
    }


# Tout le reste de l'API exige le header X-API-Key : c'est le garde-barriere de
# la machine. Les routes qui touchent a un frigo exigent en plus une session ou
# un jeton de service, qui designe le compte (voir app/auth.py).
protege = [Depends(exiger_api_key)]
app.include_router(routes_auth.router, prefix="/api", dependencies=protege)
app.include_router(produits.router, prefix="/api", dependencies=protege)
app.include_router(produits.router_lots, prefix="/api", dependencies=protege)
app.include_router(produits.stats_router, prefix="/api", dependencies=protege)
app.include_router(produits.reference_router, prefix="/api", dependencies=protege)
app.include_router(plats.router, prefix="/api", dependencies=protege)
app.include_router(plats.router_dispo, prefix="/api", dependencies=protege)
app.include_router(courses.router, prefix="/api", dependencies=protege)
app.include_router(reglages.router, prefix="/api", dependencies=protege)
app.include_router(llm.router, prefix="/api", dependencies=protege)
app.include_router(push.router, prefix="/api", dependencies=protege)
