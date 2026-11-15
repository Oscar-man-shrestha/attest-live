import { and, db, desc, eq, gt, ideas, inArray, interactions, isNotNull, isNull, ne, offers, saves, sql, teamMembers, users } from "../../../packages/db/index";
import { INTEREST_POOL, INTEREST_TILES, SKILL_POOL } from "../../../packages/types";
import { interestLabelVectors, nudgeEmbeddings } from "../queues/embeddingQueue";
import { CampusError, campusOf, ideaCampusVisible, publicIdea, requireUser, savedSet, withIdeaImages } from "./campusService";
import { circleMates } from "./peers";

/**
 * "For you" ranking for the idea board.
 *
 * score = 0.42 content + 0.14 skill + 0.13 peers + 0.08 cohort + 0.11 fresh + 0.07 popular + 0.05 branch - fatigue
 *
 * content  cosine between the viewer's taste vector and the idea embedding (all-MiniLM-L6-v2).
 *          Taste = profile embedding + time-decayed embeddings of ideas the viewer saved, offered on,
 *          read, or opened, minus ideas marked not interested. Keyword overlap when vectors are missing.
 * peers    item-item collaborative filtering: students who engaged with what you engaged with.
 * skill    the viewer's skills appear in the roles the idea needs.
 * cohort   engagement in the last 21 days from the viewer's k-means circle and branch-semester classmates.
 * The top of the list is re-ranked with maximal marginal relevance so it is not ten copies of one
 * topic, and fresh ideas get guaranteed slots so new posts can be discovered.
 */

type IdeaRow = typeof ideas.$inferSelect;
type Vec = number[];

const CANDIDATES = 300;
const RANKED = 60;
const PAGE = 20;
const HISTORY_DAYS = 90;
const HALF_LIFE_DAYS = 14;
const MMR_LAMBDA = 0.72;
const FRESH_HOURS = 72;
const EXPLORE_SLOTS = [3, 8, 14];
const VIEW_DEDUP_MINUTES = 30;
const TOPIC_MIN_SIM = 0.3;
const KEYWORD_TOPIC_BUMP = 0.12;
const TOPIC_MAX_GAP = 0.2;
const SUGGEST_MIN_WEIGHT = 2;
const MIN_SIGNALS_FOR_SUGGESTIONS = 3;

const SIGNAL_WEIGHT = { offer: 4, save: 3, dwell: 2, view: 0.6, not_interested: -3 } as const;
type SignalKind = keyof typeof SIGNAL_WEIGHT;
const SIGNAL_VERB: Record<Exclude<SignalKind, "not_interested">, string> = {
    offer: "offered to help on",
    save: "saved",
    dwell: "read",
    view: "opened",
};

type Signal = { ideaId: string; kind: SignalKind; at: Date; weight: number };

// ---------- vector helpers ----------

function dot(a: Vec, b: Vec) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
    return sum;
}

function normalize(v: Vec): Vec | null {
    const length = Math.sqrt(dot(v, v));
    if (!Number.isFinite(length) || length < 1e-9) return null;
    return v.map((x) => x / length);
}

function addScaled(target: Vec, v: Vec, scale: number) {
    for (let i = 0; i < target.length; i += 1) target[i] += v[i] * scale;
}

function cosine(a: Vec | null | undefined, b: Vec | null | undefined) {
    if (!a || !b || a.length !== b.length) return 0;
    return dot(a, b);
}

/**
 * Sentence-embedding cosines bunch up in a narrow band, so spread them over 0..1 across the
 * candidates. A pool with no real spread keeps its raw values.
 */
function rescaler(values: number[]) {
    if (values.length < 2) return (value: number) => Math.max(0, value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min < 0.05) return (value: number) => Math.max(0, value);
    return (value: number) => (value - min) / (max - min);
}

// ---------- keyword fallback ----------

