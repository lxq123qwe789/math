from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from pathlib import Path
import secrets
import os


def load_or_create_secret_key() -> str:
    """Use a configured key, or generate and persist one in backend/.env."""
    configured_secret = os.getenv("SECRET_KEY")
    if configured_secret:
        return configured_secret

    env_path = Path(__file__).with_name(".env")
    legacy_secret_path = Path(__file__).with_name(".jwt_secret")
    with env_path.open("a+", encoding="utf-8") as env_file:
        env_file.seek(0)
        lines = env_file.readlines()
        for line in lines:
            key, separator, value = line.partition("=")
            if separator and key.strip() == "SECRET_KEY" and value.strip():
                return value.strip().strip('"').strip("'")

        if legacy_secret_path.exists():
            secret = legacy_secret_path.read_text(encoding="utf-8").strip()
        else:
            secret = secrets.token_urlsafe(48)

        env_file.seek(0, 2)
        if lines and not lines[-1].endswith(("\n", "\r")):
            env_file.write("\n")
        env_file.write(f"SECRET_KEY={secret}\n")
        if legacy_secret_path.exists():
            legacy_secret_path.unlink()
        return secret


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
        env_file=Path(__file__).with_name(".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql://postgres:2833210@localhost:5432/math_teaching"

    # JWT
    # An environment variable or backend/.env value takes precedence. If neither
    # exists, generate and persist a key in backend/.env for subsequent starts.
    SECRET_KEY: str = Field(default_factory=load_or_create_secret_key, min_length=32)
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
