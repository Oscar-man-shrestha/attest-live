import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
    and,
    approaches,
    asc,
    count,
    desc,
    eq,
    inArray,
    isNotNull,
    isNull,
    lt,
    gt,
    ne,
    or,
    sql,
    checkIns,
    db,
    domains,
    events,
    groups,
    groupMembers,
    ideaImages,
    ideas,
    notices,
    offers,
    problems,
    proofPages,
    reports,
    revisions,
    saves,
    sprintInvites,
    sprints,
    tasks,
    teamMembers,
    tryouts,
    users,
    academicVerifications,
    integrityFlags,
} from "../../../packages/db/index";
import {
    detectAcademicRequest,
    emailDomain,
    guessFromRollNumber,
    INTEREST_TILES,
    isAcademicDomain,
    isAcademicEmail,
    isPaidDeal,
    toMinor,
    universityForEmail,
    VOLUNTEER_SENTENCE,
    suggestBranch,
    type CampusProfileInput,
    type CreateProblemInput,
    type CreateSprintIdeaInput,
} from "../../../packages/types";
import { storageUploadErrorMessage, supabase, supabaseBucket } from "./supabaseClient";
import { deliverMail, enqueueMail, MailDeliveryError } from "./mailQueue";
import { cosineSimilarity, embedTextsSafe, ideaText, nudgeEmbeddings } from "../queues/embeddingQueue";
import { nudgeGithubCheck } from "../queues/documentQueue";
import { checkUserDay7Notices } from "../queues/day7Queue";
import { jwtSecret } from "../config/jwtSecret";


export class CampusError extends Error {
    status: number;
    extra?: Record<string, unknown>;
    constructor(status: number, message: string, extra?: Record<string, unknown>) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

type UserRow = typeof users.$inferSelect;
type IdeaRow = typeof ideas.$inferSelect;
type ProblemRow = typeof problems.$inferSelect;

type Proposal = {
    title: string;
    pitch: string;
    audience: string;
    gap: string;
    ships: string;
    helpNeeded: string[];
    hideName: boolean;
    compensationSentence?: string;
    isSmall: boolean;
    hourCap?: number | null;
    stage: string;
    visibility?: "minimal" | "standard" | "open";
    blurb?: string;
};

const otpCodes = new Map<string, { code: string; expires: number; attempts?: number }>();
/** Wrong guesses allowed per code before it is thrown away (stops brute-forcing the 6 digits). */
const OTP_MAX_ATTEMPTS = 5;
/** In-memory OTP request windows: email → timestamps of recent sends. */
const otpRequestLog = new Map<string, number[]>();
const OTP_MIN_INTERVAL_MS = 60_000;
const OTP_MAX_PER_HOUR = 5;
const OFFERS_PER_HOUR = 8;
const IDEA_CREATE_COOLDOWN_MS = 30 * 60 * 1000;
const ideaCreateAt = new Map<string, number>();

export function toPublicUser(user: UserRow) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePicUrl: user.profilePicUrl,
        socials: user.socials,
        projectLinks: user.projectLinks,
        createdAt: user.createdAt,
        displayName: user.displayName,
        branch: user.branch,
        semester: user.semester,
        campusSkills: user.campusSkills ?? [],
        interests: user.interests ?? [],
        twoWeekLine: user.twoWeekLine,
        hoursPerWeek: user.hoursPerWeek,
        availableDays: user.availableDays ?? [],
        githubUrl: user.githubUrl,
        siteUrl: user.siteUrl,
        linkedinUrl: user.linkedinUrl,
        university: user.university,
        degree: user.degree,
        graduationYear: user.graduationYear,
        cgpa: user.cgpa === null ? null : Number(user.cgpa),
        headline: user.headline,
        githubLogin: user.githubLogin,
        githubStats: user.githubStats,
        projects: user.projects ?? [],
        certifications: user.certifications ?? [],
        experience: user.experience ?? [],
        guess: guessFromRollNumber(user.email),
        isAdmin: user.isAdmin,
        profileComplete: profileComplete(user),
        handle: user.username,
        country: user.country,
        city: user.city,
        showInstitution: user.showInstitution,
        isAdult: Boolean(user.adultConfirmedAt),
        hasCampus: hasCampus(user),
        verifiedStudent: hasCampus(user),
        tipUrl: user.tipUrl,
        suspended: Boolean(user.suspendedAt),
        suspendedReason: user.suspendedAt ? user.suspendedReason : null,
        appealed: Boolean(user.appealedAt),
    };
}

/** Campus = same verified email domain. */
/**
 * A person's campus: their university email domain. People who signed in with a personal address have
 * no campus; they get a private sentinel (`~<id>`) that never equals anyone else's, so no campus filter
 * ever groups them (for example, everyone on gmail.com).
 */
export function campusOf(user: Pick<UserRow, "id" | "email" | "emailDomain">) {
    const domain = user.emailDomain ?? emailDomain(user.email);
    return isAcademicDomain(domain) ? domain : `~${user.id}`;
}
export function hasCampus(user: Pick<UserRow, "id" | "email" | "emailDomain">) {
    return !campusOf(user).startsWith("~");
}
/** Value to store on a post: the university domain, or null when the poster has no campus. */
export function campusDomainOrNull(user: Pick<UserRow, "id" | "email" | "emailDomain">) {
    return hasCampus(user) ? campusOf(user) : null;
}

/** SQL guard: campus-only ideas are visible only to their own campus (RULES 17a). */
export function ideaCampusVisible(viewerCampus: string) {
    return or(eq(ideas.campusOnly, false), eq(ideas.campusDomain, viewerCampus))!;
}

function assertIdeaCampus(idea: IdeaRow, viewer: UserRow) {
    if (!idea.campusOnly || idea.ownerId === viewer.id || viewer.isAdmin) return;
    if (idea.campusDomain !== campusOf(viewer)) throw new CampusError(404, "Idea not found");
}

/** What other users may see of someone's institution (RULES 6). */
export function institutionFor(user: Pick<UserRow, "university" | "showInstitution">) {
    return user.showInstitution ? user.university : null;
}

/** Inline, cheap keyword check. Adds a pending integrity flag for admin review; never blocks the post. */
export async function flagIfAcademic(targetType: "idea" | "problem" | "engagement" | "gig", targetId: string, text: string) {
    const hit = detectAcademicRequest(text);
    if (!hit) return null;
    await db.insert(integrityFlags).values({ targetType, targetId, source: "keyword", label: "graded_coursework", matched: hit.matched });
    return hit;
}

function profileComplete(user: UserRow) {
    return Boolean(
        user.displayName?.trim() &&
        user.branch &&
        user.semester &&
        user.twoWeekLine &&
        user.twoWeekLine.trim().length >= 8
    );
}

function assertOwnWords(label: string, value: string, min: number) {
    const text = value.trim();
    if (text.length < min) throw new CampusError(400, `${label} is too short`);
    if (/^https?:\/\/\S+$/i.test(text)) throw new CampusError(400, `${label} cannot be only a link`);
    const sentences = text.split(/[.!?]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (sentences.length >= 2 && new Set(sentences).size === 1) {
        throw new CampusError(400, `${label} repeats the same sentence`);
    }
}

function sameSentence(a: string, b: string) {
    const norm = (value: string) => value.trim().toLowerCase().replace(/[.!?\s]+$/g, "").replace(/\s+/g, " ");
    return norm(a) === norm(b);
}

function assertDistinctBrief(pitch: string, gap: string, ships: string) {
    if (sameSentence(pitch, gap) || sameSentence(pitch, ships) || sameSentence(gap, ships)) {
        throw new CampusError(400, "The pitch, the gap, and what will exist have to be different sentences");
    }
}

function assertCompensation(sentence: string) {
    if (/^(pay|equity|academic credit)\.?$/i.test(sentence.trim())) {
        throw new CampusError(400, "Pay, equity, and academic credit need a full sentence, not a badge");
    }
}

export async function requireUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new CampusError(401, "Unauthorized");
    return user;
}

async function requireReady(userId: string) {
    const user = await requireUser(userId);
    if (!profileComplete(user)) {
        throw new CampusError(400, "Finish your profile before posting");
    }
    return user;
}

/** Team size including the owner (was 4; raised to 6 on 2026-11-15). */
const TEAM_MAX = 6;
const MAX_COLLABORATORS = TEAM_MAX - 1;

/** Sprints are rolling 14-day build seasons: when one ends, the next starts, so the board never closes. */
async function ensureSprint() {
    const [existing] = await db.select().from(sprints).orderBy(desc(sprints.createdAt)).limit(1);
    if (existing && new Date(existing.endsAt) > new Date()) return existing;
    const endsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [created] = await db.insert(sprints).values({ endsAt }).returning();
    return created;
}

function day7Of(endsAt: Date) {
    return new Date(new Date(endsAt).getTime() - 7 * 24 * 60 * 60 * 1000);
}

const DAY7_EXIT = "missed the day-7 check-in";

