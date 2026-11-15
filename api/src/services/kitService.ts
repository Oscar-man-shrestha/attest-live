/**
 * Kits: an organiser's need list for a fest, club, event or local business.
 * Each need is a request gig linked to the kit, so builders find it on the Gigs board and the
 * organiser tracks every need from open → hired → delivered → paid on one page.
 * This is the free "single-player" tool for the demand side (MEMORY.md, SaaS direction).
 */
import { and, count, db, desc, engagements, eq, gigResponses, gigs, inArray, isNull, kits, lt, milestones, or, users } from "../../../packages/db/index";
import { formatMoney, toMinor } from "../../../packages/types";
import { CampusError, campusOf, flagIfAcademic, requireUser } from "./campusService";
import { logEvent, requireWriter } from "./dealService";
import { gigDto } from "./gigService";

type KitRow = typeof kits.$inferSelect;
type UserRow = typeof users.$inferSelect;
const PAGE = 20;
const MAX_OPEN_KITS = 5;
const MAX_NEEDS = 20;

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

async function mustKit(id: string, viewer: UserRow) {
    const [kit] = await db.select().from(kits).where(eq(kits.id, id));
    if (!kit) throw new CampusError(404, "Kit not found");
    const own = kit.ownerId === viewer.id;
    if (kit.hiddenAt && !own && !viewer.isAdmin) throw new CampusError(404, "Kit not found");
    if (kit.campusOnly && !own && !viewer.isAdmin && kit.campusDomain !== campusOf(viewer)) throw new CampusError(404, "Kit not found");
    return kit;
}

function kitDto(kit: KitRow, ownerHandle: string, viewer: UserRow, needs = 0, filled = 0) {
    return {
        id: kit.id,
        name: kit.name,
        kind: kit.kind,
        description: kit.description,
        eventDate: kit.eventDate,
        campusOnly: kit.campusOnly,
        sameCampus: Boolean(kit.campusDomain && kit.campusDomain === campusOf(viewer)),
        status: kit.status,
        createdAt: kit.createdAt,
        owner: { id: kit.ownerId, handle: ownerHandle },
        mine: kit.ownerId === viewer.id,
        needs,
        filled,
    };
}

export async function createKit(userId: string, input: { name: string; kind: string; description?: string; eventDate?: string | null; campusOnly: boolean }) {
    const owner = await requireWriter(userId);
    const [open] = await db.select({ n: count() }).from(kits).where(and(eq(kits.ownerId, owner.id), eq(kits.status, "open")));
    if (Number(open?.n ?? 0) >= MAX_OPEN_KITS) throw new CampusError(400, "Five open kits is the cap. Close one first.");
    const [kit] = await db.insert(kits).values({
        ownerId: owner.id,
        name: input.name.trim(),
        kind: input.kind,
        description: input.description?.trim() || null,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        campusDomain: campusOf(owner),
        campusOnly: input.campusOnly,
    }).returning();
    await logEvent("kit_created", owner.id, "kit", kit.id);
    return { kit: kitDto(kit, owner.username, owner) };
}

