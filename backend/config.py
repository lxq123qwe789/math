from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


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
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql://postgres:2833210@localhost:5432/math_teaching"

    # JWT
    SECRET_KEY: str = Field(min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    ALLOWED_ORIGINS_RAW: str | None = None
    ALLOWED_ORIGIN_REGEX: str = ""

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        return parse_origins(self.ALLOWED_ORIGINS_RAW)


settings = Settings()