function sameRole(left: string, right: string) {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function withRoleOpen(roles: string[], role: string | null | undefined) {
    const label = (role ?? "").trim();
    if (!label || roles.some((item) => sameRole(item, label))) return roles;
    return [...roles, label];
}

function rolesHeldBy(taskRows: { assigneeId: string | null; role: string | null }[], userId: string) {
    const labels: string[] = [];
    for (const task of taskRows) {
        const role = task.role?.trim();
        if (task.assigneeId !== userId || !role || sameRole(role, "Tryout")) continue;
        if (!labels.some((item) => sameRole(item, role))) labels.push(role);
    }
    return labels;
}

async function campusDomainId() {
    const [named] = await db.select().from(domains).where(eq(domains.name, "Campus"));
    if (named) return named.id;
    const [anyDomain] = await db.select().from(domains).limit(1);
    if (anyDomain) return anyDomain.id;
    const [created] = await db.insert(domains).values({ name: "Campus" }).returning();
    return created.id;
}

async function logEvent(kind: string, actorId: string | null, targetType: string, targetId: string, payload?: unknown) {
    await db.insert(events).values({ kind, actorId, targetType, targetId, payload: payload ?? null });
}

async function notify(userId: string, email: string, subject: string, body: string, targetId?: string) {
    await db.insert(notices).values({ userId, body, targetId: targetId ?? null });
    enqueueMail({ to: email, subject, text: body });
}

function authorLabel(hideName: boolean, name: string | null, branch: string | null, semester: number | null) {
    return {
        authorName: hideName ? "" : (name ?? ""),
        authorBranch: branch,
        authorSemester: semester,
    };
}

function encodeCursor(date: Date, id: string) {
    return Buffer.from(`${new Date(date).toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor?: string) {
    if (!cursor) return null;
    try {
        const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
        if (!iso || !id || Number.isNaN(new Date(iso).getTime())) return null;
        return { at: new Date(iso), id };
    } catch {
        return null;
    }
}

async function countSprintIdeas(userId: string, sprintId: string) {
    const [row] = await db.select({ c: count() }).from(ideas).where(and(
        eq(ideas.ownerId, userId),
        eq(ideas.sprintId, sprintId),
        isNull(ideas.duplicateOfId),
        isNotNull(ideas.pitch),
    ));
    return Number(row?.c ?? 0);
}

async function countSprintProblems(userId: string, sprintId: string) {
    const [row] = await db.select({ c: count() }).from(problems).where(and(
        eq(problems.authorId, userId),
        eq(problems.sprintId, sprintId),
    ));
    return Number(row?.c ?? 0);
}

async function activeCollaborators(ideaId: string) {
    const [row] = await db.select({ c: count() }).from(teamMembers).where(and(
        eq(teamMembers.ideaId, ideaId),
        isNull(teamMembers.leftAt),
    ));
    return Number(row?.c ?? 0);
}

async function onTeam(idea: IdeaRow, userId: string) {
    if (idea.ownerId === userId) return true;
    const [member] = await db.select().from(teamMembers).where(and(
        eq(teamMembers.ideaId, idea.id),
        eq(teamMembers.userId, userId),
        isNull(teamMembers.leftAt),
    ));
    return Boolean(member);
}

async function mustIdea(id: string) {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    if (!idea || !idea.pitch) throw new CampusError(404, "Idea not found");
    return idea;
}

async function mustProblem(id: string) {
    const [problem] = await db.select().from(problems).where(eq(problems.id, id));
    if (!problem) throw new CampusError(404, "Problem not found");
    return problem;
}

function visibleOrThrow(hiddenAt: Date | null, viewer: UserRow, authorId: string) {
    if (!hiddenAt) return;
    if (viewer.isAdmin || viewer.id === authorId) return;
    throw new CampusError(404, "Idea not found");
}

export async function savedSet(userId: string, targetType: "idea" | "problem", ids: string[]) {
    if (ids.length === 0) return new Set<string>();
    const rows = await db.select().from(saves).where(and(
        eq(saves.userId, userId),
        eq(saves.targetType, targetType),
        inArray(saves.targetId, ids),
    ));
    return new Set(rows.map((row) => row.targetId));
}

export function publicIdea(
    idea: IdeaRow,
    saved: boolean,
    problemTitle?: string | null,
    forkCount = 0,
    opts?: { viewerIsMember?: boolean; viewerId?: string; viewerCampus?: string },
) {
    const visibility = (idea.visibility === "minimal" || idea.visibility === "open" ? idea.visibility : "standard") as "minimal" | "standard" | "open";
    const member = Boolean(opts?.viewerIsMember);
    const showBrief = member || visibility === "standard" || visibility === "open";
    const blurb = (idea.blurb?.trim() || (idea.pitch ? idea.pitch.trim().slice(0, 160) : "")) || null;
    return {
        id: idea.id,
        title: idea.title,
        visibility,
        blurb,
        pitch: showBrief ? idea.pitch : null,
        audience: showBrief ? idea.audience : null,
        gap: showBrief ? idea.gap : null,
        ships: showBrief ? idea.ships : null,
        briefLocked: !showBrief,
        stage: idea.stage,
        teamStatus: idea.teamStatus,
        helpNeeded: idea.helpNeeded ?? [],
        isSmall: idea.isSmall,
        hourCap: idea.hourCap,
        compensationSentence: showBrief ? idea.compensationSentence : null,
        hideName: idea.hideName,
        authorName: idea.hideName ? "" : (idea.authorName ?? ""),
        authorBranch: idea.authorBranch,
        authorSemester: idea.authorSemester,
        problemId: idea.problemId,
        problemTitle: problemTitle ?? null,
        duplicateOfId: idea.duplicateOfId,
        forkedFromId: idea.forkedFromId,
        forkCount,
        createdAt: idea.createdAt,
        ownerId: idea.ownerId,
        hidden: Boolean(idea.hiddenAt),
        saved,
        seatsOpen: idea.teamStatus === "open",
        teamMax: TEAM_MAX,
        dealType: idea.dealType,
        currency: idea.currency,
        budgetMinor: idea.budgetMinor,
        licence: idea.licence,
        campusOnly: idea.campusOnly,
        sameCampus: Boolean(opts?.viewerCampus && idea.campusDomain && idea.campusDomain === opts.viewerCampus),
    };
}

async function forkCountsFor(ids: string[]) {
    const out = new Map<string, number>();
    if (ids.length === 0) return out;
    ids.forEach((id) => out.set(id, 0));
    const rows = await db.execute(sql`
        select forked_from_id::text as id, count(*)::int as n
        from ideas
        where forked_from_id = any(${`{${ids.join(",")}}`}::uuid[])
        group by forked_from_id`);
    for (const row of rows.rows as { id: string; n: number }[]) {
        out.set(row.id, Number(row.n));
    }
    return out;
}

/** Attach live fork counts to idea cards (list / feed / profile). */
export async function withForkCounts<T extends { id: string }>(list: T[]) {
    const forks = await forkCountsFor(list.map((idea) => idea.id));
    return list.map((idea) => ({ ...idea, forkCount: forks.get(idea.id) ?? 0 }));
}

function publicProblem(problem: ProblemRow, saved: boolean, ideaId: string | null, sunk: boolean, viewerId: string, viewerCampus?: string) {
    return {
        id: problem.id,
        title: problem.title,
        whatHappens: problem.whatHappens,
        whoFeels: problem.whoFeels,
        fixWouldChange: problem.fixWouldChange,
        source: problem.source,
        hideName: problem.hideName,
        authorName: problem.hideName ? "" : (problem.authorName ?? ""),
        authorBranch: problem.authorBranch,
        authorSemester: problem.authorSemester,
        createdAt: problem.createdAt,
        authorId: problem.hideName && viewerId !== problem.authorId ? null : problem.authorId,
        ideaId,
        hasIdea: Boolean(ideaId),
        needsFreshLine: sunk,
        freshLine: problem.freshLine,
        hidden: Boolean(problem.hiddenAt),
        saved,
        sameCampus: Boolean(viewerCampus && problem.campusDomain && problem.campusDomain === viewerCampus),
    };
}

async function assertNoDuplicate(title: string, pitch: string, ignoreId?: string) {
    const rows = await db.select({ id: ideas.id, title: ideas.title, pitch: ideas.pitch }).from(ideas).where(and(
        isNotNull(ideas.pitch),
        isNull(ideas.duplicateOfId),
    ));
    const hit = rows.find((row) => row.id !== ignoreId && (
        row.title.trim().toLowerCase() === title.trim().toLowerCase() ||
        (row.pitch ?? "").trim().toLowerCase() === pitch.trim().toLowerCase()
    ));
    if (hit) throw new CampusError(409, "That title or pitch is already on the board", { existingId: hit.id });
}

function checkBrief(pitch: string, gap: string, ships: string, compensation: string) {
    assertOwnWords("Pitch", pitch, 40);
    assertOwnWords("What will exist", ships, 40);
    assertOwnWords("Gap", gap, 12);
    assertDistinctBrief(pitch, gap, ships);
    assertCompensation(compensation);
}

async function insertIdeaRecord(owner: UserRow, fields: {
    title: string;
    pitch: string;
    audience: string;
    gap: string;
    ships: string;
    helpNeeded: string[];
    stage: string;
    isSmall: boolean;
    hourCap?: number | null;
    compensationSentence: string;
    hideName: boolean;
    visibility?: "minimal" | "standard" | "open";
    blurb?: string | null;
    problemId?: string | null;
    duplicateOfId?: string | null;
    forkedFromId?: string | null;
    sprintId: string;
    dealType?: string;
    currency?: string | null;
    budgetMinor?: number | null;
    licence?: string | null;
    notAcademicAttestedAt?: Date | null;
    campusOnly?: boolean;
}) {
    const domainId = await campusDomainId();
    const snap = authorLabel(fields.hideName, owner.displayName, owner.branch, owner.semester);
    const visibility = fields.visibility ?? "standard";
    const blurb = (fields.blurb?.trim() || fields.pitch.trim().slice(0, 160)).slice(0, 160);
    const [idea] = await db.insert(ideas).values({
        ownerId: owner.id,
        title: fields.title,
        description: fields.pitch,
        domainId,
        accessType: "open_open",
        status: "open",
        pitch: fields.pitch,
        audience: fields.audience,
        gap: fields.gap,
        ships: fields.ships,
        stage: fields.stage,
        teamStatus: "open",
        helpNeeded: fields.helpNeeded,
        isSmall: fields.isSmall,
        hourCap: fields.isSmall ? fields.hourCap ?? null : null,
        compensationSentence: fields.compensationSentence,
        hideName: fields.hideName,
        authorName: snap.authorName,
        authorBranch: snap.authorBranch,
        authorSemester: snap.authorSemester,
        problemId: fields.problemId ?? null,
        duplicateOfId: fields.duplicateOfId ?? null,
        forkedFromId: fields.forkedFromId ?? null,
        sprintId: fields.sprintId,
        visibility,
        blurb,
        dealType: fields.dealType ?? "credit_only",
        currency: fields.currency ?? null,
        budgetMinor: fields.budgetMinor ?? null,
        licence: fields.licence ?? null,
        notAcademicAttestedAt: fields.notAcademicAttestedAt ?? null,
        campusDomain: campusDomainOrNull(owner),
        campusOnly: Boolean(fields.campusOnly) && hasCampus(owner),
    }).returning();
    const [group] = await db.insert(groups).values({ ideaId: idea.id }).returning();
    await db.insert(groupMembers).values({ groupId: group.id, userId: owner.id });
    nudgeEmbeddings();
    return idea;
}

function localTestLogin() {
    const email = process.env.ATTEST_TEST_LOGIN_EMAIL?.trim().toLowerCase();
    const code = process.env.ATTEST_TEST_LOGIN_CODE?.trim();
    if (process.env.NODE_ENV === "production" || !email || !code) return null;
    return { email, code };
}

function assertOtpRateLimit(email: string) {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const recent = (otpRequestLog.get(email) ?? []).filter((t) => t > hourAgo);
    if (recent.length > 0 && now - recent[recent.length - 1]! < OTP_MIN_INTERVAL_MS) {
        throw new CampusError(429, "Wait a minute before requesting another code");
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
        throw new CampusError(429, "Too many login codes this hour. Try again later.");
    }
    recent.push(now);
    otpRequestLog.set(email, recent);
}

export async function requestCampusCode(email: string) {
    const normalized = email.trim().toLowerCase();
    assertOtpRateLimit(normalized);
    const testLogin = localTestLogin();
    if (testLogin && testLogin.email === normalized) {
        otpCodes.set(normalized, { code: testLogin.code, expires: Date.now() + 10 * 60 * 1000 });
        return { sent: true };
    }
    const code = String(crypto.randomInt(100000, 999999));
    try {
        await deliverMail({
            to: normalized,
            subject: "Your Attest login code",
            text: `Your Attest code is ${code}. It expires in 10 minutes.`,
        });
    } catch (error) {
        const message = error instanceof MailDeliveryError
            ? error.message
            : "The login code could not be sent. Try again in a moment.";
        throw new CampusError(503, message);
    }
    otpCodes.set(normalized, { code, expires: Date.now() + 10 * 60 * 1000 });
    return { sent: true };
}

export async function verifyCampusCode(email: string, code: string) {
    const normalized = email.trim().toLowerCase();
    const stored = otpCodes.get(normalized);
    if (!stored || stored.expires < Date.now()) {
        otpCodes.delete(normalized);
        throw new CampusError(401, "That code is wrong or expired");
    }
    if (stored.code !== code.trim()) {
        stored.attempts = (stored.attempts ?? 0) + 1;
        if (stored.attempts >= OTP_MAX_ATTEMPTS) {
            otpCodes.delete(normalized);
            throw new CampusError(429, "Too many wrong codes. Request a new one.");
        }
        throw new CampusError(401, "That code is wrong or expired");
    }

    otpCodes.delete(normalized);
    return signInCampusEmail(normalized);
}

/** New accounts get a random handle so a roll number or real name is never the public identity. */
async function freshHandle() {
    const words = ["builder", "maker", "tinker", "forge", "spark", "circuit", "pixel", "kernel", "rivet", "signal"];
    for (let n = 0; n < 8; n += 1) {
        const handle = `${words[crypto.randomInt(words.length)]}_${crypto.randomInt(1000, 99999)}`;
        const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, handle));
        if (!taken) return handle;
    }
    return `builder_${crypto.randomBytes(5).toString("hex")}`;
}

async function recordVerification(userId: string, email: string, method: "otp" | "microsoft" | "google") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await db.insert(academicVerifications).values({ userId, emailDomain: emailDomain(email), method, verifiedAt: now, expiresAt })
        .onConflictDoUpdate({
            target: [academicVerifications.userId, academicVerifications.emailDomain],
            set: { method, verifiedAt: now, expiresAt },
        });
}

export async function signInCampusEmail(email: string, fullName?: string | null, method: "otp" | "microsoft" | "google" = "otp") {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new CampusError(400, "Enter a valid email");
    const academic = isAcademicEmail(normalized);
    const university = universityForEmail(normalized);
    const guess = guessFromRollNumber(normalized);
    const cleanName = fullName?.trim().replace(/\s+/g, " ").slice(0, 80) || null;

    let [user] = await db.select().from(users).where(eq(users.email, normalized));
    if (user) {
        const fill: Partial<typeof users.$inferInsert> = {};
        if (!user.university && university) fill.university = university;
        if (!user.emailDomain && academic) fill.emailDomain = emailDomain(normalized);
        if (!user.displayName && cleanName) fill.displayName = cleanName;
        if (!user.degree && guess.degree) fill.degree = guess.degree;
        if (!user.graduationYear && guess.graduationYear) fill.graduationYear = guess.graduationYear;
        if (Object.keys(fill).length) {
            [user] = await db.update(users).set(fill).where(eq(users.id, user.id)).returning();
        }
    } else {
        const username = await freshHandle();
        const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
        const [created] = await db.insert(users).values({
            username,
            email: normalized,
            emailDomain: academic ? emailDomain(normalized) : null,
            passwordHash,
            displayName: cleanName,
            university,
            branch: guess.branch,
            semester: guess.semester,
            degree: guess.degree,
            graduationYear: guess.graduationYear,
        }).returning();
        user = created;
    }
    if (academic) await recordVerification(user.id, normalized, method);

    const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email },
        jwtSecret(),
        { expiresIn: "7d" }
    );
    return { token, user: toPublicUser(user), suggestedBranch: suggestBranch(normalized), guess };
}

export async function saveProfile(userId: string, input: CampusProfileInput) {
    const user = await requireUser(userId);
    const allowedInterests = new Set<string>([...INTEREST_TILES, ...(user.interests ?? [])]);
    if (input.interests.some((tile) => !allowedInterests.has(tile))) {
        throw new CampusError(400, "Pick interests from the tiles");
    }
    const skills = [...new Set(input.skills.map((skill) => skill.trim()).filter(Boolean))];
    if (skills.length > 8) throw new CampusError(400, "Eight skills is the cap");
    const githubChanged = (input.githubUrl || null) !== user.githubUrl;
    const [updated] = await db.update(users).set({
        displayName: input.displayName.trim(),
        branch: input.branch.trim(),
        semester: input.semester,
        country: input.country === undefined ? user.country : (input.country?.trim() || null),
        city: input.city === undefined ? user.city : (input.city?.trim() || null),
        showInstitution: input.showInstitution ?? user.showInstitution,
        campusSkills: skills,
        interests: input.interests,
        twoWeekLine: input.twoWeekLine.trim(),
        profileEmbedding: null,
        hoursPerWeek: input.hoursPerWeek ?? null,
        availableDays: input.availableDays ?? [],
        githubUrl: input.githubUrl ? input.githubUrl : null,
        siteUrl: input.siteUrl ? input.siteUrl : null,
        linkedinUrl: input.linkedinUrl ? input.linkedinUrl : null,
        university: user.university ?? universityForEmail(user.email),
        degree: input.degree?.trim() || null,
        graduationYear: input.graduationYear ?? null,
        cgpa: input.cgpa === null || input.cgpa === undefined ? null : input.cgpa.toFixed(2),
        headline: input.headline?.trim() || null,
        projects: (input.projects ?? []).map(({ url, ...rest }) => ({ ...rest, ...(url ? { url } : {}) })),
        certifications: (input.certifications ?? []).map(({ url, year, ...rest }) => ({ ...rest, ...(url ? { url } : {}), ...(year ? { year } : {}) })),
        experience: input.experience ?? [],
        profilePicUrl: input.profilePicUrl ? input.profilePicUrl : user.profilePicUrl,
        coverUrl: input.coverUrl ? input.coverUrl : null,
        currentlyWorkingOn: input.currentlyWorkingOn?.trim() || null,
        ...(githubChanged ? { githubLogin: null, githubStats: null } : {}),
    }).where(eq(users.id, userId)).returning();
    if (githubChanged && updated.githubUrl) nudgeGithubCheck();
    return { user: toPublicUser(updated) };
}

export async function listIdeas(userId: string, query: { branch?: string; semester?: string; q?: string; cursor?: string; bucket?: string; campus?: string }) {
    const viewer = await requireUser(userId);
    const viewerCampus = campusOf(viewer);
    const bucket = query.bucket === "shipped" ? "shipped" : "active";
    const filters = [
        isNotNull(ideas.pitch),
        isNull(ideas.hiddenAt),
        bucket === "shipped" ? eq(ideas.teamStatus, "shipped") : ne(ideas.teamStatus, "shipped"),
    ];
    filters.push(ideaCampusVisible(viewerCampus));
    if (query.campus === "1") filters.push(eq(ideas.campusDomain, viewerCampus));
    if (query.branch) filters.push(eq(ideas.authorBranch, query.branch));
    if (query.semester) filters.push(eq(ideas.authorSemester, Number(query.semester)));
    if (query.q) filters.push(sql`${ideas.title} ILIKE ${"%" + query.q.replace(/[%_]/g, "") + "%"}`);
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(ideas.createdAt, cursor.at),
            and(eq(ideas.createdAt, cursor.at), lt(ideas.id, cursor.id)),
        )!);
    }
    const rows = await db.select().from(ideas).where(and(...filters)).orderBy(desc(ideas.createdAt), desc(ideas.id)).limit(21);
    const page = rows.slice(0, 20);
    const saved = await savedSet(viewer.id, "idea", page.map((row) => row.id));
    const problemIds = page.map((row) => row.problemId).filter((id): id is string => Boolean(id));
    const problemTitles = new Map<string, string>();
    if (problemIds.length) {
        const linked = await db.select({ id: problems.id, title: problems.title }).from(problems).where(inArray(problems.id, problemIds));
        linked.forEach((row) => problemTitles.set(row.id, row.title));
    }
    const last = page[page.length - 1];
    const forks = await forkCountsFor(page.map((row) => row.id));
    const cards = page.map((row) => publicIdea(row, saved.has(row.id), row.problemId ? problemTitles.get(row.problemId) : null, forks.get(row.id) ?? 0, { viewerCampus }));
    return {
        ideas: await withIdeaImages(cards),
        nextCursor: rows.length > 20 && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

export async function getIdea(userId: string, ideaId: string) {
    const viewer = await requireUser(userId);
    const idea = await mustIdea(ideaId);
    visibleOrThrow(idea.hiddenAt, viewer, idea.ownerId);
    assertIdeaCampus(idea, viewer);
    let problemTitle: string | null = null;
    let problemSource: { id: string; title: string; reporterName: string | null } | null = null;
    if (idea.problemId) {
        const [problem] = await db.select({ id: problems.id, title: problems.title, authorName: problems.authorName, hideName: problems.hideName }).from(problems).where(eq(problems.id, idea.problemId));
        problemTitle = problem?.title ?? null;
        if (problem) problemSource = { id: problem.id, title: problem.title, reporterName: problem.hideName ? null : problem.authorName };
    }
    const saved = await savedSet(viewer.id, "idea", [idea.id]);
    const forks = await forkCountsFor([idea.id]);
    const member = await onTeam(idea, viewer.id);
    const visibility = idea.visibility === "minimal" || idea.visibility === "open" ? idea.visibility : "standard";
    let approach: { body: string; contactEmail?: string } | null = null;
    if (member) {
        const [row] = await db.select().from(approaches).where(eq(approaches.ideaId, idea.id));
        approach = row ? { body: row.body, contactEmail: row.contactEmail } : null;
    } else if (visibility === "open") {
        const [row] = await db.select().from(approaches).where(eq(approaches.ideaId, idea.id));
        approach = row ? { body: row.body } : null;
    }
    const collaborators = await activeCollaborators(idea.id);
    const seatsOpen = idea.teamStatus === "open" && collaborators < MAX_COLLABORATORS;
    const images = await listIdeaImages(idea.id);
    // "Buy them a coffee": only for named posts, so a hidden-name owner is never revealed through their tip page.
    let ownerTipUrl: string | null = null;
    if (!idea.hideName && idea.ownerId !== viewer.id) {
        const [owner] = await db.select({ tipUrl: users.tipUrl, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, idea.ownerId));
        ownerTipUrl = owner && !owner.suspendedAt ? owner.tipUrl : null;
    }
    const card = {
        ...publicIdea(idea, saved.has(idea.id), problemTitle, forks.get(idea.id) ?? 0, { viewerIsMember: member, viewerCampus: campusOf(viewer) }),
        problemSource,
        approach,
        isMember: member,
        seatsOpen,
        collaboratorCount: collaborators,
        publishedAt: idea.createdAt,
        images,
        ownerTipUrl,
    };
    return { idea: card };
}

const IDEA_IMAGE_MAX = 3;
const IDEA_IMAGE_BYTES = 5 * 1024 * 1024;
const IDEA_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

async function listIdeaImages(ideaId: string) {
    const rows = await db.select({
        id: ideaImages.id,
        imageUrl: ideaImages.imageUrl,
        createdAt: ideaImages.createdAt,
    }).from(ideaImages).where(eq(ideaImages.ideaId, ideaId)).orderBy(asc(ideaImages.createdAt)).limit(IDEA_IMAGE_MAX);
    return rows.map((row, index) => ({
        id: row.id,
        imageUrl: row.imageUrl,
        role: index === 0 ? "hero" as const : "figure" as const,
    }));
}

/** Batch-attach idea images (hero first) for list/feed cards. */
export async function withIdeaImages<T extends { id: string }>(list: T[]) {
    if (list.length === 0) return list.map((row) => ({ ...row, images: [] as { id: string; imageUrl: string; role: "hero" | "figure" }[] }));
    const ids = list.map((row) => row.id);
    const rows = await db.select({
        id: ideaImages.id,
        ideaId: ideaImages.ideaId,
        imageUrl: ideaImages.imageUrl,
        createdAt: ideaImages.createdAt,
    }).from(ideaImages).where(inArray(ideaImages.ideaId, ids)).orderBy(asc(ideaImages.createdAt));
    const byIdea = new Map<string, { id: string; imageUrl: string; role: "hero" | "figure" }[]>();
    for (const row of rows) {
        const bucket = byIdea.get(row.ideaId) ?? [];
        if (bucket.length >= IDEA_IMAGE_MAX) continue;
        bucket.push({
            id: row.id,
            imageUrl: row.imageUrl,
            role: bucket.length === 0 ? "hero" : "figure",
        });
        byIdea.set(row.ideaId, bucket);
    }
    return list.map((row) => ({ ...row, images: byIdea.get(row.id) ?? [] }));
}

export async function uploadSprintIdeaImage(
    userId: string,
    ideaId: string,
    file: { mimetype: string; size: number; buffer: Buffer; originalname?: string } | undefined,
) {
    const user = await requireUser(userId);
    const idea = await mustIdea(ideaId);
    if (idea.ownerId !== user.id) throw new CampusError(403, "Only the owner can add images");
    if (!file) throw new CampusError(400, "Attach a PNG, JPG or WebP");
    if (!IDEA_IMAGE_MIME.has(file.mimetype)) throw new CampusError(415, "Use PNG, JPG or WebP");
    if (file.size > IDEA_IMAGE_BYTES) throw new CampusError(413, "Images are capped at 5 MB");
    const [existing] = await db.select({ n: count() }).from(ideaImages).where(eq(ideaImages.ideaId, ideaId));
    if (Number(existing?.n ?? 0) >= IDEA_IMAGE_MAX) {
        throw new CampusError(400, "One hero and two figures is the cap");
    }
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const path = `ideas/${ideaId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(supabaseBucket).upload(path, file.buffer, { contentType: file.mimetype });
    if (error) {
        console.error("Idea image upload failed:", error.message);
        throw new CampusError(500, storageUploadErrorMessage(error));
    }
    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(path);
    const [image] = await db.insert(ideaImages).values({
        ideaId,
        userId: user.id,
        imageUrl: data.publicUrl,
    }).returning({ id: ideaImages.id, imageUrl: ideaImages.imageUrl });
    return { id: image.id, imageUrl: image.imageUrl, role: Number(existing?.n ?? 0) === 0 ? "hero" : "figure" };
}

export async function deleteSprintIdeaImage(userId: string, ideaId: string, imageId: string) {
    const user = await requireUser(userId);
    const idea = await mustIdea(ideaId);
    const [image] = await db.select().from(ideaImages).where(and(eq(ideaImages.id, imageId), eq(ideaImages.ideaId, ideaId))).limit(1);
    if (!image) throw new CampusError(404, "Image not found");
    if (idea.ownerId !== user.id && image.userId !== user.id) throw new CampusError(403, "Only owner or uploader can delete");
    const marker = `/storage/v1/object/public/${supabaseBucket}/`;
    const path = image.imageUrl.split(marker)[1];
    if (path) await supabase.storage.from(supabaseBucket).remove([path]);
    await db.delete(ideaImages).where(eq(ideaImages.id, image.id));
    return { ok: true as const };
}

export async function createIdea(userId: string, input: CreateSprintIdeaInput) {
    const user = await requireReady(userId);
    const sprint = await ensureSprint();
    const lastCreate = ideaCreateAt.get(user.id) ?? 0;
    if (Date.now() - lastCreate < IDEA_CREATE_COOLDOWN_MS) {
        throw new CampusError(429, "Wait a bit before posting another idea");
    }
    if (await countSprintIdeas(user.id, sprint.id) >= 2) {
        throw new CampusError(400, "Two ideas is the cap for this sprint");
    }
    const compensation = input.compensationSentence?.trim() || VOLUNTEER_SENTENCE;
    checkBrief(input.pitch, input.gap, input.ships, compensation);
    if (input.isSmall && !input.hourCap) throw new CampusError(400, "A small build needs an hour cap");
    await assertNoDuplicate(input.title, input.pitch);
    const paid = isPaidDeal(input.dealType);
    if (paid && !user.adultConfirmedAt) {
        throw new CampusError(403, "Paid projects need you to confirm you are 18 or older first (Profile → Account)");
    }
    const visibility = input.visibility ?? "standard";
    const blurb = (input.blurb?.trim() || input.pitch.trim().slice(0, 160)).slice(0, 160);
    if (visibility === "minimal" && blurb.length < 12) {
        throw new CampusError(400, "Minimal visibility needs a short public teaser");
    }
    const idea = await insertIdeaRecord(user, {
        title: input.title.trim(),
        pitch: input.pitch.trim(),
        audience: input.audience.trim(),
        gap: input.gap.trim(),
        ships: input.ships.trim(),
        helpNeeded: input.helpNeeded,
        stage: input.stage,
        isSmall: input.isSmall,
        hourCap: input.hourCap,
        compensationSentence: compensation,
        hideName: input.hideName,
        visibility,
        blurb,
        sprintId: sprint.id,
        dealType: input.dealType,
        currency: paid ? input.currency ?? null : null,
        budgetMinor: paid && input.budget ? toMinor(input.budget) : null,
        licence: input.dealType === "open_source" ? input.licence ?? null : null,
        notAcademicAttestedAt: new Date(),
        campusOnly: input.campusOnly,
    });
    await db.insert(approaches).values({
        ideaId: idea.id,
        body: input.approach.trim(),
        contactEmail: input.contactEmail.trim().toLowerCase(),
    });
    await flagIfAcademic("idea", idea.id, [input.title, input.pitch, input.ships, input.approach, input.blurb ?? ""].join("\n"));
    ideaCreateAt.set(user.id, Date.now());
    return { idea: publicIdea(idea, false, null, 0, { viewerIsMember: true }) };
}

export async function listProblems(userId: string, query: { branch?: string; semester?: string; q?: string; cursor?: string; bucket?: string; noIdea?: string; campus?: string }) {
    const viewer = await requireUser(userId);
    const viewerCampus = campusOf(viewer);
    const sprint = await ensureSprint();
    const boundary = day7Of(sprint.endsAt);
    const now = new Date();
    const sunkSql = sql`${now} >= ${boundary} and not exists (select 1 from ideas i where i.problem_id = ${problems.id}) and ${problems.freshLine} is null`;
    const filters = [isNull(problems.hiddenAt), query.bucket === "sunk" ? sunkSql : sql`not (${sunkSql})`];
    if (query.campus === "1") filters.push(eq(problems.campusDomain, viewerCampus));
    if (query.branch) filters.push(eq(problems.authorBranch, query.branch));
    if (query.semester) filters.push(eq(problems.authorSemester, Number(query.semester)));
    if (query.q) filters.push(sql`${problems.title} ILIKE ${"%" + query.q.replace(/[%_]/g, "") + "%"}`);
    if (query.noIdea === "1") filters.push(sql`not exists (select 1 from ideas i where i.problem_id = ${problems.id})`);
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(problems.createdAt, cursor.at),
            and(eq(problems.createdAt, cursor.at), lt(problems.id, cursor.id)),
        )!);
    }
    const rows = await db.select({
        problem: problems,
        ideaId: ideas.id,
    }).from(problems)
        .leftJoin(ideas, eq(ideas.problemId, problems.id))
        .where(and(...filters))
        .orderBy(desc(problems.createdAt), desc(problems.id))
        .limit(21);
    const page = rows.slice(0, 20);
    const saved = await savedSet(viewer.id, "problem", page.map((row) => row.problem.id));
    const last = page[page.length - 1];
    return {
        problems: page.map((row) => publicProblem(
            row.problem,
            saved.has(row.problem.id),
            row.ideaId,
            query.bucket === "sunk",
            viewer.id,
            viewerCampus,
        )),
        nextCursor: rows.length > 20 && last ? encodeCursor(last.problem.createdAt, last.problem.id) : null,
    };
}