function mentions(text: string, keyword: string) {
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

function ideaWords(idea: IdeaRow) {
    return {
        body: [idea.title, idea.pitch, idea.audience, idea.gap, idea.ships].join(" ").toLowerCase(),
        roles: (idea.helpNeeded ?? []).join(" ").toLowerCase(),
    };
}

function keywordTopics(idea: IdeaRow) {
    const { body, roles } = ideaWords(idea);
    return INTEREST_POOL
        .filter((option) => option.keywords.some((keyword) => mentions(body, keyword) || mentions(roles, keyword)))
        .map((option) => option.label);
}

function skillHits(idea: IdeaRow, skills: string[]) {
    const { body, roles } = ideaWords(idea);
    const strong: string[] = [];
    const weak: string[] = [];
    for (const skill of skills) {
        const option = SKILL_POOL.find((item) => item.label === skill);
        const keywords = [skill.toLowerCase(), ...(option?.keywords ?? [])];
        if (keywords.some((keyword) => mentions(roles, keyword))) strong.push(skill);
        else if (keywords.some((keyword) => mentions(body, keyword))) weak.push(skill);
    }
    return { strong, weak };
}

// ---------- topics ----------

/** Zero-shot tags: similarity to each interest label, plus a bump when the label's keywords appear. */
function topicsFor(idea: IdeaRow, labels: Map<string, Vec> | null, limit = 3) {
    const keywordHits = new Set(keywordTopics(idea));
    const embedding = idea.embedding ?? null;
    if (!embedding || !labels) return [...keywordHits].slice(0, limit);
    const ranked = [...labels.entries()]
        .map(([label, vector]) => ({ label, sim: dot(embedding, vector) + (keywordHits.has(label) ? KEYWORD_TOPIC_BUMP : 0) }))
        .sort((a, b) => b.sim - a.sim);
    const floor = Math.max(TOPIC_MIN_SIM, (ranked[0]?.sim ?? 0) - TOPIC_MAX_GAP);
    return ranked.filter((row) => row.sim >= floor).slice(0, limit).map((row) => row.label);
}

// ---------- signals ----------

async function viewerSignals(viewerId: string): Promise<Signal[]> {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
    const [savedRows, offerRows, interactionRows] = await Promise.all([
        db.select({ ideaId: saves.targetId, at: saves.createdAt }).from(saves)
            .where(and(eq(saves.userId, viewerId), eq(saves.targetType, "idea"), gt(saves.createdAt, since))),
        db.select({ ideaId: offers.ideaId, at: offers.createdAt }).from(offers)
            .where(and(eq(offers.builderId, viewerId), isNotNull(offers.ideaId), gt(offers.createdAt, since))),
        db.select({ ideaId: interactions.ideaId, kind: interactions.kind, dwellMs: interactions.dwellMs, at: interactions.createdAt })
            .from(interactions)
            .where(and(eq(interactions.userId, viewerId), gt(interactions.createdAt, since)))
            .orderBy(desc(interactions.createdAt))
            .limit(500),
    ]);
    const signals: Signal[] = [];
    savedRows.forEach((row) => signals.push({ ideaId: row.ideaId, kind: "save", at: row.at, weight: SIGNAL_WEIGHT.save }));
    offerRows.forEach((row) => row.ideaId && signals.push({ ideaId: row.ideaId, kind: "offer", at: row.at, weight: SIGNAL_WEIGHT.offer }));
    for (const row of interactionRows) {
        if (row.kind === "view") signals.push({ ideaId: row.ideaId, kind: "view", at: row.at, weight: SIGNAL_WEIGHT.view });
        if (row.kind === "not_interested") signals.push({ ideaId: row.ideaId, kind: "not_interested", at: row.at, weight: SIGNAL_WEIGHT.not_interested });
        if (row.kind === "dwell") {
            const depth = Math.min(1, (row.dwellMs ?? 0) / 45_000);
            if (depth >= 0.2) signals.push({ ideaId: row.ideaId, kind: "dwell", at: row.at, weight: SIGNAL_WEIGHT.dwell * depth });
        }
    }
    return signals;
}

function decay(at: Date) {
    const days = (Date.now() - at.getTime()) / 86_400_000;
    return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

function behaviourVector(signals: Signal[], vectors: Map<string, Vec>, dims: number) {
    const sum = new Array<number>(dims).fill(0);
    let used = 0;
    for (const signal of signals) {
        const vector = vectors.get(signal.ideaId);
        if (!vector) continue;
        addScaled(sum, vector, signal.weight * decay(signal.at));
        if (signal.weight > 0) used += 1;
    }
    return { vector: used ? normalize(sum) : null, used };
}

function uuidArray(ids: string[]) {
    return `{${ids.join(",")}}`;
}

/** Item-item collaborative filtering over saves, offers, and long reads. */
async function peerScores(viewerId: string, candidateIds: string[]) {
    if (!candidateIds.length) return new Map<string, number>();
    const result = await db.execute(sql`
        with eng as (
            select user_id, target_id as idea_id, created_at from saves where target_type = 'idea'
            union all
            select builder_id, idea_id, created_at from offers where idea_id is not null
            union all
            select user_id, idea_id, created_at from interactions where kind = 'dwell' and dwell_ms >= 15000
        ),
        recent as (select * from eng where created_at > now() - make_interval(days => ${HISTORY_DAYS})),
        mine as (select distinct idea_id from recent where user_id = ${viewerId}),
        peers as (
            select user_id, count(distinct idea_id)::float as overlap
            from recent where idea_id in (select idea_id from mine) and user_id <> ${viewerId}
            group by user_id
        )
        select r.idea_id::text as idea_id, sum(p.overlap)::float as score
        from (select distinct user_id, idea_id from recent) r
        join peers p on p.user_id = r.user_id
        where r.idea_id = any(${uuidArray(candidateIds)}::uuid[])
          and r.idea_id not in (select idea_id from mine)
        group by r.idea_id
    `);
    return new Map((result.rows as { idea_id: string; score: number }[]).map((row) => [row.idea_id, Number(row.score)]));
}

/** Distinct students engaging in the last 14 days. Opens count a quarter. */
async function popularity(candidateIds: string[]) {
    if (!candidateIds.length) return new Map<string, number>();
    const result = await db.execute(sql`
        with eng as (
            select user_id, target_id as idea_id, 1.0 as w, created_at from saves where target_type = 'idea'
            union all
            select builder_id, idea_id, 1.5, created_at from offers where idea_id is not null
            union all
            select user_id, idea_id, case when kind = 'view' then 0.25 when kind = 'share' then 1.25 else 0.75 end, created_at
            from interactions where kind in ('view', 'dwell', 'share')
            union all
            select user_id, target_id, 1.0, created_at from reactions where target_type = 'idea'
            union all
            select user_id, idea_id, 1.25, created_at from idea_comments where deleted_at is null
        )
        select idea_id::text as idea_id, sum(w)::float as score from (
            select user_id, idea_id, max(w) as w from eng
            where created_at > now() - interval '14 days' and idea_id = any(${uuidArray(candidateIds)}::uuid[])
            group by user_id, idea_id
        ) per_user group by idea_id
    `);
    return new Map((result.rows as { idea_id: string; score: number }[]).map((row) => [row.idea_id, Number(row.score)]));
}

/**
 * Engagement from the viewer's cohort: their k-means circle plus classmates in the same branch and
 * semester. Returns a score per idea and which group drove it, for the reason line.
 */
async function cohortScores(viewer: { id: string; branch: string | null; semester: number | null }, candidateIds: string[]) {
    const empty = { scores: new Map<string, number>(), source: new Map<string, "circle" | "classmates">(), circleLabel: null as string | null };
    if (!candidateIds.length) return empty;
    const [{ circle, members }, classmates] = await Promise.all([
        circleMates(viewer.id),
        viewer.branch && viewer.semester
            ? db.select({ id: users.id }).from(users).where(and(eq(users.branch, viewer.branch), eq(users.semester, viewer.semester), ne(users.id, viewer.id))).limit(2000)
            : Promise.resolve([] as { id: string }[]),
    ]);
    const circleSet = new Set(members);
    const classSet = new Set(classmates.map((row) => row.id));
    const cohort = [...new Set([...circleSet, ...classSet])];
    if (!cohort.length) return empty;

    const result = await db.execute(sql`
        with eng as (
            select user_id, target_id as idea_id, 1.0 as w, created_at from saves where target_type = 'idea'
            union all
            select builder_id, idea_id, 1.5, created_at from offers where idea_id is not null
            union all
            select user_id, idea_id, case when kind = 'view' then 0.25 else 0.75 end, created_at
            from interactions where kind in ('view', 'dwell')
        )
        select user_id::text as user_id, idea_id::text as idea_id, max(w)::float as w from eng
        where created_at > now() - interval '21 days'
          and user_id = any(${uuidArray(cohort)}::uuid[])
          and idea_id = any(${uuidArray(candidateIds)}::uuid[])
        group by user_id, idea_id
    `);
    const byCircle = new Map<string, number>();
    const byClass = new Map<string, number>();
    for (const row of result.rows as { user_id: string; idea_id: string; w: number }[]) {
        const w = Number(row.w);
        if (circleSet.has(row.user_id)) byCircle.set(row.idea_id, (byCircle.get(row.idea_id) ?? 0) + w);
        if (classSet.has(row.user_id)) byClass.set(row.idea_id, (byClass.get(row.idea_id) ?? 0) + w);
    }
    for (const id of new Set([...byCircle.keys(), ...byClass.keys()])) {
        const fromCircle = byCircle.get(id) ?? 0;
        const fromClass = byClass.get(id) ?? 0;
        empty.scores.set(id, Math.max(fromCircle, fromClass));
        empty.source.set(id, fromCircle >= fromClass ? "circle" : "classmates");
    }
    return { ...empty, circleLabel: circle?.label ?? null };
}

// ---------- feed ----------

type Scored = {
    idea: IdeaRow;
    score: number;
    reasons: string[];
    topics: string[];
    fresh: boolean;
};

function decodeCursor(cursor?: string) {
    if (!cursor) return 0;
    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown };
        const offset = Number(parsed.o);
        return Number.isInteger(offset) && offset >= 0 && offset < RANKED ? offset : 0;
    } catch {
        return 0;
    }
}

