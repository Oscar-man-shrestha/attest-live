import { and, asc, db, documents, eq, isNotNull, isNull, users } from "../../../packages/db/index";
import { SKILL_POOL, type DocumentExtraction } from "../../../packages/types";

/**
 * Background document parsing and GitHub checks. An upload is stored with status "queued";
 * this worker sends it to the NLP service, keeps only the extracted fields, and deletes the
 * file bytes. A GitHub check is queued by saving a GitHub link with no github_login yet.
 */

const NLP_URL = (process.env.NLP_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
const IDLE_MS = 15_000;
const DOWN_MS = 60_000;
const SKILL_VOCAB = SKILL_POOL.map((option) => ({ label: option.label, keywords: option.keywords }));

let running = false;
let timer: NodeJS.Timeout | null = null;
let nlpDown = false;
let githubPausedUntil = 0;
const githubMissing = new Set<string>();

export function startDocumentWorker() {
    schedule(2_000);
}

/** Ask for a run soon, for example right after an upload or a profile save. Never awaited. */
export function nudgeDocuments() {
    if (!running) schedule(200);
}

export const nudgeGithubCheck = nudgeDocuments;

function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), ms);
}

async function tick() {
    if (running) return;
    running = true;
    let wait = IDLE_MS;
    try {
        const parsed = await parseQueuedDocuments();
        const checked = await checkGithubProfiles();
        if (parsed || checked) wait = 200;
    } catch (error) {
        console.error("Document worker:", error);
    } finally {
        running = false;
        schedule(nlpDown ? DOWN_MS : wait);
    }
}

async function parseQueuedDocuments() {
    const [doc] = await db.select().from(documents)
        .where(eq(documents.status, "queued"))
        .orderBy(asc(documents.createdAt))
        .limit(1);
    if (!doc || !doc.content) return 0;

    let response: globalThis.Response;
    try {
        response = await fetch(`${NLP_URL}/parse-document`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                kind: doc.kind,
                mimeType: doc.mimeType,
                contentBase64: Buffer.from(doc.content).toString("base64"),
                skillVocab: SKILL_VOCAB,
            }),
            signal: AbortSignal.timeout(120_000),
        });
    } catch (error) {
        if (!nlpDown) console.warn(`Document worker: NLP service unavailable at ${NLP_URL}. Uploads stay queued.`);
        nlpDown = true;
        return 0;
    }
    if (nlpDown) console.log("Document worker: NLP service is back");
    nlpDown = false;

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        await db.update(documents).set({
            status: "failed",
            error: typeof body.detail === "string" ? body.detail : "Could not read this file",
            content: null,
            parsedAt: new Date(),
        }).where(eq(documents.id, doc.id));
        return 1;
    }

    const result = (await response.json()) as DocumentExtraction;
    await db.update(documents).set({ status: "parsed", result, content: null, parsedAt: new Date() })
        .where(eq(documents.id, doc.id));
    return 1;
}

function githubLoginFromUrl(url: string) {
    const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/?$/i);
    return match ? match[1] : null;
}

async function github(path: string) {
    return fetch(`https://api.github.com${path}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "attest-campus" },
        signal: AbortSignal.timeout(15_000),
    });
}

/** Confirms the linked GitHub profile exists and records public stats. It does not prove ownership. */
async function checkGithubProfiles() {
    if (Date.now() < githubPausedUntil) return 0;
    const rows = await db.select({ id: users.id, githubUrl: users.githubUrl }).from(users)
        .where(and(isNotNull(users.githubUrl), isNull(users.githubLogin)))
        .limit(10);
    const pending = rows.filter((row) => row.githubUrl && !githubMissing.has(`${row.id}:${row.githubUrl}`));
    const row = pending[0];
    if (!row?.githubUrl) return 0;

    const key = `${row.id}:${row.githubUrl}`;
    const login = githubLoginFromUrl(row.githubUrl);
    if (!login) {
        githubMissing.add(key);
        return 1;
    }

    const profile = await github(`/users/${encodeURIComponent(login)}`);
    if (profile.status === 403 || profile.status === 429) {
        const reset = Number(profile.headers.get("x-ratelimit-reset"));
        githubPausedUntil = reset ? reset * 1000 : Date.now() + 15 * 60_000;
        return 0;
    }
    if (!profile.ok) {
        githubMissing.add(key);
        return 1;
    }
    const body = (await profile.json()) as { login: string; public_repos: number; followers: number };

    const topLanguages: string[] = [];
    const repos = await github(`/users/${encodeURIComponent(body.login)}/repos?sort=pushed&per_page=30&type=owner`);
    if (repos.ok) {
        const list = (await repos.json()) as { language: string | null; fork: boolean }[];
        const counts = new Map<string, number>();
        for (const repo of list) {
            if (repo.fork || !repo.language) continue;
            counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
        }
        topLanguages.push(...[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([language]) => language));
    }

    await db.update(users).set({
        githubLogin: body.login,
        githubStats: { publicRepos: body.public_repos, followers: body.followers, topLanguages, checkedAt: new Date().toISOString() },
    }).where(and(eq(users.id, row.id), eq(users.githubUrl, row.githubUrl)));
    return 1;
}