export async function getProblem(userId: string, problemId: string) {
    const viewer = await requireUser(userId);
    const problem = await mustProblem(problemId);
    visibleOrThrow(problem.hiddenAt, viewer, problem.authorId);
    const [linked] = await db.select({ id: ideas.id, ownerId: ideas.ownerId }).from(ideas).where(eq(ideas.problemId, problem.id));
    const sprint = await ensureSprint();
    const sunk = !linked && new Date() >= day7Of(sprint.endsAt) && !problem.freshLine;
    const saved = await savedSet(viewer.id, "problem", [problem.id]);
    let approach = null;
    const accepted = linked
        ? await db.select().from(teamMembers).where(and(eq(teamMembers.ideaId, linked.id), eq(teamMembers.userId, viewer.id), isNull(teamMembers.leftAt)))
        : [];
    if (viewer.id === problem.authorId || viewer.id === linked?.ownerId || accepted.length > 0) {
        const [row] = await db.select().from(approaches).where(eq(approaches.problemId, problem.id));
        approach = row ? { body: row.body, contactEmail: row.contactEmail } : null;
    }
    return { problem: { ...publicProblem(problem, saved.has(problem.id), linked?.id ?? null, sunk, viewer.id, campusOf(viewer)), approach } };
}

export async function createProblem(userId: string, input: CreateProblemInput) {
    const user = await requireReady(userId);
    const sprint = await ensureSprint();
    if (await countSprintProblems(user.id, sprint.id) >= 2) {
        throw new CampusError(400, "Two problems is the cap for this sprint");
    }
    assertOwnWords("What is happening", input.whatHappens, 20);
    assertOwnWords("What a fix would change", input.fixWouldChange, 20);
    const snap = authorLabel(input.hideName, user.displayName, user.branch, user.semester);
    const [problem] = await db.insert(problems).values({
        authorId: user.id,
        sprintId: sprint.id,
        title: input.title.trim(),
        whatHappens: input.whatHappens.trim(),
        whoFeels: input.whoFeels.trim(),
        fixWouldChange: input.fixWouldChange.trim(),
        source: input.source,
        authorName: snap.authorName,
        authorBranch: snap.authorBranch,
        authorSemester: snap.authorSemester,
        hideName: input.hideName,
        notAcademicAttestedAt: new Date(),
        campusDomain: campusDomainOrNull(user),
    }).returning();
    await db.insert(approaches).values({
        problemId: problem.id,
        body: input.approach.trim(),
        contactEmail: input.contactEmail.trim().toLowerCase(),
    });
    await flagIfAcademic("problem", problem.id, [input.title, input.whatHappens, input.fixWouldChange, input.approach].join("\n"));
    return { problem: publicProblem(problem, false, null, false, user.id) };
}

