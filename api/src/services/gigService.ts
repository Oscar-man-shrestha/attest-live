/**
 * Gigs board: quick freelancing between students.
 *  - request: the author needs something done (author = requester).
 *  - offer:   the author sells a service (author = builder).
 * Accepting a response creates an active one-milestone engagement. All Phase 1 money rules apply:
 * Attest never holds money, paid gigs need both sides 18+, graded coursework is banned.
 */
import {
    and,
    count,
    db,
    desc,
    engagements,
    eq,
    gigResponses,
    gigs,
    inArray,
    isNull,
    lt,
    milestones,
    or,
    users,
} from "../../../packages/db/index";
import { DEFAULT_IP_TERMS, formatMoney, toMinor, type CreateGigInput } from "../../../packages/types";
import { CampusError, campusOf, flagIfAcademic, requireUser } from "./campusService";
import { activePaidCount, logEvent, MAX_ACTIVE_PAID_PER_BUILDER, notifyUser, requireWriter } from "./dealService";

type GigRow = typeof gigs.$inferSelect;
type UserRow = typeof users.$inferSelect;

const PAGE = 20;
const MAX_OPEN_GIGS = 5;

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

function gigVisible(viewerCampus: string) {
    return or(eq(gigs.campusOnly, false), eq(gigs.campusDomain, viewerCampus))!;
}

async function mustGig(id: string, viewer: UserRow) {
    const [gig] = await db.select().from(gigs).where(eq(gigs.id, id));
    if (!gig) throw new CampusError(404, "Gig not found");
    const own = gig.authorId === viewer.id;
    if (gig.hiddenAt && !own && !viewer.isAdmin) throw new CampusError(404, "Gig not found");
    if (gig.campusOnly && !own && !viewer.isAdmin && gig.campusDomain !== campusOf(viewer)) throw new CampusError(404, "Gig not found");
    return gig;
}

function gigDto(gig: GigRow, author: Pick<UserRow, "id" | "username"> | undefined, viewer: UserRow, responseCount?: number) {
    const paid = gig.dealType === "paid_fixed";
    return {
        id: gig.id,
        kind: gig.kind,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        dealType: gig.dealType,
        paid,
        currency: gig.currency,
        priceMinor: gig.priceMinor,
        price: paid ? formatMoney(gig.priceMinor, gig.currency) : null,
        deliveryDays: gig.deliveryDays,
        campusOnly: gig.campusOnly,
        sameCampus: Boolean(gig.campusDomain && gig.campusDomain === campusOf(viewer)),
        status: gig.status,
        hidden: Boolean(gig.hiddenAt),
        createdAt: gig.createdAt,
        author: { id: gig.authorId, handle: author?.username ?? "" },
        mine: gig.authorId === viewer.id,
        responseCount: gig.authorId === viewer.id ? responseCount ?? 0 : undefined,
    };
}

export async function createGig(userId: string, input: CreateGigInput) {
    const author = await requireWriter(userId);
    const paid = input.dealType === "paid_fixed";
    if (paid && !author.adultConfirmedAt) {
        throw new CampusError(403, "Paid gigs need you to confirm you are 18 or older first (Profile → Account)");
    }
    const [open] = await db.select({ n: count() }).from(gigs).where(and(eq(gigs.authorId, author.id), eq(gigs.status, "open"), isNull(gigs.hiddenAt)));
    if (Number(open?.n ?? 0) >= MAX_OPEN_GIGS) throw new CampusError(400, "Five open gigs is the cap. Close one first.");
    const [gig] = await db.insert(gigs).values({
        authorId: author.id,
        kind: input.kind,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        dealType: input.dealType,
        currency: paid ? input.currency ?? null : null,
        priceMinor: paid && input.price ? toMinor(input.price) : null,
        deliveryDays: input.deliveryDays ?? null,
        campusDomain: campusOf(author),
        campusOnly: input.campusOnly,
        notAcademicAttestedAt: new Date(),
    }).returning();
    await flagIfAcademic("gig", gig.id, `${input.title}\n${input.description}`);
    await logEvent("gig_posted", author.id, "gig", gig.id, { kind: input.kind });
    return { gig: gigDto(gig, author, author, 0) };
}

