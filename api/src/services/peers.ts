import { and, db, desc, eq, ideas, isNotNull, isNull, ne, sql, users } from "../../../packages/db/index";
import { interestLabelVectors } from "../queues/embeddingQueue";
import { CampusError, inviteMember, requireUser } from "./campusService";

/**
 * "Students like you" and circles.
 *
 * match = 0.40 profile + 0.15 branch + 0.12 semester + 0.05 university + 0.12 interests + 0.06 skills + 0.10 co-engaged
 *
 * profile     cosine between profile embeddings (all-MiniLM-L6-v2 over headline, interests, skills,
 *             two-week line, projects), spread over 0..1 across the candidates.
 * semester    1 for the same semester, 0.5 for one apart.
 * interests   Jaccard overlap of picked interests. skills: shared skills, three or more counts fully.
 * co-engaged  saved, offered on, or read the same ideas in the last 90 days.
 *
 * Circles are spherical k-means over every profile embedding. k is picked by silhouette score
 * (2 up to 12), and each circle is named after the interests its members pick more than the
 * rest of campus. They are recomputed at most every ten minutes.
 *
 * Only public profile fields leave this file. CGPA, certifications, projects and experience stay
 * on the offer screen, where only the idea owner sees them.
 */

type Vec = number[];

const CANDIDATES = 1000;
const RANKED = 100;
const PAGE = 20;
const CIRCLE_TTL_MS = 10 * 60_000;
const MIN_FOR_CIRCLES = 8;
const MAX_CIRCLES = 12;
const KMEANS_ITERATIONS = 25;
const KMEANS_RESTARTS = 8;
const SILHOUETTE_SAMPLE = 600;
const PROFILE_WEIGHT_IN_CIRCLES = 0.5;

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

function jaccard(a: string[], b: string[]) {
    if (!a.length || !b.length) return 0;
    const setB = new Set(b);
    const shared = a.filter((item) => setB.has(item)).length;
    return shared / (a.length + b.length - shared);
}

function shared(a: string[], b: string[]) {
    const lowerB = new Set(b.map((item) => item.toLowerCase()));
    return a.filter((item) => lowerB.has(item.toLowerCase()));
}

// ---------- circles ----------

type Circle = { id: number; label: string; topics: string[]; size: number; centroid: Vec };
type CircleState = { at: number; circles: Circle[]; byUser: Map<string, { circle: number; closeness: number }> };

let circleState: CircleState | null = null;
let circleBuild: Promise<CircleState> | null = null;

/** Deterministic PRNG so circles do not reshuffle on every rebuild with the same data. */
function mulberry32(seed: number) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Spherical k-means with k-means++ seeding. Vectors are unit length, so similarity is a dot product. */
function kmeans(points: Vec[], k: number) {
    let best: ReturnType<typeof kmeansOnce> | null = null;
    for (let run = 0; run < KMEANS_RESTARTS; run += 1) {
        const result = kmeansOnce(points, k, 42 + run);
        if (!best || result.cohesion > best.cohesion) best = result;
    }
    return best as ReturnType<typeof kmeansOnce>;
}

function kmeansOnce(points: Vec[], k: number, seed: number) {
    const random = mulberry32(seed);
    const centroids: Vec[] = [points[Math.floor(random() * points.length)]];
    const nearest = points.map((p) => 1 - dot(p, centroids[0]));
    while (centroids.length < k) {
        const total = nearest.reduce((sum, d) => sum + Math.max(0, d) ** 2, 0);
        let target = random() * total;
        let index = 0;
        for (; index < points.length - 1; index += 1) {
            target -= Math.max(0, nearest[index]) ** 2;
            if (target <= 0) break;
        }
        centroids.push(points[index]);
        points.forEach((p, i) => { nearest[i] = Math.min(nearest[i], 1 - dot(p, points[index])); });
    }

    const assignment = new Array<number>(points.length).fill(-1);
    for (let iteration = 0; iteration < KMEANS_ITERATIONS; iteration += 1) {
        let moved = 0;
        points.forEach((p, i) => {
            let best = 0;
            let bestSim = -Infinity;
            centroids.forEach((c, j) => {
                const sim = dot(p, c);
                if (sim > bestSim) { bestSim = sim; best = j; }
            });
            if (assignment[i] !== best) { assignment[i] = best; moved += 1; }
        });
        centroids.forEach((_, j) => {
            const sum = new Array<number>(points[0].length).fill(0);
            let members = 0;
            points.forEach((p, i) => {
                if (assignment[i] !== j) return;
                members += 1;
                for (let d = 0; d < sum.length; d += 1) sum[d] += p[d];
            });
            if (members) centroids[j] = normalize(sum) ?? centroids[j];
        });
        if (!moved) break;
    }
    const cohesion = points.reduce((sum, p, i) => sum + dot(p, centroids[assignment[i]]), 0);
    return { centroids, assignment, cohesion };
}