export async function addFreshLine(userId: string, problemId: string, freshLine: string) {
    const problem = await mustProblem(problemId);
    if (problem.authorId !== userId) throw new CampusError(403, "Only the poster can add a fresh line");
    await db.insert(revisions).values({
        targetType: "problem",
        targetId: problem.id,
        snapshot: { freshLine: problem.freshLine },
    });
    const [updated] = await db.update(problems).set({ freshLine: freshLine.trim() }).where(eq(problems.id, problem.id)).returning();
    return { problem: publicProblem(updated, false, null, false, userId) };
}

async function openOfferGuard(userId: string, sprintId: string) {
    const [open] = await db.select({ id: offers.id }).from(offers).where(and(
        eq(offers.builderId, userId),
        eq(offers.sprintId, sprintId),
        inArray(offers.status, ["new", "tryout"]),
    ));
    if (open) throw new CampusError(400, "You already have an open offer this sprint");
}

export async function createOffer(userId: string, input: {
    ideaId?: string;
    problemId?: string;
    body: string;
    hoursPerWeek: number;
    availableDays: string[];
    links: string[];
    skills?: string[];
    phases?: string[];
    proposal?: Proposal;
}) {
    const builder = await requireReady(userId);
    const sprint = await ensureSprint();
    if (new Date() > new Date(sprint.endsAt)) throw new CampusError(400, "This sprint is no longer taking requests");
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [recentOffers] = await db.select({ n: count() }).from(offers).where(and(
        eq(offers.builderId, builder.id),
        gt(offers.createdAt, since),
    ));
    if (Number(recentOffers?.n ?? 0) >= OFFERS_PER_HOUR) {
        throw new CampusError(429, "Too many requests this hour. Try again later.");
    }
    await openOfferGuard(builder.id, sprint.id);
    if (input.ideaId && input.problemId) throw new CampusError(400, "Choose an idea or a problem");
    const skills = [...new Set((input.skills ?? []).map((s) => s.trim()).filter(Boolean))].slice(0, 8);
    const phases = [...new Set((input.phases ?? []).map((s) => s.trim()).filter(Boolean))].slice(0, 6);

    if (input.ideaId) {
        const idea = await mustIdea(input.ideaId);
        if (idea.hiddenAt) throw new CampusError(404, "Idea not found");
        assertIdeaCampus(idea, builder);
        if (idea.ownerId === builder.id) throw new CampusError(400, "You already author this idea");
        if (idea.teamStatus === "shipped") throw new CampusError(400, "This idea has shipped");
        if (idea.teamStatus !== "open") throw new CampusError(400, "This team is not open for new requests");
        const collaborators = await activeCollaborators(idea.id);
        if (collaborators >= MAX_COLLABORATORS) throw new CampusError(400, "This team is full");
        if (idea.isSmall && idea.hourCap && input.hoursPerWeek > idea.hourCap) {
            throw new CampusError(400, `This build caps hours at ${idea.hourCap}`);
        }
        const [offer] = await db.insert(offers).values({
            builderId: builder.id,
            sprintId: sprint.id,
            ideaId: idea.id,
            body: input.body.trim(),
            hoursPerWeek: input.hoursPerWeek,
            availableDays: input.availableDays,
            links: input.links,
            skills,
            phases,
            status: "new",
        }).returning();
        const [owner] = await db.select().from(users).where(eq(users.id, idea.ownerId));
        if (owner) await notify(owner.id, owner.email, "New request on your idea", `${builder.displayName || builder.username} asked to join “${idea.title}”.`, offer.id);
        await logEvent("join", builder.id, "offer", offer.id, { ideaId: idea.id });
        return { offer };
    }

    if (!input.problemId || !input.proposal) throw new CampusError(400, "A problem proposal needs the public idea fields");
    if (input.body.trim().length < 40) throw new CampusError(400, "The proposal needs at least 40 characters");
    const problem = await mustProblem(input.problemId);
    if (problem.hiddenAt) throw new CampusError(404, "Problem not found");
    const problemText = `${problem.whatHappens}\n${problem.title}`.trim().toLowerCase();
    if (input.body.trim().toLowerCase() === problem.whatHappens.trim().toLowerCase() || input.body.trim().toLowerCase() === problemText) {
        throw new CampusError(400, "The proposal has to be your own words, not a copy of the problem");
    }
    const compensation = input.proposal.compensationSentence?.trim() || VOLUNTEER_SENTENCE;
    checkBrief(input.proposal.pitch, input.proposal.gap, input.proposal.ships, compensation);
    const [existingIdea] = await db.select({ id: ideas.id }).from(ideas).where(eq(ideas.problemId, problem.id));
    if (existingIdea) throw new CampusError(400, "This problem already has an idea");
    const [offer] = await db.insert(offers).values({
        builderId: builder.id,
        sprintId: sprint.id,
        problemId: problem.id,
        body: input.body.trim(),
        hoursPerWeek: input.hoursPerWeek,
        availableDays: input.availableDays,
        links: input.links,
        skills,
        phases,
        proposal: { ...input.proposal, compensationSentence: compensation },
        status: "new",
    }).returning();
    const [owner] = await db.select().from(users).where(eq(users.id, problem.authorId));
    if (owner) await notify(owner.id, owner.email, "New proposal on your problem", `${builder.displayName || builder.username} proposed an idea for “${problem.title}”.`, offer.id);
    await logEvent("join", builder.id, "offer", offer.id, { problemId: problem.id });
    return { offer };
}

async function mustOffer(id: string) {
    const [offer] = await db.select().from(offers).where(eq(offers.id, id));
    if (!offer) throw new CampusError(404, "Offer not found");
    return offer;
}

async function offerOwnerId(offer: typeof offers.$inferSelect) {
    if (offer.ideaId) {
        const idea = await mustIdea(offer.ideaId);
        return idea.ownerId;
    }
    if (offer.problemId) {
        const problem = await mustProblem(offer.problemId);
        return problem.authorId;
    }
    throw new CampusError(400, "Offer has no target");
}

export async function getOffer(userId: string, offerId: string) {
    const viewer = await requireUser(userId);
    const offer = await mustOffer(offerId);
    const ownerId = await offerOwnerId(offer);
    if (viewer.id !== ownerId && viewer.id !== offer.builderId) throw new CampusError(403, "You cannot open this offer");
    const [builder] = await db.select().from(users).where(eq(users.id, offer.builderId));
    if (!builder) throw new CampusError(404, "Profile not found");
    const [tryout] = await db.select().from(tryouts).where(eq(tryouts.offerId, offer.id));
    const signed = await signedSkillNames(builder.id);
    const [finished] = await db.select({ c: count() }).from(offers).where(and(eq(offers.builderId, builder.id), eq(offers.status, "accepted")));
    const [dropped] = await db.select({ c: count() }).from(offers).where(and(eq(offers.builderId, builder.id), eq(offers.status, "declined")));
    const profile = viewer.id === ownerId || viewer.id === builder.id ? {
        displayName: builder.displayName,
        branch: builder.branch,
        semester: builder.semester,
        twoWeekLine: builder.twoWeekLine,
        skills: (builder.campusSkills ?? []).map((name) => ({ name, signed: signed.has(name.toLowerCase()) })),
        university: institutionFor(builder),
        degree: builder.degree,
        graduationYear: builder.graduationYear,
        cgpa: builder.cgpa === null ? null : Number(builder.cgpa),
        headline: builder.headline,
        githubUrl: builder.githubUrl,
        githubLogin: builder.githubLogin,
        githubStats: builder.githubStats,
        linkedinUrl: builder.linkedinUrl,
        siteUrl: builder.siteUrl,
        projects: builder.projects ?? [],
        certifications: builder.certifications ?? [],
        experience: builder.experience ?? [],
        profilePicUrl: builder.profilePicUrl,
        coverUrl: builder.coverUrl,
        currentlyWorkingOn: builder.currentlyWorkingOn,
        finished: Number(finished?.c ?? 0),
        dropped: Number(dropped?.c ?? 0),
    } : null;
    return {
        offer: {
            id: offer.id,
            status: offer.status,
            body: offer.body,
            hoursPerWeek: offer.hoursPerWeek,
            availableDays: offer.availableDays,
            links: offer.links,
            skills: offer.skills ?? [],
            phases: offer.phases ?? [],
            proposal: offer.proposal,
            ideaId: offer.ideaId,
            problemId: offer.problemId,
            builderId: offer.builderId,
            createdAt: offer.createdAt,
        },
        profile,
        tryout: tryout ? { brief: tryout.brief, hourCap: tryout.hourCap, outcome: tryout.outcome } : null,
        canDecide: viewer.id === ownerId && (offer.status === "new" || offer.status === "tryout"),
    };
}

async function signedSkillNames(userId: string) {
    const rows = await db.select({ role: tasks.role }).from(tasks).where(and(
        eq(tasks.assigneeId, userId),
        eq(tasks.receiptStatus, "signed"),
    ));
    return new Set(rows.map((row) => (row.role ?? "").trim().toLowerCase()).filter(Boolean));
}

async function addCollaborator(ideaId: string, userId: string) {
    const collaborators = await activeCollaborators(ideaId);
    if (collaborators >= MAX_COLLABORATORS) throw new CampusError(400, `This team already has ${TEAM_MAX} people`);
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
    if (idea && idea.ownerId === userId) throw new CampusError(400, "The author is already on the team");
    const [existing] = await db.select().from(teamMembers).where(and(eq(teamMembers.ideaId, ideaId), eq(teamMembers.userId, userId)));
    if (existing && !existing.leftAt) throw new CampusError(400, "They are already on the team");
    if (existing) {
        await db.update(teamMembers).set({ leftAt: null, exitReason: null, joinedAt: new Date() }).where(and(
            eq(teamMembers.ideaId, ideaId),
            eq(teamMembers.userId, userId),
        ));
    } else {
        await db.insert(teamMembers).values({ ideaId, userId });
    }
    const [group] = await db.select().from(groups).where(eq(groups.ideaId, ideaId));
    if (group) {
        const [seat] = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
        if (!seat) await db.insert(groupMembers).values({ groupId: group.id, userId });
    }
    if (idea && idea.teamStatus === "open") {
        await db.update(ideas).set({ teamStatus: "in_build" }).where(eq(ideas.id, ideaId));
    }
}

