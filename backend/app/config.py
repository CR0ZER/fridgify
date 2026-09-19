from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    api_key: str = ""
    database_path: str = "data/fridgify.db"
    cors_origins: str = "*"

    #: Paire VAPID identifiant ce serveur aupres des services de push. Generee
    #: par `python -m app.push`. Sans elle, les notifications sont desactivees.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    #: Contact exige par la specification VAPID, transmis au service de push.
    vapid_subject: str = "mailto:fridgify@localhost"
    #: Nombre de jours avant peremption qui declenche l'alerte quotidienne.
    notification_seuil_jours: int = 1

    @property
    def db_file(self) -> Path:
        chemin = Path(self.database_path)
        if not chemin.is_absolute():
            chemin = BACKEND_DIR / chemin
        return chemin

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