export async function listGigs(userId: string, query: { kind: string; campus?: string; category?: string; mine?: string; cursor?: string }) {
    const viewer = await requireUser(userId);
    const viewerCampus = campusOf(viewer);
    const filters = query.mine === "1"
        ? [eq(gigs.authorId, viewer.id)]
        : [eq(gigs.kind, query.kind), eq(gigs.status, "open"), isNull(gigs.hiddenAt), gigVisible(viewerCampus)];
    if (query.campus === "1") filters.push(eq(gigs.campusDomain, viewerCampus));
    if (query.category) filters.push(eq(gigs.category, query.category));
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(gigs.createdAt, cursor.at),
            and(eq(gigs.createdAt, cursor.at), lt(gigs.id, cursor.id)),
        )!);
    }
    const rows = await db.select().from(gigs).where(and(...filters)).orderBy(desc(gigs.createdAt), desc(gigs.id)).limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    const authors = page.length
        ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, [...new Set(page.map((g) => g.authorId))]))
        : [];
    const byId = new Map(authors.map((a) => [a.id, a]));
    const mineIds = page.filter((g) => g.authorId === viewer.id).map((g) => g.id);
    const counts = new Map<string, number>();
    if (mineIds.length) {
        const rowsCount = await db.select({ gigId: gigResponses.gigId, n: count() }).from(gigResponses)
            .where(and(inArray(gigResponses.gigId, mineIds), eq(gigResponses.status, "new"))).groupBy(gigResponses.gigId);
        rowsCount.forEach((r) => counts.set(r.gigId, Number(r.n)));
    }
    const last = page[page.length - 1];
    return {
        gigs: page.map((g) => gigDto(g, byId.get(g.authorId), viewer, counts.get(g.id))),
        nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

export async function getGig(userId: string, gigId: string) {
    const viewer = await requireUser(userId);
    const gig = await mustGig(gigId, viewer);
    const [author] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, gig.authorId));
    const mine = gig.authorId === viewer.id;
    const rows = await db.select().from(gigResponses)
        .where(mine ? eq(gigResponses.gigId, gig.id) : and(eq(gigResponses.gigId, gig.id), eq(gigResponses.userId, viewer.id)))
        .orderBy(desc(gigResponses.createdAt)).limit(50);
    const people = rows.length
        ? await db.select({ id: users.id, username: users.username, adultConfirmedAt: users.adultConfirmedAt, emailDomain: users.emailDomain })
            .from(users).where(inArray(users.id, rows.map((r) => r.userId)))
        : [];
    const byId = new Map(people.map((p) => [p.id, p]));
    const responses = rows.map((r) => {
        const person = byId.get(r.userId);
        return {
            id: r.id,
            note: r.note,
            status: r.status,
            engagementId: r.engagementId,
            createdAt: r.createdAt,
            user: { id: r.userId, handle: person?.username ?? "", isAdult: Boolean(person?.adultConfirmedAt), sameCampus: Boolean(person?.emailDomain && person.emailDomain === gig.campusDomain) },
        };
    });
    return {
        gig: gigDto(gig, author, viewer, rows.filter((r) => r.status === "new").length),
        responses: mine ? responses : [],
        myResponse: mine ? null : responses[0] ?? null,
    };
}

export async function respondToGig(userId: string, gigId: string, note: string) {
    const responder = await requireWriter(userId);
    const gig = await mustGig(gigId, responder);
    if (gig.authorId === responder.id) throw new CampusError(400, "This is your own gig");
    if (gig.status !== "open" || gig.hiddenAt) throw new CampusError(400, "This gig is closed");
    if (gig.dealType === "paid_fixed" && !responder.adultConfirmedAt) {
        throw new CampusError(403, "Paid gigs need you to confirm you are 18 or older first (Profile → Account)");
    }
    const [existing] = await db.select({ id: gigResponses.id }).from(gigResponses).where(and(eq(gigResponses.gigId, gig.id), eq(gigResponses.userId, responder.id)));
    if (existing) throw new CampusError(400, "You already responded to this gig");
    const [response] = await db.insert(gigResponses).values({ gigId: gig.id, userId: responder.id, note: note.trim() }).returning();
    const author = await requireUser(gig.authorId);
    await notifyUser(author, gig.kind === "request" ? "Someone can do your gig" : "Someone wants your service",
        `@${responder.username} responded to “${gig.title}”. Open the gig to read their note and accept or decline.`, gig.id);
    await logEvent("gig_response", responder.id, "gig", gig.id);
    return { response: { id: response.id, note: response.note, status: response.status, engagementId: null, createdAt: response.createdAt } };
}

