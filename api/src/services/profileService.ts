import { and, count, db, desc, eq, follows, ideas, isNotNull, isNull, lt, proofPages, sql, tasks, teamMembers, users } from "../../../packages/db/index";
import { CampusError, publicIdea, requireUser, savedSet, withForkCounts } from "./campusService";
import { storageUploadErrorMessage, supabase, supabaseBucket } from "./supabaseClient";
import { circles } from "./peers";
import { withEngagement } from "./social";
import { randomUUID } from "crypto";

/**
 * The campus profile page. Everything here is read from the database on each request:
 * posted ideas, teams joined, signed tasks, likes received, and the proof fields the student
 * saved. Email is never returned, and CGPA only to the student themself.
 */

const POSTS_PAGE = 10;
const TEAMS_LIMIT = 30;
const MEDIA_BYTES = 5 * 1024 * 1024;
const MEDIA_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function decodeCursor(cursor?: string) {
    if (!cursor) return null;
    const at = new Date(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isNaN(at.getTime()) ? null : at;
}

/** Consecutive calendar days with a signed task or check-in, ending today or yesterday. */
async function activityStreak(userId: string) {
    const rows = await db.execute(sql`
        select distinct day::date as day from (
          select date_trunc('day', signed_at) as day from tasks
            where assignee_id = ${userId} and receipt_status = 'signed' and signed_at is not null
          union
          select date_trunc('day', created_at) as day from check_ins
            where user_id = ${userId}
        ) d
        order by day desc
        limit 60`);
    const days = (rows.rows as { day: string | Date }[]).map((row) => {
        const d = new Date(row.day);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    });
    if (days.length === 0) return 0;
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const yesterdayUtc = todayUtc - 86_400_000;
    if (days[0] !== todayUtc && days[0] !== yesterdayUtc) return 0;
    let streak = 1;
    for (let i = 1; i < days.length; i += 1) {
        if (days[i - 1] - days[i] !== 86_400_000) break;
        streak += 1;
    }
    return streak;
}

export async function campusProfile(viewerId: string, personId: string) {
    const viewer = await requireUser(viewerId);
    const [person] = await db.select().from(users).where(eq(users.id, personId));
    if (!person || !person.displayName) throw new CampusError(404, "Profile not found");
    const self = viewer.id === person.id;

    const [statsResult, signedRows, teamRows, proof, circleState, followRow, followerCount, followingCount, streak, signedTrail, openTeamResult] = await Promise.all([
        db.execute(sql`
            select
              (select count(*)::int from ideas where owner_id = ${person.id} and pitch is not null and hidden_at is null ${self ? sql`` : sql`and hide_name = false`}) as posted,
              (select count(distinct idea_id)::int from team_members where user_id = ${person.id}) as joined,
              (select count(*)::int from ideas i where i.team_status = 'shipped' and (
                  (i.owner_id = ${person.id} ${self ? sql`` : sql`and i.hide_name = false`})
                  or exists(select 1 from team_members t where t.idea_id = i.id and t.user_id = ${person.id} and t.left_at is null))) as shipped,
              (select count(*)::int from tasks where assignee_id = ${person.id} and receipt_status = 'signed') as signed_tasks,
              (select count(*)::int from reactions r join ideas i on r.target_type = 'idea' and r.target_id = i.id
                 where i.owner_id = ${person.id} ${self ? sql`` : sql`and i.hide_name = false`}) as idea_likes,
              (select count(*)::int from reactions r join idea_comments c on r.target_type = 'comment' and r.target_id = c.id
                 where c.user_id = ${person.id} and c.deleted_at is null) as comment_likes,
              (select count(*)::int from idea_comments where user_id = ${person.id} and deleted_at is null) as comments`),
        db.select({ role: tasks.role }).from(tasks).where(and(eq(tasks.assigneeId, person.id), eq(tasks.receiptStatus, "signed"))),
        db.select({
            ideaId: teamMembers.ideaId,
            joinedAt: teamMembers.joinedAt,
            leftAt: teamMembers.leftAt,
            title: ideas.title,
            teamStatus: ideas.teamStatus,
            authorBranch: ideas.authorBranch,
        }).from(teamMembers).innerJoin(ideas, eq(ideas.id, teamMembers.ideaId))
            .where(and(eq(teamMembers.userId, person.id), isNull(ideas.hiddenAt)))
            .orderBy(desc(teamMembers.joinedAt)).limit(TEAMS_LIMIT),
        db.select().from(proofPages).where(eq(proofPages.userId, person.id)),
        circles(),
        self
            ? Promise.resolve([] as { followerId: string }[])
            : db.select({ followerId: follows.followerId }).from(follows)
                .where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, person.id))).limit(1),
        db.select({ n: count() }).from(follows).where(eq(follows.followingId, person.id)),
        db.select({ n: count() }).from(follows).where(eq(follows.followerId, person.id)),
        activityStreak(person.id),
        db.select({
            id: tasks.id,
            role: tasks.role,
            signedAt: tasks.signedAt,
            ideaId: tasks.ideaId,
            title: ideas.title,
        }).from(tasks).innerJoin(ideas, eq(ideas.id, tasks.ideaId))
            .where(and(eq(tasks.assigneeId, person.id), eq(tasks.receiptStatus, "signed"), isNull(ideas.hiddenAt)))
            .orderBy(desc(tasks.signedAt)).limit(8),
        db.execute(sql`
            select i.id::text as idea_id, i.title, i.team_status,
              case when i.owner_id = ${person.id} then 'owner' else 'member' end as role
            from ideas i
            where i.hidden_at is null and i.team_status = 'open'
              and (i.owner_id = ${person.id}
                or exists (select 1 from team_members t where t.idea_id = i.id and t.user_id = ${person.id} and t.left_at is null))
            order by i.created_at desc
            limit 6`),
    ]);
    const stats = statsResult.rows[0] as Record<string, number>;
    const signed = new Set(signedRows.map((row) => (row.role ?? "").trim().toLowerCase()).filter(Boolean));
    const circleId = circleState.byUser.get(person.id)?.circle;
    const circle = circleId === undefined ? null : circleState.circles.find((c) => c.id === circleId) ?? null;
    const openTeams = (openTeamResult.rows as { idea_id: string; title: string; team_status: string; role: string }[]);

    return {
        profile: {
            id: person.id,
            isSelf: self,
            displayName: person.displayName,
            headline: person.headline,
            university: self ? person.university : (person.showInstitution ? person.university : null),
            verifiedStudent: Boolean(person.university),
            handle: person.username,
            country: person.country,
            city: person.city,
            degree: person.degree,
            branch: person.branch,
            semester: person.semester,
            graduationYear: person.graduationYear,
            cgpa: self && person.cgpa !== null ? Number(person.cgpa) : null,
            twoWeekLine: person.twoWeekLine,
            interests: person.interests ?? [],
            skills: (person.campusSkills ?? []).map((name) => ({ name, signed: signed.has(name.toLowerCase()) })),
            githubUrl: person.githubUrl,
            githubLogin: person.githubLogin,
            githubStats: person.githubStats,
            linkedinUrl: person.linkedinUrl,
            siteUrl: person.siteUrl,
            projects: person.projects ?? [],
            certifications: person.certifications ?? [],
            experience: person.experience ?? [],
            circle: circle ? { id: circle.id, label: circle.label } : null,
            proofPublished: Boolean(proof[0]?.published),
            joinedAt: person.createdAt,
            profilePicUrl: person.profilePicUrl,
            coverUrl: person.coverUrl,
            currentlyWorkingOn: person.currentlyWorkingOn,
            followerCount: Number(followerCount[0]?.n ?? 0),
            followingCount: Number(followingCount[0]?.n ?? 0),
            viewerFollows: self ? false : followRow.length > 0,
            activityStreak: streak,
        },
        stats: {
            ideasPosted: Number(stats.posted),
            teamsJoined: Number(stats.joined),
            shipped: Number(stats.shipped),
            signedTasks: Number(stats.signed_tasks),
            likesReceived: Number(stats.idea_likes) + Number(stats.comment_likes),
            comments: Number(stats.comments),
        },
        teams: teamRows.map((row) => ({
            ideaId: row.ideaId,
            title: row.title,
            teamStatus: row.teamStatus,
            joinedAt: row.joinedAt,
            leftAt: row.leftAt,
        })),
        currentlyWorking: openTeams.map((row) => ({
            ideaId: row.idea_id,
            title: row.title,
            teamStatus: row.team_status,
            role: row.role,
        })),
        signedTrail: signedTrail.map((row) => ({
            taskId: row.id,
            role: row.role,
            signedAt: row.signedAt,
            ideaId: row.ideaId,
            ideaTitle: row.title,
        })),
    };
}

