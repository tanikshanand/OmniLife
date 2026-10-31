"""Document parsing and semantic chunking."""

from __future__ import annotations

import io
import re
import zipfile
from typing import List
from xml.etree import ElementTree


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _parse_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)
    except Exception:
        return data.decode("utf-8", errors="ignore")


def _parse_docx(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            xml_bytes = archive.read("word/document.xml")
        root = ElementTree.fromstring(xml_bytes)
        namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        paragraphs = []
        for paragraph in root.iter(f"{namespace}p"):
            texts = [node.text or "" for node in paragraph.iter(f"{namespace}t")]
            if texts:
                paragraphs.append("".join(texts))
        return "\n\n".join(paragraphs)
    except Exception:
        return ""


def parse_file(filename: str, data: bytes) -> str:
    extension = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if extension == "pdf":
        raw = _parse_pdf(data)
    elif extension == "docx":
        raw = _parse_docx(data)
    elif extension in {"md", "markdown", "txt", "text", "log", "json"}:
        raw = data.decode("utf-8", errors="ignore")
    else:
        raw = data.decode("utf-8", errors="ignore")
    return clean_text(raw)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    text = clean_text(text)
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        if end < length:
            boundary = max(text.rfind("\n", start, end), text.rfind(" ", start, end))
            if boundary > start + chunk_size // 2:
                end = boundary
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= length:
            break
        next_start = max(end - overlap, start + 1)
        start = next_start
    return chunks
