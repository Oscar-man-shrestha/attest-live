"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reports = exports.documents = exports.interactions = exports.events = exports.notices = exports.saves = exports.sprintInvites = exports.proofPages = exports.checkIns = exports.tasks = exports.teamMembers = exports.tryouts = exports.offers = exports.revisions = exports.approaches = exports.problems = exports.sprints = exports.groupMessages = exports.groupMembers = exports.groups = exports.savedIdeas = exports.joinRequests = exports.contributions = exports.ratings = exports.reactions = exports.ideaComments = exports.ideaImages = exports.ideaLookingFor = exports.ideas = exports.communityBans = exports.communityMembers = exports.communities = exports.follows = exports.userSkills = exports.domains = exports.skills = exports.users = exports.reportStatusEnum = exports.reportTargetEnum = exports.joinRequestStatusEnum = exports.contributionStatusEnum = exports.ideaStatusEnum = exports.accessTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// ---------- ENUMS ----------
exports.accessTypeEnum = (0, pg_core_1.pgEnum)("access_type", ["open_open", "open_closed", "closed"]);
exports.ideaStatusEnum = (0, pg_core_1.pgEnum)("idea_status", ["open", "closed"]);
exports.contributionStatusEnum = (0, pg_core_1.pgEnum)("contribution_status", ["pending", "approved", "rejected"]);
exports.joinRequestStatusEnum = (0, pg_core_1.pgEnum)("join_request_status", ["pending", "accepted", "rejected"]);
exports.reportTargetEnum = (0, pg_core_1.pgEnum)("report_target_type", ["idea", "user", "community", "problem"]);
exports.reportStatusEnum = (0, pg_core_1.pgEnum)("report_status", ["pending", "reviewed"]);
// ---------- USERS ----------
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    passwordHash: (0, pg_core_1.text)("password_hash").notNull(),
    bio: (0, pg_core_1.text)("bio"),
    profilePicUrl: (0, pg_core_1.text)("profile_pic_url"),
    socials: (0, pg_core_1.jsonb)("socials"),
    projectLinks: (0, pg_core_1.jsonb)("project_links"),
    displayName: (0, pg_core_1.text)("display_name"),
    branch: (0, pg_core_1.text)("branch"),
    semester: (0, pg_core_1.integer)("semester"),
    campusSkills: (0, pg_core_1.jsonb)("campus_skills").$type().default([]).notNull(),
    interests: (0, pg_core_1.jsonb)("interests").$type().default([]).notNull(),
    twoWeekLine: (0, pg_core_1.text)("two_week_line"),
    profileEmbedding: (0, pg_core_1.vector)("profile_embedding", { dimensions: 384 }),
    university: (0, pg_core_1.text)("university"),
    degree: (0, pg_core_1.text)("degree"),
    graduationYear: (0, pg_core_1.integer)("graduation_year"),
    cgpa: (0, pg_core_1.numeric)("cgpa", { precision: 4, scale: 2 }),
    headline: (0, pg_core_1.text)("headline"),
    linkedinUrl: (0, pg_core_1.text)("linkedin_url"),
    githubLogin: (0, pg_core_1.text)("github_login"),
    githubStats: (0, pg_core_1.jsonb)("github_stats").$type(),
    projects: (0, pg_core_1.jsonb)("projects").$type().default([]).notNull(),
    certifications: (0, pg_core_1.jsonb)("certifications").$type().default([]).notNull(),
    experience: (0, pg_core_1.jsonb)("experience").$type().default([]).notNull(),
    hoursPerWeek: (0, pg_core_1.integer)("hours_per_week"),
    availableDays: (0, pg_core_1.jsonb)("available_days").$type().default([]).notNull(),
    githubUrl: (0, pg_core_1.text)("github_url"),
    siteUrl: (0, pg_core_1.text)("site_url"),
    isAdmin: (0, pg_core_1.boolean)("is_admin").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// ---------- SKILLS / DOMAINS (fixed lookups) ----------
