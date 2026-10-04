"""Candidate retrieval behind a small interface.

* SupabaseRetriever: production. Calls the `match_passages` SQL function (full-text + trigram + vector, RRF).
* InMemoryRetriever: tests and offline demos. Same contract.
"""

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from rapidfuzz import fuzz

from .normalize import normalize

FIXTURE = Path(__file__).parent / "data" / "fixture_passages.json"


@dataclass
class Passage:
    id: int
    collection: str
    kind: str  # quran | hadith
    book: int | None  # surah number (quran) or book/section number (hadith)
    number: int | None  # ayah number (quran) or hadith number
    numbering_scheme: str | None
    text_ar: str
    text_en: str | None = None
    gradings: list[dict] = field(default_factory=list)
    url: str | None = None
    text_ar_norm: str = ""
    text_en_norm: str = ""

    def __post_init__(self) -> None:
        self.text_ar_norm = self.text_ar_norm or normalize(self.text_ar)
        if self.text_en and not self.text_en_norm:
            self.text_en_norm = normalize(self.text_en)


def load_fixture() -> list[Passage]:
    """Small real corpus (see scripts/build_corpus.py --fixture) for offline runs and demos."""
    if not FIXTURE.exists():
        return []
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return [Passage(**p) for p in data["passages"]]


@dataclass
class Candidate:
    passage: Passage
    retrieval_score: float


class Retriever(Protocol):
    async def search(self, query: str, kind: str | None, k: int) -> list[Candidate]: ...

    async def lookup(
        self, collection: str, number: int | None = None, book: int | None = None
    ) -> list[Passage]: ...

    async def neighbors(self, passage_id: int) -> tuple[str | None, str | None]:
        """Text of the previous and next passage in the same book (used for Quran context)."""
        ...


class InMemoryRetriever:
    def __init__(self, passages: list[Passage]):
        self.passages = passages

    async def search(self, query: str, kind: str | None, k: int) -> list[Candidate]:
        q = normalize(query)
        scored = []
        for p in self.passages:
            if kind and p.kind != kind:
                continue
            s = max(
                fuzz.partial_ratio(q, p.text_ar_norm),
                fuzz.partial_ratio(q, p.text_en_norm) if p.text_en_norm else 0,
            )
            scored.append(Candidate(p, s))
        scored.sort(key=lambda c: -c.retrieval_score)
        return scored[:k]

    async def lookup(self, collection: str, number: int | None = None, book: int | None = None):
        return [
            p
            for p in self.passages
            if p.collection == collection
            and (number is None or p.number == number)
            and (book is None or p.book == book)
        ]

    async def neighbors(self, passage_id: int) -> tuple[str | None, str | None]:
        p = next((x for x in self.passages if x.id == passage_id), None)
        if p is None or p.number is None:
            return None, None

        def text(n: int) -> str | None:
            hit = next(
                (x for x in self.passages if x.collection == p.collection and x.book == p.book and x.number == n),
                None,
            )
            return hit.text_ar if hit else None

        return text(p.number - 1), text(p.number + 1)


class IndexedRetriever(InMemoryRetriever):
    """In-memory retrieval over the full corpus without a database: an inverted word index proposes
    candidates (IDF-weighted word overlap), then fuzzy matching reranks a short list.
    Used for offline evaluation and as a fallback when Postgres is unavailable."""

    def __init__(self, passages: list[Passage], shortlist: int = 60):
        super().__init__(passages)
        self.shortlist = shortlist
        self.index: dict[str, list[int]] = {}
        for i, p in enumerate(passages):
            for tok in set(p.text_ar_norm.split()) | set(p.text_en_norm.split()):
                self.index.setdefault(tok, []).append(i)
        n = len(passages)
        self.idf = {t: math.log(1 + n / len(ids)) for t, ids in self.index.items()}
        self.by_id = {p.id: p for p in passages}

    async def search(self, query: str, kind: str | None, k: int) -> list[Candidate]:
        q = normalize(query)
        scores: dict[int, float] = {}
        for tok in set(q.split()):
            w = self.idf.get(tok)
            if w is None:
                continue
            for i in self.index[tok]:
                scores[i] = scores.get(i, 0.0) + w
        top = sorted(scores, key=lambda i: -scores[i])[: self.shortlist]
        out = []
        for i in top:
            p = self.passages[i]
            if kind and p.kind != kind:
                continue
            s = max(
                fuzz.partial_ratio(q, p.text_ar_norm),
                fuzz.partial_ratio(q, p.text_en_norm) if p.text_en_norm else 0,
            )
            out.append(Candidate(p, s))
        out.sort(key=lambda c: -c.retrieval_score)
        return out[:k]

    async def neighbors(self, passage_id: int) -> tuple[str | None, str | None]:
        p = self.by_id.get(passage_id)
        if p is None or p.number is None:
            return None, None
        before = self.by_id.get(passage_id - 1)
        after = self.by_id.get(passage_id + 1)

        def same_book(x: Passage | None, n: int) -> str | None:
            return x.text_ar if x and x.collection == p.collection and x.book == p.book and x.number == n else None

        return same_book(before, p.number - 1), same_book(after, p.number + 1)


