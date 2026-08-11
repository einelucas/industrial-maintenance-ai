from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, predictions
from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.app_env)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Serviço de inferência de manutenção preditiva. Stateless: não escreve "
        "diretamente no PostgreSQL. Consumido exclusivamente pelo backend Next.js."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(predictions.router, prefix=settings.api_v1_prefix)

# Alias sem prefixo de versão, conforme seção 8 do escopo ("GET /health" OU
# "GET /api/v1/health" — expomos ambos por compatibilidade).
app.include_router(health.router)
