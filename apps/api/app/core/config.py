from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "ERP"
    ENV: str = "dev"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql+asyncpg://erp:erp@localhost:5432/erp"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    CORS_ORIGINS: str = "http://localhost:3000"

    # Fernet key (urlsafe base64-encoded 32 bytes) for at-rest encryption
    # of sensitive settings (SMS provider passwords, API keys).
    # If empty, a dev-only key is derived from SECRET_KEY (NOT for production).
    SECRETS_FERNET_KEY: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