async function mustResponse(responseId: string, authorId: string) {
    const [response] = await db.select().from(gigResponses).where(eq(gigResponses.id, responseId));
    if (!response) throw new CampusError(404, "Response not found");
    const [gig] = await db.select().from(gigs).where(eq(gigs.id, response.gigId));
    if (!gig || gig.authorId !== authorId) throw new CampusError(404, "Response not found");
    return { response, gig };
}

/** The gig author accepts a response → an active one-milestone deal. Both sides have already opted in. */
export async function acceptResponse(userId: string, responseId: string) {
    const author = await requireWriter(userId);
    const { response, gig } = await mustResponse(responseId, author.id);
    if (response.status !== "new") throw new CampusError(400, "This response was already handled");
    if (gig.hiddenAt) throw new CampusError(400, "This gig is hidden");
    if (gig.kind === "request" && gig.status !== "open") throw new CampusError(400, "This gig is closed");
    const responder = await requireUser(response.userId);
    if (responder.suspendedAt) throw new CampusError(400, "That account can't take deals right now");
    const requester = gig.kind === "request" ? author : responder;
    const builder = gig.kind === "request" ? responder : author;
    const paid = gig.dealType === "paid_fixed";
    if (paid) {
        if (!requester.adultConfirmedAt || !builder.adultConfirmedAt) throw new CampusError(400, "Paid gigs need both of you to have confirmed you are 18 or older");
        if (await activePaidCount(builder.id) >= MAX_ACTIVE_PAID_PER_BUILDER) {
            throw new CampusError(400, gig.kind === "request" ? "This builder already has two active paid deals" : "You already have two active paid deals. Finish one first.");
        }
    }
    const now = new Date();
    const [engagement] = await db.insert(engagements).values({
        gigId: gig.id,
        requesterId: requester.id,
        builderId: builder.id,
        dealType: gig.dealType,
        currency: paid ? gig.currency : null,
        totalAmountMinor: paid ? gig.priceMinor ?? 0 : 0,
        ipTerms: DEFAULT_IP_TERMS,
        nda: false,
        notAcademicAttestedAt: gig.notAcademicAttestedAt,
        status: "active",
        builderAcceptedAt: now,
    }).returning();
    await db.insert(milestones).values({
        engagementId: engagement.id,
        position: 1,
        title: gig.title,
        amountMinor: paid ? gig.priceMinor ?? 0 : 0,
        dueAt: gig.deliveryDays ? new Date(now.getTime() + gig.deliveryDays * 24 * 60 * 60 * 1000) : null,
    });
    await db.update(gigResponses).set({ status: "hired", engagementId: engagement.id }).where(eq(gigResponses.id, response.id));
    if (gig.kind === "request") await db.update(gigs).set({ status: "closed" }).where(eq(gigs.id, gig.id));
    await logEvent("gig_hired", author.id, "engagement", engagement.id, { gigId: gig.id });
    await notifyUser(responder, "Your gig response was accepted", `@${author.username} accepted your response on “${gig.title}”. The deal is active — open Deals to start.`, engagement.id);
    return { engagementId: engagement.id };
}

export async function declineResponse(userId: string, responseId: string) {
    const author = await requireWriter(userId);
    const { response } = await mustResponse(responseId, author.id);
    if (response.status !== "new") throw new CampusError(400, "This response was already handled");
    await db.update(gigResponses).set({ status: "declined" }).where(eq(gigResponses.id, response.id));
    return { ok: true as const };
}

export async function closeGig(userId: string, gigId: string) {
    const author = await requireWriter(userId);
    const [gig] = await db.select().from(gigs).where(eq(gigs.id, gigId));
    if (!gig || gig.authorId !== author.id) throw new CampusError(404, "Gig not found");
    await db.update(gigs).set({ status: "closed" }).where(eq(gigs.id, gig.id));
    return { ok: true as const };
}
