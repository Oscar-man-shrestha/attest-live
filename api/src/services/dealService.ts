/**
 * Marketplace Phase 1: engagements (deals), milestones, off-platform payment records,
 * reviews, engagement-scoped threads, account settings and moderation.
 *
 * Attest never holds money (RULES 13). Payments happen off-platform; both sides confirm them here.
 */
import {
    and,
    asc,
    count,
    db,
    desc,
    engagementMessages,
    engagements,
    eq,
    events,
    ideas,
    inArray,
    integrityFlags,
    isNull,
    lt,
    milestones,
    notices,
    or,
    paymentConfirmations,
    problems,
    reviews,
    sql,
    teamMembers,
    users,
} from "../../../packages/db/index";
import {
    DEFAULT_IP_TERMS,
    detectContactDetails,
    formatMoney,
    isPaidDeal,
    toMinor,
    type CreateEngagementInput,
} from "../../../packages/types";
import { CampusError, flagIfAcademic, requireUser } from "./campusService";
import { enqueueMail } from "./mailQueue";

type UserRow = typeof users.$inferSelect;
type EngagementRow = typeof engagements.$inferSelect;
type MilestoneRow = typeof milestones.$inferSelect;

const ACCEPTANCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_REVEAL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_PAID_PER_BUILDER = 2;
const PAGE = 20;
const MESSAGE_PAGE = 30;

// ---------- helpers ----------

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

async function logEvent(kind: string, actorId: string | null, targetType: string, targetId: string, payload?: unknown) {
    await db.insert(events).values({ kind, actorId, targetType, targetId, payload: payload ?? null });
}

/** In-app notice + transactional email (no push; RULES 2). */
async function notifyUser(user: Pick<UserRow, "id" | "email">, subject: string, body: string, targetId: string) {
    await db.insert(notices).values({ userId: user.id, body, targetId });
    enqueueMail({ to: user.email, subject, text: `${body}\n\nOpen Attest → Deals to respond.` });
}

async function mustEngagement(id: string) {
    const [row] = await db.select().from(engagements).where(eq(engagements.id, id));
    if (!row) throw new CampusError(404, "Deal not found");
    return row;
}

async function mustMilestone(id: string) {
    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id));
    if (!milestone) throw new CampusError(404, "Milestone not found");
    const engagement = await mustEngagement(milestone.engagementId);
    return { milestone, engagement };
}

function roleIn(engagement: EngagementRow, user: UserRow): "requester" | "builder" | "admin" {
    if (engagement.requesterId === user.id) return "requester";
    if (engagement.builderId === user.id) return "builder";
    if (user.isAdmin) return "admin";
    throw new CampusError(404, "Deal not found");
}

async function requireWriter(userId: string) {
    const user = await requireUser(userId);
    if (user.suspendedAt) throw new CampusError(403, "Your account is suspended. You can still read and send an appeal.");
    return user;
}

async function activePaidCount(builderId: string) {
    const rows = await db.select({ dealType: engagements.dealType }).from(engagements).where(and(
        eq(engagements.builderId, builderId),
        eq(engagements.status, "active"),
    ));
    return rows.filter((row) => isPaidDeal(row.dealType)).length;
}

function party(user: UserRow | undefined) {
    if (!user) return null;
    return { id: user.id, handle: user.username, displayName: user.displayName, isAdult: Boolean(user.adultConfirmedAt) };
}

function reviewRevealed(engagement: EngagementRow, count: number) {
    if (count >= 2) return true;
    return Boolean(engagement.completedAt && Date.now() - new Date(engagement.completedAt).getTime() >= REVIEW_REVEAL_MS);
}

