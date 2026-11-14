"""Loads the pretrained sentence embedding model once per process.

all-MiniLM-L6-v2: 384 dimensions (matches ideas.embedding and users.profile_embedding),
about 90 MB, runs on CPU. Used as-is; there is no fine-tuning.
"""

from functools import lru_cache

import torch
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DIMENSIONS = 384


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    torch.set_num_threads(max(1, torch.get_num_threads()))
    return SentenceTransformer(MODEL_NAME, device="cpu")


def embed(texts: list[str]) -> list[list[float]]:
    vectors = get_model().encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return vectors.astype(float).tolist()
