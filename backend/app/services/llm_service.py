"""Local LLM access layer backed by Ollama.

Every method degrades gracefully when Ollama is not running so the platform
remains fully usable offline (deterministic fallbacks live in the callers).
"""

from __future__ import annotations

import json
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from app.core.config import settings


class LLMService:
    def __init__(self) -> None:
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.ollama_model_name
        self.timeout = settings.LLM_TIMEOUT_SECONDS
        self._availability: Optional[bool] = None
        self._checked_at: float = 0.0
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout, connect=4.0),
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
            )
        return self._client

    async def is_available(self, force: bool = False) -> bool:
        now = time.monotonic()
        if not force and self._availability is not None and now - self._checked_at < 20:
            return self._availability
        available = False
        try:
            client = self._get_client()
            resp = await client.get(f"{self.base_url}/api/tags", timeout=2.0)
            available = resp.status_code == 200
        except Exception:
            available = False
        self._availability = available
        self._checked_at = now
        return available

    def _messages(self, prompt: str, system: Optional[str]) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return messages

    async def chat(
        self,
        prompt: str,
        system: Optional[str] = None,
        json_mode: bool = False,
        temperature: float = 0.4,
        max_tokens: int = 768,
    ) -> Optional[str]:
        if not await self.is_available():
            return None
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": self._messages(prompt, system),
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if json_mode:
            payload["format"] = "json"
        try:
            client = self._get_client()
            resp = await client.post(f"{self.base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except Exception:
            self._availability = False
            self._checked_at = time.monotonic()
            return None

    async def stream_chat(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        """Yield token deltas from Ollama. Caller must check is_available()."""
        payload = {
            "model": self.model,
            "messages": self._messages(prompt, system),
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        client = self._get_client()
        async with client.stream(
            "POST", f"{self.base_url}/api/chat", json=payload
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if data.get("done"):
                    break
                delta = data.get("message", {}).get("content", "")
                if delta:
                    yield delta

    async def chat_json(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2,
    ) -> Optional[Dict[str, Any]]:
        raw = await self.chat(
            prompt, system=system, json_mode=True, temperature=temperature
        )
        if not raw:
            return None
        return _extract_json(raw)


def _extract_json(raw: str) -> Optional[Dict[str, Any]]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        try:
            parsed = json.loads(raw[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


llm_service = LLMService()
