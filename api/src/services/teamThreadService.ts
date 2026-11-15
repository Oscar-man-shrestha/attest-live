/**
 * Team thread: one message thread per idea, for the owner and active team members only.
 * Stored in the existing groups / group_messages tables. No open DMs (RULES 2).
 */
import {
    and,
    count,
    db,
    desc,
    eq,
    groupMessages,
    groups,
    gt,
    ideas,
    inArray,
    isNull,
    lt,
    notices,
    or,
    teamMembers,
    users,
} from "../../../packages/db/index";
import { CampusError, requireUser } from "./campusService";

const PAGE = 30;
const NOTICE_GAP_MS = 6 * 60 * 60 * 1000;

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

/** Owner or an active team member; everyone else gets 404 so the thread's existence isn't revealed. */
async function teamOf(userId: string, ideaId: string) {
    const viewer = await requireUser(userId);
    const [idea] = await db.select({ id: ideas.id, ownerId: ideas.ownerId, title: ideas.title, pitch: ideas.pitch }).from(ideas).where(eq(ideas.id, ideaId));
    if (!idea || !idea.pitch) throw new CampusError(404, "Idea not found");
    const members = await db.select({ userId: teamMembers.userId }).from(teamMembers)
        .where(and(eq(teamMembers.ideaId, idea.id), isNull(teamMembers.leftAt)));
    const memberIds = [idea.ownerId, ...members.map((m) => m.userId)];
    if (!memberIds.includes(viewer.id)) throw new CampusError(404, "Idea not found");
    let [group] = await db.select().from(groups).where(eq(groups.ideaId, idea.id));
    if (!group) [group] = await db.insert(groups).values({ ideaId: idea.id }).returning();
    return { viewer, idea, memberIds, groupId: group.id };
}

export async function listTeamMessages(userId: string, ideaId: string, query: { cursor?: string }) {
    const { viewer, idea, memberIds, groupId } = await teamOf(userId, ideaId);
    const filters = [eq(groupMessages.groupId, groupId)];
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
        filters.push(or(
            lt(groupMessages.createdAt, cursor.at),
            and(eq(groupMessages.createdAt, cursor.at), lt(groupMessages.id, cursor.id)),
        )!);
    }
    const rows = await db.select().from(groupMessages).where(and(...filters))
        .orderBy(desc(groupMessages.createdAt), desc(groupMessages.id)).limit(PAGE + 1);
    const page = rows.slice(0, PAGE);
    const authorIds = [...new Set(page.map((m) => m.userId))];
    const people = authorIds.length
        ? await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, authorIds))
        : [];
    const names = new Map(people.map((p) => [p.id, p.displayName || p.username]));
    const last = page[page.length - 1];
    return {
        memberCount: memberIds.length,
        messages: page.map((m) => ({
            id: m.id,
            mine: m.userId === viewer.id,
            name: names.get(m.userId) ?? "Teammate",
            isOwner: m.userId === idea.ownerId,
            former: !memberIds.includes(m.userId),
            body: m.content,
            createdAt: m.createdAt,
        })),
        nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
}

export async function postTeamMessage(userId: string, ideaId: string, body: string) {
    const { viewer, idea, memberIds, groupId } = await teamOf(userId, ideaId);
    const since = new Date(Date.now() - 60_000);
    const [recent] = await db.select({ n: count() }).from(groupMessages).where(and(
        eq(groupMessages.groupId, groupId),
        eq(groupMessages.userId, viewer.id),
        gt(groupMessages.createdAt, since),
    ));
    if (Number(recent?.n ?? 0) >= 10) throw new CampusError(429, "Slow down a little");
    const [message] = await db.insert(groupMessages).values({ groupId, userId: viewer.id, content: body.trim() }).returning();

    // In-app notice only (no email, no push), at most one per teammate per idea every 6 hours.
    const noticeBody = `New messages in the team thread for “${idea.title}”.`;
    const others = memberIds.filter((id) => id !== viewer.id);
    if (others.length) {
        const cutoff = new Date(Date.now() - NOTICE_GAP_MS);
        const recentNotices = await db.select({ userId: notices.userId }).from(notices).where(and(
            inArray(notices.userId, others),
            eq(notices.targetId, idea.id),
            eq(notices.body, noticeBody),
            gt(notices.createdAt, cutoff),
        ));
        const already = new Set(recentNotices.map((n) => n.userId));
        const fresh = others.filter((id) => !already.has(id));
        if (fresh.length) await db.insert(notices).values(fresh.map((id) => ({ userId: id, body: noticeBody, targetId: idea.id })));
    }
    return {
        message: { id: message.id, mine: true, name: viewer.displayName || viewer.username, isOwner: viewer.id === idea.ownerId, former: false, body: message.content, createdAt: message.createdAt },
    };
}