export async function acceptOffer(userId: string, offerId: string) {
    const offer = await mustOffer(offerId);
    if (await offerOwnerId(offer) !== userId) throw new CampusError(403, "Only the owner can accept");
    if (offer.status !== "new" && offer.status !== "tryout") throw new CampusError(400, "This offer is already decided");
    const builder = await requireUser(offer.builderId);

    if (offer.ideaId) {
        await addCollaborator(offer.ideaId, builder.id);
        await db.update(offers).set({ status: "accepted" }).where(eq(offers.id, offer.id));
        await notify(builder.id, builder.email, "You are on the team", "Your request was accepted. The workspace is open.", offer.ideaId);
        await logEvent("join", userId, "idea", offer.ideaId, { offerId: offer.id, userId: builder.id });
        return { status: "accepted", ideaId: offer.ideaId };
    }

    const problem = await mustProblem(offer.problemId!);
    const proposal = offer.proposal as Proposal | null;
    if (!proposal) throw new CampusError(400, "This proposal is missing its public brief");
    if (offer.body.trim().length < 40) throw new CampusError(400, "The proposal needs at least 40 characters");
    if (sameSentence(offer.body, problem.whatHappens)) {
        throw new CampusError(400, "The proposal has to be your own words, not a copy of the problem");
    }
    const sprint = await ensureSprint();
    if (await countSprintIdeas(builder.id, sprint.id) >= 2) {
        throw new CampusError(400, "The proposer is already at the two-idea cap");
    }
    const [already] = await db.select({ id: ideas.id }).from(ideas).where(eq(ideas.problemId, problem.id));
    if (already) throw new CampusError(409, "This problem already has an idea");
    const compensation = proposal.compensationSentence || VOLUNTEER_SENTENCE;
    checkBrief(proposal.pitch, proposal.gap, proposal.ships, compensation);
    const idea = await insertIdeaRecord(builder, {
        title: proposal.title,
        pitch: proposal.pitch,
        audience: proposal.audience,
        gap: proposal.gap,
        ships: proposal.ships,
        helpNeeded: proposal.helpNeeded,
        stage: proposal.stage || "idea",
        isSmall: Boolean(proposal.isSmall),
        hourCap: proposal.hourCap,
        compensationSentence: compensation,
        hideName: Boolean(proposal.hideName),
        problemId: problem.id,
        visibility: proposal.visibility || "standard",
        blurb: proposal.blurb,
        sprintId: sprint.id,
    });
    await db.update(offers).set({ status: "accepted" }).where(eq(offers.id, offer.id));
    await db.update(offers).set({ status: "declined" }).where(and(
        eq(offers.problemId, problem.id),
        ne(offers.id, offer.id),
        inArray(offers.status, ["new", "tryout"]),
    ));
    const savers = await db.select().from(saves).where(and(eq(saves.targetType, "problem"), eq(saves.targetId, problem.id)));
    for (const save of savers) {
        const [person] = await db.select().from(users).where(eq(users.id, save.userId));
        if (person) await notify(person.id, person.email, "A saved problem has an idea", `“${problem.title}” now has an idea.`, idea.id);
    }
    await notify(builder.id, builder.email, "Your proposal is the idea", `“${idea.title}” is on the board. Open the workspace and assign a first task.`, idea.id);
    await logEvent("join", userId, "idea", idea.id, { offerId: offer.id, problemId: problem.id });
    return { status: "accepted", ideaId: idea.id };
}

export async function declineOffer(userId: string, offerId: string) {
    const offer = await mustOffer(offerId);
    if (await offerOwnerId(offer) !== userId) throw new CampusError(403, "Only the owner can decline");
    if (offer.status !== "new" && offer.status !== "tryout") throw new CampusError(400, "This offer is already decided");
    const [tryout] = await db.select().from(tryouts).where(eq(tryouts.offerId, offer.id));
    if (tryout) {
        await db.update(tryouts).set({ outcome: "declined" }).where(eq(tryouts.id, tryout.id));
        if (offer.ideaId) {
            await db.insert(tasks).values({
                ideaId: offer.ideaId,
                title: "Tryout",
                description: tryout.brief,
                assigneeId: offer.builderId,
                role: "Tryout",
                status: "submitted",
                receiptStatus: "submitted",
                frozenAt: new Date(),
            });
        }
        await logEvent("tryout_declined", offer.builderId, "offer", offer.id, { brief: tryout.brief });
    }
    await db.update(offers).set({ status: "declined" }).where(eq(offers.id, offer.id));
    const builder = await requireUser(offer.builderId);
    await notify(builder.id, builder.email, "Your request was declined", "You can keep looking on the Ideas tab.", offer.ideaId ?? offer.problemId ?? undefined);
    return { status: "declined" };
}

export async function assignTryout(userId: string, offerId: string, brief: string, hourCap: number) {
    const offer = await mustOffer(offerId);
    if (await offerOwnerId(offer) !== userId) throw new CampusError(403, "Only the owner can ask for a tryout");
    if (offer.status !== "new") throw new CampusError(400, "A tryout can only be assigned once, from a new request");
    if (hourCap > 8) throw new CampusError(400, "A tryout cap is at most 8 hours");
    const [existing] = await db.select().from(tryouts).where(eq(tryouts.offerId, offer.id));
    if (existing) throw new CampusError(400, "This request already has a tryout");
    await db.insert(tryouts).values({ offerId: offer.id, brief: brief.trim(), hourCap });
    await db.update(offers).set({ status: "tryout" }).where(eq(offers.id, offer.id));
    const builder = await requireUser(offer.builderId);
    await notify(builder.id, builder.email, "A tryout was asked", brief.trim(), offer.id);
    return { status: "tryout", hourCap, brief: brief.trim() };
}

