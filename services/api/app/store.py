"""Persistence for the LLM result cache and the run log.

The run log never stores the user's text: only its hash, size and the summary counts.
"""

import json
from typing import Any, Protocol


class Store(Protocol):
    async def cache_get(self, key: str) -> Any | None: ...

    async def cache_set(self, key: str, model: str, prompt_version: str, value: Any) -> None: ...

    async def record_run(self, run: dict) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self.cache: dict[str, Any] = {}
        self.runs: list[dict] = []

    async def cache_get(self, key: str) -> Any | None:
        return self.cache.get(key)

    async def cache_set(self, key: str, model: str, prompt_version: str, value: Any) -> None:
        self.cache[key] = value

    async def record_run(self, run: dict) -> None:
        self.runs.append(run)


class PostgresStore:
    def __init__(self, pool) -> None:
        self.pool = pool

    async def cache_get(self, key: str) -> Any | None:
        async with self.pool.connection() as conn:
            row = await (await conn.execute("select response from llm_cache where key = %s", (key,))).fetchone()
        return row[0] if row else None

    async def cache_set(self, key: str, model: str, prompt_version: str, value: Any) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                "insert into llm_cache (key, model, prompt_version, response) values (%s, %s, %s, %s::jsonb) "
                "on conflict (key) do nothing",
                (key, model, prompt_version, json.dumps(value, ensure_ascii=False)),
            )

    async def record_run(self, run: dict) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                "insert into verification_runs (id, corpus_version, api_version, pipeline_version, "
                "prompt_version, llm_model, input_sha256, input_chars, summary, duration_ms) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)",
                (
                    run["run_id"], run["corpus_version"], run["api_version"], run["pipeline_version"],
                    run["prompt_version"], run["llm_model"], run["input_sha256"], run["input_chars"],
                    json.dumps(run["summary"], ensure_ascii=False), run["duration_ms"],
                ),
            )
