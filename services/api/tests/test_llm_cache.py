import asyncio

from app.llm import ClaudeClient
from app.store import MemoryStore


def test_disabled_cache_does_not_store_or_reuse_extracted_quotations():
    # Exercise the cache without constructing an SDK client or sending anything to a provider.
    client = ClaudeClient.__new__(ClaudeClient)
    client.store = MemoryStore()
    client.model = "test"
    client.cache_enabled = False
    calls = []

    async def call():
        calls.append(1)
        return {"items": [{"quoted_text": "private quotation"}]}

    async def check():
        await client._cached("extract", "private document", call)
        await client._cached("extract", "private document", call)

    asyncio.run(check())
    assert len(calls) == 2
    assert client.store.cache == {}
