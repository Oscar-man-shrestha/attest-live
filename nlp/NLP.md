# Attest NLP service

Python FastAPI service. Pretrained models only, CPU only, no fine-tuning, no paid APIs.

## Run

```bash
cd nlp
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn main:app --port 8001
```

The first start downloads `all-MiniLM-L6-v2` (about 90 MB) into the Hugging Face cache.

The API finds it through `NLP_URL` (default `http://localhost:8001`). If the service is down, the API keeps working: embeddings wait in the queue and the feed falls back to keyword matching.

## Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/health` | | `{ status, model }` |
| POST | `/embed` | `{ texts: string[] }` (1 to 64, each cut to 4000 chars) | `{ model, dimensions: 384, vectors: number[][] }`, unit length |

## What uses the vectors

- `ideas.embedding`: title, pitch, audience, gap, what ships, and roles needed.
- `users.profile_embedding`: interests, skills, and the two-week line.
- Interest labels from `INTEREST_POOL`: zero-shot topic tags for ideas (cosine similarity to each label).

The ranking itself runs in the API from stored vectors, so no request waits on this service.
