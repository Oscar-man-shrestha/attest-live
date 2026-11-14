from fastapi import APIRouter
from pydantic import BaseModel, Field

from models.embedder import DIMENSIONS, MODEL_NAME, embed

router = APIRouter()

MAX_TEXTS = 64
MAX_CHARS = 4000


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=MAX_TEXTS)


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    vectors: list[list[float]]


@router.post("/embed", response_model=EmbedResponse)
def embed_texts(body: EmbedRequest) -> EmbedResponse:
    texts = [text.strip()[:MAX_CHARS] or " " for text in body.texts]
    return EmbedResponse(model=MODEL_NAME, dimensions=DIMENSIONS, vectors=embed(texts))