function encodeCursor(offset: number) {
    return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

export async function forYouFeed(userId: string, cursor?: string, campusOnly = false) {
    const viewer = await requireUser(userId);
    const viewerCampus = campusOf(viewer);
    const labels = interestLabelVectors();
    const interests = viewer.interests ?? [];
    const skills = viewer.campusSkills ?? [];

    const [candidates, signals, myTeams] = await Promise.all([
        db.select().from(ideas).where(and(
            isNotNull(ideas.pitch),
            isNull(ideas.hiddenAt),
            ne(ideas.teamStatus, "shipped"),
            ne(ideas.ownerId, viewer.id),
            ideaCampusVisible(viewerCampus),
            ...(campusOnly ? [eq(ideas.campusDomain, viewerCampus)] : []),
        )).orderBy(desc(ideas.createdAt)).limit(CANDIDATES),
        viewerSignals(viewer.id),
        db.select({ ideaId: teamMembers.ideaId }).from(teamMembers)
            .where(and(eq(teamMembers.userId, viewer.id), isNull(teamMembers.leftAt))),
    ]);

    const hidden = new Set(signals.filter((s) => s.kind === "not_interested").map((s) => s.ideaId));
    const onTeam = new Set(myTeams.map((row) => row.ideaId));
    const pool = candidates.filter((idea) => !hidden.has(idea.id) && !onTeam.has(idea.id));

    const vectors = new Map<string, Vec>();
    const titles = new Map<string, string>();
    candidates.forEach((idea) => {
        titles.set(idea.id, idea.title);
        if (idea.embedding) vectors.set(idea.id, idea.embedding);
    });
    const outside = [...new Set(signals.map((s) => s.ideaId))].filter((id) => !titles.has(id));
    if (outside.length) {
        const rows = await db.select({ id: ideas.id, title: ideas.title, embedding: ideas.embedding })
            .from(ideas).where(inArray(ideas.id, outside));
        rows.forEach((row) => {
            titles.set(row.id, row.title);
            if (row.embedding) vectors.set(row.id, row.embedding);
        });
    }

    const dims = viewer.profileEmbedding?.length ?? vectors.values().next().value?.length ?? 384;
    const behaviour = behaviourVector(signals, vectors, dims);
    const tasteSum = new Array<number>(dims).fill(0);
    if (viewer.profileEmbedding) addScaled(tasteSum, viewer.profileEmbedding, 1.5);
    if (behaviour.vector) addScaled(tasteSum, behaviour.vector, Math.min(2, 0.4 * behaviour.used));
    const taste = normalize(tasteSum);
    if (!viewer.profileEmbedding && (interests.length || skills.length || viewer.twoWeekLine)) nudgeEmbeddings();

    const ids = pool.map((idea) => idea.id);
    const [peers, popular, cohort] = await Promise.all([peerScores(viewer.id, ids), popularity(ids), cohortScores(viewer, ids)]);
    const maxPeer = Math.max(1, ...peers.values());
    const maxPop = Math.max(1, ...popular.values());
    const maxCohort = Math.max(1, ...cohort.scores.values());

    const viewCounts = new Map<string, number>();
    signals.filter((s) => s.kind === "view").forEach((s) => viewCounts.set(s.ideaId, (viewCounts.get(s.ideaId) ?? 0) + 1));
    const deepSignals = new Set(signals.filter((s) => s.kind === "save" || s.kind === "offer").map((s) => s.ideaId));
    const readSignals = new Set(signals.filter((s) => s.kind === "dwell").map((s) => s.ideaId));
    const positive = signals.filter((s) => s.weight > 0);

    const rawContent = new Map<string, number>();
    for (const idea of pool) {
        if (taste && idea.embedding) {
            rawContent.set(idea.id, cosine(taste, idea.embedding));
        } else {
            const keywordTopicHits = keywordTopics(idea).filter((topic) => interests.includes(topic)).length;
            rawContent.set(idea.id, Math.min(1, keywordTopicHits / 3) * 0.6);
        }
    }
    const contentScale = rescaler([...rawContent.values()]);

    const scored: Scored[] = pool.map((idea) => {
        const embedding = idea.embedding ?? null;
        const topics = topicsFor(idea, labels);
        const interestTopics = topics.filter((topic) => interests.includes(topic));
        const content = contentScale(rawContent.get(idea.id) ?? 0);
        const { strong, weak } = skillHits(idea, skills);
        const skill = Math.min(1, (strong.length + 0.35 * weak.length) / 2);
        const peer = Math.log1p(peers.get(idea.id) ?? 0) / Math.log1p(maxPeer);
        const pop = Math.log1p(popular.get(idea.id) ?? 0) / Math.log1p(maxPop);
        const ageHours = (Date.now() - idea.createdAt.getTime()) / 3_600_000;
        const fresh = Math.exp(-ageHours / (24 * 5));
        const branch = viewer.branch && idea.authorBranch === viewer.branch ? 1 : 0;
        const views = viewCounts.get(idea.id) ?? 0;
        const fatigue = deepSignals.has(idea.id) ? 0.25 : readSignals.has(idea.id) ? 0.12 : Math.min(0.2, 0.05 * views);

        const circle = Math.log1p(cohort.scores.get(idea.id) ?? 0) / Math.log1p(maxCohort);

        const score = 0.42 * content + 0.14 * skill + 0.13 * peer + 0.08 * circle + 0.11 * fresh + 0.07 * pop + 0.05 * branch - fatigue;

        const reasons: string[] = [];
        let because: { title: string; verb: string; sim: number } | null = null;
        if (embedding) {
            for (const signal of positive) {
                if (signal.ideaId === idea.id || signal.kind === "not_interested") continue;
                const sim = cosine(vectors.get(signal.ideaId), embedding);
                if (sim > 0.55 && (!because || sim > because.sim)) {
                    because = { title: titles.get(signal.ideaId) ?? "an idea", verb: SIGNAL_VERB[signal.kind as Exclude<SignalKind, "not_interested">], sim };
                }
            }
        }
        if (strong.length) reasons.push(`Needs your ${strong.slice(0, 2).join(" and ")}`);
        if (because) reasons.push(`Like "${because.title}", which you ${because.verb}`);
        if (interestTopics.length) reasons.push(`Matches your interest in ${interestTopics.slice(0, 2).join(" and ")}`);
        if (peer > 0.3) reasons.push("Students with your taste are into this");
        if (circle > 0.4) {
            reasons.push(cohort.source.get(idea.id) === "circle" && cohort.circleLabel
                ? `Popular in your circle: ${cohort.circleLabel}`
                : `Popular with ${viewer.branch} semester ${viewer.semester}`);
        }
        if (pop > 0.6) reasons.push("Trending this week");
        if (ageHours < FRESH_HOURS) reasons.push("New");
        return { idea, score, reasons: reasons.slice(0, 2), topics, fresh: ageHours < FRESH_HOURS };
    });

    const ranked = diversify(scored, vectors);
    const offset = decodeCursor(cursor);
    const page = ranked.slice(offset, offset + PAGE);
    const saved = await savedSet(viewer.id, "idea", page.map((row) => row.idea.id));

    const cards = page.map((row) => ({
        ...publicIdea(row.idea, saved.has(row.idea.id), null, 0, { viewerId: viewer.id, viewerCampus }),
        reasons: row.reasons,
        topics: row.topics,
    }));
    return {
        ideas: await withIdeaImages(cards),
        nextCursor: offset + PAGE < ranked.length ? encodeCursor(offset + PAGE) : null,
        personalized: Boolean(taste) || interests.length > 0 || skills.length > 0,
        usingModel: Boolean(taste && labels),
        suggestedInterests: offset === 0 ? suggestInterests(signals, candidates, interests, labels) : [],
    };
}

/** Maximal marginal relevance over the best candidates, then guaranteed slots for fresh ideas. */
function diversify(scored: Scored[], vectors: Map<string, Vec>) {
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const head = sorted.slice(0, RANKED * 2);
    const picked: Scored[] = [];
    const remaining = [...head];
    while (picked.length < RANKED && remaining.length) {
        let bestIndex = 0;
        let bestValue = -Infinity;
        for (let i = 0; i < remaining.length; i += 1) {
            const candidate = remaining[i];
            const vector = vectors.get(candidate.idea.id);
            let redundancy = 0;
            if (vector) {
                for (const chosen of picked) redundancy = Math.max(redundancy, cosine(vector, vectors.get(chosen.idea.id)));
            }
            const value = MMR_LAMBDA * candidate.score - (1 - MMR_LAMBDA) * redundancy;
            if (value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }
        picked.push(remaining.splice(bestIndex, 1)[0]);
    }

    const early = new Set(picked.slice(0, EXPLORE_SLOTS[EXPLORE_SLOTS.length - 1] + 1).map((row) => row.idea.id));
    const freshLater = picked.filter((row) => row.fresh && !early.has(row.idea.id));
    for (const slot of EXPLORE_SLOTS) {
        const next = freshLater.shift();
        if (!next || slot >= picked.length) break;
        picked.splice(picked.indexOf(next), 1);
        picked.splice(slot, 0, next);
    }
    return picked;
}

/** Topics that keep showing up in what the viewer engages with but has not picked yet. */
function suggestInterests(signals: Signal[], candidates: IdeaRow[], interests: string[], labels: Map<string, Vec> | null) {
    const positive = signals.filter((s) => s.weight > 0);
    if (positive.length < MIN_SIGNALS_FOR_SUGGESTIONS) return [];
    const byId = new Map(candidates.map((idea) => [idea.id, idea]));
    const weights = new Map<string, number>();
    for (const signal of positive) {
        const idea = byId.get(signal.ideaId);
        if (!idea) continue;
        for (const topic of topicsFor(idea, labels)) {
            if (interests.includes(topic)) continue;
            weights.set(topic, (weights.get(topic) ?? 0) + signal.weight * decay(signal.at));
        }
    }
    return [...weights.entries()]
        .filter(([, weight]) => weight >= SUGGEST_MIN_WEIGHT)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label]) => label);
}