/** Ideas the student posted, newest first, with like/comment/share counts. Hidden-name ideas only for the author. */
export async function profilePosts(viewerId: string, personId: string, cursor?: string) {
    const viewer = await requireUser(viewerId);
    const filters = [eq(ideas.ownerId, personId), isNotNull(ideas.pitch), isNull(ideas.hiddenAt)];
    if (viewer.id !== personId) filters.push(eq(ideas.hideName, false));
    const at = decodeCursor(cursor);
    if (at) filters.push(lt(ideas.createdAt, at));
    const rows = await db.select().from(ideas).where(and(...filters)).orderBy(desc(ideas.createdAt)).limit(POSTS_PAGE + 1);
    const page = rows.slice(0, POSTS_PAGE);
    const saved = await savedSet(viewer.id, "idea", page.map((row) => row.id));
    const last = page[page.length - 1];
    return {
        ideas: await withForkCounts(await withEngagement(viewer.id, page.map((row) => publicIdea(row, saved.has(row.id), null, 0, { viewerId: viewer.id })))),
        nextCursor: rows.length > POSTS_PAGE && last ? Buffer.from(last.createdAt.toISOString(), "utf8").toString("base64url") : null,
    };
}

export async function followPerson(viewerId: string, personId: string, follow: boolean) {
    const viewer = await requireUser(viewerId);
    if (viewer.id === personId) throw new CampusError(400, "You cannot follow yourself");
    const [person] = await db.select({ id: users.id }).from(users).where(eq(users.id, personId));
    if (!person) throw new CampusError(404, "Profile not found");
    if (follow) {
        const [existing] = await db.select().from(follows)
            .where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, personId))).limit(1);
        if (!existing) await db.insert(follows).values({ followerId: viewer.id, followingId: personId });
        return { following: true as const };
    }
    await db.delete(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, personId)));
    return { following: false as const };
}

export async function uploadProfileMedia(
    userId: string,
    slot: "avatar" | "cover",
    file: { mimetype: string; size: number; buffer: Buffer } | undefined,
) {
    const user = await requireUser(userId);
    if (!file) throw new CampusError(400, "Attach a PNG, JPG or WebP");
    if (!MEDIA_MIME.has(file.mimetype)) throw new CampusError(415, "Use PNG, JPG or WebP");
    if (file.size > MEDIA_BYTES) throw new CampusError(413, "Images are capped at 5 MB");
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const path = `profiles/${user.id}/${slot}-${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(supabaseBucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) {
        console.error("Profile media upload failed:", error.message);
        throw new CampusError(500, storageUploadErrorMessage(error));
    }
    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(path);
    const patch = slot === "avatar" ? { profilePicUrl: data.publicUrl } : { coverUrl: data.publicUrl };
    await db.update(users).set(patch).where(eq(users.id, user.id));
    return { url: data.publicUrl, slot };
}
