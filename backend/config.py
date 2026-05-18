import os
from pydantic_settings import BaseSettings


def parse_origins(value: str | None) -> list[str]:
    if not value:
        return [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://0.0.0.0:5173",
        ]
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:2833210@localhost:5432/math_teaching"
    )
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    ALLOWED_ORIGINS: list = parse_origins(os.getenv("ALLOWED_ORIGINS"))
    ALLOWED_ORIGIN_REGEX: str = os.getenv("ALLOWED_ORIGIN_REGEX", "")


settings = Settings()
