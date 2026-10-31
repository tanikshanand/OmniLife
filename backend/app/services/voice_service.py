"""Text-to-speech and speech-to-text helpers.

TTS uses the free Microsoft Edge neural voices via `edge-tts`. If the network
or package is unavailable we return a short silent WAV so the client never
breaks (the browser `speechSynthesis` fallback is used in the UI).
"""

from __future__ import annotations

import io
import math
import struct
import tempfile
import wave
from pathlib import Path
from typing import Optional, Tuple

DEFAULT_VOICE = "en-US-ChristopherNeural"


def _silent_wav(duration_seconds: float = 0.4, sample_rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    frames = int(duration_seconds * sample_rate)
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(struct.pack("<h", 0) * frames)
    return buffer.getvalue()


async def synthesize_speech(
    text: str, voice: str = DEFAULT_VOICE
) -> Tuple[bytes, str]:
    text = (text or "").strip()
    if not text:
        return _silent_wav(0.2), "audio/wav"
    try:
        import edge_tts

        communicate = edge_tts.Communicate(text[:4000], voice or DEFAULT_VOICE)
        buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio" and chunk.get("data"):
                buffer.write(chunk["data"])
        data = buffer.getvalue()
        if data:
            return data, "audio/mpeg"
    except Exception:
        pass
    return _silent_wav(), "audio/wav"


async def transcribe_audio(data: bytes, filename: str = "audio.webm") -> Optional[str]:
    """Optional high-fidelity transcription when faster-whisper is installed."""
    if not data:
        return None
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception:
        return None

    suffix = Path(filename).suffix or ".webm"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(data)
            temp_path = temp.name
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _info = model.transcribe(temp_path)
        return " ".join(segment.text.strip() for segment in segments).strip()
    except Exception:
        return None
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass
