import math
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import get_current_user
from app.models.memory import Document, MemoryChunk
from app.models.user import User
from app.schemas.memory_schema import (
    DocumentResponse,
    MemoryChunkResponse,
    PaginatedChunks,
    QuickNoteCreate,
)
from app.services.doc_parser import chunk_text, parse_file
from app.services.entity_extractor import extract_knowledge_triples
from app.services.graph_engine import graph_engine
from app.services.rag_engine import (
    add_memory_chunks,
    delete_chunk_vector,
    delete_document_vectors,
    memory_count,
)

router = APIRouter(prefix="/memory", tags=["Memory Vault"])


def _display_name(user: User) -> str:
    if user.profile and user.profile.full_name:
        return user.profile.full_name
    return user.email.split("@")[0]


async def _extract_and_ingest(
    user_id: str, user_name: str, text: str, first_chunk_id: Optional[str]
) -> None:
    try:
        extraction = await extract_knowledge_triples(text, user_name)
        await graph_engine.ingest_extracted_triples(user_id, extraction, user_name)
        if first_chunk_id:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(MemoryChunk).where(
                        MemoryChunk.id == uuid.UUID(first_chunk_id)
                    )
                )
                chunk = result.scalar_one_or_none()
                if chunk is not None:
                    chunk.extracted_entities = extraction.model_dump()
                    await db.commit()
    except Exception:
        pass


@router.post(
    "/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED
)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
        )
    filename = file.filename or "upload.txt"
    text = parse_file(filename, data)
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract readable text from the document",
        )

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No usable text chunks found"
        )

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    document = Document(
        user_id=current_user.id,
        filename=filename,
        file_type=extension,
        file_size=len(data),
        raw_text_preview=text[:1000],
        source_type="DOCUMENT",
    )
    db.add(document)
    await db.flush()

    now = datetime.now(timezone.utc).isoformat()
    chunk_rows: List[MemoryChunk] = []
    vector_chunks = []
    for index, content in enumerate(chunks):
        chroma_id = f"chunk_{document.id}_{index}"
        row = MemoryChunk(
            document_id=document.id,
            user_id=current_user.id,
            chroma_id=chroma_id,
            chunk_index=index,
            content=content,
            extracted_entities={},
            tags="",
        )
        db.add(row)
        chunk_rows.append(row)
        vector_chunks.append(
            {
                "id": chroma_id,
                "content": content,
                "document_id": str(document.id),
                "filename": filename,
                "chunk_index": index,
                "source_type": "DOCUMENT",
                "tags": "",
                "created_at": now,
            }
        )

    await db.commit()
    await db.refresh(document)
    for row in chunk_rows:
        await db.refresh(row)

    await add_memory_chunks(vector_chunks, str(current_user.id))
    background.add_task(
        _extract_and_ingest,
        str(current_user.id),
        _display_name(current_user),
        text,
        str(chunk_rows[0].id),
    )

    return DocumentResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        file_size=document.file_size,
        raw_text_preview=document.raw_text_preview,
        source_type=document.source_type,
        created_at=document.created_at,
        chunk_count=len(chunk_rows),
    )


@router.post(
    "/quick-note", response_model=MemoryChunkResponse, status_code=status.HTTP_201_CREATED
)
async def quick_note(
    payload: QuickNoteCreate,
    background: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    document = Document(
        user_id=current_user.id,
        filename=f"quick_note_{now.strftime('%Y%m%d_%H%M%S')}.txt",
        file_type="txt",
        file_size=len(payload.content.encode("utf-8")),
        raw_text_preview=payload.content[:1000],
        source_type="NOTE",
    )
    db.add(document)
    await db.flush()

    chroma_id = f"chunk_{document.id}_0"
    tags = ",".join(payload.tags)
    chunk = MemoryChunk(
        document_id=document.id,
        user_id=current_user.id,
        chroma_id=chroma_id,
        chunk_index=0,
        content=payload.content,
        extracted_entities={},
        tags=tags,
    )
    db.add(chunk)
    await db.commit()
    await db.refresh(chunk)

    await add_memory_chunks(
        [
            {
                "id": chroma_id,
                "content": payload.content,
                "document_id": str(document.id),
                "filename": document.filename,
                "chunk_index": 0,
                "source_type": "NOTE",
                "tags": tags,
                "created_at": now.isoformat(),
            }
        ],
        str(current_user.id),
    )
    background.add_task(
        _extract_and_ingest,
        str(current_user.id),
        _display_name(current_user),
        payload.content,
        str(chunk.id),
    )
    return MemoryChunkResponse.model_validate(chunk)


@router.get("/chunks", response_model=PaginatedChunks)
async def list_chunks(
    query: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [MemoryChunk.user_id == current_user.id]
    if query:
        filters.append(MemoryChunk.content.ilike(f"%{query}%"))

    count_result = await db.execute(
        select(func.count()).select_from(MemoryChunk).where(*filters)
    )
    total = int(count_result.scalar_one() or 0)

    result = await db.execute(
        select(MemoryChunk)
        .where(*filters)
        .order_by(MemoryChunk.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.scalars().all()
    pages = math.ceil(total / limit) if limit else 0
    return PaginatedChunks(
        items=[MemoryChunkResponse.model_validate(row) for row in rows],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document, func.count(MemoryChunk.id))
        .outerjoin(MemoryChunk, MemoryChunk.document_id == Document.id)
        .where(Document.user_id == current_user.id)
        .group_by(Document.id)
        .order_by(Document.created_at.desc())
    )
    documents = []
    for document, chunk_count in result.all():
        documents.append(
            DocumentResponse(
                id=document.id,
                filename=document.filename,
                file_type=document.file_type,
                file_size=document.file_size,
                raw_text_preview=document.raw_text_preview,
                source_type=document.source_type,
                created_at=document.created_at,
                chunk_count=int(chunk_count or 0),
            )
        )
    return documents


@router.get("/stats")
async def memory_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document_count = await db.execute(
        select(func.count()).select_from(Document).where(
            Document.user_id == current_user.id
        )
    )
    chunk_count = await db.execute(
        select(func.count()).select_from(MemoryChunk).where(
            MemoryChunk.user_id == current_user.id
        )
    )
    return {
        "documents": int(document_count.scalar_one() or 0),
        "chunks": int(chunk_count.scalar_one() or 0),
        "vectors": memory_count(str(current_user.id)),
    }


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == current_user.id
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    await delete_document_vectors(str(document_id), str(current_user.id))
    await db.delete(document)
    await db.commit()
    return None


@router.delete("/chunks/{chunk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chunk(
    chunk_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MemoryChunk).where(
            MemoryChunk.id == chunk_id, MemoryChunk.user_id == current_user.id
        )
    )
    chunk = result.scalar_one_or_none()
    if chunk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Memory chunk not found"
        )
    await delete_chunk_vector(chunk.chroma_id, str(current_user.id))
    await db.delete(chunk)
    await db.commit()
    return None
