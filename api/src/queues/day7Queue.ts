/**
 * Day-7 check-in nudges. Polls active sprint teams past mid-sprint and writes
 * in-app notices (+ mail via Resend queue). No push notifications (AGENTS rule 9).
 */
import {
    and,
    checkIns,
    db,
    desc,
    eq,
    events,
    ideas,
    inArray,
    isNotNull,
    isNull,
    ne,
    notices,
    or,
    sprints,
    teamMembers,
    users,
} from "../../../packages/db/index";
import { enqueueMail } from "../services/mailQueue";

const IDLE_MS = 5 * 60_000;

let running = false;
let timer: NodeJS.Timeout | null = null;

export function startDay7Worker() {
    // Run initial tick quickly after server startup, then poll periodically
    schedule(1_000);
}

export function nudgeDay7() {
    if (!running) schedule(500);
}

function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), ms);
}

function day7Of(endsAt: Date) {
    return new Date(new Date(endsAt).getTime() - 7 * 24 * 60 * 60 * 1000);
}

async function tick() {
    if (running) return;
    running = true;
    try {
        await remindPastDay7();
    } catch (error) {
        console.warn("Day-7 worker:", error instanceof Error ? error.message : error);
    } finally {
        running = false;
        schedule(IDLE_MS);
    }
}

async function getOrEnsureSprint() {
    const [sprint] = await db.select().from(sprints).orderBy(desc(sprints.createdAt)).limit(1);
    if (sprint) return sprint;
    const endsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [created] = await db.insert(sprints).values({ endsAt }).returning();
    return created;
}

export async function remindPastDay7() {
    const sprint = await getOrEnsureSprint();
    if (!sprint) return;
    const boundary = day7Of(sprint.endsAt);
    if (new Date() < boundary) return;

    const board = await db.select().from(ideas).where(and(
        or(eq(ideas.sprintId, sprint.id), isNull(ideas.sprintId)),
        isNull(ideas.hiddenAt),
        isNotNull(ideas.pitch),
        ne(ideas.teamStatus, "shipped"),
    ));

    for (const idea of board) {
        const members = await db.select().from(teamMembers).where(and(
            eq(teamMembers.ideaId, idea.id),
            isNull(teamMembers.leftAt),
        ));
        const checks = await db.select().from(checkIns).where(eq(checkIns.ideaId, idea.id));
        const checked = new Set(checks.map((row) => row.userId));
        const roster = Array.from(new Set([idea.ownerId, ...members.map((m) => m.userId)]));

        for (const memberId of roster) {
            if (checked.has(memberId)) continue;
            const [sent] = await db.select({ id: events.id }).from(events).where(and(
                eq(events.kind, "day7_reminder"),
                eq(events.actorId, memberId),
                eq(events.targetId, idea.id),
            )).limit(1);
            if (sent) continue;

            const [person] = await db.select().from(users).where(eq(users.id, memberId));
            if (!person) continue;

            await db.insert(events).values({
                kind: "day7_reminder",
                actorId: memberId,
                targetType: "idea",
                targetId: idea.id,
                payload: { title: idea.title },
            });
            const body = `Day 7 check-in for “${idea.title}”: write done, stuck, and next in the workspace. Silence reopens your role.`;
            await db.insert(notices).values({ userId: person.id, body, targetId: idea.id });
            enqueueMail({ to: person.email, subject: "Day 7 check-in", text: body });
        }
    }
}

/**
 * Checks and creates Day 7 in-app notices for a specific user when they view their inbox
 * or active sprint, without requiring them to open the workspace first.
 */
export async function checkUserDay7Notices(userId: string) {
    const sprint = await getOrEnsureSprint();
    if (!sprint) return;
    const boundary = day7Of(sprint.endsAt);
    if (new Date() < boundary) return;

    // Find ideas where this user is either owner or active collaborator
    const memberRows = await db.select({ ideaId: teamMembers.ideaId }).from(teamMembers).where(and(
        eq(teamMembers.userId, userId),
        isNull(teamMembers.leftAt),
    ));
    const memberIdeaIds = memberRows.map((r) => r.ideaId);

    const userIdeas = await db.select().from(ideas).where(and(
        or(
            eq(ideas.ownerId, userId),
            memberIdeaIds.length ? inArray(ideas.id, memberIdeaIds) : sqlFalse(),
        ),
        or(eq(ideas.sprintId, sprint.id), isNull(ideas.sprintId)),
        isNull(ideas.hiddenAt),
        isNotNull(ideas.pitch),
        ne(ideas.teamStatus, "shipped"),
    ));

    for (const idea of userIdeas) {
        const [checked] = await db.select({ id: checkIns.id }).from(checkIns).where(and(
            eq(checkIns.ideaId, idea.id),
            eq(checkIns.userId, userId),
        )).limit(1);
        if (checked) continue;

        const [sent] = await db.select({ id: events.id }).from(events).where(and(
            eq(events.kind, "day7_reminder"),
            eq(events.actorId, userId),
            eq(events.targetId, idea.id),
        )).limit(1);
        if (sent) continue;

        const [person] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!person) continue;

        await db.insert(events).values({
            kind: "day7_reminder",
            actorId: userId,
            targetType: "idea",
            targetId: idea.id,
            payload: { title: idea.title },
        });
        const body = `Day 7 check-in for “${idea.title}”: write done, stuck, and next in the workspace. Silence reopens your role.`;
        await db.insert(notices).values({ userId: person.id, body, targetId: idea.id });
        enqueueMail({ to: person.email, subject: "Day 7 check-in", text: body });
    }
}

function sqlFalse() {
    // Helper to avoid empty inArray syntax error
    return eq(ideas.id, "00000000-0000-0000-0000-000000000000");
}
