"""
MomentBrand AI — Application Settings
All configuration is loaded from environment variables / .env file.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives one level above this file (project root), regardless of cwd
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Google AI Studio (Gemini) — use ONE of these two:
    GOOGLE_AI_API_KEY: str = ""             # API key from aistudio.google.com (starts with AIza)
    GOOGLE_SERVICE_ACCOUNT_PATH: str = ""   # Path to a service account JSON key file

    # Cloudflare Workers AI
    CLOUDFLARE_API_TOKEN: str = ""
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_TEXT_MODEL_ID: str = "@cf/moonshotai/kimi-k2.6"
    CLOUDFLARE_IMAGE_MODEL_ID: str = "@cf/black-forest-labs/flux-2-klein-9b"
    CLOUDFLARE_IMAGE_EDIT_MODEL_ID: str = "@cf/black-forest-labs/flux-2-klein-9b"
    # Legacy name kept so old .env files still work.
    CLOUDFLARE_MODEL_ID: str = ""

    # Remove.bg
    REMOVEBG_API_KEY: str = ""

    # PostgreSQL + local storage
    DATABASE_URL: str = ""
    UPLOADS_DIR: str = "uploads"
    PUBLIC_BASE_URL: str = ""
    CALENDARIFIC_API_KEY: str = ""
    BRAIN_API_BASE_URL: str = ""
    BRAIN_API_TIMEOUT_SECONDS: int = 180

    # Legacy Supabase envs are ignored; kept so old .env files do not break.
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # App
    APP_ENV: str = "development"
    DEMO_FALLBACK_MODE: bool = False

    @property
    def cloudflare_flux_url(self) -> str:
        """Full Cloudflare Workers AI endpoint URL for the configured image model."""
        return (
            f"https://api.cloudflare.com/client/v4/accounts/"
            f"{self.CLOUDFLARE_ACCOUNT_ID}/ai/run/"
            f"{self.CLOUDFLARE_IMAGE_MODEL_ID or self.CLOUDFLARE_MODEL_ID}"
        )


settings = Settings()
