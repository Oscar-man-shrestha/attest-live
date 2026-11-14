"""Resume and certificate fields, zero-shot.

Section headers decide where a line belongs. Lines outside a known section are classified by
cosine similarity to short prototype sentences with the same all-MiniLM-L6-v2 model used for the
feed. Skills come from the vocabulary the API sends (one source of truth in packages/types).
Everything returned is a suggestion the student reviews.
"""

import re
from dataclasses import dataclass

import numpy as np

from models.embedder import embed
from models.ocr import ExtractedText

SECTION_HEADERS = {
    "education": r"education|academics?|academic (details|background)|qualifications?",
    "projects": r"projects?|academic projects|personal projects|key projects",
    "experience": r"experience|work experience|internships?|professional experience|employment",
    "certifications": r"certifications?|certificates?|courses|licen[sc]es( & certifications)?|online courses",
    "skills": r"(technical )?skills|technologies|tools|tech stack|core competencies",
    "summary": r"summary|objective|profile|about me|career objective",
    "other": r"achievements|awards|activities|extra.?curricular|hobbies|interests|languages|references|declaration|positions of responsibility|leadership|publications",
}
HEADER_RE = {name: re.compile(rf"^\W*({pattern})\W*$", re.I) for name, pattern in SECTION_HEADERS.items()}

PROTOTYPES = {
    "projects": "Built a project: developed an application or system using these technologies.",
    "experience": "Worked as an intern or engineer at a company, responsible for tasks.",
    "certifications": "Completed a certification course online, certificate issued by an organization.",
    "education": "Bachelor of Technology degree at a university, CGPA, school, twelfth grade marks.",
    "other": "Hobbies, languages spoken, personal details, declaration, contact information.",
}
ZERO_SHOT_MIN = 0.3

BULLET_RE = re.compile(r"^\s*[•\-\*▪◦●‣∙·–»►✓]\s*")
CGPA_RE = re.compile(r"\b(?:c\.?\s?g\.?\s?p\.?\s?a|gpa|cpi)\b\s*[:\-–]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:/\s*10(?:\.0+)?)?", re.I)
CGPA_AFTER_RE = re.compile(r"(\d{1,2}\.\d{1,2})\s*/\s*10\b")
DEGREE_RE = re.compile(r"\b(B\.?\s?Tech|M\.?\s?Tech|B\.?\s?E\b|BCA|MCA|B\.?\s?Sc|M\.?\s?Sc|MBA|Ph\.?\s?D)\b", re.I)
YEAR_RANGE_RE = re.compile(r"\b(20\d{2})\s*(?:-|–|—|to)\s*(20\d{2}|present|current|now)\b", re.I)
YEAR_RE = re.compile(r"\b(20[0-3]\d)\b")
PERIOD_RE = re.compile(
    r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+20\d{2}|20\d{2})\s*(?:-|–|—|to)\s*"
    r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+20\d{2}|20\d{2}|present|current|now)",
    re.I,
)
URL_RE = re.compile(r"(https?://[^\s,;)>\]]+|(?:www\.)?(?:github\.com|linkedin\.com|gitlab\.com)/[^\s,;)>\]]+)", re.I)
GITHUB_PROFILE_RE = re.compile(r"github\.com/([A-Za-z0-9-]{1,39})(?:/([A-Za-z0-9_.-]+))?", re.I)
LINKEDIN_RE = re.compile(r"linkedin\.com/in/([^/\s?#]+)", re.I)
CREDENTIAL_HOSTS = ("coursera.org/verify", "coursera.org/account/accomplishments", "credly.com", "nptel.ac.in",
                    "udemy.com/certificate", "ude.my", "archive.nptel", "credentials.", "verify.", "cert.", "certificate")
