from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MIZAN_", extra="ignore")

    # Shared secret between the Next.js server and this service. Empty disables the check (local dev).
    internal_api_key: str = ""

    # Postgres (Supabase). Use the pooler connection string (transaction mode) in production.
    database_url: str = ""
    corpus_version: str = "dev"

    # Claude. The API key itself is read by the SDK from ANTHROPIC_API_KEY.
    llm_enabled: bool = True
    llm_model: str = "claude-opus-5-5"
    llm_effort_extract: str = "low"
    llm_effort_adjudicate: str = "medium"
    llm_fallbacks: bool = True
    llm_concurrency: int = 4

    # Matching thresholds (0-100). Tune on eval/gold dev split; never on the test split.
    t_exact: float = 92.0
    t_variant: float = 75.0
    ambiguity_margin: float = 3.0
    retrieve_k: int = 20

    max_input_chars: int = 20_000


@lru_cache
def get_settings() -> Settings:
    return Settings()