function nearestCentroid(v: Vec, centroids: Vec[]) {
    let best = 0;
    centroids.forEach((c, j) => { if (dot(v, c) > dot(v, centroids[best])) best = j; });
    return best;
}

/** Mean silhouette on cosine distance, over at most SILHOUETTE_SAMPLE points so it stays cheap. */
function silhouette(points: Vec[], assignment: number[], k: number) {
    const step = Math.max(1, Math.floor(points.length / SILHOUETTE_SAMPLE));
    const sample = points.map((_, i) => i).filter((i) => i % step === 0);
    let total = 0;
    for (const i of sample) {
        const sums = new Array<number>(k).fill(0);
        const counts = new Array<number>(k).fill(0);
        for (const j of sample) {
            if (i === j) continue;
            sums[assignment[j]] += 1 - dot(points[i], points[j]);
            counts[assignment[j]] += 1;
        }
        const own = assignment[i];
        if (!counts[own]) continue;
        const a = sums[own] / counts[own];
        let b = Infinity;
        for (let c = 0; c < k; c += 1) if (c !== own && counts[c]) b = Math.min(b, sums[c] / counts[c]);
        if (Number.isFinite(b)) total += (b - a) / Math.max(a, b);
    }
    return total / sample.length;
}

/**
 * Circle names come from what members picked more often than everyone else (lift over the
 * campus rate), so a circle reads as "IoT & Embedded systems" rather than a generic label.
 * Members with no interests fall back to the interest labels nearest the centroid.
 */
function nameCircle(centroid: Vec, memberInterests: string[][], overall: Map<string, number>, total: number, taken: Set<string>) {
    const counts = new Map<string, number>();
    memberInterests.forEach((list) => list.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1)));
    let topics = [...counts.entries()]
        .filter(([, n]) => n >= Math.min(2, memberInterests.length))
        .map(([label, n]) => ({ label, lift: (n / memberInterests.length) / ((overall.get(label) ?? 1) / total), n }))
        .sort((a, b) => b.n * b.lift - a.n * a.lift)
        .slice(0, 3)
        .map((row) => row.label);
    if (topics.length < 2) {
        const labels = interestLabelVectors();
        const nearest = labels
            ? [...labels.entries()].map(([label, v]) => ({ label, sim: dot(centroid, v) })).sort((a, b) => b.sim - a.sim).map((row) => row.label)
            : [];
        topics = [...new Set([...topics, ...nearest])].slice(0, 3);
    }
    if (!topics.length) return { label: "Students like you", topics };
    let label = topics.slice(0, 2).join(" & ");
    if (taken.has(label)) label = [topics[0], topics[2]].filter(Boolean).join(" & ");
    taken.add(label);
    return { label, topics };
}

/**
 * Short profiles share template sentences ("I can build..."), which pulls every profile vector
 * together. Blending in the mean vector of the picked interest labels keeps circles about topics.
 */
function clusterVector(profile: Vec, interests: string[], labels: Map<string, Vec> | null) {
    const picked = labels ? interests.map((label) => labels.get(label)).filter((v): v is Vec => Boolean(v)) : [];
    if (!picked.length) return profile;
    const sum = profile.map((x) => x * PROFILE_WEIGHT_IN_CIRCLES);
    for (const v of picked) for (let d = 0; d < sum.length; d += 1) sum[d] += v[d] / picked.length;
    return normalize(sum) ?? profile;
}

