/**
 * Marketplace worker (polls the DB; no Redis needed).
 * 1. Auto-accepts submitted milestones whose 7-day review window has passed.
 * 2. Zero-shot integrity check: compares new ideas/problems against "graded coursework" prototypes with the
 *    self-hosted MiniLM model (AGENTS rule 1). A close match only adds a pending flag for an admin; it never hides
 *    or bans anything by itself (RULES 17).
 */
import { and, db, desc, eq, ideas, integrityFlags, isNotNull, isNull, problems } from "../../../packages/db/index";
import { autoAcceptDueMilestones } from "../services/dealService";
import { cosineSimilarity, embedTextsSafe } from "./embeddingQueue";

const IDLE_MS = 10 * 60_000;
const BATCH = 20;
/**
 * Calibrated 2026-11-15 on live posts: a blatant homework request scored 0.40 while a genuine
 * "course-note search" idea scored 0.42, so MiniLM alone cannot separate them. The keyword check in
 * packages/types (detectAcademicRequest) is the primary guard; this model pass is only a backstop for very
 * close matches, set high to avoid flooding admins with real projects.
 */
const THRESHOLD = 0.5;

const PROTOTYPES = [
    "Do my college assignment for me before the submission deadline",
    "Solve my exam questions and send me the answers",
    "Complete my lab record and lab report for submission",
    "Write my final year project report so I can submit it for grading",
    "Need someone to do my university coursework homework",
    "Make my semester mini project for marks",
];

let running = false;
let timer: NodeJS.Timeout | null = null;
let prototypeVectors: number[][] | null = null;

export function startMarketplaceWorker() {
    schedule(5_000);
}

export function nudgeMarketplace() {
    if (!running) schedule(500);
}

function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), ms);
}

async function tick() {
    if (running) return;
    running = true;
    try {
        const accepted = await autoAcceptDueMilestones();
        if (accepted) console.log(`Marketplace worker: auto-accepted ${accepted} milestone(s)`);
        await integrityPass();
    } catch (error) {
        console.warn("Marketplace worker:", error instanceof Error ? error.message : error);
    } finally {
        running = false;
        schedule(IDLE_MS);
    }
}

async function prototypes() {
    if (prototypeVectors) return prototypeVectors;
    const vectors = await embedTextsSafe(PROTOTYPES);
    if (vectors && vectors.length === PROTOTYPES.length) prototypeVectors = vectors;
    return prototypeVectors;
}

async function integrityPass() {
    const protos = await prototypes();
    if (!protos) return; // NLP service down: try again next tick; nothing is marked checked.

    const ideaRows = await db.select({ id: ideas.id, title: ideas.title, pitch: ideas.pitch, ships: ideas.ships })
        .from(ideas).where(and(isNotNull(ideas.pitch), isNull(ideas.integrityCheckedAt))).orderBy(desc(ideas.createdAt)).limit(BATCH);
    const problemRows = await db.select({ id: problems.id, title: problems.title, whatHappens: problems.whatHappens, fix: problems.fixWouldChange })
        .from(problems).where(isNull(problems.integrityCheckedAt)).orderBy(desc(problems.createdAt)).limit(BATCH);

    const items = [
        ...ideaRows.map((r) => ({ type: "idea" as const, id: r.id, text: [r.title, r.pitch, r.ships].filter(Boolean).join(". ") })),
        ...problemRows.map((r) => ({ type: "problem" as const, id: r.id, text: [r.title, r.whatHappens, r.fix].join(". ") })),
    ];
    if (!items.length) return;
    const vectors = await embedTextsSafe(items.map((i) => i.text));
    if (!vectors) return;

    for (let n = 0; n < items.length; n += 1) {
        const item = items[n];
        const best = Math.max(...protos.map((p) => cosineSimilarity(vectors[n], p)));
        if (best >= THRESHOLD) {
            const [existing] = await db.select({ id: integrityFlags.id }).from(integrityFlags).where(and(
                eq(integrityFlags.targetType, item.type),
                eq(integrityFlags.targetId, item.id),
                eq(integrityFlags.status, "pending"),
            ));
            if (!existing) {
                await db.insert(integrityFlags).values({
                    targetType: item.type,
                    targetId: item.id,
                    source: "model",
                    label: "graded_coursework",
                    score: best.toFixed(4),
                    matched: item.text.slice(0, 200),
                });
            }
        }
        const now = new Date();
        if (item.type === "idea") await db.update(ideas).set({ integrityCheckedAt: now }).where(eq(ideas.id, item.id));
        else await db.update(problems).set({ integrityCheckedAt: now }).where(eq(problems.id, item.id));
    }
}
