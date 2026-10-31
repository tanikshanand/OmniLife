"""ChromaDB client with a persistent local fallback vector index."""

from __future__ import annotations

import json
import math
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings


def _fallback_path() -> Path:
    env = os.getenv("VECTOR_FALLBACK_PATH")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "vector_fallback.json"


class _FallbackVectorStore:
    def __init__(self) -> None:
        self.path = _fallback_path()
        self._lock = threading.RLock()
        self.items: List[Dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        try:
            if self.path.exists():
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                if isinstance(raw, list):
                    self.items = raw
        except Exception:
            self.items = []

    def _save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(self.items, ensure_ascii=False), encoding="utf-8"
            )
            tmp.replace(self.path)
        except Exception:
            pass

    def add(
        self,
        ids: List[str],
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
    ) -> None:
        with self._lock:
            existing = {item["id"]: item for item in self.items}
            for i, item_id in enumerate(ids):
                existing[item_id] = {
                    "id": item_id,
                    "document": documents[i],
                    "embedding": embeddings[i],
                    "metadata": metadatas[i],
                }
            self.items = list(existing.values())
            self._save()

    def query(
        self, embedding: List[float], user_id: str, n_results: int
    ) -> List[Dict[str, Any]]:
        with self._lock:
            candidates = [
                item
                for item in self.items
                if str(item.get("metadata", {}).get("user_id")) == str(user_id)
            ]
        scored = []
        for item in candidates:
            score = _cosine(embedding, item.get("embedding") or [])
            scored.append(
                {
                    "id": item["id"],
                    "content": item.get("document", ""),
                    "metadata": item.get("metadata", {}),
                    "distance": 1 - score,
                    "score": score,
                }
            )
        scored.sort(key=lambda entry: entry["score"], reverse=True)
        return scored[:n_results]

    def delete_by_document(self, document_id: str, user_id: str) -> int:
        with self._lock:
            before = len(self.items)
            self.items = [
                item
                for item in self.items
                if not (
                    str(item.get("metadata", {}).get("document_id")) == str(document_id)
                    and str(item.get("metadata", {}).get("user_id")) == str(user_id)
                )
            ]
            self._save()
            return before - len(self.items)

    def delete_by_id(self, chroma_id: str, user_id: str) -> bool:
        with self._lock:
            before = len(self.items)
            self.items = [
                item
                for item in self.items
                if not (
                    item["id"] == chroma_id
                    and str(item.get("metadata", {}).get("user_id")) == str(user_id)
                )
            ]
            self._save()
            return len(self.items) < before

    def count(self, user_id: Optional[str] = None) -> int:
        with self._lock:
            if user_id is None:
                return len(self.items)
            return sum(
                1
                for item in self.items
                if str(item.get("metadata", {}).get("user_id")) == str(user_id)
            )


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    size = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(size))
    norm_a = math.sqrt(sum(x * x for x in a[:size]))
    norm_b = math.sqrt(sum(x * x for x in b[:size]))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class VectorClient:
    def __init__(self) -> None:
        self.collection = None
        self.available = False
        self.fallback = _FallbackVectorStore()
        self._last_attempt: float = 0.0
        self._retry_interval: float = 15.0

    async def connect(self) -> bool:
        if self.available and self.collection is not None:
            return True
        if not settings.CHROMA_ENABLED:
            self.available = False
            return False
        now = time.monotonic()
        if now - self._last_attempt < self._retry_interval:
            return False
        self._last_attempt = now
        try:
            import httpx

            url = f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v1/heartbeat"
            async with httpx.AsyncClient(timeout=1.5) as probe:
                response = await probe.get(url)
                if response.status_code >= 500:
                    return False
        except Exception:
            return False
        try:
            import chromadb

            client = chromadb.HttpClient(
                host=settings.CHROMA_HOST, port=settings.CHROMA_PORT
            )
            self.collection = client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
            self.available = True
            return True
        except Exception:
            self.collection = None
            self.available = False
            return False

    async def add(
        self,
        ids: List[str],
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
    ) -> None:
        if ids and await self.connect():
            try:
                self.collection.add(
                    ids=ids,
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas,
                )
                return
            except Exception:
                self.available = False
                self.collection = None
        self.fallback.add(ids, documents, embeddings, metadatas)

    async def query(
        self, embedding: List[float], user_id: str, n_results: int = 5
    ) -> List[Dict[str, Any]]:
        if await self.connect():
            try:
                result = self.collection.query(
                    query_embeddings=[embedding],
                    n_results=max(1, n_results),
                    where={"user_id": str(user_id)},
                    include=["documents", "metadatas", "distances"],
                )
                ids = (result.get("ids") or [[]])[0]
                documents = (result.get("documents") or [[]])[0]
                metadatas = (result.get("metadatas") or [[]])[0]
                distances = (result.get("distances") or [[]])[0]
                items = []
                for i, item_id in enumerate(ids):
                    distance = distances[i] if i < len(distances) else 1.0
                    items.append(
                        {
                            "id": item_id,
                            "content": documents[i] if i < len(documents) else "",
                            "metadata": metadatas[i] if i < len(metadatas) else {},
                            "distance": distance,
                            "score": max(0.0, 1.0 - float(distance)),
                        }
                    )
                return items
            except Exception:
                self.available = False
                self.collection = None
        return self.fallback.query(embedding, user_id, n_results)

    async def delete_by_document(self, document_id: str, user_id: str) -> int:
        if await self.connect():
            try:
                self.collection.delete(
                    where={
                        "$and": [
                            {"document_id": str(document_id)},
                            {"user_id": str(user_id)},
                        ]
                    }
                )
                return 1
            except Exception:
                self.available = False
                self.collection = None
        return self.fallback.delete_by_document(document_id, user_id)

    async def delete_by_id(self, chroma_id: str, user_id: str) -> bool:
        if await self.connect():
            try:
                self.collection.delete(ids=[chroma_id])
                return True
            except Exception:
                self.available = False
                self.collection = None
        return self.fallback.delete_by_id(chroma_id, user_id)

    def count(self, user_id: Optional[str] = None) -> int:
        if self.available and self.collection is not None:
            try:
                result = self.collection.get(where={"user_id": str(user_id)} if user_id else None)
                return len(result.get("ids") or [])
            except Exception:
                pass
        return self.fallback.count(user_id)


vector_client = VectorClient()