export async function getInbox(userId: string) {
    const viewer = await requireUser(userId);
    try {
        await checkUserDay7Notices(viewer.id);
    } catch (e) {
        console.warn("Day-7 check error in getInbox:", e instanceof Error ? e.message : e);
    }

    const ownedIdeas = await db.select({
        id: ideas.id,
        title: ideas.title,
        pitch: ideas.pitch,
        audience: ideas.audience,
        gap: ideas.gap,
        ships: ideas.ships,
        helpNeeded: ideas.helpNeeded,
        embedding: ideas.embedding,
        teamStatus: ideas.teamStatus,
    }).from(ideas).where(and(eq(ideas.ownerId, viewer.id), isNull(ideas.hiddenAt)));
    const ownedProblems = await db.select({ id: problems.id, title: problems.title }).from(problems)
        .where(and(eq(problems.authorId, viewer.id), isNull(problems.hiddenAt)));
    const ideaIds = ownedIdeas.map((row) => row.id);
    const problemIds = ownedProblems.map((row) => row.id);
    const ideaById = new Map(ownedIdeas.map((row) => [row.id, row]));

    const incoming = ideaIds.length || problemIds.length
        ? await db.select().from(offers).where(or(
            ideaIds.length ? inArray(offers.ideaId, ideaIds) : sql`false`,
            problemIds.length ? inArray(offers.problemId, problemIds) : sql`false`,
        )).orderBy(desc(offers.createdAt)).limit(80)
        : [];

    const outgoing = await db.select().from(offers)
        .where(eq(offers.builderId, viewer.id))
        .orderBy(desc(offers.createdAt)).limit(40);

    const inviteRows = await db.select({
        id: sprintInvites.id,
        ideaId: sprintInvites.ideaId,
        email: sprintInvites.email,
        status: sprintInvites.status,
        createdAt: sprintInvites.createdAt,
        title: ideas.title,
        teamStatus: ideas.teamStatus,
        ownerId: ideas.ownerId,
    }).from(sprintInvites)
        .innerJoin(ideas, eq(ideas.id, sprintInvites.ideaId))
        .where(eq(sprintInvites.email, viewer.email))
        .orderBy(desc(sprintInvites.createdAt))
        .limit(40);

    const noticeRows = await db.select().from(notices)
        .where(eq(notices.userId, viewer.id))
        .orderBy(desc(notices.createdAt))
        .limit(40);

    const titleMap = new Map<string, string>();
    ownedIdeas.forEach((row) => titleMap.set(row.id, row.title));
    ownedProblems.forEach((row) => titleMap.set(row.id, row.title));

    const builderIds = [...new Set(incoming.map((offer) => offer.builderId))];
    const builders = builderIds.length
        ? await db.select({
            id: users.id,
            displayName: users.displayName,
            username: users.username,
            branch: users.branch,
            semester: users.semester,
            campusSkills: users.campusSkills,
            twoWeekLine: users.twoWeekLine,
            headline: users.headline,
            githubUrl: users.githubUrl,
            profilePicUrl: users.profilePicUrl,
            profileEmbedding: users.profileEmbedding,
        }).from(users).where(inArray(users.id, builderIds))
        : [];
    const builderById = new Map(builders.map((row) => [row.id, row]));

    const signedCounts = new Map<string, number>();
    if (builderIds.length) {
        const signed = await db.execute(sql`
            select assignee_id::text as id, count(*)::int as n
            from tasks
            where assignee_id = any(${`{${builderIds.join(",")}}`}::uuid[])
              and receipt_status = 'signed'
            group by assignee_id`);
        for (const row of signed.rows as { id: string; n: number }[]) {
            signedCounts.set(row.id, Number(row.n));
        }
    }

    // Outgoing targets (ideas/problems not necessarily owned)
    const outIdeaIds = [...new Set(outgoing.map((o) => o.ideaId).filter(Boolean) as string[])];
    const outProblemIds = [...new Set(outgoing.map((o) => o.problemId).filter(Boolean) as string[])];
    const outIdeas = outIdeaIds.length
        ? await db.select({ id: ideas.id, title: ideas.title, ownerId: ideas.ownerId, teamStatus: ideas.teamStatus }).from(ideas).where(inArray(ideas.id, outIdeaIds))
        : [];
    const outProblems = outProblemIds.length
        ? await db.select({ id: problems.id, title: problems.title }).from(problems).where(inArray(problems.id, outProblemIds))
        : [];
    outIdeas.forEach((row) => titleMap.set(row.id, row.title));
    outProblems.forEach((row) => titleMap.set(row.id, row.title));

    // Tasks awaiting owner signature
    const signatureRows = ideaIds.length
        ? await db.select({
            id: tasks.id,
            title: tasks.title,
            role: tasks.role,
            ideaId: tasks.ideaId,
            assigneeId: tasks.assigneeId,
            updatedAt: tasks.createdAt,
        }).from(tasks).where(and(
            inArray(tasks.ideaId, ideaIds),
            eq(tasks.receiptStatus, "submitted"),
        )).orderBy(desc(tasks.createdAt)).limit(20)
        : [];
    const assigneeIds = [...new Set(signatureRows.map((row) => row.assigneeId).filter(Boolean) as string[])];
    const assignees = assigneeIds.length
        ? await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, assigneeIds))
        : [];
    const assigneeName = new Map(assignees.map((row) => [row.id, row.displayName || row.username || "Teammate"]));

    // NLP fit: embed offer texts when idea/profile vectors missing; score with MiniLM cosine + skill overlap
    const needEmbed: { key: string; text: string }[] = [];
    for (const offer of incoming.filter((o) => o.status === "new" || o.status === "tryout")) {
        const idea = offer.ideaId ? ideaById.get(offer.ideaId) : null;
        const builder = builderById.get(offer.builderId);
        if (idea && !idea.embedding) {
            needEmbed.push({ key: `idea:${idea.id}`, text: ideaText(idea) });
        }
        if (builder && !builder.profileEmbedding) {
            needEmbed.push({
                key: `builder:${builder.id}`,
                text: [builder.headline, builder.twoWeekLine, (builder.campusSkills ?? []).join(", "), offer.body, (offer.skills ?? []).join(", ")].filter(Boolean).join("\n"),
            });
        } else if (!builder) {
            needEmbed.push({ key: `offer:${offer.id}`, text: [offer.body, (offer.skills ?? []).join(", ")].filter(Boolean).join("\n") });
        }
    }
    const uniqueEmbed = [...new Map(needEmbed.map((row) => [row.key, row])).values()].slice(0, 24);
    const vectors = uniqueEmbed.length ? await embedTextsSafe(uniqueEmbed.map((row) => row.text)) : [];
    const usingModel = vectors !== null && (vectors.length > 0 || ownedIdeas.some((i) => i.embedding) || builders.some((b) => b.profileEmbedding));
    const vecByKey = new Map<string, number[]>();
    if (vectors) uniqueEmbed.forEach((row, i) => vecByKey.set(row.key, vectors[i]));

    const scoreOffer = (offer: typeof incoming[number]) => {
        const idea = offer.ideaId ? ideaById.get(offer.ideaId) : null;
        const builder = builderById.get(offer.builderId);
        const help = (idea?.helpNeeded ?? []).map((s) => s.toLowerCase());
        const skills = [...(offer.skills ?? []), ...(builder?.campusSkills ?? [])].map((s) => s.toLowerCase());
        const skillHits = help.length
            ? help.filter((role) => skills.some((skill) => skill.includes(role) || role.includes(skill))).length / help.length
            : skills.length ? 0.35 : 0;
        const ideaVec = idea?.embedding ?? (idea ? vecByKey.get(`idea:${idea.id}`) : null) ?? null;
        const builderVec = builder?.profileEmbedding
            ?? vecByKey.get(`builder:${builder?.id ?? ""}`)
            ?? vecByKey.get(`offer:${offer.id}`)
            ?? null;
        const semantic = cosineSimilarity(ideaVec, builderVec);
        const branchBoost = builder?.branch && viewer.branch && builder.branch === viewer.branch ? 0.08 : 0;
        const proofBoost = Math.min(0.12, (signedCounts.get(offer.builderId) ?? 0) * 0.03);
        const hoursBoost = offer.hoursPerWeek >= 4 ? 0.05 : 0;
        const fit = Math.min(1, Math.max(0, 0.55 * semantic + 0.28 * skillHits + branchBoost + proofBoost + hoursBoost));
        const reasons: string[] = [];
        if (semantic >= 0.35) reasons.push("Strong brief match");
        else if (semantic >= 0.2) reasons.push("Related experience");
        if (skillHits >= 0.5) reasons.push("Skills fit open roles");
        if (branchBoost) reasons.push(`Same branch (${builder?.branch})`);
        if ((signedCounts.get(offer.builderId) ?? 0) > 0) reasons.push(`${signedCounts.get(offer.builderId)} signed tasks`);
        if (offer.hoursPerWeek >= 6) reasons.push(`${offer.hoursPerWeek}h / week`);
        return { fit: Math.round(fit * 100), reasons: reasons.slice(0, 3) };
    };

    const mapIncoming = (offer: typeof incoming[number]) => {
        const builder = builderById.get(offer.builderId);
        const scored = offer.status === "new" || offer.status === "tryout" ? scoreOffer(offer) : { fit: 0, reasons: [] as string[] };
        return {
            id: offer.id,
            status: offer.status,
            body: offer.body,
            hoursPerWeek: offer.hoursPerWeek,
            availableDays: offer.availableDays ?? [],
            skills: offer.skills ?? [],
            phases: offer.phases ?? [],
            links: offer.links ?? [],
            ideaId: offer.ideaId,
            problemId: offer.problemId,
            title: titleMap.get(offer.ideaId || "") || titleMap.get(offer.problemId || "") || "Request",
            kind: offer.ideaId ? "idea" as const : "problem" as const,
            createdAt: offer.createdAt,
            fitScore: scored.fit,
            fitReasons: scored.reasons,
            builder: builder ? {
                id: builder.id,
                displayName: builder.displayName || builder.username || "Student",
                branch: builder.branch,
                semester: builder.semester,
                headline: builder.headline,
                skills: builder.campusSkills ?? [],
                signedTasks: signedCounts.get(builder.id) ?? 0,
                githubUrl: builder.githubUrl,
                profilePicUrl: builder.profilePicUrl,
            } : null,
        };
    };

    const sortByFit = <T extends { fitScore: number; createdAt: Date | string }>(rows: T[]) =>
        [...rows].sort((a, b) => b.fitScore - a.fitScore || +new Date(b.createdAt) - +new Date(a.createdAt));

    const incomingMapped = {
        new: sortByFit(incoming.filter((o) => o.status === "new").map(mapIncoming)),
        tryout: sortByFit(incoming.filter((o) => o.status === "tryout").map(mapIncoming)),
        decided: incoming.filter((o) => o.status === "accepted" || o.status === "declined").map(mapIncoming),
    };

    const outgoingMapped = outgoing.map((offer) => ({
        id: offer.id,
        status: offer.status,
        body: offer.body,
        hoursPerWeek: offer.hoursPerWeek,
        skills: offer.skills ?? [],
        phases: offer.phases ?? [],
        ideaId: offer.ideaId,
        problemId: offer.problemId,
        title: titleMap.get(offer.ideaId || "") || titleMap.get(offer.problemId || "") || "Your request",
        kind: offer.ideaId ? "idea" as const : "problem" as const,
        createdAt: offer.createdAt,
        href: offer.status === "accepted" && offer.ideaId
            ? `/ideas/${offer.ideaId}/work`
            : `/offers/${offer.id}`,
    }));

    const invitesMapped = inviteRows.map((row) => ({
        id: row.id,
        ideaId: row.ideaId,
        email: row.email,
        status: row.status,
        createdAt: row.createdAt,
        title: row.title,
        teamStatus: row.teamStatus,
        href: `/invites/${row.id}`,
    }));

    const noticesMapped = noticeRows.map((row) => {
        const body = row.body;
        const day7 = /(day[\s-]*7|silence reopens|check-in)/i.test(body);
        const kind = day7 ? "day7" as const
            : /removed|left the team/i.test(body) ? "team" as const
                : /proposal|offer|request|invite/i.test(body) ? "social" as const
                    : "notice" as const;
        return {
            id: row.id,
            body,
            targetId: row.targetId,
            readAt: row.readAt,
            createdAt: row.createdAt,
            kind,
            href: row.targetId ? (day7 ? `/ideas/${row.targetId}/work` : `/ideas/${row.targetId}`) : null,
        };
    });

    const signatures = signatureRows.map((row) => ({
        taskId: row.id,
        title: row.title,
        role: row.role,
        ideaId: row.ideaId,
        ideaTitle: titleMap.get(row.ideaId) || "Idea",
        assigneeName: row.assigneeId ? assigneeName.get(row.assigneeId) || "Teammate" : "Unassigned",
        href: `/ideas/${row.ideaId}/work`,
    }));

    type Action = {
        id: string;
        priority: number;
        type: "offer" | "invite" | "day7" | "sign" | "tryout";
        title: string;
        body: string;
        href: string;
        meta?: string;
    };
    const actions: Action[] = [];
    for (const notice of noticesMapped.filter((n) => n.kind === "day7" && !n.readAt)) {
        actions.push({
            id: `day7-${notice.id}`,
            priority: 100,
            type: "day7",
            title: "Day-7 check-in",
            body: notice.body,
            href: notice.href || "/inbox",
            meta: "Keep your seat",
        });
    }
    for (const sig of signatures) {
        actions.push({
            id: `sign-${sig.taskId}`,
            priority: 90,
            type: "sign",
            title: `Sign “${sig.title}”`,
            body: `${sig.assigneeName} submitted work on ${sig.ideaTitle}`,
            href: sig.href,
            meta: "Proof waiting",
        });
    }
    for (const offer of incomingMapped.new.slice(0, 12)) {
        actions.push({
            id: `offer-${offer.id}`,
            priority: 70 + Math.round((offer.fitScore || 0) / 5),
            type: "offer",
            title: offer.builder ? `${offer.builder.displayName} wants to join` : "New join request",
            body: offer.title,
            href: `/offers/${offer.id}`,
            meta: offer.fitScore ? `${offer.fitScore}% fit` : "New",
        });
    }
    for (const offer of incomingMapped.tryout) {
        actions.push({
            id: `tryout-${offer.id}`,
            priority: 65,
            type: "tryout",
            title: "Tryout in progress",
            body: offer.title,
            href: `/offers/${offer.id}`,
            meta: "Decide after tryout",
        });
    }
    for (const invite of invitesMapped.filter((i) => i.status === "pending")) {
        actions.push({
            id: `invite-${invite.id}`,
            priority: 60,
            type: "invite",
            title: "Team invite",
            body: invite.title,
            href: invite.href,
            meta: "Accept or decline",
        });
    }
    actions.sort((a, b) => b.priority - a.priority);

    const unreadNotices = noticesMapped.filter((n) => !n.readAt).length;
    const pendingOffers = incomingMapped.new.length + incomingMapped.tryout.length;
    const pendingInvites = invitesMapped.filter((i) => i.status === "pending").length;

    if (ownedIdeas.some((i) => !i.embedding) || builders.some((b) => !b.profileEmbedding)) nudgeEmbeddings();

    return {
        summary: {
            actionCount: actions.length,
            unreadNotices,
            pendingOffers,
            pendingInvites,
            awaitingSignature: signatures.length,
            outgoingOpen: outgoingMapped.filter((o) => o.status === "new" || o.status === "tryout").length,
            usingModel: Boolean(usingModel),
        },
        actions: actions.slice(0, 20),
        incoming: incomingMapped,
        outgoing: outgoingMapped,
        invites: invitesMapped,
        notices: noticesMapped,
        signatures,
    };
}

export async function markNoticeRead(userId: string, noticeId: string) {
    const viewer = await requireUser(userId);
    const [row] = await db.select().from(notices).where(and(eq(notices.id, noticeId), eq(notices.userId, viewer.id))).limit(1);
    if (!row) throw new CampusError(404, "Notice not found");
    if (!row.readAt) {
        await db.update(notices).set({ readAt: new Date() }).where(eq(notices.id, noticeId));
    }
    return { ok: true as const };
}

export async function markAllNoticesRead(userId: string) {
    const viewer = await requireUser(userId);
    await db.update(notices).set({ readAt: new Date() })
        .where(and(eq(notices.userId, viewer.id), isNull(notices.readAt)));
    return { ok: true as const };
}

export async function inboxBadge(userId: string) {
    // One round trip: this runs on every page load, so it must stay fast on slow links.
    const result = await db.execute(sql`
        select
            (select count(*) from notices n
                where n.user_id = u.id and n.read_at is null) as unread_notices,
            (select count(*) from offers o
                where o.status in ('new', 'tryout')
                  and (o.idea_id in (select i.id from ideas i where i.owner_id = u.id)
                    or o.problem_id in (select p.id from problems p where p.author_id = u.id))) as pending_offers,
            (select count(*) from sprint_invites si
                where si.email = u.email and si.status = 'pending') as pending_invites,
            (select count(*) from tasks t
                where t.receipt_status = 'submitted'
                  and t.idea_id in (select i.id from ideas i where i.owner_id = u.id)) as awaiting_signature
        from users u
        where u.id = ${userId}
    `);
    const row = result.rows[0] as Record<string, string | number> | undefined;
    if (!row) throw new CampusError(401, "Unauthorized");
    const unreadNotices = Number(row.unread_notices ?? 0);
    const pendingOffers = Number(row.pending_offers ?? 0);
    const pendingInvites = Number(row.pending_invites ?? 0);
    const awaitingSignature = Number(row.awaiting_signature ?? 0);
    const total = unreadNotices + pendingOffers + pendingInvites + awaitingSignature;
    return { count: total, unreadNotices, pendingOffers, pendingInvites, awaitingSignature };
}

async function mustTask(id: string) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) throw new CampusError(404, "Task not found");
    return task;
}

export async function getWork(userId: string, ideaId: string) {
    const viewer = await requireUser(userId);
    const idea = await mustIdea(ideaId);
    if (!(await onTeam(idea, viewer.id))) throw new CampusError(403, "The workspace is for the team");
    const sprint = idea.sprintId ? (await db.select().from(sprints).where(eq(sprints.id, idea.sprintId)))[0] : await ensureSprint();
    const members = await db.select().from(teamMembers).where(eq(teamMembers.ideaId, idea.id));
    const active = members.filter((member) => !member.leftAt);
    const peopleIds = [idea.ownerId, ...members.map((member) => member.userId)];
    const people = peopleIds.length
        ? await db.select({ id: users.id, displayName: users.displayName, username: users.username, email: users.email }).from(users).where(inArray(users.id, peopleIds))
        : [];
    const nameOf = (id: string) => {
        const person = people.find((row) => row.id === id);
        return person?.displayName || person?.username || "Teammate";
    };
    const checkRows = await db.select().from(checkIns).where(eq(checkIns.ideaId, idea.id));
    const taskRows = await db.select().from(tasks).where(eq(tasks.ideaId, idea.id)).orderBy(desc(tasks.createdAt));
    const [approach] = await db.select().from(approaches).where(eq(approaches.ideaId, idea.id));
    const boundary = day7Of(sprint.endsAt);
    const missed = new Date() >= boundary;
    const checkedIn = (userId: string) => checkRows.some((row) => row.userId === userId);
    if (missed) {
        const roster = [idea.ownerId, ...active.map((member) => member.userId)];
        for (const memberId of roster) {
            if (checkedIn(memberId)) continue;
            const [sent] = await db.select({ id: events.id }).from(events).where(and(
                eq(events.kind, "day7_reminder"),
                eq(events.actorId, memberId),
                eq(events.targetId, idea.id),
            ));
            if (sent) continue;
            const person = people.find((row) => row.id === memberId);
            if (!person) continue;
            await logEvent("day7_reminder", memberId, "idea", idea.id);
            await notify(person.id, person.email, "Day 7 check-in", `Day 7 check-in for “${idea.title}”: write done, stuck, and next in the workspace. Silence reopens your role.`, idea.id);
        }
        const now = new Date();
        let helpNeeded = [...(idea.helpNeeded ?? [])];
        for (const member of active) {
            if (member.userId === idea.ownerId || checkedIn(member.userId)) continue;
            await db.update(teamMembers).set({
                leftAt: now,
                exitReason: DAY7_EXIT,
            }).where(and(
                eq(teamMembers.ideaId, idea.id),
                eq(teamMembers.userId, member.userId),
                isNull(teamMembers.leftAt),
            ));
            member.leftAt = now;
            member.exitReason = DAY7_EXIT;
            for (const role of rolesHeldBy(taskRows, member.userId)) {
                helpNeeded = withRoleOpen(helpNeeded, role);
            }
        }
        if (!checkedIn(idea.ownerId)) {
            for (const role of rolesHeldBy(taskRows, idea.ownerId)) {
                helpNeeded = withRoleOpen(helpNeeded, role);
            }
        }
        if (JSON.stringify(helpNeeded) !== JSON.stringify(idea.helpNeeded ?? [])) {
            await db.update(ideas).set({ helpNeeded }).where(eq(ideas.id, idea.id));
            idea.helpNeeded = helpNeeded;
        }
    }
    const reopened = missed
        ? [
            ...(checkedIn(idea.ownerId) ? [] : [idea.ownerId]),
            ...members
                .filter((member) => member.exitReason === DAY7_EXIT && !checkedIn(member.userId))
                .map((member) => member.userId),
        ]
        : [];
    return {
        idea: publicIdea(idea, false, null),
        approach: approach ? { body: approach.body, contactEmail: approach.contactEmail } : null,
        roster: [
            { userId: idea.ownerId, name: nameOf(idea.ownerId), role: "author", leftAt: null },
            ...members.map((member) => ({
                userId: member.userId,
                name: nameOf(member.userId),
                role: "collaborator",
                leftAt: member.leftAt,
                exitReason: member.exitReason,
            })),
        ],
        tasks: taskRows,
        checkIns: checkRows,
        reopenedUserIds: reopened,
        day7: boundary,
        endsAt: sprint.endsAt,
        isAuthor: idea.ownerId === viewer.id,
    };
}