async function buildCircles(): Promise<CircleState> {
    const rows = await db.select({ id: users.id, embedding: users.profileEmbedding, interests: users.interests }).from(users)
        .where(and(isNotNull(users.profileEmbedding), isNotNull(users.branch)));
    const labels = interestLabelVectors();
    const points = rows.filter((row) => row.embedding?.length).map((row) => ({
        id: row.id,
        v: clusterVector(row.embedding as Vec, row.interests ?? [], labels),
        interests: row.interests ?? [],
    }));
    // Profiles with no picked interests form an easy outlier cluster that wins the silhouette
    // vote, so fit on complete profiles and attach the rest to their nearest centroid.
    const fitted = points.filter((p) => p.interests.length);
    if (fitted.length < MIN_FOR_CIRCLES) return { at: Date.now(), circles: [], byUser: new Map() };

    const vectors = fitted.map((p) => p.v);
    const maxK = Math.max(2, Math.min(MAX_CIRCLES, Math.floor(fitted.length / 3)));
    let best = { k: 2, score: -Infinity, ...kmeans(vectors, 2) };
    for (let k = 2; k <= maxK; k += 1) {
        const run = k === 2 ? best : { k, score: -Infinity, ...kmeans(vectors, k) };
        const score = silhouette(vectors, run.assignment, k);
        if (score > best.score) best = { ...run, k, score };
    }
    const { centroids } = best;
    const fittedIndex = new Map(fitted.map((p, i) => [p.id, best.assignment[i]]));
    const assignment = points.map((p) => fittedIndex.get(p.id) ?? nearestCentroid(p.v, centroids));
    console.log(`Circles: k=${best.k} over ${fitted.length} profiles, silhouette ${best.score.toFixed(3)}`);

    const overall = new Map<string, number>();
    points.forEach((p) => p.interests.forEach((label) => overall.set(label, (overall.get(label) ?? 0) + 1)));
    const taken = new Set<string>();
    const circles: Circle[] = centroids.map((centroid, id) => {
        const members = points.filter((_, i) => assignment[i] === id);
        const withInterests = members.map((p) => p.interests).filter((list) => list.length);
        return { id, ...nameCircle(centroid, withInterests, overall, points.length, taken), size: members.length, centroid };
    }).filter((circle) => circle.size > 0);
    const byUser = new Map(points.map((p, i) => [p.id, { circle: assignment[i], closeness: dot(p.v, centroids[assignment[i]]) }]));
    return { at: Date.now(), circles, byUser };
}

/** Circles, rebuilt in the background when stale so a request waits only on the very first build. */
export async function circles(): Promise<CircleState> {
    const stale = !circleState || Date.now() - circleState.at > CIRCLE_TTL_MS;
    if (stale && !circleBuild) {
        circleBuild = buildCircles()
            .then((state) => { circleState = state; return state; })
            .finally(() => { circleBuild = null; });
    }
    if (circleState) return circleState;
    return circleBuild as Promise<CircleState>;
}

/** Users in the viewer's circle, for the cohort signal in the feed. Empty until circles exist. */
export async function circleMates(userId: string) {
    const state = await circles();
    const mine = state.byUser.get(userId);
    if (!mine) return { circle: null as Circle | null, members: [] as string[] };
    const members = [...state.byUser.entries()].filter(([id, row]) => id !== userId && row.circle === mine.circle).map(([id]) => id);
    return { circle: state.circles.find((c) => c.id === mine.circle) ?? null, members };
}

// ---------- students like you ----------

export type PeopleScope = "all" | "campus" | "branch" | "cohort";

