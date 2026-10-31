"""Local embedding + semantic memory retrieval."""

from __future__ import annotations

import hashlib
import math
import os
import re
from typing import Any, Dict, List

from app.core.vector_client import vector_client

EMBEDDING_DIM = 384
_WORD_RE = re.compile(r"[a-zA-Z0-9_+#.\-]+")

_onnx_embedder = None
_onnx_checked = False


def _hash_embed(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """Deterministic local hashing embedding (no network, no model download)."""
    vector = [0.0] * dim
    normalized = (text or "").lower()
    words = _WORD_RE.findall(normalized)
    if not words:
        return vector

    tokens: List[str] = list(words)
    for i in range(len(words) - 1):
        tokens.append(f"{words[i]}_{words[i + 1]}")

    for token in tokens:
        digest = hashlib.md5(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    norm = math.sqrt(sum(value * value for value in vector))
    if norm > 0:
        vector = [value / norm for value in vector]
    return vector


def _get_onnx_embedder():
    global _onnx_embedder, _onnx_checked
    if _onnx_checked:
        return _onnx_embedder
    _onnx_checked = True
    if os.getenv("OMNILIFE_USE_ONNX_EMBEDDINGS", "false").lower() != "true":
        return None
    try:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

        _onnx_embedder = DefaultEmbeddingFunction()
    except Exception:
        _onnx_embedder = None
    return _onnx_embedder


def embed_text(text: str) -> List[float]:
    embedder = _get_onnx_embedder()
    if embedder is not None:
        try:
            result = embedder([text])
            if result and len(result[0]) > 0:
                return [float(x) for x in result[0]]
        except Exception:
            pass
    return _hash_embed(text)


def embed_texts(texts: List[str]) -> List[List[float]]:
    return [embed_text(text) for text in texts]


async def add_memory_chunks(chunks: List[Dict[str, Any]], user_id: str) -> List[str]:
    """Insert chunks into the vector store. Each chunk: id, content, metadata."""
    if not chunks:
        return []
    ids: List[str] = []
    documents: List[str] = []
    metadatas: List[Dict[str, Any]] = []
    for chunk in chunks:
        metadata = {
            "user_id": str(user_id),
            "document_id": str(chunk.get("document_id", "")),
            "filename": str(chunk.get("filename", "memory")),
            "chunk_index": int(chunk.get("chunk_index", 0)),
            "source_type": str(chunk.get("source_type", "DOCUMENT")),
            "tags": str(chunk.get("tags", "")),
            "created_at": str(chunk.get("created_at", "")),
        }
        ids.append(str(chunk["id"]))
        documents.append(str(chunk["content"]))
        metadatas.append(metadata)

    embeddings = embed_texts(documents)
    await vector_client.add(ids, documents, embeddings, metadatas)
    return ids


async def query_semantic_memory(
    query: str, user_id: str, n_results: int = 5
) -> List[Dict[str, Any]]:
    embedding = embed_text(query)
    return await vector_client.query(embedding, user_id, n_results=n_results)


async def delete_document_vectors(document_id: str, user_id: str) -> int:
    return await vector_client.delete_by_document(document_id, user_id)


async def delete_chunk_vector(chroma_id: str, user_id: str) -> bool:
    return await vector_client.delete_by_id(chroma_id, user_id)


def memory_count(user_id: str) -> int:
    return vector_client.count(user_id)
