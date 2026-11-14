"""Idea brief autofill from uploaded docs.

Suggests title / teaser / pitch / audience / gap / ships / approach from OCR or PDF text.
Everything is a suggestion the student reviews before posting.
"""

from __future__ import annotations

import re

from models.ocr import ExtractedText

SECTION_HINTS = {
    "title": re.compile(r"^(title|idea|project name)\s*[:\-–]\s*(.+)$", re.I),
    "pitch": re.compile(r"^(pitch|summary|overview|about|problem)\s*[:\-–]\s*(.+)$", re.I),
    "audience": re.compile(r"^(audience|who|for whom|users?)\s*[:\-–]\s*(.+)$", re.I),
    "gap": re.compile(r"^(gap|missing|still need|open problem)\s*[:\-–]\s*(.+)$", re.I),
    "ships": re.compile(r"^(ships?|deliverable|two weeks?|milestone|scope)\s*[:\-–]\s*(.+)$", re.I),
    "approach": re.compile(r"^(approach|how|method|plan|technical)\s*[:\-–]\s*(.+)$", re.I),
}

BULLET_RE = re.compile(r"^\s*[•\-\*▪◦●‣∙·–»►✓]\s*")


def _clip(text: str | None, n: int) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return None
    return cleaned[:n]


def _paragraphs(lines: list[str]) -> list[str]:
    blocks: list[str] = []
    buf: list[str] = []
    for raw in lines:
        line = BULLET_RE.sub("", raw).strip()
        if not line:
            if buf:
                blocks.append(" ".join(buf))
                buf = []
            continue
        buf.append(line)
    if buf:
        blocks.append(" ".join(buf))
    return [b for b in blocks if len(b) >= 12]


def extract_idea_brief(doc: ExtractedText) -> dict:
    lines = [line.strip() for line in doc.lines if line.strip()]
    labeled: dict[str, str] = {}
    for line in lines:
        for key, pattern in SECTION_HINTS.items():
            match = pattern.match(line)
            if match:
                labeled[key] = match.group(2).strip()
                break

    paras = _paragraphs(lines)
    title = labeled.get("title") or (lines[0] if lines and len(lines[0]) <= 120 else None)
    pitch = labeled.get("pitch") or (paras[0] if paras else None)
    ships = labeled.get("ships") or (paras[1] if len(paras) > 1 else None)
    approach = labeled.get("approach") or (paras[2] if len(paras) > 2 else (paras[-1] if paras else None))
    audience = labeled.get("audience")
    gap = labeled.get("gap")
    blurb = _clip(pitch, 160)

    return {
        "skills": [],
        "cgpa": None,
        "githubUrl": None,
        "linkedinUrl": None,
        "siteUrl": None,
        "degree": None,
        "graduationYear": None,
        "headline": _clip(title, 120),
        "projects": [],
        "certifications": [],
        "experience": [],
        "usedOcr": doc.used_ocr,
        "ideaBrief": {
            "title": _clip(title, 120),
            "blurb": blurb,
            "pitch": _clip(pitch, 2000),
            "audience": _clip(audience, 400),
            "gap": _clip(gap, 800),
            "ships": _clip(ships, 2000),
            "approach": _clip(approach, 4000),
        },
    }
