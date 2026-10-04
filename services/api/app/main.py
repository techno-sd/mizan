import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request

from . import API_VERSION, PIPELINE_VERSION
from .config import Settings, get_settings
from .llm import ClaudeClient
from .pipeline import Pipeline
from .retrieve import InMemoryRetriever, SupabaseRetriever, load_fixture
from .schemas import VerifyRequest, VerifyResponse
from .store import MemoryStore, PostgresStore

log = logging.getLogger("mizan")
logging.basicConfig(level=logging.INFO, format='{"level":"%(levelname)s","msg":%(message)r}')


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if s.database_url:
        retriever = SupabaseRetriever(s.database_url, s.corpus_version)
        await retriever.open()
        store = PostgresStore(retriever.pool)
        log.info("retriever=supabase corpus_version=%s", s.corpus_version)
    else:
        retriever = InMemoryRetriever(load_fixture())
        store = MemoryStore()
        log.info("retriever=in-memory fixture passages=%d", len(retriever.passages))

    llm = None
    if s.llm_enabled and os.environ.get("ANTHROPIC_API_KEY"):
        llm = ClaudeClient(store, s.llm_model, s.llm_effort_extract, s.llm_effort_adjudicate, s.llm_fallbacks)
    log.info("llm=%s", s.llm_model if llm else "disabled (rules-only mode)")

    app.state.pipeline = Pipeline(s, retriever, store, llm)
    yield
    if isinstance(retriever, SupabaseRetriever):
        await retriever.close()


app = FastAPI(title="Mizan API", version=PIPELINE_VERSION, lifespan=lifespan)


def check_internal_key(
    settings: Settings = Depends(get_settings), x_internal_key: str | None = Header(default=None)
) -> None:
    if settings.internal_api_key and x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="invalid internal key")


@app.get("/health")
async def health(request: Request) -> dict:
    p: Pipeline = request.app.state.pipeline
    if isinstance(p.retriever, SupabaseRetriever):
        try:
            passages = await p.retriever.ping()
        except Exception as e:  # report, don't crash: the host restarts unhealthy services
            log.warning("db ping failed: %s", e)
            raise HTTPException(status_code=503, detail="database unavailable") from e
    else:
        passages = len(p.retriever.passages)
    return {
        "status": "ok",
        "api_version": API_VERSION,
        "pipeline_version": PIPELINE_VERSION,
        "corpus_version": p.s.corpus_version,
        "passages": passages,
        "llm": p.llm.model if p.llm else None,
    }


@app.get("/v1/corpus", dependencies=[Depends(check_internal_key)])
async def corpus(request: Request) -> dict:
    p: Pipeline = request.app.state.pipeline
    return {"corpus_version": p.s.corpus_version, "scope": p.corpus_scope}


@app.post("/v1/verify", response_model=VerifyResponse, dependencies=[Depends(check_internal_key)])
async def verify(body: VerifyRequest, request: Request) -> VerifyResponse:
    p: Pipeline = request.app.state.pipeline
    if len(body.text) > p.s.max_input_chars:
        raise HTTPException(status_code=413, detail=f"text longer than {p.s.max_input_chars} characters")
    return await p.verify(body.text, debug=body.debug)
