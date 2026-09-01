from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://senpv:secret@localhost:5432/senpv"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24h
    upload_dir: str = "/data/uploads"
    domain: str = ""
    default_lat: float = 14.6928  # Dakar
    default_lon: float = -17.4467
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
