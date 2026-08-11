from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Configurações centralizadas do serviço de IA.

    Nunca ler variáveis de ambiente diretamente nos endpoints — sempre
    através desta classe, para manter uma única fonte de verdade.
    """

    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", protected_namespaces=("settings_",)
    )

    app_env: str = "development"
    model_path: str = "models/model.joblib"
    ai_service_api_key: str = "change-me-in-local-env"
    cors_origins: str = "http://localhost:3000"

    api_v1_prefix: str = "/api/v1"
    app_name: str = "Predictive Maintenance AI Service"
    app_version: str = "1.0.0"

    @property
    def resolved_model_path(self) -> Path:
        path = Path(self.model_path)
        if not path.is_absolute():
            path = BASE_DIR / path
        return path

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