export async function listKits(userId: string, query: { campus?: string; mine?: string; cursor?: string }) {
    const viewer = await requireUser(userId);
    const viewerCampus = campusOf(viewer);
    const filters = query.mine === "1"
        ? [eq(kits.ownerId, viewer.id)]
        : [eq(kits.status, "open"), isNull(kits.hiddenAt), or(eq(kits.campusOnly, false), eq(kits.campusDomain, viewerCampus))!];
    if (query.campus === "1") filters.push(eq(kits.campusDomain, viewerCampus));
    const cursor = decodeCursor(query.cursor);
    if (cursor) filters.push(or(lt(kits.createdAt, cursor.at), and(eq(kits.createdAt, cursor.at), lt(kits.id, cursor.id)))!);
    const rows = await db.select().from(kits).where(and(...filters)).orderBy(desc(kits.createdAt), desc(kits.id)).limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    const ids = page.map((k) => k.id);
    const owners = ids.length ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, [...new Set(page.map((k) => k.ownerId))])) : [];
    const handles = new Map(owners.map((o) => [o.id, o.username]));
    const needRows = ids.length ? await db.select({ kitId: gigs.kitId, status: gigs.status }).from(gigs).where(and(inArray(gigs.kitId, ids), isNull(gigs.hiddenAt))) : [];
    const last = page[page.length - 1];
    return {
        kits: page.map((k) => {
            const mine = needRows.filter((n) => n.kitId === k.id);
            return kitDto(k, handles.get(k.ownerId) ?? "", viewer, mine.length, mine.filter((n) => n.status === "closed").length);
        }),
        nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

/** Stage of one need, from the organiser's point of view. */
function stageOf(gigStatus: string, deal: { status: string; milestone: string } | undefined) {
    if (!deal) return gigStatus === "open" ? "open" : "closed";
    if (deal.status === "cancelled") return "cancelled";
    if (deal.milestone === "payment_confirmed") return "paid";
    if (deal.milestone === "accepted" || deal.milestone === "auto_accepted") return "delivered";
    if (deal.milestone === "submitted") return "review";
    return "hired";
}

export async function getKit(userId: string, kitId: string) {
    const viewer = await requireUser(userId);
    const kit = await mustKit(kitId, viewer);
    const [owner] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, kit.ownerId));
    const mine = kit.ownerId === viewer.id;
    const needRows = await db.select().from(gigs)
        .where(and(eq(gigs.kitId, kit.id), ...(mine ? [] : [isNull(gigs.hiddenAt)]))).orderBy(desc(gigs.createdAt)).limit(MAX_NEEDS);
    const gigIds = needRows.map((g) => g.id);
    const dealRows = gigIds.length
        ? await db.select({ gigId: engagements.gigId, id: engagements.id, status: engagements.status, builderId: engagements.builderId, milestone: milestones.status })
            .from(engagements).innerJoin(milestones, eq(milestones.engagementId, engagements.id)).where(inArray(engagements.gigId, gigIds))
        : [];
    const responseRows = mine && gigIds.length
        ? await db.select({ gigId: gigResponses.gigId, n: count() }).from(gigResponses)
            .where(and(inArray(gigResponses.gigId, gigIds), eq(gigResponses.status, "new"))).groupBy(gigResponses.gigId)
        : [];
    const newResponses = new Map(responseRows.map((r) => [r.gigId, Number(r.n)]));
    const builderIds = [...new Set(dealRows.map((d) => d.builderId))];
    const builders = builderIds.length ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, builderIds)) : [];
    const builderHandle = new Map(builders.map((b) => [b.id, b.username]));

    let budgetMinor = 0, paidMinor = 0;
    const currencies = new Set<string>();
    const needs = needRows.map((gig) => {
        const deal = dealRows.find((d) => d.gigId === gig.id && d.status !== "cancelled") ?? dealRows.find((d) => d.gigId === gig.id);
        const stage = stageOf(gig.status, deal);
        if (gig.priceMinor && gig.currency) {
            currencies.add(gig.currency);
            if (stage !== "cancelled") budgetMinor += gig.priceMinor;
            if (stage === "paid") paidMinor += gig.priceMinor;
        }
        return {
            ...gigDto(gig, owner, viewer, newResponses.get(gig.id)),
            stage,
            // Only the organiser sees who was hired and the deal link.
            builderHandle: mine && deal ? builderHandle.get(deal.builderId) ?? null : null,
            engagementId: mine && deal ? deal.id : null,
        };
    });
    const currency = currencies.size === 1 ? [...currencies][0] : null;
    const done = needs.filter((n) => n.stage === "paid" || n.stage === "delivered").length;
    return {
        kit: kitDto(kit, owner?.username ?? "", viewer, needs.length, needs.filter((n) => n.stage !== "open").length),
        needs,
        totals: {
            needs: needs.length,
            open: needs.filter((n) => n.stage === "open").length,
            inProgress: needs.filter((n) => n.stage === "hired" || n.stage === "review").length,
            done,
            // Money totals are for the organiser only, and only when every need uses one currency.
            budget: mine && currency ? formatMoney(budgetMinor, currency) : null,
            paidConfirmed: mine && currency ? formatMoney(paidMinor, currency) : null,
        },
    };
}

export async function addNeed(userId: string, kitId: string, input: { title: string; description: string; category: string; dealType: string; currency?: string | null; price?: number | null; deliveryDays?: number | null }) {
    const owner = await requireWriter(userId);
    const [kit] = await db.select().from(kits).where(eq(kits.id, kitId));
    if (!kit || kit.ownerId !== owner.id) throw new CampusError(404, "Kit not found");
    if (kit.status !== "open") throw new CampusError(400, "This kit is closed");
    const paid = input.dealType === "paid_fixed";
    if (paid && !owner.adultConfirmedAt) throw new CampusError(403, "Paid needs require you to confirm you are 18 or older first (Profile → Account)");
    const [existing] = await db.select({ n: count() }).from(gigs).where(eq(gigs.kitId, kit.id));
    if (Number(existing?.n ?? 0) >= MAX_NEEDS) throw new CampusError(400, "A kit holds up to 20 needs");
    const [gig] = await db.insert(gigs).values({
        authorId: owner.id,
        kind: "request",
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        dealType: input.dealType,
        currency: paid ? input.currency ?? null : null,
        priceMinor: paid && input.price ? toMinor(input.price) : null,
        deliveryDays: input.deliveryDays ?? null,
        campusDomain: kit.campusDomain,
        campusOnly: kit.campusOnly,
        notAcademicAttestedAt: new Date(),
        kitId: kit.id,
    }).returning();
    await flagIfAcademic("gig", gig.id, `${kit.name}\n${input.title}\n${input.description}`);
    await logEvent("kit_need_added", owner.id, "gig", gig.id, { kitId: kit.id });
    return getKit(userId, kit.id);
}

export async function closeKit(userId: string, kitId: string) {
    const owner = await requireWriter(userId);
    const [kit] = await db.select().from(kits).where(eq(kits.id, kitId));
    if (!kit || kit.ownerId !== owner.id) throw new CampusError(404, "Kit not found");
    await db.update(kits).set({ status: "closed" }).where(eq(kits.id, kit.id));
    // Needs nobody was hired for close with the kit; hired ones carry on as deals.
    await db.update(gigs).set({ status: "closed" }).where(and(eq(gigs.kitId, kit.id), eq(gigs.status, "open")));
    return { ok: true as const };
}
