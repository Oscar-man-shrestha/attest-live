import { and, count, db, eq, gt, ideaComments, ideas, reactions, sql } from "../../../packages/db/index";
import { CampusError, requireUser } from "./campusService";

/**
 * Likes, threaded comments, and share counts on sprint ideas.
 *
 * Comments are one level deep, like LinkedIn: replying to a reply files it under the same
 * top-level comment. "Top" orders by likes x2 + replies, then newest. Deleting sets deleted_at;
 * a deleted comment that still has replies shows as "Comment deleted" so the thread reads.
 * No notifications are sent (out of scope), and authors of hidden-name ideas stay hidden.
 */

const PAGE = 20;
const REPLY_PREVIEW = 2;
const COMMENT_WINDOW_MINUTES = 10;
const COMMENTS_PER_WINDOW = 20;
const MAX_OFFSET = 2000;

type Engagement = { likes: number; liked: boolean; comments: number; shares: number };

function uuidArray(ids: string[]) {
    return `{${ids.join(",")}}`;
}

function decodeOffset(cursor?: string) {
    if (!cursor) return 0;
    try {
        const offset = Number(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")).o);
        return Number.isInteger(offset) && offset >= 0 && offset <= MAX_OFFSET ? offset : 0;
    } catch {
        return 0;
    }
}

function encodeOffset(offset: number) {
    return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

// ---------- engagement counts on cards ----------

export async function engagementFor(viewerId: string, ideaIds: string[]) {
    const out = new Map<string, Engagement>();
    if (!ideaIds.length) return out;
    ideaIds.forEach((id) => out.set(id, { likes: 0, liked: false, comments: 0, shares: 0 }));
    const ids = uuidArray(ideaIds);
    const [likeRows, commentRows, shareRows] = await Promise.all([
        db.execute(sql`
            select target_id::text as id, count(*)::int as n, bool_or(user_id = ${viewerId}) as mine
            from reactions where target_type = 'idea' and target_id = any(${ids}::uuid[]) group by target_id`),
        db.execute(sql`
            select idea_id::text as id, count(*)::int as n
            from idea_comments where deleted_at is null and idea_id = any(${ids}::uuid[]) group by idea_id`),
        db.execute(sql`
            select idea_id::text as id, count(*)::int as n
            from interactions where kind = 'share' and idea_id = any(${ids}::uuid[]) group by idea_id`),
    ]);
    for (const row of likeRows.rows as { id: string; n: number; mine: boolean }[]) {
        const entry = out.get(row.id);
        if (entry) { entry.likes = Number(row.n); entry.liked = Boolean(row.mine); }
    }
    for (const row of commentRows.rows as { id: string; n: number }[]) {
        const entry = out.get(row.id);
        if (entry) entry.comments = Number(row.n);
    }
    for (const row of shareRows.rows as { id: string; n: number }[]) {
        const entry = out.get(row.id);
        if (entry) entry.shares = Number(row.n);
    }
    return out;
}

/** Adds `engagement` to each idea in a response list. */
export async function withEngagement<T extends { id: string }>(viewerId: string, list: T[]) {
    const counts = await engagementFor(viewerId, list.map((idea) => idea.id));
    return list.map((idea) => ({ ...idea, engagement: counts.get(idea.id) ?? { likes: 0, liked: false, comments: 0, shares: 0 } }));
}

// ---------- comments ----------

async function visibleIdea(viewerId: string, ideaId: string) {
    const viewer = await requireUser(viewerId);
    const [idea] = await db.select({ id: ideas.id, ownerId: ideas.ownerId, hideName: ideas.hideName, pitch: ideas.pitch, hiddenAt: ideas.hiddenAt })
        .from(ideas).where(eq(ideas.id, ideaId));
    if (!idea || !idea.pitch) throw new CampusError(404, "Idea not found");
    if (idea.hiddenAt && !viewer.isAdmin && viewer.id !== idea.ownerId) throw new CampusError(404, "Idea not found");
    return { viewer, idea };
}

type CommentRow = {
    id: string;
    parent_id: string | null;
    user_id: string;
    content: string;
    created_at: string;
    deleted_at: Date | null;
    display_name: string | null;
    branch: string | null;
    semester: number | null;
    headline: string | null;
    likes: number;
    liked: boolean;
    replies: number;
};

function commentSelect(viewerId: string) {
    return sql`
        c.id::text as id, c.parent_comment_id::text as parent_id, c.user_id::text as user_id, c.content,
        to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at, c.deleted_at,
        u.display_name, u.branch, u.semester, u.headline,
        (select count(*)::int from reactions r where r.target_type = 'comment' and r.target_id = c.id) as likes,
        exists(select 1 from reactions r where r.target_type = 'comment' and r.target_id = c.id and r.user_id = ${viewerId}) as liked,
        (select count(*)::int from idea_comments x where x.parent_comment_id = c.id and x.deleted_at is null) as replies`;
}

function serialize(row: CommentRow, idea: { ownerId: string; hideName: boolean }, viewer: { id: string; isAdmin: boolean }) {
    const deleted = Boolean(row.deleted_at);
    const byAuthor = row.user_id === idea.ownerId;
    const masked = byAuthor && idea.hideName;
    return {
        id: row.id,
        parentId: row.parent_id,
        body: deleted ? null : row.content,
        deleted,
        createdAt: row.created_at,
        author: {
            id: masked ? null : row.user_id,
            name: masked ? "Idea author" : (row.display_name ?? "Student"),
            branch: row.branch,
            semester: row.semester,
            headline: masked ? null : row.headline,
            isIdeaAuthor: byAuthor,
        },
        likes: Number(row.likes),
        liked: Boolean(row.liked),
        replyCount: Number(row.replies),
        mine: row.user_id === viewer.id,
        canDelete: !deleted && (row.user_id === viewer.id || idea.ownerId === viewer.id || viewer.isAdmin),
    };
}

export async function listComments(viewerId: string, ideaId: string, sort: "top" | "new", cursor?: string) {
    const { viewer, idea } = await visibleIdea(viewerId, ideaId);
    const offset = decodeOffset(cursor);
    const order = sort === "top"
        ? sql`(select count(*) from reactions r where r.target_type = 'comment' and r.target_id = c.id) * 2
              + (select count(*) from idea_comments x where x.parent_comment_id = c.id and x.deleted_at is null) desc, c.created_at desc`
        : sql`c.created_at desc`;
    const result = await db.execute(sql`
        select ${commentSelect(viewer.id)}
        from idea_comments c join users u on u.id = c.user_id
        where c.idea_id = ${ideaId} and c.parent_comment_id is null
          and (c.deleted_at is null or exists(select 1 from idea_comments x where x.parent_comment_id = c.id and x.deleted_at is null))
        order by ${order}
        limit ${PAGE + 1} offset ${offset}`);
    const rows = result.rows as CommentRow[];
    const page = rows.slice(0, PAGE);

    const previews = new Map<string, CommentRow[]>();
    if (page.length) {
        const replyResult = await db.execute(sql`
            select * from (
                select ${commentSelect(viewer.id)},
                       row_number() over (partition by c.parent_comment_id order by c.created_at asc) as rn
                from idea_comments c join users u on u.id = c.user_id
                where c.parent_comment_id = any(${uuidArray(page.map((row) => row.id))}::uuid[]) and c.deleted_at is null
            ) t where rn <= ${REPLY_PREVIEW}`);
        for (const row of replyResult.rows as CommentRow[]) {
            const list = previews.get(row.parent_id as string) ?? [];
            list.push(row);
            previews.set(row.parent_id as string, list);
        }
    }

    const [{ total }] = await db.select({ total: count() }).from(ideaComments)
        .where(and(eq(ideaComments.ideaId, ideaId), sql`${ideaComments.deletedAt} is null`));
    return {
        comments: page.map((row) => ({
            ...serialize(row, idea, viewer),
            replies: (previews.get(row.id) ?? []).map((reply) => serialize(reply, idea, viewer)),
        })),
        nextCursor: rows.length > PAGE ? encodeOffset(offset + PAGE) : null,
        total: Number(total),
    };
}

export async function listReplies(viewerId: string, commentId: string, cursor?: string) {
    const [root] = await db.select({ ideaId: ideaComments.ideaId, parentId: ideaComments.parentCommentId })
        .from(ideaComments).where(eq(ideaComments.id, commentId));
    if (!root || root.parentId) throw new CampusError(404, "Comment not found");
    const { viewer, idea } = await visibleIdea(viewerId, root.ideaId);
    const offset = decodeOffset(cursor);
    const result = await db.execute(sql`
        select ${commentSelect(viewer.id)}
        from idea_comments c join users u on u.id = c.user_id
        where c.parent_comment_id = ${commentId} and c.deleted_at is null
        order by c.created_at asc
        limit ${PAGE + 1} offset ${offset}`);
    const rows = result.rows as CommentRow[];
    return {
        replies: rows.slice(0, PAGE).map((row) => serialize(row, idea, viewer)),
        nextCursor: rows.length > PAGE ? encodeOffset(offset + PAGE) : null,
    };
}

export async function addComment(viewerId: string, ideaId: string, body: string, parentId?: string) {
    const { viewer, idea } = await visibleIdea(viewerId, ideaId);
    if (!viewer.displayName?.trim()) throw new CampusError(400, "Add your name to your profile before commenting");

    const since = new Date(Date.now() - COMMENT_WINDOW_MINUTES * 60_000);
    const [recent] = await db.select({ n: count() }).from(ideaComments)
        .where(and(eq(ideaComments.userId, viewer.id), gt(ideaComments.createdAt, since)));
    if (Number(recent?.n ?? 0) >= COMMENTS_PER_WINDOW) throw new CampusError(429, "That is a lot of comments. Take a short break and try again.");

    let rootId: string | null = null;
    if (parentId) {
        const [parent] = await db.select().from(ideaComments).where(eq(ideaComments.id, parentId));
        if (!parent || parent.ideaId !== ideaId) throw new CampusError(400, "That comment is not on this idea");
        if (parent.deletedAt && parent.parentCommentId) throw new CampusError(400, "That comment was deleted");
        rootId = parent.parentCommentId ?? parent.id;
    }

    const [inserted] = await db.insert(ideaComments).values({
        ideaId,
        userId: viewer.id,
        parentCommentId: rootId,
        content: body.trim(),
        imageUrl: null,
    }).returning({ id: ideaComments.id });

    const result = await db.execute(sql`
        select ${commentSelect(viewer.id)} from idea_comments c join users u on u.id = c.user_id where c.id = ${inserted.id}`);
    return { comment: { ...serialize(result.rows[0] as CommentRow, idea, viewer), replies: [] } };
}

export async function deleteComment(viewerId: string, commentId: string) {
    const [comment] = await db.select().from(ideaComments).where(eq(ideaComments.id, commentId));
    if (!comment || comment.deletedAt) throw new CampusError(404, "Comment not found");
    const { viewer, idea } = await visibleIdea(viewerId, comment.ideaId);
    if (comment.userId !== viewer.id && idea.ownerId !== viewer.id && !viewer.isAdmin) {
        throw new CampusError(403, "Only the comment author or the idea author can delete this");
    }
    await db.update(ideaComments).set({ deletedAt: new Date() }).where(eq(ideaComments.id, commentId));
    return { deleted: true };
}

// ---------- likes ----------

export async function setReaction(viewerId: string, targetType: "idea" | "comment", targetId: string, on: boolean) {
    const viewer = await requireUser(viewerId);
    if (targetType === "idea") {
        const { idea } = await visibleIdea(viewer.id, targetId);
        if (idea.ownerId === viewer.id) throw new CampusError(400, "You cannot like your own idea");
    } else {
        const [comment] = await db.select({ userId: ideaComments.userId, ideaId: ideaComments.ideaId, deletedAt: ideaComments.deletedAt })
            .from(ideaComments).where(eq(ideaComments.id, targetId));
        if (!comment || comment.deletedAt) throw new CampusError(404, "Comment not found");
        await visibleIdea(viewer.id, comment.ideaId);
        if (comment.userId === viewer.id) throw new CampusError(400, "You cannot like your own comment");
    }

    if (on) {
        await db.insert(reactions).values({ userId: viewer.id, targetType, targetId }).onConflictDoNothing();
    } else {
        await db.delete(reactions).where(and(eq(reactions.userId, viewer.id), eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)));
    }
    const [row] = await db.select({ n: count() }).from(reactions)
        .where(and(eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)));
    return { liked: on, likes: Number(row?.n ?? 0) };
}

export async function shareCount(ideaId: string) {
    const result = await db.execute(sql`select count(*)::int as n from interactions where kind = 'share' and idea_id = ${ideaId}`);
    return Number((result.rows[0] as { n: number } | undefined)?.n ?? 0);
}
