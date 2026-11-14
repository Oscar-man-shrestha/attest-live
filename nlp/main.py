"""Attest NLP service. Express calls this over HTTP; it never runs models itself.

Run: .venv/bin/uvicorn main:app --port 8001
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from endpoints.documents import router as documents_router
from endpoints.embed import router as embed_router
from models.embedder import MODEL_NAME, get_model


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_model()
    yield


app = FastAPI(title="Attest NLP", lifespan=lifespan)
app.include_router(embed_router)
app.include_router(documents_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}