KNOWN_ISSUERS = [
    "NPTEL", "Coursera", "Udemy", "edX", "AWS", "Amazon Web Services", "Google", "Microsoft", "Cisco", "IBM",
    "Oracle", "Infosys Springboard", "Great Learning", "HackerRank", "LinkedIn Learning", "Meta", "NVIDIA",
    "Salesforce", "Red Hat", "MongoDB", "Deeplearning.AI", "DeepLearning.AI", "Stanford", "IIT", "Simplilearn",
    "Kaggle", "freeCodeCamp", "Postman", "GitHub", "Autodesk", "Dassault", "MathWorks", "Intel", "Qualcomm",
]
ROLE_WORDS = re.compile(r"\b(intern|engineer|developer|analyst|trainee|assistant|lead|member|volunteer|associate|researcher|designer|consultant)\b", re.I)
SKIP_LINE = re.compile(r"@|\+?\d[\d\s-]{8,}\d|^page \d", re.I)

JUNK_PROJECT_TITLES = re.compile(
    r"^(projects?|academic projects?|personal projects?|key projects?|selected projects?|"
    r"major projects?|mini projects?|coursework projects?|capstone( project)?|technical projects?|"
    r"techno?log(y|ies)(\s+used)?|techonolog(y|ies)(\s+used)?|tech stack|tools?(\s+used)?|skills?(\s+used)?|tools & technologies|"
    r"languages?(\s+used)?|frameworks?|libraries|platforms?|environment|database|"
    r"overview|description|features?|key features?|responsibilities|roles?( & responsibilities)?|"
    r"summary|achievements?|key achievements?|highlights?|work done|methodology|architecture|"
    r"role|duration|team(\s+size)?|period|timeline|timeframe|dates?|semester|"
    r"github(\s+links?)?|repository|demo|live demo|links?|source code|urls?|website|"
    r"results?|conclusions?|outcomes?|impact|notes?|details?|project \d+)\b",
    re.I,
)

BULLET_ACTION_VERBS = re.compile(
    r"^(developed|building|built|designed|implement(ed|ing)?|created|worked|engineered|"
    r"conducted|led|maintained|integrated|utiliz(ed|ing)|us(ed|ing)|performed|analyzed|configured|"
    r"authored|collaborated|assisted|formulated|programmed|deployed|tested|optimized|"
    r"enhanced|automated|contributed|spearheaded|facilitated|established|researched|"
    r"trained|fine-tuned|collected|evaluated|secured|monitored|executed)\b",
    re.I,
)

PROJECT_ACRONYMS = {"ocr", "cli", "nlp", "cad", "iot", "llm", "gps", "api", "gui", "pos", "erp", "crm", "ide", "sdk"}


@dataclass
class Entry:
    head: str
    body: list[str]


def _clean(line: str) -> str:
    return BULLET_RE.sub("", line).strip(" \t|•")


def _section_of(line: str) -> str | None:
    if len(line) > 40:
        return None
    for name, pattern in HEADER_RE.items():
        if pattern.match(line):
            return name
    return None


def _split_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"unknown": []}
    current = "unknown"
    for raw in lines:
        header = _section_of(raw.strip())
        if header:
            current = header
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(raw)
    return sections


def _zero_shot(lines: list[str]) -> dict[str, list[str]]:
    candidates = [line for line in lines if 15 <= len(line) <= 220 and not SKIP_LINE.search(line)]
    if not candidates:
        return {}
    labels = list(PROTOTYPES)
    vectors = np.array(embed(candidates + [PROTOTYPES[label] for label in labels]))
    line_vecs, proto_vecs = vectors[: len(candidates)], vectors[len(candidates):]
    sims = line_vecs @ proto_vecs.T
    out: dict[str, list[str]] = {}
    for line, row in zip(candidates, sims):
        best = int(row.argmax())
        if row[best] >= ZERO_SHOT_MIN and labels[best] != "other":
            out.setdefault(labels[best], []).append(line)
    return out


def _entries(lines: list[str]) -> list[Entry]:
    """A new entry starts at a short line that is not a bullet; bullets and long lines are its body."""
    entries: list[Entry] = []
    for raw in lines:
        is_bullet = bool(BULLET_RE.match(raw))
        text = _clean(raw)
        if not text:
            continue
        if not is_bullet and len(text) <= 100 and (not entries or entries[-1].body or len(text) < 70):
            entries.append(Entry(head=text, body=[]))
        elif entries:
            entries[-1].body.append(text)
        else:
            entries.append(Entry(head=text, body=[]))
    return entries