async function engagementDto(engagement: EngagementRow, viewer: UserRow) {
    const role = roleIn(engagement, viewer);
    const [idea] = await db.select({ id: ideas.id, title: ideas.title }).from(ideas).where(eq(ideas.id, engagement.ideaId));
    const people = await db.select().from(users).where(inArray(users.id, [engagement.requesterId, engagement.builderId]));
    const byId = new Map(people.map((p) => [p.id, p]));
    const steps = await db.select().from(milestones).where(eq(milestones.engagementId, engagement.id)).orderBy(asc(milestones.position));
    const payments = steps.length
        ? await db.select().from(paymentConfirmations).where(inArray(paymentConfirmations.milestoneId, steps.map((s) => s.id)))
        : [];
    const payByMilestone = new Map(payments.map((p) => [p.milestoneId, p]));
    const reviewRows = await db.select().from(reviews).where(eq(reviews.engagementId, engagement.id));
    const revealed = reviewRevealed(engagement, reviewRows.length);
    const mine = reviewRows.find((r) => r.reviewerId === viewer.id) ?? null;
    const theirs = reviewRows.find((r) => r.reviewerId !== viewer.id && (r.revieweeId === viewer.id || role === "admin")) ?? null;
    const paid = isPaidDeal(engagement.dealType);
    return {
        id: engagement.id,
        role,
        idea: idea ?? null,
        requester: party(byId.get(engagement.requesterId)),
        builder: party(byId.get(engagement.builderId)),
        dealType: engagement.dealType,
        paid,
        currency: engagement.currency,
        totalAmountMinor: engagement.totalAmountMinor,
        total: formatMoney(engagement.totalAmountMinor, engagement.currency),
        licence: engagement.licence,
        ipTerms: engagement.ipTerms,
        nda: engagement.nda,
        status: engagement.status,
        createdAt: engagement.createdAt,
        builderAcceptedAt: engagement.builderAcceptedAt,
        completedAt: engagement.completedAt,
        cancelledAt: engagement.cancelledAt,
        cancelReason: engagement.cancelReason,
        threadOpen: engagement.status === "proposed" || engagement.status === "active",
        paymentNotice: paid
            ? "Attest never holds money. Pay directly (UPI, bank, Payoneer, Wise, PayPal…), then both of you confirm it here. Your payment app may show your legal name to the other person."
            : null,
        milestones: steps.map((step) => {
            const pay = payByMilestone.get(step.id);
            return {
                id: step.id,
                position: step.position,
                title: step.title,
                amountMinor: step.amountMinor,
                amount: paid ? formatMoney(step.amountMinor, engagement.currency) : null,
                dueAt: step.dueAt,
                status: step.status,
                deliverableLinks: step.deliverableLinks ?? [],
                note: step.note,
                submittedAt: step.submittedAt,
                acceptanceDeadline: step.acceptanceDeadline,
                acceptedAt: step.acceptedAt,
                disputedAt: step.disputedAt,
                disputeReason: step.disputeReason,
                payment: pay ? {
                    method: pay.method,
                    reference: pay.externalReference,
                    payerConfirmedAt: pay.payerConfirmedAt,
                    payeeConfirmedAt: pay.payeeConfirmedAt,
                } : null,
            };
        }),
        reviews: {
            canReview: engagement.status === "completed" && role !== "admin" && !mine,
            revealed,
            mine: mine ? reviewDto(mine) : null,
            theirs: revealed && theirs ? reviewDto(theirs) : null,
            waitingOnOther: Boolean(mine) && !revealed,
        },
    };
}

function reviewDto(row: typeof reviews.$inferSelect) {
    return {
        onTime: row.onTime,
        communication: row.communication,
        quality: row.quality,
        wouldWorkAgain: row.wouldWorkAgain,
        note: row.note,
        createdAt: row.createdAt,
    };
}

/** Every milestone done (unpaid: accepted; paid: payment confirmed by both) → the engagement completes. */
async function maybeComplete(engagement: EngagementRow) {
    if (engagement.status !== "active") return engagement;
    const steps = await db.select().from(milestones).where(eq(milestones.engagementId, engagement.id));
    const paid = isPaidDeal(engagement.dealType);
    const done = steps.length > 0 && steps.every((s) => paid
        ? s.status === "payment_confirmed"
        : s.status === "accepted" || s.status === "auto_accepted");
    if (!done) return engagement;
    const [updated] = await db.update(engagements).set({ status: "completed", completedAt: new Date() })
        .where(eq(engagements.id, engagement.id)).returning();
    await logEvent("deal_completed", null, "engagement", engagement.id);
    const people = await db.select().from(users).where(inArray(users.id, [engagement.requesterId, engagement.builderId]));
    for (const person of people) {
        await notifyUser(person, "Deal complete — leave a review", "A deal you were part of is complete. Leave a short review; it stays hidden until you both review or 14 days pass.", engagement.id);
    }
    return updated;
}

// ---------- engagements ----------