export async function addTask(userId: string, ideaId: string, input: { title: string; description?: string; role?: string; assigneeId?: string }) {
    const idea = await mustIdea(ideaId);
    if (idea.ownerId !== userId) throw new CampusError(403, "Only the author adds tasks");
    if (input.assigneeId && input.assigneeId !== idea.ownerId && !(await onTeam(idea, input.assigneeId))) {
        throw new CampusError(400, "Assign the task to someone on the team");
    }
    const [task] = await db.insert(tasks).values({
        ideaId,
        title: input.title.trim(),
        description: input.description?.trim() || "",
        role: input.role?.trim() || null,
        assigneeId: input.assigneeId ?? null,
        status: "todo",
    }).returning();
    return { task };
}

export async function reassignTask(userId: string, taskId: string, assigneeId?: string | null) {
    const task = await mustTask(taskId);
    const idea = await mustIdea(task.ideaId);
    if (idea.ownerId !== userId) throw new CampusError(403, "Only the author can reassign tasks");
    if (task.frozenAt || task.status === "submitted" || task.status === "done") {
        throw new CampusError(400, "Frozen or submitted tasks cannot be reassigned");
    }
    if (assigneeId && assigneeId !== idea.ownerId && !(await onTeam(idea, assigneeId))) {
        throw new CampusError(400, "Assign the task to someone on the team");
    }
    const [updated] = await db.update(tasks).set({ assigneeId: assigneeId ?? null }).where(eq(tasks.id, task.id)).returning();
    return { task: updated };
}

export async function startTask(userId: string, taskId: string) {
    const task = await mustTask(taskId);
    if (task.assigneeId !== userId) throw new CampusError(403, "Only the assignee can start this task");
    if (task.status !== "todo" || task.frozenAt) throw new CampusError(400, "This task cannot be started");
    const [updated] = await db.update(tasks).set({ status: "in_progress" }).where(eq(tasks.id, task.id)).returning();
    return { task: updated };
}

export async function updateTaskDraft(userId: string, taskId: string, description: string, links: string[]) {
    const task = await mustTask(taskId);
    if (task.assigneeId !== userId) throw new CampusError(403, "Only the assignee can edit this task");
    if (task.frozenAt || (task.status !== "todo" && task.status !== "in_progress")) {
        throw new CampusError(400, "Frozen text cannot be edited");
    }
    const [updated] = await db.update(tasks).set({ description, links }).where(eq(tasks.id, task.id)).returning();
    return { task: updated };
}

export async function submitTask(userId: string, taskId: string) {
    const task = await mustTask(taskId);
    if (task.assigneeId !== userId) throw new CampusError(403, "Only the assignee can submit this task");
    if (task.frozenAt || (task.status !== "todo" && task.status !== "in_progress")) {
        throw new CampusError(400, "This task is already frozen");
    }
    const [updated] = await db.update(tasks).set({
        status: "submitted",
        receiptStatus: "submitted",
        frozenAt: new Date(),
    }).where(eq(tasks.id, task.id)).returning();
    await logEvent("submit", userId, "task", task.id, { ideaId: task.ideaId });
    return { task: updated };
}

export async function signTask(userId: string, taskId: string) {
    const task = await mustTask(taskId);
    const idea = await mustIdea(task.ideaId);
    if (task.assigneeId === userId) throw new CampusError(400, "You cannot sign your own work");
    if (!(await onTeam(idea, userId))) throw new CampusError(403, "Only a teammate can sign");
    if (task.status !== "submitted" || task.receiptStatus === "signed") throw new CampusError(400, "This task is not waiting for a signature");
    const [updated] = await db.update(tasks).set({
        status: "done",
        receiptStatus: "signed",
        signedAt: new Date(),
        witnessId: userId,
    }).where(eq(tasks.id, task.id)).returning();
    await logEvent("signature", userId, "task", task.id, { assigneeId: task.assigneeId });
    return { task: updated };
}

export async function disputeTask(userId: string, taskId: string) {
    const task = await mustTask(taskId);
    const idea = await mustIdea(task.ideaId);
    if (idea.ownerId !== userId) throw new CampusError(403, "Only the author can dispute a line");
    if (task.receiptStatus !== "signed" && task.status !== "done") throw new CampusError(400, "Only a signed line can be disputed");
    const [updated] = await db.update(tasks).set({ status: "disputed", receiptStatus: "disputed" }).where(eq(tasks.id, task.id)).returning();
    return { task: updated };
}

export async function checkIn(userId: string, ideaId: string, input: { done: string; stuck: string; next: string }) {
    const idea = await mustIdea(ideaId);
    if (!(await onTeam(idea, userId))) throw new CampusError(403, "Only the team checks in");
    const [existing] = await db.select().from(checkIns).where(and(eq(checkIns.ideaId, ideaId), eq(checkIns.userId, userId)));
    if (existing) {
        const [updated] = await db.update(checkIns).set(input).where(eq(checkIns.id, existing.id)).returning();
        return { checkIn: updated };
    }
    const [created] = await db.insert(checkIns).values({ ideaId, userId, ...input }).returning();
    return { checkIn: created };
}

export async function shipIdea(userId: string, ideaId: string) {
    const idea = await mustIdea(ideaId);
    if (idea.ownerId !== userId) throw new CampusError(403, "Only the author can mark the sprint shipped");
    const [updated] = await db.update(ideas).set({ teamStatus: "shipped", status: "closed" }).where(eq(ideas.id, idea.id)).returning();
    const members = await db.select().from(teamMembers).where(and(eq(teamMembers.ideaId, idea.id), isNull(teamMembers.leftAt)));
    const ids = [idea.ownerId, ...members.map((member) => member.userId)];
    const people = await db.select().from(users).where(inArray(users.id, ids));
    const signed = await db.select().from(tasks).where(and(eq(tasks.ideaId, idea.id), eq(tasks.receiptStatus, "signed")));
    const summary = signed.map((task) => task.title).join(", ") || "No signed lines";
    for (const person of people) {
        await notify(person.id, person.email, "Closeout", `“${idea.title}” is marked shipped. Signed lines: ${summary}`, idea.id);
    }
    return { idea: publicIdea(updated, false, null), signed };
}

export async function inviteMember(userId: string, ideaId: string, email: string) {
    const idea = await mustIdea(ideaId);
    if (idea.ownerId !== userId) throw new CampusError(403, "Only the author can invite");
    const sprint = await ensureSprint();
    if (new Date() > new Date(sprint.endsAt)) throw new CampusError(400, "This sprint is no longer taking requests");
    if (await activeCollaborators(idea.id) >= MAX_COLLABORATORS) throw new CampusError(400, `This team already has ${TEAM_MAX} people`);
    const normalized = email.trim().toLowerCase();
    const [pending] = await db.select().from(sprintInvites).where(and(
        eq(sprintInvites.ideaId, idea.id),
        eq(sprintInvites.email, normalized),
        eq(sprintInvites.status, "pending"),
    ));
    if (pending) throw new CampusError(400, "That invite is already waiting");
    const [invite] = await db.insert(sprintInvites).values({ ideaId: idea.id, email: normalized, status: "pending" }).returning();
    const [person] = await db.select().from(users).where(eq(users.email, normalized));
    if (person) await notify(person.id, person.email, "You are invited", `You are invited to “${idea.title}”. A seat is not a receipt until you accept.`, invite.id);
    else enqueueMail({ to: normalized, subject: "You are invited to Attest", text: `You are invited to “${idea.title}”. Sign in with this email and accept the invite.` });
    return { invite };
}

export async function getInvite(userId: string, inviteId: string) {
    const user = await requireUser(userId);
    const [invite] = await db.select().from(sprintInvites).where(eq(sprintInvites.id, inviteId));
    if (!invite) throw new CampusError(404, "Invite not found");
    if (invite.email !== user.email.toLowerCase()) throw new CampusError(403, "This invite is for a different email");
    const idea = await mustIdea(invite.ideaId);
    const [owner] = await db.select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        branch: users.branch,
        semester: users.semester,
        headline: users.headline,
    }).from(users).where(eq(users.id, idea.ownerId));
    const collaborators = await activeCollaborators(idea.id);
    return {
        invite: {
            id: invite.id,
            status: invite.status,
            createdAt: invite.createdAt,
            email: invite.email,
        },
        idea: {
            id: idea.id,
            title: idea.title,
            blurb: idea.blurb || (idea.pitch ? idea.pitch.slice(0, 160) : null),
            stage: idea.stage,
            teamStatus: idea.teamStatus,
            helpNeeded: idea.helpNeeded ?? [],
            seatsOpen: idea.teamStatus === "open" && collaborators < MAX_COLLABORATORS,
            collaboratorCount: collaborators,
        },
        owner: owner ? {
            id: owner.id,
            displayName: owner.displayName || owner.username || "Author",
            branch: owner.branch,
            semester: owner.semester,
            headline: owner.headline,
        } : null,
    };
}

export async function respondInvite(userId: string, inviteId: string, action: "accept" | "decline") {
    const user = await requireReady(userId);
    const [invite] = await db.select().from(sprintInvites).where(eq(sprintInvites.id, inviteId));
    if (!invite) throw new CampusError(404, "Invite not found");
    if (invite.email !== user.email.toLowerCase()) throw new CampusError(403, "This invite is for a different email");
    if (invite.status !== "pending") throw new CampusError(400, "This invite is already decided");
    if (action === "decline") {
        await db.update(sprintInvites).set({ status: "declined" }).where(eq(sprintInvites.id, invite.id));
        return { status: "declined" };
    }
    await addCollaborator(invite.ideaId, user.id);
    await db.update(sprintInvites).set({ status: "accepted" }).where(eq(sprintInvites.id, invite.id));
    await logEvent("join", user.id, "idea", invite.ideaId, { inviteId: invite.id });
    return { status: "accepted", ideaId: invite.ideaId };
}

export async function leaveTeam(userId: string, ideaId: string) {
    const idea = await mustIdea(ideaId);
    if (idea.ownerId === userId) throw new CampusError(400, "The author does not leave this way");
    const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.ideaId, idea.id), eq(teamMembers.userId, userId), isNull(teamMembers.leftAt)));
    if (!member) throw new CampusError(400, "You are not on this team");
    await db.update(teamMembers).set({ leftAt: new Date(), exitReason: "left" }).where(and(eq(teamMembers.ideaId, idea.id), eq(teamMembers.userId, userId)));
    return { left: true };
}

export async function removeMember(userId: string, ideaId: string, memberId: string, reason: string) {
    const idea = await mustIdea(ideaId);
    if (idea.ownerId !== userId) throw new CampusError(403, "Only the author can remove a member");
    if (memberId === idea.ownerId) throw new CampusError(400, "The author stays");
    const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.ideaId, idea.id), eq(teamMembers.userId, memberId), isNull(teamMembers.leftAt)));
    if (!member) throw new CampusError(400, "That person is not an active member");
    const now = new Date();
    await db.update(teamMembers).set({ leftAt: now, exitReason: reason.trim() }).where(and(eq(teamMembers.ideaId, idea.id), eq(teamMembers.userId, memberId)));
    const openTasks = await db.select().from(tasks).where(and(eq(tasks.ideaId, idea.id), eq(tasks.assigneeId, memberId), eq(tasks.status, "in_progress")));
    for (const task of openTasks) {
        await db.update(tasks).set({
            status: "submitted",
            receiptStatus: "removed",
            frozenAt: now,
            removedAt: now,
        }).where(eq(tasks.id, task.id));
    }
    const person = await requireUser(memberId);
    await notify(person.id, person.email, "You were removed from a team", `You were removed from “${idea.title}”. Reason: ${reason.trim()}. Work you already submitted stays on your proof page.`, idea.id);
    await logEvent("kick", userId, "idea", idea.id, { userId: memberId, reason: reason.trim() });
    return { removed: true };
}