// ---------- interest graph ----------

let relatedCache: { source: Map<string, Vec>; related: Record<string, string[]> } | null = null;

/** For each interest label, the labels nearest in meaning. Empty until the NLP service has answered once. */
export function relatedInterests() {
    const labels = interestLabelVectors();
    if (!labels) return { related: {} as Record<string, string[]> };
    if (relatedCache?.source === labels) return { related: relatedCache.related };
    const entries = [...labels.entries()];
    const related: Record<string, string[]> = {};
    for (const [label, vector] of entries) {
        related[label] = entries
            .filter(([other]) => other !== label)
            .map(([other, otherVector]) => ({ other, sim: dot(vector, otherVector) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, 6)
            .map((row) => row.other);
    }
    relatedCache = { source: labels, related };
    return { related };
}

// ---------- more like this ----------

export async function similarIdeas(userId: string, ideaId: string) {
    const viewer = await requireUser(userId);
    const [source] = await db.select({ id: ideas.id, embedding: ideas.embedding }).from(ideas).where(eq(ideas.id, ideaId));
    if (!source) throw new CampusError(404, "Idea not found");
    if (!source.embedding) return { ideas: [] };
    const literal = `[${source.embedding.join(",")}]`;
    const rows = await db.select().from(ideas).where(and(
        isNotNull(ideas.pitch),
        isNull(ideas.hiddenAt),
        isNotNull(ideas.embedding),
        ne(ideas.id, ideaId),
        ideaCampusVisible(campusOf(viewer)),
    )).orderBy(sql`${ideas.embedding} <=> ${literal}::extensions.vector`).limit(4);
    const labels = interestLabelVectors();
    const saved = await savedSet(viewer.id, "idea", rows.map((row) => row.id));
    return {
        ideas: rows
            .map((row) => ({ row, sim: cosine(source.embedding, row.embedding) }))
            .filter(({ sim }) => sim >= 0.3)
            .map(({ row }) => ({ ...publicIdea(row, saved.has(row.id), null, 0, { viewerId: viewer.id, viewerCampus: campusOf(viewer) }), topics: topicsFor(row, labels) })),
    };
}

// ---------- signals in ----------

export async function recordInteraction(userId: string, input: { ideaId: string; kind: string; dwellMs?: number }) {
    await requireUser(userId);
    const [idea] = await db.select({ id: ideas.id }).from(ideas).where(eq(ideas.id, input.ideaId));
    if (!idea) throw new CampusError(404, "Idea not found");

    if (input.kind === "undo_not_interested") {
        await db.delete(interactions).where(and(
            eq(interactions.userId, userId),
            eq(interactions.ideaId, input.ideaId),
            eq(interactions.kind, "not_interested"),
        ));
        return { ok: true };
    }
    if (input.kind === "view" || input.kind === "share" || input.kind === "not_interested") {
        const since = input.kind === "not_interested" ? new Date(0) : new Date(Date.now() - VIEW_DEDUP_MINUTES * 60_000);
        const [existing] = await db.select({ id: interactions.id }).from(interactions).where(and(
            eq(interactions.userId, userId),
            eq(interactions.ideaId, input.ideaId),
            eq(interactions.kind, input.kind),
            gt(interactions.createdAt, since),
        )).limit(1);
        if (existing) return { ok: true };
    }
    if (input.kind === "dwell" && (input.dwellMs ?? 0) < 3_000) return { ok: true };
    await db.insert(interactions).values({
        userId,
        ideaId: input.ideaId,
        kind: input.kind,
        dwellMs: input.kind === "dwell" ? Math.min(input.dwellMs ?? 0, 600_000) : null,
    });
    return { ok: true };
}

export async function addInterest(userId: string, label: string) {
    const viewer = await requireUser(userId);
    if (!INTEREST_TILES.includes(label)) throw new CampusError(400, "Pick an interest from the list");
    const current = viewer.interests ?? [];
    if (current.includes(label)) return { interests: current };
    if (current.length >= 20) throw new CampusError(400, "Twenty interests is the cap");
    const next = [...current, label];
    await db.update(users).set({ interests: next, profileEmbedding: null }).where(eq(users.id, viewer.id));
    nudgeEmbeddings();
    return { interests: next };
}