def _urls(text: str, links: list[str]) -> list[str]:
    found = [match if match.startswith("http") else f"https://{match}" for match in URL_RE.findall(text)]
    return list(dict.fromkeys(url.rstrip(".") for url in [*links, *found]))


def _pick_links(urls: list[str]):
    github = linkedin = site = None
    for url in urls:
        gh = GITHUB_PROFILE_RE.search(url)
        if gh and not github and gh.group(1).lower() not in {"orgs", "features", "about", "topics"}:
            github = f"https://github.com/{gh.group(1)}"
            continue
        li = LINKEDIN_RE.search(url)
        if li and not linkedin:
            linkedin = f"https://www.linkedin.com/in/{li.group(1)}"
            continue
        lower = url.lower()
        if not site and not gh and not li and not any(host in lower for host in CREDENTIAL_HOSTS) and "mailto:" not in lower:
            site = url
    return github, linkedin, site


def _cgpa(text: str) -> float | None:
    for match in [*CGPA_RE.finditer(text), *CGPA_AFTER_RE.finditer(text)]:
        value = float(match.group(1))
        if 4.0 <= value <= 10.0:
            return round(value, 2)
    return None


def _count(term: str, lowered: str) -> int:
    escaped = re.escape(term.lower().strip())
    return len(re.findall(rf"(?<![a-z0-9+#]){escaped}(?![a-z0-9+#])", lowered)) if escaped else 0


def _skills(text: str, vocab: list[dict]) -> list[str]:
    """A skill counts when its own name appears ("KiCad", "TypeScript"), or when two different
    topic keywords do. Topic keywords alone ("node", "design") are too loose to be evidence."""
    lowered = f" {text.lower()} "
    scored: list[tuple[int, str]] = []
    for item in vocab:
        names = [part for part in re.split(r"\s+/\s+|\s+and\s+|[()]", item["label"]) if len(part.strip()) >= 1]
        strong = sum(_count(name, lowered) for name in {item["label"], *names})
        weak = [keyword for keyword in item.get("keywords", []) if _count(keyword, lowered)]
        if strong or len(set(weak)) >= 2:
            scored.append((strong * 2 + len(weak), item["label"]))
    return [label for _, label in sorted(scored, key=lambda row: -row[0])]


def _issuer(text: str) -> str | None:
    lower = text.lower()
    for issuer in KNOWN_ISSUERS:
        if re.search(rf"(?<![a-z]){re.escape(issuer.lower())}(?![a-z])", lower):
            return issuer
    match = re.search(r"\b(?:by|from|issued by|offered by)\s+([A-Z][\w.&\- ]{2,40})", text)
    return match.group(1).strip() if match else None


def _year(text: str) -> int | None:
    years = [int(y) for y in YEAR_RE.findall(text)]
    return max(years) if years else None


def _credential_url(urls: list[str]) -> str | None:
    for url in urls:
        if any(host in url.lower() for host in CREDENTIAL_HOSTS):
            return url
    return None


