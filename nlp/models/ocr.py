"""Text out of PDFs and images. Real text layer first; OCR only for scanned pages.

OCR is RapidOCR (PaddleOCR models exported to ONNX): pretrained, CPU only, bundled with the pip package.
"""

from dataclasses import dataclass, field
from functools import lru_cache

import fitz  # PyMuPDF
import numpy as np

MAX_PAGES = 4
MIN_TEXT_CHARS = 120
OCR_ZOOM = 2.0


@dataclass
class ExtractedText:
    lines: list[str]
    links: list[str] = field(default_factory=list)
    used_ocr: bool = False


@lru_cache(maxsize=1)
def get_ocr():
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR()


def _ocr_image(image: np.ndarray) -> list[str]:
    result, _ = get_ocr()(image)
    if not result:
        return []
    # result rows: [box, text, score]; sort top-to-bottom, then left-to-right.
    rows = sorted(result, key=lambda row: (round(row[0][0][1] / 12), row[0][0][0]))
    return [row[1].strip() for row in rows if row[2] >= 0.5 and row[1].strip()]


def _pixmap_to_array(pix: fitz.Pixmap) -> np.ndarray:
    array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    return array[:, :, :3] if pix.n >= 3 else np.repeat(array, 3, axis=2)


def from_pdf(data: bytes) -> ExtractedText:
    doc = fitz.open(stream=data, filetype="pdf")
    lines: list[str] = []
    links: list[str] = []
    pages = [doc[i] for i in range(min(MAX_PAGES, doc.page_count))]
    for page in pages:
        lines.extend(line.strip() for line in page.get_text("text").splitlines() if line.strip())
        links.extend(link["uri"] for link in page.get_links() if link.get("uri"))
    if sum(len(line) for line in lines) >= MIN_TEXT_CHARS:
        return ExtractedText(lines=lines, links=links)
    ocr_lines: list[str] = []
    for page in pages:
        pix = page.get_pixmap(matrix=fitz.Matrix(OCR_ZOOM, OCR_ZOOM), alpha=False)
        ocr_lines.extend(_ocr_image(_pixmap_to_array(pix)))
    return ExtractedText(lines=ocr_lines, links=links, used_ocr=True)


def from_image(data: bytes) -> ExtractedText:
    pix = fitz.Pixmap(data)
    if pix.alpha:
        pix = fitz.Pixmap(pix, 0)
    if pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return ExtractedText(lines=_ocr_image(_pixmap_to_array(pix)), used_ocr=True)


def extract_text(data: bytes, mime_type: str) -> ExtractedText:
    if mime_type == "application/pdf":
        return from_pdf(data)
    return from_image(data)