export async function createEngagement(userId: string, input: CreateEngagementInput) {
    const requester = await requireWriter(userId);
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, input.ideaId));
    if (!idea || !idea.pitch || idea.hiddenAt) throw new CampusError(404, "Idea not found");
    if (idea.ownerId !== requester.id) throw new CampusError(403, "Only the idea owner can propose a deal");
    if (input.builderId === requester.id) throw new CampusError(400, "You can't make a deal with yourself");
    const [member] = await db.select().from(teamMembers).where(and(
        eq(teamMembers.ideaId, idea.id),
        eq(teamMembers.userId, input.builderId),
        isNull(teamMembers.leftAt),
    ));
    if (!member) throw new CampusError(400, "The builder has to be on this idea's team first (accept their request)");
    const builder = await requireUser(input.builderId);

    const paid = isPaidDeal(input.dealType);
    if (paid && !requester.adultConfirmedAt) throw new CampusError(403, "Paid deals need you to confirm you are 18 or older first");
    if (paid && !builder.adultConfirmedAt) throw new CampusError(400, "This builder hasn't confirmed they are 18 or older, so the deal can't be paid. Pick an unpaid deal type.");
    if (paid && await activePaidCount(builder.id) >= MAX_ACTIVE_PAID_PER_BUILDER) {
        throw new CampusError(400, "This builder already has two active paid deals");
    }
    const [open] = await db.select({ n: count() }).from(engagements).where(and(
        eq(engagements.ideaId, idea.id),
        eq(engagements.builderId, builder.id),
        inArray(engagements.status, ["proposed", "active"]),
    ));
    if (Number(open?.n ?? 0) > 0) throw new CampusError(400, "You already have an open deal with this builder on this idea");

    const steps = input.milestones.map((m, index) => ({
        position: index + 1,
        title: m.title.trim(),
        amountMinor: paid ? toMinor(m.amount ?? 0) : 0,
        dueAt: m.dueAt ? new Date(m.dueAt) : null,
    }));
    const total = steps.reduce((sum, s) => sum + s.amountMinor, 0);

    const [engagement] = await db.insert(engagements).values({
        ideaId: idea.id,
        requesterId: requester.id,
        builderId: builder.id,
        dealType: input.dealType,
        currency: paid ? input.currency ?? null : null,
        totalAmountMinor: total,
        licence: input.dealType === "open_source" ? input.licence ?? null : null,
        ipTerms: input.ipTerms?.trim() || DEFAULT_IP_TERMS,
        nda: input.nda,
        notAcademicAttestedAt: new Date(),
        status: "proposed",
    }).returning();
    await db.insert(milestones).values(steps.map((s) => ({ ...s, engagementId: engagement.id })));
    await flagIfAcademic("engagement", engagement.id, [idea.title, ...steps.map((s) => s.title), input.ipTerms ?? ""].join("\n"));
    await logEvent("deal_proposed", requester.id, "engagement", engagement.id, { ideaId: idea.id, dealType: input.dealType });
    await notifyUser(builder, "You've been offered a deal", `The owner of “${idea.title}” proposed a ${paid ? "paid " : ""}deal with ${steps.length} milestone${steps.length === 1 ? "" : "s"}. Review the terms and accept or decline.`, engagement.id);
    return { engagement: await engagementDto(engagement, requester) };
}

export async function listEngagements(userId: string, query: { cursor?: string }) {
    const viewer = await requireUser(userId);
    const filters = [or(eq(engagements.requesterId, viewer.id), eq(engagements.builderId, viewer.id))!];
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(engagements.createdAt, cursor.at),
            and(eq(engagements.createdAt, cursor.at), lt(engagements.id, cursor.id)),
        )!);
    }
    const rows = await db.select().from(engagements).where(and(...filters))
        .orderBy(desc(engagements.createdAt), desc(engagements.id)).limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    const ideaRows = page.length ? await db.select({ id: ideas.id, title: ideas.title }).from(ideas).where(inArray(ideas.id, page.map((r) => r.ideaId))) : [];
    const titles = new Map(ideaRows.map((r) => [r.id, r.title]));
    const people = page.length ? await db.select().from(users).where(inArray(users.id, [...new Set(page.flatMap((r) => [r.requesterId, r.builderId]))])) : [];
    const byId = new Map(people.map((p) => [p.id, p]));
    const stepRows = page.length ? await db.select({ engagementId: milestones.engagementId, status: milestones.status })
        .from(milestones).where(inArray(milestones.engagementId, page.map((r) => r.id))) : [];
    const last = page[page.length - 1];
    return {
        engagements: page.map((row) => {
            const role = row.requesterId === viewer.id ? "requester" : "builder";
            const other = byId.get(role === "requester" ? row.builderId : row.requesterId);
            const mine = stepRows.filter((s) => s.engagementId === row.id);
            return {
                id: row.id,
                role,
                ideaTitle: titles.get(row.ideaId) ?? "",
                otherHandle: other?.username ?? null,
                dealType: row.dealType,
                total: formatMoney(row.totalAmountMinor, row.currency),
                status: row.status,
                milestonesDone: mine.filter((s) => ["accepted", "auto_accepted", "payment_confirmed"].includes(s.status)).length,
                milestonesTotal: mine.length,
                needsYou: needsAction(row, role, mine.map((s) => s.status)),
                createdAt: row.createdAt,
            };
        }),
        nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

function needsAction(row: EngagementRow, role: "requester" | "builder", statuses: string[]) {
    if (row.status === "proposed") return role === "builder";
    if (row.status !== "active") return false;
    if (role === "requester") return statuses.includes("submitted") || (isPaidDeal(row.dealType) && statuses.some((s) => s === "accepted" || s === "auto_accepted"));
    return statuses.includes("open") || statuses.includes("disputed");
}

export async function getEngagement(userId: string, engagementId: string) {
    const viewer = await requireUser(userId);
    const engagement = await mustEngagement(engagementId);
    return { engagement: await engagementDto(engagement, viewer) };
}

export async function acceptEngagement(userId: string, engagementId: string) {
    const builder = await requireWriter(userId);
    const engagement = await mustEngagement(engagementId);
    if (engagement.builderId !== builder.id) throw new CampusError(403, "Only the builder can accept this deal");
    if (engagement.status !== "proposed") throw new CampusError(400, "This deal is no longer waiting for you");
    if (isPaidDeal(engagement.dealType)) {
        if (!builder.adultConfirmedAt) throw new CampusError(403, "Paid deals need you to confirm you are 18 or older first");
        if (await activePaidCount(builder.id) >= MAX_ACTIVE_PAID_PER_BUILDER) {
            throw new CampusError(400, "You already have two active paid deals. Finish one first.");
        }
    }
    const [updated] = await db.update(engagements).set({ status: "active", builderAcceptedAt: new Date() })
        .where(eq(engagements.id, engagement.id)).returning();
    await logEvent("deal_accepted", builder.id, "engagement", engagement.id);
    const requester = await requireUser(engagement.requesterId);
    await notifyUser(requester, "Your deal was accepted", `${builder.username} accepted your deal. Work can start on the first milestone.`, engagement.id);
    return { engagement: await engagementDto(updated, builder) };
}

export async function cancelEngagement(userId: string, engagementId: string, reason: string) {
    const user = await requireWriter(userId);
    const engagement = await mustEngagement(engagementId);
    const role = roleIn(engagement, user);
    if (role === "admin") throw new CampusError(403, "Only the two parties can cancel a deal");
    if (engagement.status !== "proposed" && engagement.status !== "active") throw new CampusError(400, "This deal is already closed");
    const [updated] = await db.update(engagements).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason.trim() })
        .where(eq(engagements.id, engagement.id)).returning();
    await logEvent("deal_cancelled", user.id, "engagement", engagement.id, { reason: reason.trim() });
    const other = await requireUser(role === "requester" ? engagement.builderId : engagement.requesterId);
    await notifyUser(other, "A deal was cancelled", `${user.username} cancelled a deal: “${reason.trim()}”. Milestones already accepted stay on both records.`, engagement.id);
    return { engagement: await engagementDto(updated, user) };
}

// ---------- milestones ----------

export async function submitMilestone(userId: string, milestoneId: string, input: { links: string[]; note?: string }) {
    const builder = await requireWriter(userId);
    const { milestone, engagement } = await mustMilestone(milestoneId);
    if (engagement.builderId !== builder.id) throw new CampusError(403, "Only the builder submits milestones");
    if (engagement.status !== "active") throw new CampusError(400, "The deal isn't active");
    if (milestone.status !== "open" && milestone.status !== "disputed") throw new CampusError(400, "This milestone is already submitted");
    const now = new Date();
    await db.update(milestones).set({
        status: "submitted",
        deliverableLinks: input.links,
        note: input.note?.trim() || null,
        submittedAt: now,
        acceptanceDeadline: new Date(now.getTime() + ACCEPTANCE_WINDOW_MS),
    }).where(eq(milestones.id, milestone.id));
    await logEvent("milestone_submitted", builder.id, "milestone", milestone.id);
    const requester = await requireUser(engagement.requesterId);
    await notifyUser(requester, "A milestone is ready for review", `“${milestone.title}” was submitted. Accept it or raise a dispute within 7 days; after that it is accepted automatically.`, engagement.id);
    return getEngagement(userId, engagement.id);
}

export async function acceptMilestone(userId: string, milestoneId: string) {
    const requester = await requireWriter(userId);
    const { milestone, engagement } = await mustMilestone(milestoneId);
    if (engagement.requesterId !== requester.id) throw new CampusError(403, "Only the requester accepts milestones");
    if (milestone.status !== "submitted") throw new CampusError(400, "This milestone isn't waiting for review");
    await db.update(milestones).set({ status: "accepted", acceptedAt: new Date() }).where(eq(milestones.id, milestone.id));
    await logEvent("milestone_accepted", requester.id, "milestone", milestone.id);
    const builder = await requireUser(engagement.builderId);
    const paid = isPaidDeal(engagement.dealType);
    await notifyUser(builder, "Milestone accepted", paid
        ? `“${milestone.title}” was accepted. Once you receive payment, confirm it in the deal.`
        : `“${milestone.title}” was accepted and is on your record.`, engagement.id);
    await maybeComplete(engagement);
    return getEngagement(userId, engagement.id);
}

export async function disputeMilestone(userId: string, milestoneId: string, reason: string) {
    const requester = await requireWriter(userId);
    const { milestone, engagement } = await mustMilestone(milestoneId);
    if (engagement.requesterId !== requester.id) throw new CampusError(403, "Only the requester can dispute");
    if (milestone.status !== "submitted") throw new CampusError(400, "Only a submitted milestone can be disputed");
    await db.update(milestones).set({ status: "disputed", disputedAt: new Date(), disputeReason: reason.trim(), acceptanceDeadline: null })
        .where(eq(milestones.id, milestone.id));
    await logEvent("milestone_disputed", requester.id, "milestone", milestone.id, { reason: reason.trim() });
    const builder = await requireUser(engagement.builderId);
    await notifyUser(builder, "Changes requested on a milestone", `“${milestone.title}” needs changes: “${reason.trim()}”. Update the work and submit again.`, engagement.id);
    return getEngagement(userId, engagement.id);
}

export async function recordPayment(userId: string, milestoneId: string, input: { method: string; reference?: string }) {
    const requester = await requireWriter(userId);
    const { milestone, engagement } = await mustMilestone(milestoneId);
    if (engagement.requesterId !== requester.id) throw new CampusError(403, "Only the requester records a payment");
    if (!isPaidDeal(engagement.dealType)) throw new CampusError(400, "This deal is unpaid");
    if (milestone.status !== "accepted" && milestone.status !== "auto_accepted") {
        throw new CampusError(400, "Record payment after the milestone is accepted");
    }
    const now = new Date();
    await db.insert(paymentConfirmations).values({
        milestoneId: milestone.id,
        method: input.method,
        externalReference: input.reference?.trim() || null,
        payerConfirmedAt: now,
    }).onConflictDoUpdate({
        target: paymentConfirmations.milestoneId,
        set: { method: input.method, externalReference: input.reference?.trim() || null, payerConfirmedAt: now },
    });
    await logEvent("payment_sent", requester.id, "milestone", milestone.id, { method: input.method });
    const builder = await requireUser(engagement.builderId);
    await notifyUser(builder, "Payment sent — please confirm", `The requester says they paid ${formatMoney(milestone.amountMinor, engagement.currency) ?? ""} for “${milestone.title}” by ${input.method.replace("_", " ")}. Confirm once it reaches you.`, engagement.id);
    return getEngagement(userId, engagement.id);
}

export async function confirmPaymentReceived(userId: string, milestoneId: string) {
    const builder = await requireWriter(userId);
    const { milestone, engagement } = await mustMilestone(milestoneId);
    if (engagement.builderId !== builder.id) throw new CampusError(403, "Only the builder confirms receipt");
    const [pay] = await db.select().from(paymentConfirmations).where(eq(paymentConfirmations.milestoneId, milestone.id));
    if (!pay?.payerConfirmedAt) throw new CampusError(400, "The requester hasn't recorded a payment yet");
    if (milestone.status === "payment_confirmed") throw new CampusError(400, "Already confirmed");
    await db.update(paymentConfirmations).set({ payeeConfirmedAt: new Date() }).where(eq(paymentConfirmations.id, pay.id));
    await db.update(milestones).set({ status: "payment_confirmed" }).where(eq(milestones.id, milestone.id));
    await logEvent("payment_confirmed", builder.id, "milestone", milestone.id);
    const requester = await requireUser(engagement.requesterId);
    await notifyUser(requester, "Payment confirmed", `${builder.username} confirmed they received payment for “${milestone.title}”. It now counts as paid proof for both of you.`, engagement.id);
    await maybeComplete(engagement);
    return getEngagement(userId, engagement.id);
}

/** Worker: submitted milestones past their 7-day window are accepted automatically. */
export async function autoAcceptDueMilestones() {
    const due = await db.select().from(milestones).where(and(
        eq(milestones.status, "submitted"),
        lt(milestones.acceptanceDeadline, new Date()),
    )).limit(50);
    for (const milestone of due) {
        await db.update(milestones).set({ status: "auto_accepted", acceptedAt: new Date() }).where(eq(milestones.id, milestone.id));
        await logEvent("milestone_auto_accepted", null, "milestone", milestone.id);
        const engagement = await mustEngagement(milestone.engagementId);
        const people = await db.select().from(users).where(inArray(users.id, [engagement.requesterId, engagement.builderId]));
        for (const person of people) {
            await notifyUser(person, "Milestone accepted automatically", `“${milestone.title}” passed its 7-day review window and was accepted automatically.`, engagement.id);
        }
        await maybeComplete(engagement);
    }
    return due.length;
}

// ---------- reviews ----------

export async function submitReview(userId: string, engagementId: string, input: { onTime: number; communication: number; quality: number; wouldWorkAgain: boolean; note?: string }) {
    const reviewer = await requireWriter(userId);
    const engagement = await mustEngagement(engagementId);
    const role = roleIn(engagement, reviewer);
    if (role === "admin") throw new CampusError(403, "Only the two parties review");
    if (engagement.status !== "completed") throw new CampusError(400, "Reviews open when the deal is complete");
    const revieweeId = role === "requester" ? engagement.builderId : engagement.requesterId;
    const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.engagementId, engagement.id), eq(reviews.reviewerId, reviewer.id)));
    if (existing) throw new CampusError(400, "You already reviewed this deal");
    await db.insert(reviews).values({
        engagementId: engagement.id,
        reviewerId: reviewer.id,
        revieweeId,
        onTime: input.onTime,
        communication: input.communication,
        quality: input.quality,
        wouldWorkAgain: input.wouldWorkAgain,
        note: input.note?.trim() || null,
    });
    await logEvent("review", reviewer.id, "engagement", engagement.id);
    return getEngagement(userId, engagement.id);
}

/** Distributions only, never averages (RULES 19). Only revealed reviews count. */
export async function reviewSummaryFor(personId: string) {
    const rows = await db.execute(sql`
        select r.on_time, r.communication, r.quality, r.would_work_again
        from reviews r
        join engagements e on e.id = r.engagement_id
        where r.reviewee_id = ${personId}
          and (
            (select count(*) from reviews r2 where r2.engagement_id = r.engagement_id) >= 2
            or e.completed_at < now() - interval '14 days'
          )`);
    const list = rows.rows as { on_time: number; communication: number; quality: number; would_work_again: boolean }[];
    const dist = (key: "on_time" | "communication" | "quality") => [1, 2, 3, 4, 5].map((score) => list.filter((r) => Number(r[key]) === score).length);
    return {
        count: list.length,
        onTime: dist("on_time"),
        communication: dist("communication"),
        quality: dist("quality"),
        wouldWorkAgain: { yes: list.filter((r) => r.would_work_again).length, no: list.filter((r) => !r.would_work_again).length },
    };
}

/** Deal record for proof pages: completed work with both-sides confirmation. */
export async function dealRecordFor(personId: string) {
    const rows = await db.execute(sql`
        select e.id, e.deal_type, e.currency, i.title,
               count(m.id) filter (where m.status in ('accepted','auto_accepted','payment_confirmed'))::int as done,
               count(m.id) filter (where m.status = 'payment_confirmed')::int as paid_done,
               coalesce(sum(m.amount_minor) filter (where m.status = 'payment_confirmed'), 0)::int as paid_minor,
               e.completed_at,
               case when e.builder_id = ${personId} then 'builder' else 'requester' end as role
        from engagements e
        join ideas i on i.id = e.idea_id
        left join milestones m on m.engagement_id = e.id
        where (e.builder_id = ${personId} or e.requester_id = ${personId}) and e.status in ('active','completed')
        group by e.id, i.title
        order by e.created_at desc
        limit 20`);
    const list = rows.rows as { id: string; deal_type: string; currency: string | null; title: string; done: number; paid_done: number; paid_minor: number; completed_at: Date | null; role: string }[];
    return list.filter((r) => r.done > 0).map((r) => ({
        id: r.id,
        title: r.title,
        role: r.role,
        dealType: r.deal_type,
        milestonesDone: Number(r.done),
        paidMilestones: Number(r.paid_done),
        paidConfirmed: isPaidDeal(r.deal_type) ? formatMoney(Number(r.paid_minor), r.currency) : null,
        completedAt: r.completed_at,
    }));
}

// ---------- engagement-scoped thread (no open DMs; RULES 2) ----------

export async function listMessages(userId: string, engagementId: string, query: { cursor?: string }) {
    const viewer = await requireUser(userId);
    const engagement = await mustEngagement(engagementId);
    roleIn(engagement, viewer);
    const filters = [eq(engagementMessages.engagementId, engagement.id)];
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(engagementMessages.createdAt, cursor.at),
            and(eq(engagementMessages.createdAt, cursor.at), lt(engagementMessages.id, cursor.id)),
        )!);
    }
    const rows = await db.select().from(engagementMessages).where(and(...filters))
        .orderBy(desc(engagementMessages.createdAt), desc(engagementMessages.id)).limit(MESSAGE_PAGE + 1);
    const page = rows.slice(0, MESSAGE_PAGE);
    const last = page[page.length - 1];
    const handles = new Map<string, string>();
    const people = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, [engagement.requesterId, engagement.builderId]));
    people.forEach((p) => handles.set(p.id, p.username));
    return {
        open: engagement.status === "proposed" || engagement.status === "active",
        messages: page.map((m) => ({
            id: m.id,
            mine: m.userId === viewer.id,
            handle: handles.get(m.userId) ?? "",
            body: m.body,
            flag: m.flag,
            createdAt: m.createdAt,
        })),
        nextCursor: rows.length > MESSAGE_PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

export async function postMessage(userId: string, engagementId: string, body: string) {
    const author = await requireWriter(userId);
    const engagement = await mustEngagement(engagementId);
    const role = roleIn(engagement, author);
    if (role === "admin") throw new CampusError(403, "Only the two parties can write here");
    if (engagement.status !== "proposed" && engagement.status !== "active") throw new CampusError(400, "This thread is archived");
    const since = new Date(Date.now() - 60_000);
    const [recent] = await db.select({ n: count() }).from(engagementMessages).where(and(
        eq(engagementMessages.engagementId, engagement.id),
        eq(engagementMessages.userId, author.id),
        sql`${engagementMessages.createdAt} > ${since}`,
    ));
    if (Number(recent?.n ?? 0) >= 10) throw new CampusError(429, "Slow down a little");
    const flag = detectContactDetails(body);
    const [message] = await db.insert(engagementMessages).values({ engagementId: engagement.id, userId: author.id, body: body.trim(), flag }).returning();
    return {
        message: { id: message.id, mine: true, handle: author.username, body: message.body, flag: message.flag, createdAt: message.createdAt },
        warning: flag ? "Keep payment details in the payment step, and be careful sharing contact details. Attest can't protect deals made outside it." : null,
    };
}

// ---------- account settings ----------

export async function setHandle(userId: string, handle: string) {
    const user = await requireWriter(userId);
    const next = handle.trim().toLowerCase();
    if (next === user.username) return { handle: next };
    const reserved = ["admin", "attest", "support", "moderator", "staff", "root", "help"];
    if (reserved.includes(next)) throw new CampusError(400, "That handle is reserved");
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, next));
    if (taken) throw new CampusError(409, "That handle is taken");
    await db.update(users).set({ username: next }).where(eq(users.id, user.id));
    await logEvent("handle_changed", user.id, "user", user.id, { from: user.username, to: next });
    return { handle: next };
}

export async function confirmAdult(userId: string) {
    const user = await requireWriter(userId);
    if (!user.adultConfirmedAt) {
        await db.update(users).set({ adultConfirmedAt: new Date() }).where(eq(users.id, user.id));
        await logEvent("adult_confirmed", user.id, "user", user.id);
    }
    return { isAdult: true };
}

export async function setPrivacy(userId: string, showInstitution: boolean) {
    const user = await requireWriter(userId);
    await db.update(users).set({ showInstitution }).where(eq(users.id, user.id));
    return { showInstitution };
}

export async function appealSuspension(userId: string, text: string) {
    const user = await requireUser(userId);
    if (!user.suspendedAt) throw new CampusError(400, "Your account isn't suspended");
    await db.update(users).set({ suspensionAppeal: text.trim(), appealedAt: new Date() }).where(eq(users.id, user.id));
    await logEvent("suspension_appeal", user.id, "user", user.id);
    const admins = await db.select().from(users).where(eq(users.isAdmin, true));
    for (const admin of admins) {
        await notifyUser(admin, "Suspension appeal", `${user.username} appealed their suspension.`, user.id);
    }
    return { appealed: true };
}

// ---------- moderation (admin only) ----------

async function requireAdmin(userId: string) {
    const user = await requireUser(userId);
    if (!user.isAdmin) throw new CampusError(403, "Admins only");
    return user;
}

export async function listIntegrityFlags(userId: string, query: { cursor?: string }) {
    await requireAdmin(userId);
    const filters = [eq(integrityFlags.status, "pending")];
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(integrityFlags.createdAt, cursor.at),
            and(eq(integrityFlags.createdAt, cursor.at), lt(integrityFlags.id, cursor.id)),
        )!);
    }
    const rows = await db.select().from(integrityFlags).where(and(...filters))
        .orderBy(desc(integrityFlags.createdAt), desc(integrityFlags.id)).limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    const ideaIds = page.filter((f) => f.targetType === "idea").map((f) => f.targetId);
    const problemIds = page.filter((f) => f.targetType === "problem").map((f) => f.targetId);
    const titles = new Map<string, string>();
    if (ideaIds.length) (await db.select({ id: ideas.id, title: ideas.title }).from(ideas).where(inArray(ideas.id, ideaIds))).forEach((r) => titles.set(r.id, r.title));
    if (problemIds.length) (await db.select({ id: problems.id, title: problems.title }).from(problems).where(inArray(problems.id, problemIds))).forEach((r) => titles.set(r.id, r.title));
    const appeals = await db.select({ id: users.id, username: users.username, suspendedReason: users.suspendedReason, suspensionAppeal: users.suspensionAppeal, appealedAt: users.appealedAt })
        .from(users).where(and(sql`${users.suspendedAt} is not null`, sql`${users.appealedAt} is not null`)).limit(PAGE);
    const last = page[page.length - 1];
    return {
        flags: page.map((f) => ({
            id: f.id,
            targetType: f.targetType,
            targetId: f.targetId,
            title: titles.get(f.targetId) ?? null,
            source: f.source,
            label: f.label,
            score: f.score === null ? null : Number(f.score),
            matched: f.matched,
            createdAt: f.createdAt,
        })),
        appeals,
        nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

export async function resolveIntegrityFlag(userId: string, flagId: string, action: "clear" | "confirm") {
    const admin = await requireAdmin(userId);
    const [flag] = await db.select().from(integrityFlags).where(eq(integrityFlags.id, flagId));
    if (!flag) throw new CampusError(404, "Flag not found");
    await db.update(integrityFlags).set({ status: action === "clear" ? "cleared" : "confirmed", reviewerId: admin.id, reviewedAt: new Date() })
        .where(eq(integrityFlags.id, flag.id));
    if (action === "confirm") {
        // Confirmed graded-coursework requests are hidden, never auto-suspended (RULES 17).
        if (flag.targetType === "idea") await db.update(ideas).set({ hiddenAt: new Date() }).where(eq(ideas.id, flag.targetId));
        if (flag.targetType === "problem") await db.update(problems).set({ hiddenAt: new Date() }).where(eq(problems.id, flag.targetId));
        if (flag.targetType === "engagement") {
            await db.update(engagements).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "Removed: graded coursework is not allowed on Attest" })
                .where(and(eq(engagements.id, flag.targetId), inArray(engagements.status, ["proposed", "active"])));
        }
    }
    await logEvent("integrity_resolved", admin.id, flag.targetType, flag.targetId, { action });
    return { ok: true as const };
}

export async function suspendUser(userId: string, targetId: string, reason: string) {
    const admin = await requireAdmin(userId);
    if (admin.id === targetId) throw new CampusError(400, "You can't suspend yourself");
    const target = await requireUser(targetId);
    await db.update(users).set({ suspendedAt: new Date(), suspendedReason: reason.trim(), suspensionAppeal: null, appealedAt: null })
        .where(eq(users.id, target.id));
    await logEvent("suspended", admin.id, "user", target.id, { reason: reason.trim() });
    await notifyUser(target, "Your Attest account is suspended", `Reason: ${reason.trim()}\n\nYou can still sign in, read, and send one appeal from your profile.`, target.id);
    return { ok: true as const };
}

export async function unsuspendUser(userId: string, targetId: string) {
    const admin = await requireAdmin(userId);
    const target = await requireUser(targetId);
    await db.update(users).set({ suspendedAt: null, suspendedReason: null, suspensionAppeal: null, appealedAt: null }).where(eq(users.id, target.id));
    await logEvent("unsuspended", admin.id, "user", target.id);
    await notifyUser(target, "Your Attest account is active again", "Your suspension was lifted.", target.id);
    return { ok: true as const };
}

/** Used by the write guard middleware. */
export async function isSuspended(userId: string) {
    const [row] = await db.select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId));
    return Boolean(row?.suspendedAt);
}

