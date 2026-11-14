import base64
import binascii

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from extractors.idea_brief import extract_idea_brief
from extractors.resume import extract
from models.ocr import extract_text

router = APIRouter()

MAX_BYTES = 5 * 1024 * 1024
MIME_TYPES = {"application/pdf", "image/png", "image/jpeg"}


class VocabItem(BaseModel):
    label: str = Field(max_length=60)
    keywords: list[str] = Field(default_factory=list, max_length=20)


class ParseRequest(BaseModel):
    kind: str = Field(pattern="^(resume|certificate|idea_brief)$")
    mimeType: str
    contentBase64: str
    skillVocab: list[VocabItem] = Field(default_factory=list, max_length=300)


@router.post("/parse-document")
def parse_document(body: ParseRequest) -> dict:
    if body.mimeType not in MIME_TYPES:
        raise HTTPException(status_code=415, detail="PDF, PNG, or JPEG only")
    try:
        data = base64.b64decode(body.contentBase64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Bad file encoding")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Files over 5 MB are not read")
    try:
        text = extract_text(data, body.mimeType)
    except Exception:
        raise HTTPException(status_code=422, detail="The file could not be opened")
    if not text.lines:
        raise HTTPException(status_code=422, detail="No readable text found in the file")
    if body.kind == "idea_brief":
        return extract_idea_brief(text)
    return extract(text, body.kind, [item.model_dump() for item in body.skillVocab])