function decodeCursor(cursor?: string) {
    if (!cursor) return 0;
    try {
        const offset = Number(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")).o);
        return Number.isInteger(offset) && offset >= 0 && offset < RANKED ? offset : 0;
    } catch {
        return 0;
    }
}

function encodeCursor(offset: number) {
    return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

async function coEngagement(viewerId: string) {
    const result = await db.execute(sql`
        with eng as (
            select user_id, target_id as idea_id from saves where target_type = 'idea' and created_at > now() - interval '90 days'
            union
            select builder_id, idea_id from offers where idea_id is not null and created_at > now() - interval '90 days'
            union
            select user_id, idea_id from interactions where kind = 'dwell' and dwell_ms >= 15000 and created_at > now() - interval '90 days'
        ),
        mine as (select idea_id from eng where user_id = ${viewerId})
        select user_id::text as user_id, count(distinct idea_id)::int as overlap
        from eng where idea_id in (select idea_id from mine) and user_id <> ${viewerId}
        group by user_id
    `);
    return new Map((result.rows as { user_id: string; overlap: number }[]).map((row) => [row.user_id, Number(row.overlap)]));
}

export async function studentsLikeYou(userId: string, scope: PeopleScope, cursor?: string) {
    const viewer = await requireUser(userId);
    const conditions = [ne(users.id, viewer.id), isNotNull(users.branch), isNotNull(users.displayName)];
    const viewerCampus = viewer.emailDomain ?? viewer.email.split("@")[1] ?? "";
    if (scope === "campus") conditions.push(eq(users.emailDomain, viewerCampus));
    if ((scope === "branch" || scope === "cohort") && viewer.branch) conditions.push(eq(users.branch, viewer.branch));
    if (scope === "cohort" && viewer.semester) conditions.push(eq(users.semester, viewer.semester));

    const [candidates, engaged, state, myIdeas] = await Promise.all([
        db.select({
            id: users.id,
            displayName: users.displayName,
            branch: users.branch,
            semester: users.semester,
            degree: users.degree,
            university: users.university,
            showInstitution: users.showInstitution,
            headline: users.headline,
            interests: users.interests,
            skills: users.campusSkills,
            githubLogin: users.githubLogin,
            embedding: users.profileEmbedding,
        }).from(users).where(and(...conditions)).orderBy(desc(users.createdAt)).limit(CANDIDATES),
        coEngagement(viewer.id),
        circles(),
        db.select({ id: ideas.id, title: ideas.title }).from(ideas)
            .where(and(eq(ideas.ownerId, viewer.id), isNotNull(ideas.pitch), isNull(ideas.hiddenAt), eq(ideas.teamStatus, "open"))),
    ]);

    const mine = viewer.profileEmbedding ?? null;
    const sims = candidates.map((c) => (mine && c.embedding ? dot(mine, c.embedding) : null));
    const known = sims.filter((s): s is number => s !== null);
    const min = Math.min(...known);
    const max = Math.max(...known);
    const spread = known.length > 1 && max - min >= 0.05;
    const maxEngaged = Math.max(1, ...engaged.values());
    const myCircle = state.byUser.get(viewer.id)?.circle;
    const circleById = new Map(state.circles.map((c) => [c.id, c]));

    const ranked = candidates.map((c, index) => {
        const raw = sims[index];
        const profile = raw === null ? 0 : spread ? (raw - min) / (max - min) : Math.max(0, raw);
        const sameBranch = Boolean(viewer.branch && c.branch === viewer.branch);
        const semesterGap = viewer.semester && c.semester ? Math.abs(viewer.semester - c.semester) : null;
        const semester = semesterGap === 0 ? 1 : semesterGap === 1 ? 0.5 : 0;
        const sameUniversity = Boolean(viewer.university && c.university === viewer.university);
        const sharedInterests = shared(c.interests ?? [], viewer.interests ?? []);
        const sharedSkills = shared(c.skills ?? [], viewer.campusSkills ?? []);
        const overlap = engaged.get(c.id) ?? 0;
        const coEngaged = Math.log1p(overlap) / Math.log1p(maxEngaged);

        const score = 0.40 * profile + 0.15 * (sameBranch ? 1 : 0) + 0.12 * semester + 0.05 * (sameUniversity ? 1 : 0)
            + 0.12 * jaccard(c.interests ?? [], viewer.interests ?? []) + 0.06 * Math.min(1, sharedSkills.length / 3) + 0.10 * coEngaged;

        const reasons: string[] = [];
        if (sameBranch && semesterGap === 0) reasons.push(`${c.branch}, semester ${c.semester}, like you`);
        else if (sameBranch) reasons.push(`Also ${c.branch}`);
        if (sharedInterests.length) reasons.push(`Both into ${sharedInterests.slice(0, 2).join(" and ")}`);
        if (overlap >= 2) reasons.push(`Saved or joined ${overlap} of the same ideas`);
        else if (overlap === 1) reasons.push("Engaged with an idea you did");
        if (sharedSkills.length) reasons.push(`Also knows ${sharedSkills.slice(0, 2).join(" and ")}`);
        if (raw !== null && profile > 0.8 && reasons.length < 2) reasons.push("Very similar profile");

        const circleId = state.byUser.get(c.id)?.circle;
        const circle = circleId === undefined ? null : circleById.get(circleId) ?? null;
        if (circle && circleId === myCircle && reasons.length < 3) reasons.push(`In your circle: ${circle.label}`);

        return {
            score,
            person: {
                id: c.id,
                displayName: c.displayName,
                branch: c.branch,
                semester: c.semester,
                degree: c.degree,
                university: c.showInstitution ? c.university : null,
                headline: c.headline,
                interests: (c.interests ?? []).slice(0, 5),
                skills: (c.skills ?? []).slice(0, 6),
                githubLogin: c.githubLogin,
                circle: circle ? { id: circle.id, label: circle.label } : null,
                sharedInterests,
                sharedSkills,
                match: Math.round(Math.min(1, score / 0.85) * 100),
                reasons: reasons.slice(0, 3),
            },
        };
    }).sort((a, b) => b.score - a.score).slice(0, RANKED);

    const offset = decodeCursor(cursor);
    const myCircleInfo = myCircle === undefined ? null : circleById.get(myCircle) ?? null;
    return {
        people: ranked.slice(offset, offset + PAGE).map((row) => row.person),
        nextCursor: offset + PAGE < ranked.length ? encodeCursor(offset + PAGE) : null,
        circle: myCircleInfo ? { id: myCircleInfo.id, label: myCircleInfo.label, topics: myCircleInfo.topics, size: myCircleInfo.size } : null,
        circles: state.circles.map((c) => ({ id: c.id, label: c.label, size: c.size })),
        myOpenIdeas: myIdeas,
        usingModel: Boolean(mine && known.length),
    };
}

/** Invite a student to one of your open ideas without either side seeing the other's email. */
export async function invitePerson(userId: string, personId: string, ideaId: string) {
    if (personId === userId) throw new CampusError(400, "You are already on your own idea");
    const [person] = await db.select({ email: users.email }).from(users).where(eq(users.id, personId));
    if (!person) throw new CampusError(404, "Student not found");
    await inviteMember(userId, ideaId, person.email);
    return { invited: true };
}

// ---------- what students in a branch pick ----------

let popularCache = new Map<string, { at: number; value: { interests: string[]; skills: string[]; students: number } }>();
const MIN_PICKS = 2;

/**
 * Interest and skill labels ordered by how many students in the branch picked them. Labels picked
 * by fewer than two students are left out so counts never point at one person.
 */
export async function branchPopularity(branch: string) {
    const hit = popularCache.get(branch);
    if (hit && Date.now() - hit.at < CIRCLE_TTL_MS) return hit.value;
    const result = await db.execute(sql`
        with b as (select interests, campus_skills from users where branch = ${branch})
        select 'interest' as kind, value as label, count(*)::int as n from b, jsonb_array_elements_text(b.interests) as value group by value
        union all
        select 'skill', value, count(*)::int from b, jsonb_array_elements_text(b.campus_skills) as value group by value
        union all
        select 'students', '', count(*)::int from b
    `);
    const rows = result.rows as { kind: string; label: string; n: number }[];
    const pick = (kind: string) => rows.filter((r) => r.kind === kind && Number(r.n) >= MIN_PICKS)
        .sort((a, b) => Number(b.n) - Number(a.n))
        .map((r) => r.label);
    const value = {
        interests: pick("interest"),
        skills: pick("skill"),
        students: Number(rows.find((r) => r.kind === "students")?.n ?? 0),
    };
    if (popularCache.size > 20) popularCache = new Map();
    popularCache.set(branch, { at: Date.now(), value });
    return value;
}
