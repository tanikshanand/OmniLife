from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    APP_NAME: str = "OmniLife Digital Twin"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = "local_dev_secret_change_me_0123456789abcdef"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Relational database
    DATABASE_URL: str = "sqlite+aiosqlite:///./omnilife.db"

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "omnilife_graph_secret"
    NEO4J_DATABASE: str = "neo4j"
    NEO4J_ENABLED: bool = True

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    CHROMA_COLLECTION: str = "omnilife_memory_vault"
    CHROMA_ENABLED: bool = True

    # Local LLM
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    PRIMARY_MODEL: str = "ollama/llama3.2"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    LLM_TIMEOUT_SECONDS: int = 120

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Seeding
    SEED_DEMO_DATA: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def ollama_model_name(self) -> str:
        """Strip the optional `ollama/` provider prefix used by LiteLLM."""
        model = self.PRIMARY_MODEL
        if model.startswith("ollama/"):
            return model.split("/", 1)[1]
        return model


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