def _is_junk_project_title(title: str, entry: Entry | None = None) -> bool:
    """Drop OCR crumbs: single tech words, section leftovers, bullet fragments, tiny crumbs."""
    t = title.strip()
    if len(t) < 3:
        return True
    lower = t.lower()
    if len(t) < 6 and lower not in PROJECT_ACRONYMS:
        return True
    letters = re.findall(r"[A-Za-z]", t)
    if len(letters) < 3:
        return True
    # Pure numbers, dates, ranges
    if re.match(r"^[\d\s/\-.,–—()]+$", t):
        return True
    if YEAR_RANGE_RE.match(t) or PERIOD_RE.match(t):
        return True
    # Pure URLs or emails
    if URL_RE.match(t) or "@" in t:
        return True
    # Trailing colon or bullet markers
    if t.endswith(":") or t.endswith(" -"):
        return True
    # Known section or metadata header labels
    if JUNK_PROJECT_TITLES.search(t):
        if JUNK_PROJECT_TITLES.match(t):
            return True
        if ":" in t:
            prefix = t.split(":")[0].strip()
            if JUNK_PROJECT_TITLES.match(prefix):
                return True
    # Action verbs starting a bullet sentence (e.g. "Developed a real-time chat app...")
    if BULLET_ACTION_VERBS.match(t):
        # Sentence-like action bullet or has no body
        if len(t.split()) >= 4 or (entry and not entry.body):
            return True
    words = re.findall(r"[A-Za-z0-9+#]+", t)
    # Sentence ending in period or semicolon with multiple words
    if t.endswith((".", ";")) and len(words) >= 3:
        return True
    if len(words) < 2 and len(t) < 18 and lower not in PROJECT_ACRONYMS:
        # Single isolated words without substance
        generic = {"project", "projects", "academic", "personal", "system", "application", "website", "model", "tool", "software", "portal", "platform", "app"}
        if lower in generic:
            return True
    # Pure tech-token titles like "React", "Node.js", "Python Flask" alone without a verb/noun object
    tech_only_words = {"react", "reactjs", "node", "nodejs", "python", "flask", "django", "java", "c++", "c", "sql", "mongodb", "postgresql", "html", "css", "git", "github", "linux", "aws", "docker", "kubernetes", "jira", "postman", "vercel", "tailwind"}
    if len(words) <= 2 and all(w.lower() in tech_only_words for w in words):
        return True
    return False


def _projects(lines: list[str], links: list[str]) -> list[dict]:
    out = []
    seen: set[str] = set()
    for entry in _entries(lines)[:20]:
        title = re.split(r"\s+[|–—]\s+|\s{2,}", entry.head)[0].strip(" :-–—|•*")
        title = PERIOD_RE.sub("", title).strip(" ,:-–—|")
        # Strip leading numbering "1." / "•"
        title = re.sub(r"^[\d]+[.)]\s*", "", title).strip()
        title = re.sub(r"[:\-\s]+$", "", title).strip()
        if _is_junk_project_title(title, entry):
            continue
        key = re.sub(r"\W+", "", title.lower())
        if key in seen:
            continue
        seen.add(key)
        summary = " ".join(entry.body)[:280] or None
        # Prefer a body sentence; skip if body is itself a junk fragment shorter than the title
        if summary and len(summary) < 12:
            summary = None
        urls = _urls(" ".join([entry.head, *entry.body]), [])
        url = next((u for u in urls if "github.com" in u.lower() or "http" in u), None)
        item = {"title": title[:100]}
        if summary:
            item["summary"] = summary
        if url:
            item["url"] = url
        out.append(item)
        if len(out) >= 6:
            break
    return out


def _experience(lines: list[str]) -> list[dict]:
    out = []
    for entry in _entries(lines)[:6]:
        joined = " ".join([entry.head, *entry.body[:1]])
        period_match = PERIOD_RE.search(joined)
        period = period_match.group(0) if period_match else None
        head = PERIOD_RE.sub("", entry.head).strip(" ,|–—-")
        parts = [p.strip() for p in re.split(r"\s+at\s+|\s*[|,–—@]\s*", head) if p.strip()]
        if len(parts) >= 2:
            role, org = (parts[0], parts[1]) if ROLE_WORDS.search(parts[0]) or not ROLE_WORDS.search(parts[1]) else (parts[1], parts[0])
        elif entry.body and ROLE_WORDS.search(entry.body[0]):
            role, org = PERIOD_RE.sub("", entry.body[0]).strip(" ,|–—-"), head
        else:
            continue
        item = {"role": role[:80], "org": org[:80]}
        if period:
            item["period"] = period[:40]
        if len(item["role"]) >= 2 and len(item["org"]) >= 2:
            out.append(item)
    return out


