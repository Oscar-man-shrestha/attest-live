/**
 * SaaS layer: workspaces (organiser teams), plan limits and manual billing.
 * Students never pay; only workspaces hold a plan (RULES 16). Billing is manual until the founder has a
 * payment gateway account: an owner requests an upgrade, an admin activates it (MEMORY.md, 2026-11-17).
 */
import { and, count, db, desc, eq, gt, inArray, kits, subscriptions, users, workspaceMembers, workspaces } from "../../../packages/db/index";
import { BILLING_ENABLED, LAUNCH_PLAN, PLANS, formatMoney, toMinor, type PlanId } from "../../../packages/types";
import { CampusError, requireUser } from "./campusService";
import { logEvent, notifyUser, requireWriter } from "./dealService";

const MAX_OWNED_WORKSPACES = 3;

type WorkspaceRow = typeof workspaces.$inferSelect;

/** The plan a workspace is on right now: the newest active, unexpired subscription, else Free. */
export async function planFor(workspaceId: string) {
    // While billing is off, everyone gets the launch plan and nothing is read from subscriptions.
    if (!BILLING_ENABLED) return { id: "free" as PlanId, ...LAUNCH_PLAN, periodEnd: null as Date | null };
    const [sub] = await db.select().from(subscriptions).where(and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, "active"),
        gt(subscriptions.periodEnd, new Date()),
    )).orderBy(desc(subscriptions.periodEnd)).limit(1);
    const id = (sub?.plan as PlanId | undefined) ?? "free";
    return { id, ...PLANS[id], periodEnd: sub?.periodEnd ?? null };
}

export async function membershipOf(userId: string, workspaceId: string) {
    const [row] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
    return row ?? null;
}

async function mustWorkspace(id: string) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    if (!ws) throw new CampusError(404, "Workspace not found");
    return ws;
}

async function mustMember(userId: string, workspaceId: string) {
    const ws = await mustWorkspace(workspaceId);
    const member = await membershipOf(userId, ws.id);
    if (!member) throw new CampusError(404, "Workspace not found");
    return { ws, member };
}

async function mustOwner(userId: string, workspaceId: string) {
    const { ws, member } = await mustMember(userId, workspaceId);
    if (member.role !== "owner") throw new CampusError(403, "Only the workspace owner can do that");
    return ws;
}

function planDto(plan: Awaited<ReturnType<typeof planFor>>) {
    return {
        id: plan.id,
        name: plan.name,
        price: plan.priceMinor === null ? null : plan.priceMinor === 0 ? "Free" : formatMoney(plan.priceMinor, plan.currency),
        period: plan.period,
        limits: { members: plan.members, openKits: plan.openKits, needsPerKit: plan.needsPerKit },
        csvExport: plan.csvExport,
        badge: plan.badge,
        periodEnd: plan.periodEnd,
    };
}

export async function createWorkspace(userId: string, input: { name: string; kind: string }) {
    const owner = await requireWriter(userId);
    const [owned] = await db.select({ n: count() }).from(workspaces).where(eq(workspaces.ownerId, owner.id));
    if (Number(owned?.n ?? 0) >= MAX_OWNED_WORKSPACES) throw new CampusError(400, "You can own up to three workspaces");
    const [ws] = await db.insert(workspaces).values({ name: input.name.trim(), kind: input.kind, ownerId: owner.id }).returning();
    await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId: owner.id, role: "owner" });
    await logEvent("workspace_created", owner.id, "workspace", ws.id);
    return getWorkspace(userId, ws.id);
}

export async function listMyWorkspaces(userId: string) {
    const viewer = await requireUser(userId);
    const rows = await db.select({ ws: workspaces, role: workspaceMembers.role }).from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, viewer.id)).orderBy(desc(workspaces.createdAt)).limit(20);
    const out = [];
    for (const row of rows) {
        const plan = await planFor(row.ws.id);
        const [members] = await db.select({ n: count() }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, row.ws.id));
        out.push({ id: row.ws.id, name: row.ws.name, kind: row.ws.kind, role: row.role, plan: planDto(plan), members: Number(members?.n ?? 0) });
    }
    return { workspaces: out };
}

export async function getWorkspace(userId: string, workspaceId: string) {
    const { ws, member } = await mustMember(userId, workspaceId);
    // These reads are independent, so run them together instead of one after another.
    const [plan, memberRows, kitRows, subs] = await Promise.all([
        planFor(ws.id),
        db.select({ userId: workspaceMembers.userId, role: workspaceMembers.role, joinedAt: workspaceMembers.joinedAt, handle: users.username, displayName: users.displayName })
            .from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId))
            .where(eq(workspaceMembers.workspaceId, ws.id)).orderBy(workspaceMembers.joinedAt),
        db.select({ id: kits.id, name: kits.name, status: kits.status, createdAt: kits.createdAt }).from(kits)
            .where(eq(kits.workspaceId, ws.id)).orderBy(desc(kits.createdAt)).limit(50),
        member.role === "owner"
            ? db.select().from(subscriptions).where(eq(subscriptions.workspaceId, ws.id)).orderBy(desc(subscriptions.createdAt)).limit(10)
            : Promise.resolve([] as (typeof subscriptions.$inferSelect)[]),
    ]);
    return {
        workspace: { id: ws.id, name: ws.name, kind: ws.kind, createdAt: ws.createdAt },
        role: member.role,
        plan: planDto(plan),
        usage: { members: memberRows.length, openKits: kitRows.filter((k) => k.status === "open").length },
        members: memberRows.map((m) => ({ userId: m.userId, handle: m.handle, displayName: m.displayName, role: m.role, joinedAt: m.joinedAt })),
        kits: kitRows,
        billing: subs.map((s) => ({
            id: s.id, plan: s.plan, status: s.status, amount: formatMoney(s.amountMinor, s.currency), periodEnd: s.periodEnd, note: s.note, createdAt: s.createdAt,
        })),
        pendingUpgrade: subs.some((s) => s.status === "requested"),
    };
}

export async function addMember(userId: string, workspaceId: string, handle: string) {
    const ws = await mustOwner(userId, workspaceId);
    const plan = await planFor(ws.id);
    const [members] = await db.select({ n: count() }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, ws.id));
    if (Number(members?.n ?? 0) >= plan.members) {
        throw BILLING_ENABLED
            ? new CampusError(400, `The ${plan.name} plan allows ${plan.members} members. Upgrade to add more.`, { upgrade: true })
            : new CampusError(400, `A workspace can have up to ${plan.members} members for now.`);
    }
    const [person] = await db.select().from(users).where(eq(users.username, handle.trim().toLowerCase()));
    if (!person || person.suspendedAt) throw new CampusError(404, "No one has that handle");
    if (await membershipOf(person.id, ws.id)) throw new CampusError(400, "They're already in this workspace");
    await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId: person.id, role: "member" });
    await logEvent("workspace_member_added", userId, "workspace", ws.id, { member: person.id });
    await notifyUser(person, `You were added to ${ws.name}`, `You're now on the ${ws.name} team on Attest and can run its Kits.`, ws.id);
    return getWorkspace(userId, ws.id);
}

export async function removeMember(userId: string, workspaceId: string, memberId: string) {
    const ws = await mustWorkspace(workspaceId);
    const self = memberId === userId;
    if (!self) await mustOwner(userId, ws.id);
    if (memberId === ws.ownerId) throw new CampusError(400, "The owner can't leave their own workspace");
    const member = await membershipOf(memberId, ws.id);
    if (!member) throw new CampusError(404, "Not a member");
    await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, memberId)));
    await logEvent(self ? "workspace_left" : "workspace_member_removed", userId, "workspace", ws.id, { member: memberId });
    return self ? { left: true as const } : getWorkspace(userId, ws.id);
}

export async function requestUpgrade(userId: string, workspaceId: string, input: { plan: "pro" | "campus"; note?: string }) {
    if (!BILLING_ENABLED) throw new CampusError(400, "Attest is free for now. There is nothing to pay for.");
    const ws = await mustOwner(userId, workspaceId);
    const [pending] = await db.select({ id: subscriptions.id }).from(subscriptions)
        .where(and(eq(subscriptions.workspaceId, ws.id), eq(subscriptions.status, "requested")));
    if (pending) throw new CampusError(400, "You already have an upgrade request waiting");
    const plan = PLANS[input.plan];
    await db.insert(subscriptions).values({
        workspaceId: ws.id, plan: input.plan, status: "requested",
        amountMinor: plan.priceMinor, currency: plan.currency, note: input.note?.trim() || null, requestedBy: userId,
    });
    await logEvent("upgrade_requested", userId, "workspace", ws.id, { plan: input.plan });
    const admins = await db.select().from(users).where(eq(users.isAdmin, true));
    for (const admin of admins) {
        await notifyUser(admin, "New plan request", `${ws.name} asked for the ${plan.name} plan. Open Reports → Billing to arrange payment and activate it.`, ws.id);
    }
    return getWorkspace(userId, ws.id);
}

// ---------- admin billing queue ----------

async function requireAdmin(userId: string) {
    const user = await requireUser(userId);
    if (!user.isAdmin) throw new CampusError(403, "Admins only");
    return user;
}

export async function billingQueue(userId: string) {
    await requireAdmin(userId);
    const rows = await db.select({ sub: subscriptions, ws: workspaces, handle: users.username, email: users.email })
        .from(subscriptions).innerJoin(workspaces, eq(workspaces.id, subscriptions.workspaceId))
        .innerJoin(users, eq(users.id, subscriptions.requestedBy))
        .where(inArray(subscriptions.status, ["requested", "active"])).orderBy(desc(subscriptions.createdAt)).limit(50);
    return {
        requests: rows.map((r) => ({
            id: r.sub.id, status: r.sub.status, plan: r.sub.plan, workspace: { id: r.ws.id, name: r.ws.name },
            // The admin needs a way to reach the buyer to arrange payment and an invoice.
            requestedBy: { handle: r.handle, email: r.email },
            amount: formatMoney(r.sub.amountMinor, r.sub.currency), note: r.sub.note, periodEnd: r.sub.periodEnd, createdAt: r.sub.createdAt,
        })),
    };
}

export async function approveSubscription(userId: string, subscriptionId: string, input: { months: number; amount?: number | null; note?: string }) {
    const admin = await requireAdmin(userId);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    if (!sub) throw new CampusError(404, "Request not found");
    if (sub.status === "cancelled") throw new CampusError(400, "This request was cancelled");
    // Extend from the later of now and the current paid-until date, so renewals don't lose days.
    const current = await planFor(sub.workspaceId);
    const start = current.id !== "free" && current.periodEnd && new Date(current.periodEnd) > new Date() ? new Date(current.periodEnd) : new Date();
    const periodEnd = new Date(start);
    periodEnd.setMonth(periodEnd.getMonth() + input.months);
    await db.update(subscriptions).set({
        status: "active", periodEnd, approvedBy: admin.id, approvedAt: new Date(),
        amountMinor: input.amount === null || input.amount === undefined ? sub.amountMinor : toMinor(input.amount),
        note: input.note?.trim() || sub.note,
    }).where(eq(subscriptions.id, sub.id));
    await logEvent("subscription_activated", admin.id, "workspace", sub.workspaceId, { plan: sub.plan, months: input.months });
    const ws = await mustWorkspace(sub.workspaceId);
    const owner = await requireUser(ws.ownerId);
    await notifyUser(owner, `${PLANS[sub.plan as PlanId]?.name ?? sub.plan} plan is active`, `${ws.name} is now on ${PLANS[sub.plan as PlanId]?.name ?? sub.plan} until ${periodEnd.toDateString()}.`, ws.id);
    return { ok: true as const, periodEnd };
}

export async function cancelSubscription(userId: string, subscriptionId: string) {
    const admin = await requireAdmin(userId);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    if (!sub) throw new CampusError(404, "Request not found");
    await db.update(subscriptions).set({ status: "cancelled" }).where(eq(subscriptions.id, sub.id));
    await logEvent("subscription_cancelled", admin.id, "workspace", sub.workspaceId);
    return { ok: true as const };
}

/** Used by kits: may this person run this kit (owner, or any member of its workspace)? */
export async function canManageKit(userId: string, kit: { ownerId: string; workspaceId: string | null }) {
    if (kit.ownerId === userId) return true;
    if (!kit.workspaceId) return false;
    return Boolean(await membershipOf(userId, kit.workspaceId));
}

export async function myWorkspaceIds(userId: string) {
    const rows = await db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId));
    return rows.map((r) => r.id);
}

export type { WorkspaceRow };
