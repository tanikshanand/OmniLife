from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.voice_service import DEFAULT_VOICE, synthesize_speech, transcribe_audio

router = APIRouter(prefix="/voice", tags=["Voice"])


class TTSRequest(BaseModel):
    text: str
    voice: str = DEFAULT_VOICE


@router.post("/tts")
async def text_to_speech(payload: TTSRequest):
    audio, media_type = await synthesize_speech(payload.text, payload.voice)
    return Response(
        content=audio,
        media_type=media_type,
        headers={"Cache-Control": "no-store"},
    )


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    text = await transcribe_audio(data, audio.filename or "audio.webm")
    return {
        "text": text or "",
        "available": text is not None,
        "detail": None
        if text is not None
        else "Server-side transcription unavailable. Use the browser Web Speech API.",
    }