def _certifications(lines: list[str], urls: list[str]) -> list[dict]:
    out = []
    for raw in lines[:12]:
        text = _clean(raw)
        if len(text) < 4:
            continue
        name = re.split(r"\s+[|–—]\s+|\s+-\s+(?=[A-Z])", text)[0]
        name = re.sub(r"\((?:[^)]*20\d{2}[^)]*)\)", "", name).strip(" ,:-")
        item = {"name": name[:120]}
        issuer = _issuer(text)
        year = _year(text)
        if issuer and issuer.lower() not in name.lower():
            item["issuer"] = issuer
        elif issuer:
            item["issuer"] = issuer
        if year:
            item["year"] = year
        out.append(item)
    if out and len(out) == 1:
        url = _credential_url(urls)
        if url:
            out[0]["url"] = url
    return out[:10]


def _certificate_document(lines: list[str], urls: list[str]) -> list[dict]:
    text = " ".join(lines)
    name = None
    trigger = re.compile(r"successfully completed|completion of|has completed|for completing|awarded for", re.I)
    for i, line in enumerate(lines):
        if trigger.search(line):
            following = [l for l in lines[i + 1 : i + 4] if 4 <= len(l) <= 120 and not re.search(r"^(on|dated?|with|the course|offered|by)\b", l, re.I)]
            inline = trigger.split(line)[-1].strip(" :.-\"'")
            name = inline if len(inline) >= 6 else (following[0] if following else None)
            break
    if not name:
        titled = [l for l in lines if 6 <= len(l) <= 90 and not re.search(r"certificate|presented to|this is to", l, re.I)]
        name = max(titled, key=len) if titled else None
    if not name:
        return []
    item = {"name": name.strip(" \"'")[:120]}
    issuer = _issuer(text)
    if issuer:
        item["issuer"] = issuer
    year = _year(text)
    if year:
        item["year"] = year
    url = _credential_url(urls)
    if url:
        item["url"] = url
    return [item]


def _headline(summary_lines: list[str]) -> str | None:
    text = " ".join(_clean(line) for line in summary_lines).strip()
    if not text:
        return None
    first = re.split(r"(?<=[.!?])\s", text)[0]
    return first[:120] if len(first) >= 12 else None


def extract(doc: ExtractedText, kind: str, vocab: list[dict]) -> dict:
    lines = [line.strip() for line in doc.lines if line.strip()]
    text = "\n".join(lines)
    urls = _urls(text, doc.links)
    github, linkedin, site = _pick_links(urls)

    if kind == "certificate":
        return {
            "skills": _skills(text, vocab)[:8],
            "cgpa": None, "githubUrl": None, "linkedinUrl": None, "siteUrl": None,
            "degree": None, "graduationYear": None, "headline": None,
            "projects": [], "experience": [],
            "certifications": _certificate_document(lines, urls),
            "usedOcr": doc.used_ocr,
        }

    sections = _split_sections(lines)
    guessed = _zero_shot(sections.get("unknown", []))
    def part(name: str) -> list[str]:
        return sections.get(name) or guessed.get(name, [])

    education_text = " ".join(part("education"))
    degree_match = DEGREE_RE.search(education_text) or DEGREE_RE.search(text)
    degree = re.sub(r"[.\s]", "", degree_match.group(1)).replace("BTech", "B.Tech").replace("MTech", "M.Tech").replace("BSc", "B.Sc").replace("MSc", "M.Sc").replace("PhD", "PhD") if degree_match else None
    grad = None
    for match in YEAR_RANGE_RE.finditer(education_text or text):
        end = match.group(2)
        if end.isdigit():
            grad = max(grad or 0, int(end))

    return {
        "skills": _skills(text, vocab),
        "cgpa": _cgpa(education_text) or _cgpa(text),
        "githubUrl": github,
        "linkedinUrl": linkedin,
        "siteUrl": site,
        "degree": degree,
        "graduationYear": grad,
        "headline": _headline(part("summary")),
        "projects": _projects(part("projects"), doc.links),
        "certifications": _certifications(part("certifications"), urls),
        "experience": _experience(part("experience")),
        "usedOcr": doc.used_ocr,
    }