def load_corpus_jsonl(path: Path) -> list[Passage]:
    """Load a built corpus (scripts/build_corpus.py output). Ids follow file order, as in the database."""
    out = []
    with path.open(encoding="utf-8") as fh:
        for i, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            r = json.loads(line)
            out.append(
                Passage(
                    id=i, collection=r["collection"], kind=r["kind"], book=r["book"], number=r["number"],
                    numbering_scheme=r["numbering_scheme"], text_ar=r["text_ar"], text_en=r["text_en"],
                    gradings=r["gradings"], url=r["url"], text_ar_norm=r["text_ar_norm"],
                    text_en_norm=r["text_en_norm"] or "",
                )
            )
    return out


_COLUMNS = (
    "p.id, p.collection, p.kind, p.book, p.number, p.numbering_scheme, p.text_ar, p.text_en, "
    "p.gradings, p.url, p.text_ar_norm, coalesce(p.text_en_norm, '')"
)


def _row_to_passage(row) -> Passage:
    return Passage(
        id=row[0], collection=row[1], kind=row[2], book=row[3], number=row[4],
        numbering_scheme=row[5], text_ar=row[6], text_en=row[7], gradings=row[8] or [],
        url=row[9], text_ar_norm=row[10], text_en_norm=row[11],
    )


class SupabaseRetriever:
    def __init__(self, database_url: str, corpus_version: str):
        from psycopg_pool import AsyncConnectionPool

        # prepare_threshold=None: Supabase's pooler (transaction mode) does not support prepared statements.
        self.pool = AsyncConnectionPool(
            database_url,
            min_size=1,
            max_size=5,
            open=False,
            kwargs={"prepare_threshold": None, "autocommit": True},
        )
        self.corpus_version = corpus_version

    async def open(self) -> None:
        await self.pool.open()

    async def close(self) -> None:
        await self.pool.close()

    async def ping(self) -> int:
        """Passage count for this corpus version. Called by /health, which also keeps a free Supabase
        project from pausing during the judging window."""
        async with self.pool.connection() as conn:
            row = await (
                await conn.execute("select count(*) from passages where corpus_version = %s", (self.corpus_version,))
            ).fetchone()
        return int(row[0])

    async def search(self, query: str, kind: str | None, k: int) -> list[Candidate]:
        sql = (
            f"select {_COLUMNS}, m.score from match_passages(%s, %s, null, %s, %s) m "
            "join passages p on p.id = m.id order by m.score desc"
        )
        async with self.pool.connection() as conn:
            rows = await (await conn.execute(sql, (normalize(query), kind, k, self.corpus_version))).fetchall()
        return [Candidate(_row_to_passage(r), float(r[12])) for r in rows]

    async def lookup(self, collection: str, number: int | None = None, book: int | None = None):
        sql = (
            f"select {_COLUMNS} from passages p where p.corpus_version = %s and p.collection = %s "
            "and (%s::int is null or p.number = %s::int) and (%s::int is null or p.book = %s::int) "
            "order by p.book, p.number limit 50"
        )
        async with self.pool.connection() as conn:
            rows = await (
                await conn.execute(sql, (self.corpus_version, collection, number, number, book, book))
            ).fetchall()
        return [_row_to_passage(r) for r in rows]

    async def neighbors(self, passage_id: int) -> tuple[str | None, str | None]:
        sql = (
            "select n.number - p.number, n.text_ar from passages p join passages n "
            "on n.corpus_version = p.corpus_version and n.collection = p.collection and n.book = p.book "
            "and n.number in (p.number - 1, p.number + 1) where p.id = %s"
        )
        async with self.pool.connection() as conn:
            rows = await (await conn.execute(sql, (passage_id,))).fetchall()
        by_offset = {r[0]: r[1] for r in rows}
        return by_offset.get(-1), by_offset.get(1)
