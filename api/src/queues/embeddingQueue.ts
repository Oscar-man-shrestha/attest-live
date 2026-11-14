import { and, db, ideas, isNotNull, isNull, eq, sql, users } from "../../../packages/db/index";
import { INTEREST_POOL } from "../../../packages/types";

/**
 * Background embedding jobs. The work list is the set of rows whose embedding is null, so a
 * row is queued by writing it (new idea) or by clearing its vector (profile save). Nothing in
 * a request handler waits on the NLP service.
 */

const NLP_URL = (process.env.NLP_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
const BATCH = 32;
const IDLE_MS = 10_000;
const DOWN_MS = 60_000;

let labelVectors: Map<string, number[]> | null = null;
let running = false;
let timer: NodeJS.Timeout | null = null;
let nlpDown = false;

/** Interest label vectors for zero-shot topic tags. Null until the NLP service has answered once. */
export function interestLabelVectors() {
    return labelVectors;
}

export function startEmbeddingWorker() {
    schedule(1_000);
}

/** Ask for a run soon, for example right after a profile save. Never awaited by callers. */
export function nudgeEmbeddings() {
    if (!running && !nlpDown) schedule(250);
}

function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), ms);
}

async function tick() {
    if (running) return;
    running = true;
    let wait = IDLE_MS;
    try {
        await ensureLabelVectors();
        const didIdeas = await embedIdeas();
        const didUsers = await embedProfiles();
        if (nlpDown) console.log("Embedding worker: NLP service is back");
        nlpDown = false;
        if (didIdeas === BATCH || didUsers === BATCH) wait = 250;
    } catch (error) {
        if (!nlpDown) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`Embedding worker: NLP service unavailable at ${NLP_URL} (${reason}). Feed uses keyword matching until it is up.`);
        }
        nlpDown = true;
        wait = DOWN_MS;
    } finally {
        running = false;
        schedule(wait);
    }
}

async function embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${NLP_URL}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { vectors: number[][] };
    if (body.vectors.length !== texts.length) throw new Error("Vector count mismatch");
    return body.vectors;
}

/** Request-time embed for ranking. Returns null when NLP is down — never throws into handlers. */
export async function embedTextsSafe(texts: string[]): Promise<number[][] | null> {
    if (!texts.length) return [];
    try {
        return await embed(texts.map((text) => text.trim().slice(0, 4000) || " "));
    } catch {
        return null;
    }
}

export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined) {
    if (!a || !b || a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom < 1e-9 ? 0 : dot / denom;
}

async function ensureLabelVectors() {
    if (labelVectors) return;
    const texts = INTEREST_POOL.map((option) => `${option.label}: ${option.keywords.join(", ")}`);
    const vectors = await embed(texts);
    labelVectors = new Map(INTEREST_POOL.map((option, index) => [option.label, vectors[index]]));
}

export function ideaText(idea: { title: string; pitch: string | null; audience: string | null; gap: string | null; ships: string | null; helpNeeded: string[] | null }) {
    return [
        idea.title,
        idea.pitch,
        idea.audience ? `For: ${idea.audience}` : "",
        idea.gap ? `Gap: ${idea.gap}` : "",
        idea.ships ? `Ships: ${idea.ships}` : "",
        idea.helpNeeded?.length ? `Needs: ${idea.helpNeeded.join(", ")}` : "",
    ].filter(Boolean).join("\n");
}

type ProfileFields = {
    interests: string[] | null;
    campusSkills: string[] | null;
    twoWeekLine: string | null;
    headline: string | null;
    projects: { title: string; summary?: string }[] | null;
    certifications: { name: string }[] | null;
    experience: { role: string; org: string }[] | null;
};

export function profileText(user: ProfileFields) {
    return [
        user.headline ?? "",
        user.interests?.length ? `Interested in ${user.interests.join(", ")}.` : "",
        user.campusSkills?.length ? `Skills: ${user.campusSkills.join(", ")}.` : "",
        user.twoWeekLine ?? "",
        user.projects?.length ? `Projects: ${user.projects.map((p) => [p.title, p.summary].filter(Boolean).join(" - ")).join("; ")}.` : "",
        user.certifications?.length ? `Certified in ${user.certifications.map((c) => c.name).join(", ")}.` : "",
        user.experience?.length ? `Worked as ${user.experience.map((e) => `${e.role} at ${e.org}`).join(", ")}.` : "",
    ].filter(Boolean).join(" ");
}

async function embedIdeas() {
    const rows = await db.select({
        id: ideas.id,
        title: ideas.title,
        pitch: ideas.pitch,
        audience: ideas.audience,
        gap: ideas.gap,
        ships: ideas.ships,
        helpNeeded: ideas.helpNeeded,
    }).from(ideas).where(and(isNotNull(ideas.pitch), isNull(ideas.embedding))).limit(BATCH);
    if (!rows.length) return 0;
    const vectors = await embed(rows.map(ideaText));
    for (let i = 0; i < rows.length; i += 1) {
        await db.update(ideas).set({ embedding: vectors[i] }).where(eq(ideas.id, rows[i].id));
    }
    return rows.length;
}

async function embedProfiles() {
    const rows = await db.select({
        id: users.id,
        interests: users.interests,
        campusSkills: users.campusSkills,
        twoWeekLine: users.twoWeekLine,
        headline: users.headline,
        projects: users.projects,
        certifications: users.certifications,
        experience: users.experience,
    }).from(users).where(and(
        isNull(users.profileEmbedding),
        sql`(jsonb_array_length(${users.interests}) > 0 or jsonb_array_length(${users.campusSkills}) > 0 or ${users.twoWeekLine} is not null)`,
    )).limit(BATCH);
    if (!rows.length) return 0;
    const vectors = await embed(rows.map(profileText));
    for (let i = 0; i < rows.length; i += 1) {
        await db.update(users).set({ profileEmbedding: vectors[i] }).where(eq(users.id, rows[i].id));
    }
    return rows.length;
}