exports.skills = (0, pg_core_1.pgTable)("skills", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull().unique(),
});
exports.domains = (0, pg_core_1.pgTable)("domains", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull().unique(),
});
// ---------- JOIN TABLES: user_skills, follows ----------
exports.userSkills = (0, pg_core_1.pgTable)("user_skills", {
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    skillId: (0, pg_core_1.uuid)("skill_id").notNull().references(() => exports.skills.id),
});
exports.follows = (0, pg_core_1.pgTable)("follows", {
    followerId: (0, pg_core_1.uuid)("follower_id").notNull().references(() => exports.users.id),
    followingId: (0, pg_core_1.uuid)("following_id").notNull().references(() => exports.users.id),
});
// ---------- COMMUNITIES ----------
exports.communities = (0, pg_core_1.pgTable)("communities", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    emailDomain: (0, pg_core_1.text)("email_domain").notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.communityMembers = (0, pg_core_1.pgTable)("community_members", {
    communityId: (0, pg_core_1.uuid)("community_id").notNull().references(() => exports.communities.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    joinedAt: (0, pg_core_1.timestamp)("joined_at").defaultNow().notNull(),
});
exports.communityBans = (0, pg_core_1.pgTable)("community_bans", {
    communityId: (0, pg_core_1.uuid)("community_id").notNull().references(() => exports.communities.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    bannedUntil: (0, pg_core_1.timestamp)("banned_until").notNull(),
    reason: (0, pg_core_1.text)("reason"),
});
// ---------- IDEAS ----------
exports.ideas = (0, pg_core_1.pgTable)("ideas", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ownerId: (0, pg_core_1.uuid)("owner_id").notNull().references(() => exports.users.id),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    domainId: (0, pg_core_1.uuid)("domain_id").notNull().references(() => exports.domains.id),
    communityId: (0, pg_core_1.uuid)("community_id").references(() => exports.communities.id), // nullable = global
    accessType: (0, exports.accessTypeEnum)("access_type").notNull(),
    status: (0, exports.ideaStatusEnum)("status").default("open").notNull(),
    embedding: (0, pg_core_1.vector)("embedding", { dimensions: 384 }), // matches all-MiniLM-L6-v2
    forkedFromId: (0, pg_core_1.uuid)("forked_from_id").references(() => exports.ideas.id),
    inviteToken: (0, pg_core_1.text)("invite_token").unique(),
    avgRating: (0, pg_core_1.numeric)("avg_rating"),
    ratingCount: (0, pg_core_1.integer)("rating_count").default(0).notNull(),
    pitch: (0, pg_core_1.text)("pitch"),
    audience: (0, pg_core_1.text)("audience"),
    gap: (0, pg_core_1.text)("gap"),
    ships: (0, pg_core_1.text)("ships"),
    stage: (0, pg_core_1.text)("stage").default("idea").notNull(),
    teamStatus: (0, pg_core_1.text)("team_status").default("open").notNull(),
    helpNeeded: (0, pg_core_1.jsonb)("help_needed").$type().default([]).notNull(),
    isSmall: (0, pg_core_1.boolean)("is_small").default(false).notNull(),
    hourCap: (0, pg_core_1.integer)("hour_cap"),
    compensationSentence: (0, pg_core_1.text)("compensation_sentence"),
    hideName: (0, pg_core_1.boolean)("hide_name").default(false).notNull(),
    authorName: (0, pg_core_1.text)("author_name"),
    authorBranch: (0, pg_core_1.text)("author_branch"),
    authorSemester: (0, pg_core_1.integer)("author_semester"),
    problemId: (0, pg_core_1.uuid)("problem_id"),
    duplicateOfId: (0, pg_core_1.uuid)("duplicate_of_id"),
    sprintId: (0, pg_core_1.uuid)("sprint_id"),
    hiddenAt: (0, pg_core_1.timestamp)("hidden_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.ideaLookingFor = (0, pg_core_1.pgTable)("idea_looking_for", {
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    skillId: (0, pg_core_1.uuid)("skill_id").notNull().references(() => exports.skills.id),
});
exports.ideaImages = (0, pg_core_1.pgTable)("idea_images", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    imageUrl: (0, pg_core_1.text)("image_url").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.ideaComments = (0, pg_core_1.pgTable)("idea_comments", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    parentCommentId: (0, pg_core_1.uuid)("parent_comment_id").references(() => exports.ideaComments.id),
    content: (0, pg_core_1.text)("content").notNull(),
    imageUrl: (0, pg_core_1.text)("image_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at"),
}, (t) => ({
    byThread: (0, pg_core_1.index)("idea_comments_thread_idx").on(t.ideaId, t.parentCommentId, t.createdAt),
}));
exports.reactions = (0, pg_core_1.pgTable)("reactions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    targetType: (0, pg_core_1.text)("target_type").notNull(),
    targetId: (0, pg_core_1.uuid)("target_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (t) => ({
    uniq: (0, pg_core_1.unique)().on(t.userId, t.targetType, t.targetId),
    byTarget: (0, pg_core_1.index)("reactions_target_idx").on(t.targetType, t.targetId),
}));
exports.ratings = (0, pg_core_1.pgTable)("ratings", {
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    value: (0, pg_core_1.integer)("value").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (t) => ({
    uniqIdeaUser: (0, pg_core_1.unique)().on(t.ideaId, t.userId),
}));
exports.contributions = (0, pg_core_1.pgTable)("contributions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    content: (0, pg_core_1.text)("content").notNull(),
    link: (0, pg_core_1.text)("link"),
    status: (0, exports.contributionStatusEnum)("status").default("pending").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.joinRequests = (0, pg_core_1.pgTable)("join_requests", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    status: (0, exports.joinRequestStatusEnum)("status").default("pending").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.savedIdeas = (0, pg_core_1.pgTable)("saved_ideas", {
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// ---------- GROUPS ----------
exports.groups = (0, pg_core_1.pgTable)("groups", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().unique().references(() => exports.ideas.id),
});
exports.groupMembers = (0, pg_core_1.pgTable)("group_members", {
    groupId: (0, pg_core_1.uuid)("group_id").notNull().references(() => exports.groups.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    joinedAt: (0, pg_core_1.timestamp)("joined_at").defaultNow().notNull(),
    leftAt: (0, pg_core_1.timestamp)("left_at"),
});
exports.groupMessages = (0, pg_core_1.pgTable)("group_messages", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    groupId: (0, pg_core_1.uuid)("group_id").notNull().references(() => exports.groups.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    content: (0, pg_core_1.text)("content").notNull(),
    imageUrl: (0, pg_core_1.text)("image_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// ---------- CAMPUS SPRINT (Attest) ----------
exports.sprints = (0, pg_core_1.pgTable)("sprints", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    endsAt: (0, pg_core_1.timestamp)("ends_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.problems = (0, pg_core_1.pgTable)("problems", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    authorId: (0, pg_core_1.uuid)("author_id").notNull().references(() => exports.users.id),
    sprintId: (0, pg_core_1.uuid)("sprint_id").references(() => exports.sprints.id),
    title: (0, pg_core_1.text)("title").notNull(),
    whatHappens: (0, pg_core_1.text)("what_happens").notNull(),
    whoFeels: (0, pg_core_1.text)("who_feels").notNull(),
    fixWouldChange: (0, pg_core_1.text)("fix_would_change").notNull(),
    source: (0, pg_core_1.text)("source").notNull(),
    authorName: (0, pg_core_1.text)("author_name"),
    authorBranch: (0, pg_core_1.text)("author_branch"),
    authorSemester: (0, pg_core_1.integer)("author_semester"),
    hideName: (0, pg_core_1.boolean)("hide_name").default(false).notNull(),
    freshLine: (0, pg_core_1.text)("fresh_line"),
    hiddenAt: (0, pg_core_1.timestamp)("hidden_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.approaches = (0, pg_core_1.pgTable)("approaches", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").references(() => exports.ideas.id),
    problemId: (0, pg_core_1.uuid)("problem_id").references(() => exports.problems.id),
    body: (0, pg_core_1.text)("body").notNull(),
    contactEmail: (0, pg_core_1.text)("contact_email").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.revisions = (0, pg_core_1.pgTable)("revisions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    targetType: (0, pg_core_1.text)("target_type").notNull(),
    targetId: (0, pg_core_1.uuid)("target_id").notNull(),
    snapshot: (0, pg_core_1.jsonb)("snapshot").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.offers = (0, pg_core_1.pgTable)("offers", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    builderId: (0, pg_core_1.uuid)("builder_id").notNull().references(() => exports.users.id),
    sprintId: (0, pg_core_1.uuid)("sprint_id").references(() => exports.sprints.id),
    ideaId: (0, pg_core_1.uuid)("idea_id").references(() => exports.ideas.id),
    problemId: (0, pg_core_1.uuid)("problem_id").references(() => exports.problems.id),
    body: (0, pg_core_1.text)("body").notNull(),
    hoursPerWeek: (0, pg_core_1.integer)("hours_per_week").notNull(),
    availableDays: (0, pg_core_1.jsonb)("available_days").$type().default([]).notNull(),
    links: (0, pg_core_1.jsonb)("links").$type().default([]).notNull(),
    proposal: (0, pg_core_1.jsonb)("proposal"),
    status: (0, pg_core_1.text)("status").default("new").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.tryouts = (0, pg_core_1.pgTable)("tryouts", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    offerId: (0, pg_core_1.uuid)("offer_id").notNull().unique().references(() => exports.offers.id),
    brief: (0, pg_core_1.text)("brief").notNull(),
    hourCap: (0, pg_core_1.integer)("hour_cap").notNull(),
    outcome: (0, pg_core_1.text)("outcome"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.teamMembers = (0, pg_core_1.pgTable)("team_members", {
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    joinedAt: (0, pg_core_1.timestamp)("joined_at").defaultNow().notNull(),
    leftAt: (0, pg_core_1.timestamp)("left_at"),
    exitReason: (0, pg_core_1.text)("exit_reason"),
}, (t) => ({
    pk: (0, pg_core_1.primaryKey)({ columns: [t.ideaId, t.userId] }),
}));
exports.tasks = (0, pg_core_1.pgTable)("tasks", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description").default("").notNull(),
    links: (0, pg_core_1.jsonb)("links").$type().default([]).notNull(),
    role: (0, pg_core_1.text)("role"),
    status: (0, pg_core_1.text)("status").default("todo").notNull(),
    assigneeId: (0, pg_core_1.uuid)("assignee_id").references(() => exports.users.id),
    receiptStatus: (0, pg_core_1.text)("receipt_status"),
    frozenAt: (0, pg_core_1.timestamp)("frozen_at"),
    signedAt: (0, pg_core_1.timestamp)("signed_at"),
    removedAt: (0, pg_core_1.timestamp)("removed_at"),
    witnessId: (0, pg_core_1.uuid)("witness_id").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.checkIns = (0, pg_core_1.pgTable)("check_ins", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    done: (0, pg_core_1.text)("done").notNull(),
    stuck: (0, pg_core_1.text)("stuck").notNull(),
    next: (0, pg_core_1.text)("next").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (t) => ({
    uniq: (0, pg_core_1.unique)().on(t.ideaId, t.userId),
}));
exports.proofPages = (0, pg_core_1.pgTable)("proof_pages", {
    userId: (0, pg_core_1.uuid)("user_id").primaryKey().references(() => exports.users.id),
    published: (0, pg_core_1.boolean)("published").default(false).notNull(),
});
exports.sprintInvites = (0, pg_core_1.pgTable)("sprint_invites", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id),
    email: (0, pg_core_1.text)("email").notNull(),
    status: (0, pg_core_1.text)("status").default("pending").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.saves = (0, pg_core_1.pgTable)("saves", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    targetType: (0, pg_core_1.text)("target_type").notNull(),
    targetId: (0, pg_core_1.uuid)("target_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (t) => ({
    uniq: (0, pg_core_1.unique)().on(t.userId, t.targetType, t.targetId),
}));
exports.notices = (0, pg_core_1.pgTable)("notices", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    body: (0, pg_core_1.text)("body").notNull(),
    targetId: (0, pg_core_1.uuid)("target_id"),
    readAt: (0, pg_core_1.timestamp)("read_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.events = (0, pg_core_1.pgTable)("events", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    kind: (0, pg_core_1.text)("kind").notNull(),
    actorId: (0, pg_core_1.uuid)("actor_id").references(() => exports.users.id),
    targetType: (0, pg_core_1.text)("target_type"),
    targetId: (0, pg_core_1.uuid)("target_id"),
    payload: (0, pg_core_1.jsonb)("payload"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.interactions = (0, pg_core_1.pgTable)("interactions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    ideaId: (0, pg_core_1.uuid)("idea_id").notNull().references(() => exports.ideas.id, { onDelete: "cascade" }),
    kind: (0, pg_core_1.text)("kind").notNull(),
    dwellMs: (0, pg_core_1.integer)("dwell_ms"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (t) => ({
    byUser: (0, pg_core_1.index)("interactions_user_created_idx").on(t.userId, t.createdAt),
    byIdea: (0, pg_core_1.index)("interactions_idea_idx").on(t.ideaId),
}));
const bytea = (0, pg_core_1.customType)({ dataType: () => "bytea" });
exports.documents = (0, pg_core_1.pgTable)("documents", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id").notNull().references(() => exports.users.id),
    kind: (0, pg_core_1.text)("kind").notNull(),
    filename: (0, pg_core_1.text)("filename").notNull(),
    mimeType: (0, pg_core_1.text)("mime_type").notNull(),
    content: bytea("content"),
    status: (0, pg_core_1.text)("status").default("queued").notNull(),
    result: (0, pg_core_1.jsonb)("result"),
    error: (0, pg_core_1.text)("error"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    parsedAt: (0, pg_core_1.timestamp)("parsed_at"),
}, (t) => ({
    byStatus: (0, pg_core_1.index)("documents_status_created_idx").on(t.status, t.createdAt),
}));
// ---------- REPORTS ----------
exports.reports = (0, pg_core_1.pgTable)("reports", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    reporterId: (0, pg_core_1.uuid)("reporter_id").notNull().references(() => exports.users.id),
    targetType: (0, exports.reportTargetEnum)("target_type").notNull(),
    targetId: (0, pg_core_1.uuid)("target_id").notNull(),
    communityId: (0, pg_core_1.uuid)("community_id").references(() => exports.communities.id),
    reason: (0, pg_core_1.text)("reason").notNull(),
    classification: (0, pg_core_1.text)("classification"),
    status: (0, exports.reportStatusEnum)("status").default("pending").notNull(),
    resolution: (0, pg_core_1.text)("resolution"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