export async function forkIdea(userId: string, ideaId: string) {
    const user = await requireReady(userId);
    const source = await mustIdea(ideaId);
    visibleOrThrow(source.hiddenAt, user, source.ownerId);
    assertIdeaCampus(source, user);
    const sprint = await ensureSprint();
    const visibility = source.visibility === "minimal" || source.visibility === "open" ? source.visibility : "standard";
    const showBrief = visibility === "standard" || visibility === "open";
    const teaser = (source.blurb?.trim() || source.pitch || source.description || "Remix of a campus idea").slice(0, 160);
    // Fork only the public slice — never the private approach.
    const pitch = showBrief
        ? (source.pitch || source.description || teaser)
        : `${teaser}\n\n(Fill in your own full pitch — the original brief stays gated.)`;
    const audience = showBrief ? (source.audience || "The same people as the original") : "Who this remixed build is for";
    const gap = showBrief ? (source.gap || "Carried from the original") : "What is still missing in your remix";
    const ships = showBrief ? (source.ships || source.pitch || source.description || teaser) : "What will exist in two weeks for your remix";
    const idea = await insertIdeaRecord(user, {
        title: source.title.startsWith("Remix:") ? source.title : `Remix: ${source.title}`.slice(0, 120),
        pitch: pitch.slice(0, 2000),
        audience: audience.slice(0, 2000),
        gap: gap.slice(0, 2000),
        ships: ships.slice(0, 2000),
        helpNeeded: source.helpNeeded ?? [],
        stage: "idea",
        isSmall: source.isSmall,
        hourCap: source.hourCap,
        compensationSentence: source.compensationSentence || VOLUNTEER_SENTENCE,
        hideName: false,
        visibility: "standard",
        blurb: teaser,
        duplicateOfId: source.id,
        forkedFromId: source.id,
        sprintId: sprint.id,
    });
    await db.insert(approaches).values({
        ideaId: idea.id,
        body: "Fill in your own approach. Forking never copies the original private notes.",
        contactEmail: user.email,
    });
    const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.ideaId, source.id), eq(teamMembers.userId, user.id)));
    if (member?.leftAt && member.exitReason !== "left") {
        const frozen = await db.select().from(tasks).where(and(eq(tasks.ideaId, source.id), eq(tasks.assigneeId, user.id), isNotNull(tasks.frozenAt)));
        for (const task of frozen) {
            await db.insert(tasks).values({
                ideaId: idea.id,
                title: task.title,
                description: task.description,
                links: task.links,
                role: task.role,
                status: task.status,
                assigneeId: user.id,
                receiptStatus: task.receiptStatus,
                frozenAt: task.frozenAt,
                signedAt: task.signedAt,
                removedAt: task.removedAt,
                witnessId: task.witnessId,
            });
        }
    }
    await logEvent("fork", user.id, "idea", idea.id, { sourceId: source.id });
    return { idea: publicIdea(idea, false, null, 0, { viewerIsMember: true }) };
}

export async function proofLines(viewerId: string, subjectId: string) {
    const viewer = await requireUser(viewerId);
    const subject = await requireUser(subjectId);
    const [page] = await db.select().from(proofPages).where(eq(proofPages.userId, subject.id));
    const published = Boolean(page?.published);
    const own = viewer.id === subject.id;
    if (!own && !published) return { published: false, lines: [], displayName: subject.displayName };
    const taskRows = await db.select().from(tasks).where(eq(tasks.assigneeId, subject.id));
    const declined = await db.select().from(events).where(and(eq(events.kind, "tryout_declined"), eq(events.actorId, subject.id)));
    const lines = [
        ...taskRows.filter((task) => task.frozenAt || task.receiptStatus).map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            role: task.role,
            receiptStatus: task.receiptStatus,
            frozenAt: task.frozenAt,
            signedAt: task.signedAt,
            removedAt: task.removedAt,
            ideaId: task.ideaId,
        })),
        ...declined.map((event) => ({
            id: event.id,
            title: "Tryout declined",
            description: String((event.payload as { brief?: string } | null)?.brief ?? ""),
            role: "Tryout",
            receiptStatus: "submitted",
            frozenAt: event.createdAt,
            signedAt: null,
            removedAt: null,
            ideaId: null,
        })),
    ];
    const visible = own ? lines : lines.filter((line) => line.receiptStatus === "signed");
    return { published, lines: visible, displayName: subject.displayName, own };
}

export async function publishProof(userId: string, published: boolean) {
    await requireUser(userId);
    const [existing] = await db.select().from(proofPages).where(eq(proofPages.userId, userId));
    if (existing) {
        await db.update(proofPages).set({ published }).where(eq(proofPages.userId, userId));
    } else {
        await db.insert(proofPages).values({ userId, published });
    }
    return { published };
}

export async function fileReport(userId: string, targetType: "idea" | "problem", targetId: string, reason: "spam" | "copied work") {
    await requireUser(userId);
    if (targetType === "idea") {
        const idea = await mustIdea(targetId);
        await db.update(ideas).set({ hiddenAt: new Date() }).where(eq(ideas.id, idea.id));
    } else {
        const problem = await mustProblem(targetId);
        await db.update(problems).set({ hiddenAt: new Date() }).where(eq(problems.id, problem.id));
    }
    const [report] = await db.insert(reports).values({
        reporterId: userId,
        targetType,
        targetId,
        reason,
        status: "pending",
    }).returning();
    return { reportId: report.id, hidden: true };
}

export async function listReports(userId: string) {
    const viewer = await requireUser(userId);
    if (!viewer.isAdmin) throw new CampusError(403, "The report queue is for an admin");
    const rows = await db.select().from(reports).where(eq(reports.status, "pending")).orderBy(desc(reports.createdAt)).limit(50);

    const ideaIds = rows.filter((r) => r.targetType === "idea").map((r) => r.targetId);
    const problemIds = rows.filter((r) => r.targetType === "problem").map((r) => r.targetId);

    const ideaList = ideaIds.length > 0 ? await db.select({ id: ideas.id, title: ideas.title, ownerId: ideas.ownerId }).from(ideas).where(inArray(ideas.id, ideaIds)) : [];
    const problemList = problemIds.length > 0 ? await db.select({ id: problems.id, title: problems.title, authorId: problems.authorId }).from(problems).where(inArray(problems.id, problemIds)) : [];

    const ideaMap = new Map(ideaList.map((i) => [i.id, i]));
    const problemMap = new Map(problemList.map((p) => [p.id, p]));

    const enriched = rows.map((r) => {
        const targetTitle = r.targetType === "idea" ? ideaMap.get(r.targetId)?.title : problemMap.get(r.targetId)?.title;
        return {
            ...r,
            targetTitle: targetTitle || null,
        };
    });

    return { reports: enriched };
}

export async function resolveReport(userId: string, reportId: string, action: "restore" | "keep") {
    const viewer = await requireUser(userId);
    if (!viewer.isAdmin) throw new CampusError(403, "The report queue is for an admin");
    const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
    if (!report) throw new CampusError(404, "Report not found");
    await db.update(reports).set({
        status: "reviewed",
        resolution: action === "restore" ? "restored" : "hidden",
    }).where(eq(reports.id, report.id));
    if (action === "restore") {
        const [others] = await db.select({ c: count() }).from(reports).where(and(
            eq(reports.targetId, report.targetId),
            eq(reports.status, "pending"),
        ));
        if (Number(others?.c ?? 0) === 0) {
            if (report.targetType === "problem") await db.update(problems).set({ hiddenAt: null }).where(eq(problems.id, report.targetId));
            else await db.update(ideas).set({ hiddenAt: null }).where(eq(ideas.id, report.targetId));
        }
    }
    return { resolved: true };
}

export async function saveTarget(userId: string, targetType: "idea" | "problem", targetId: string) {
    await requireUser(userId);
    if (targetType === "idea") await mustIdea(targetId);
    else await mustProblem(targetId);
    const [existing] = await db.select().from(saves).where(and(
        eq(saves.userId, userId),
        eq(saves.targetType, targetType),
        eq(saves.targetId, targetId),
    ));
    if (!existing) await db.insert(saves).values({ userId, targetType, targetId });
    return { saved: true };
}

export async function unsaveTarget(userId: string, targetType: "idea" | "problem", targetId: string) {
    await db.delete(saves).where(and(eq(saves.userId, userId), eq(saves.targetType, targetType), eq(saves.targetId, targetId)));
    return { saved: false };
}

export async function listSaved(userId: string, cursor?: string) {
    const viewer = await requireUser(userId);
    const filters = [eq(saves.userId, viewer.id), eq(saves.targetType, "idea")];
    const at = cursor ? (() => {
        try {
            const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { at?: string; id?: string };
            const when = raw.at ? new Date(raw.at) : null;
            return when && !Number.isNaN(when.getTime()) && raw.id ? { at: when, id: raw.id } : null;
        } catch {
            return null;
        }
    })() : null;
    if (at) {
        filters.push(or(
            lt(saves.createdAt, at.at),
            and(eq(saves.createdAt, at.at), lt(saves.id, at.id)),
        )!);
    }
    const rows = await db
        .select({ save: saves, idea: ideas })
        .from(saves)
        .innerJoin(ideas, eq(ideas.id, saves.targetId))
        .where(and(...filters, isNull(ideas.hiddenAt), isNotNull(ideas.pitch), ideaCampusVisible(campusOf(viewer))))
        .orderBy(desc(saves.createdAt), desc(saves.id))
        .limit(21);
    const page = rows.slice(0, 20);
    const forks = await forkCountsFor(page.map((row) => row.idea.id));
    const last = page[page.length - 1];
    const ideaCards = await withIdeaImages(page.map((row) => publicIdea(row.idea, true, null, forks.get(row.idea.id) ?? 0)));

    // Saved problems (first page only — bookmarks are few per student in a sprint)
    let savedProblems: ReturnType<typeof publicProblem>[] = [];
    if (!cursor) {
        const problemRows = await db
            .select({ save: saves, problem: problems })
            .from(saves)
            .innerJoin(problems, eq(problems.id, saves.targetId))
            .where(and(eq(saves.userId, viewer.id), eq(saves.targetType, "problem"), isNull(problems.hiddenAt)))
            .orderBy(desc(saves.createdAt), desc(saves.id))
            .limit(40);
        const linkedIdeas = problemRows.length
            ? await db.select({ id: ideas.id, problemId: ideas.problemId }).from(ideas).where(inArray(
                ideas.problemId,
                problemRows.map((row) => row.problem.id),
            ))
            : [];
        const ideaByProblem = new Map(linkedIdeas.filter((row) => row.problemId).map((row) => [row.problemId!, row.id]));
        savedProblems = problemRows.map((row) => publicProblem(
            row.problem,
            true,
            ideaByProblem.get(row.problem.id) ?? null,
            false,
            viewer.id,
        ));
    }

    return {
        ideas: ideaCards,
        problems: savedProblems,
        nextCursor: rows.length > 20 && last
            ? Buffer.from(JSON.stringify({ at: last.save.createdAt.toISOString(), id: last.save.id }), "utf8").toString("base64url")
            : null,
    };
}

const HELP = [
    { q: "Who can sign in?", a: "Anyone. Use Continue with Google or get a one-time code by email. A university email is optional: signing in with one earns the Verified student stamp and unlocks the campus features (My campus, campus-only posts). Attest is not affiliated with any university." },
    { q: "How do I thank someone?", a: "Profiles can carry a “Buy me a coffee” link to the person's own tipping page. Tips are voluntary and go straight to them; Attest never handles money. Add yours under Profile → Account." },
    { q: "What does My campus / Everywhere do?", a: "Your campus is everyone who signed in with the same university email domain. The switch on Ideas, Problems, People and Gigs shows either only them or every campus. You can also mark an idea or gig “Only my campus”, and other universities won't see it at all." },
    { q: "How does paid work happen?", a: "Attest never holds money. The idea owner and a builder agree a deal split into milestones. The builder submits each one, the owner accepts it (or it auto-accepts after 7 days), the owner pays the builder directly, and both confirm the payment here. Only payments both sides confirm count as proof. Builders pay no fee. Paid work is for people 18 or older." },
    { q: "What is a gig?", a: "A small job with one milestone. Post “I need this done” or list a service you offer. When the poster accepts a response, it becomes a deal straight away. Gigs show your handle, not your name." },
    { q: "What is “I'd use this”?", a: "A way to tell a builder there is real demand, separate from likes. The card shows the total and how many are on your campus." },
    { q: "Can I get help with an assignment here?", a: "No. Graded coursework, exams and assignments are not allowed for either side, paid or free. Posts that read like coursework are reviewed and hidden. See the house rules at /rules." },
    { q: "How do I get from empty to shipping?", a: "Finish your profile → post an idea or a problem → ask classmates on People or wait for offers → accept one teammate → open the workspace → submit a task → the owner signs it → it lands on your proof page." },
    { q: "What is public on an idea?", a: "Owners choose visibility. Minimal shows a short teaser and roles. Standard also shows the full brief. Open can show the approach text campus-wide. Contact email and workspace stay for accepted teammates. First published time is always shown so authorship is clear." },
    { q: "What is the difference between Ideas and Problems?", a: "Ideas are builds looking for teammates. Problems are campus pains — you propose an idea to own the fix. Ideas use indigo; Problems use amber so the boards stay distinct." },
    { q: "What is a receipt?", a: "A teammate who is not you signs a submitted task. That signature is the receipt. You cannot sign your own work. Likes are social, not credit." },
    { q: "Can I fork an idea?", a: "Yes. Fork starts your own related idea and credits the original. It only copies what was public for that card’s visibility — never private approach notes. Forks skip the two-idea cap. If you were removed from a team, frozen submissions can come with you." },
    { q: "What happens if I am removed?", a: "The author needs a reason. Work you already submitted stays. You can fork the idea. The fork cites the original and carries your frozen submissions." },
    { q: "How big is a team?", a: "Four people, including the author. An invite is not a seat until you accept. A seat is not a receipt." },
];

export function helpAnswers() {
    return { answers: HELP };
}

export async function draftText(_kind: "idea" | "problem" | "help", _notes: string) {
    // Paid LLM drafts (Gemini/Grok) are disallowed. Self-hosted NLP does not draft free text yet.
    return {
        enabled: false as const,
        draft: null,
        message: "Drafting is off for this sprint — write in your own words.",
    };
}
