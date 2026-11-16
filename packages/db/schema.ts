import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, boolean, AnyPgColumn, vector, pgEnum, unique, primaryKey, index, customType } from "drizzle-orm/pg-core";

// ---------- ENUMS ----------
export const accessTypeEnum = pgEnum("access_type", ["open_open", "open_closed", "closed"]);
export const ideaStatusEnum = pgEnum("idea_status", ["open", "closed"]);
export const contributionStatusEnum = pgEnum("contribution_status", ["pending", "approved", "rejected"]);
export const joinRequestStatusEnum = pgEnum("join_request_status", ["pending", "accepted", "rejected"]);
export const reportTargetEnum = pgEnum("report_target_type", ["idea", "user", "community", "problem"]);
export const reportStatusEnum = pgEnum("report_status", ["pending", "reviewed"]);

// ---------- USERS ----------
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    bio: text("bio"),
    profilePicUrl: text("profile_pic_url"),
    socials: jsonb("socials"),
    projectLinks: jsonb("project_links"),
    displayName: text("display_name"),
    branch: text("branch"),
    semester: integer("semester"),
    campusSkills: jsonb("campus_skills").$type<string[]>().default([]).notNull(),
    interests: jsonb("interests").$type<string[]>().default([]).notNull(),
    twoWeekLine: text("two_week_line"),
    profileEmbedding: vector("profile_embedding", { dimensions: 384 }),
    university: text("university"),
    degree: text("degree"),
    graduationYear: integer("graduation_year"),
    cgpa: numeric("cgpa", { precision: 4, scale: 2 }),
    headline: text("headline"),
    linkedinUrl: text("linkedin_url"),
    githubLogin: text("github_login"),
    githubStats: jsonb("github_stats").$type<{ publicRepos: number; followers: number; topLanguages: string[]; checkedAt: string }>(),
    projects: jsonb("projects").$type<{ title: string; url?: string; summary?: string }[]>().default([]).notNull(),
    certifications: jsonb("certifications").$type<{ name: string; issuer?: string; year?: number; url?: string }[]>().default([]).notNull(),
    experience: jsonb("experience").$type<{ role: string; org: string; period?: string }[]>().default([]).notNull(),
    hoursPerWeek: integer("hours_per_week"),
    availableDays: jsonb("available_days").$type<string[]>().default([]).notNull(),
    githubUrl: text("github_url"),
    siteUrl: text("site_url"),
    coverUrl: text("cover_url"),
    currentlyWorkingOn: text("currently_working_on"),
    isAdmin: boolean("is_admin").default(false).notNull(),
    country: text("country"),
    city: text("city"),
    showInstitution: boolean("show_institution").default(false).notNull(),
    adultConfirmedAt: timestamp("adult_confirmed_at"),
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    suspensionAppeal: text("suspension_appeal"),
    appealedAt: timestamp("appealed_at"),
    emailDomain: text("email_domain"),
    tipUrl: text("tip_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const academicVerifications = pgTable("academic_verifications", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    emailDomain: text("email_domain").notNull(),
    method: text("method").notNull(),
    verifiedAt: timestamp("verified_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
}, (t) => ({
    uniqUserDomain: unique("academic_verifications_user_domain_unique").on(t.userId, t.emailDomain),
}));

// ---------- SKILLS / DOMAINS (fixed lookups) ----------
export const skills = pgTable("skills", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
});

export const domains = pgTable("domains", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
});

// ---------- JOIN TABLES: user_skills, follows ----------
export const userSkills = pgTable("user_skills", {
    userId: uuid("user_id").notNull().references(() => users.id),
    skillId: uuid("skill_id").notNull().references(() => skills.id),
});

export const follows = pgTable("follows", {
    followerId: uuid("follower_id").notNull().references(() => users.id),
    followingId: uuid("following_id").notNull().references(() => users.id),
});

// ---------- COMMUNITIES ----------
export const communities = pgTable("communities", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    emailDomain: text("email_domain").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityMembers = pgTable("community_members", {
    communityId: uuid("community_id").notNull().references(() => communities.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const communityBans = pgTable("community_bans", {
    communityId: uuid("community_id").notNull().references(() => communities.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    bannedUntil: timestamp("banned_until").notNull(),
    reason: text("reason"),
});

// ---------- IDEAS ----------
export const ideas = pgTable("ideas", {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    domainId: uuid("domain_id").notNull().references(() => domains.id),
    communityId: uuid("community_id").references(() => communities.id), // nullable = global
    accessType: accessTypeEnum("access_type").notNull(),
    status: ideaStatusEnum("status").default("open").notNull(),
    embedding: vector("embedding", { dimensions: 384 }), // matches all-MiniLM-L6-v2
    forkedFromId: uuid("forked_from_id").references((): AnyPgColumn => ideas.id),
    inviteToken: text("invite_token").unique(),
    avgRating: numeric("avg_rating"),
    ratingCount: integer("rating_count").default(0).notNull(),
    pitch: text("pitch"),
    audience: text("audience"),
    gap: text("gap"),
    ships: text("ships"),
    stage: text("stage").default("idea").notNull(),
    teamStatus: text("team_status").default("open").notNull(),
    helpNeeded: jsonb("help_needed").$type<string[]>().default([]).notNull(),
    isSmall: boolean("is_small").default(false).notNull(),
    hourCap: integer("hour_cap"),
    compensationSentence: text("compensation_sentence"),
    hideName: boolean("hide_name").default(false).notNull(),
    authorName: text("author_name"),
    authorBranch: text("author_branch"),
    authorSemester: integer("author_semester"),
    problemId: uuid("problem_id"),
    duplicateOfId: uuid("duplicate_of_id"),
    sprintId: uuid("sprint_id"),
    hiddenAt: timestamp("hidden_at"),
    visibility: text("visibility").default("standard").notNull(),
    blurb: text("blurb"),
    dealType: text("deal_type").default("credit_only").notNull(),
    currency: text("currency"),
    budgetMinor: integer("budget_minor"),
    licence: text("licence"),
    notAcademicAttestedAt: timestamp("not_academic_attested_at"),
    integrityCheckedAt: timestamp("integrity_checked_at"),
    campusDomain: text("campus_domain"),
    campusOnly: boolean("campus_only").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ideaLookingFor = pgTable("idea_looking_for", {
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    skillId: uuid("skill_id").notNull().references(() => skills.id),
});

export const ideaImages = pgTable("idea_images", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    imageUrl: text("image_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ideaComments = pgTable("idea_comments", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => ideaComments.id),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
}, (t) => ({
    byThread: index("idea_comments_thread_idx").on(t.ideaId, t.parentCommentId, t.createdAt),
}));

export const reactions = pgTable("reactions", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    uniq: unique().on(t.userId, t.targetType, t.targetId),
    byTarget: index("reactions_target_idx").on(t.targetType, t.targetId),
}));

export const ratings = pgTable("ratings", {
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    value: integer("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    uniqIdeaUser: unique().on(t.ideaId, t.userId),
}));

export const contributions = pgTable("contributions", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    link: text("link"),
    status: contributionStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const joinRequests = pgTable("join_requests", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    status: joinRequestStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedIdeas = pgTable("saved_ideas", {
    userId: uuid("user_id").notNull().references(() => users.id),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- GROUPS ----------
export const groups = pgTable("groups", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().unique().references(() => ideas.id),
});

export const groupMembers = pgTable("group_members", {
    groupId: uuid("group_id").notNull().references(() => groups.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
});

export const groupMessages = pgTable("group_messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- CAMPUS SPRINT (Attest) ----------
export const sprints = pgTable("sprints", {
    id: uuid("id").defaultRandom().primaryKey(),
    endsAt: timestamp("ends_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const problems = pgTable("problems", {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id").notNull().references(() => users.id),
    sprintId: uuid("sprint_id").references(() => sprints.id),
    title: text("title").notNull(),
    whatHappens: text("what_happens").notNull(),
    whoFeels: text("who_feels").notNull(),
    fixWouldChange: text("fix_would_change").notNull(),
    source: text("source").notNull(),
    authorName: text("author_name"),
    authorBranch: text("author_branch"),
    authorSemester: integer("author_semester"),
    hideName: boolean("hide_name").default(false).notNull(),
    freshLine: text("fresh_line"),
    hiddenAt: timestamp("hidden_at"),
    notAcademicAttestedAt: timestamp("not_academic_attested_at"),
    integrityCheckedAt: timestamp("integrity_checked_at"),
    campusDomain: text("campus_domain"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const approaches = pgTable("approaches", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").references(() => ideas.id),
    problemId: uuid("problem_id").references(() => problems.id),
    body: text("body").notNull(),
    contactEmail: text("contact_email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revisions = pgTable("revisions", {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const offers = pgTable("offers", {
    id: uuid("id").defaultRandom().primaryKey(),
    builderId: uuid("builder_id").notNull().references(() => users.id),
    sprintId: uuid("sprint_id").references(() => sprints.id),
    ideaId: uuid("idea_id").references(() => ideas.id),
    problemId: uuid("problem_id").references(() => problems.id),
    body: text("body").notNull(),
    hoursPerWeek: integer("hours_per_week").notNull(),
    availableDays: jsonb("available_days").$type<string[]>().default([]).notNull(),
    links: jsonb("links").$type<string[]>().default([]).notNull(),
    proposal: jsonb("proposal"),
    skills: jsonb("skills").$type<string[]>().default([]).notNull(),
    phases: jsonb("phases").$type<string[]>().default([]).notNull(),
    status: text("status").default("new").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tryouts = pgTable("tryouts", {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id").notNull().unique().references(() => offers.id),
    brief: text("brief").notNull(),
    hourCap: integer("hour_cap").notNull(),
    outcome: text("outcome"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
    exitReason: text("exit_reason"),
}, (t) => ({
    pk: primaryKey({ columns: [t.ideaId, t.userId] }),
}));

export const tasks = pgTable("tasks", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    links: jsonb("links").$type<string[]>().default([]).notNull(),
    role: text("role"),
    status: text("status").default("todo").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id),
    receiptStatus: text("receipt_status"),
    frozenAt: timestamp("frozen_at"),
    signedAt: timestamp("signed_at"),
    removedAt: timestamp("removed_at"),
    witnessId: uuid("witness_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const checkIns = pgTable("check_ins", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    done: text("done").notNull(),
    stuck: text("stuck").notNull(),
    next: text("next").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    uniq: unique().on(t.ideaId, t.userId),
}));

export const proofPages = pgTable("proof_pages", {
    userId: uuid("user_id").primaryKey().references(() => users.id),
    published: boolean("published").default(false).notNull(),
});

export const sprintInvites = pgTable("sprint_invites", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id),
    email: text("email").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const saves = pgTable("saves", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    uniq: unique().on(t.userId, t.targetType, t.targetId),
}));

export const notices = pgTable("notices", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    targetId: uuid("target_id"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interactions = pgTable("interactions", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    dwellMs: integer("dwell_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    byUser: index("interactions_user_created_idx").on(t.userId, t.createdAt),
    byIdea: index("interactions_idea_idx").on(t.ideaId),
}));

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const documents = pgTable("documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    kind: text("kind").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    content: bytea("content"),
    status: text("status").default("queued").notNull(),
    result: jsonb("result"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    parsedAt: timestamp("parsed_at"),
}, (t) => ({
    byStatus: index("documents_status_created_idx").on(t.status, t.createdAt),
}));

// ---------- KITS (organiser need lists; see DATA.md) ----------
export const kits = pgTable("kits", {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date"),
    campusDomain: text("campus_domain"),
    campusOnly: boolean("campus_only").default(false).notNull(),
    status: text("status").default("open").notNull(),
    hiddenAt: timestamp("hidden_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- GIGS (quick freelancing; see DATA.md) ----------
export const gigs = pgTable("gigs", {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id").notNull().references(() => users.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    dealType: text("deal_type").notNull(),
    currency: text("currency"),
    priceMinor: integer("price_minor"),
    deliveryDays: integer("delivery_days"),
    campusDomain: text("campus_domain"),
    campusOnly: boolean("campus_only").default(false).notNull(),
    status: text("status").default("open").notNull(),
    notAcademicAttestedAt: timestamp("not_academic_attested_at").notNull(),
    hiddenAt: timestamp("hidden_at"),
    kitId: uuid("kit_id").references(() => kits.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    byBoard: index("gigs_board_idx").on(t.status, t.kind, t.createdAt),
}));

// ---------- MARKETPLACE PHASE 1 (no money held; see DATA.md) ----------
export const engagements = pgTable("engagements", {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: uuid("idea_id").references(() => ideas.id),
    gigId: uuid("gig_id").references(() => gigs.id),
    requesterId: uuid("requester_id").notNull().references(() => users.id),
    builderId: uuid("builder_id").notNull().references(() => users.id),
    dealType: text("deal_type").notNull(),
    currency: text("currency"),
    totalAmountMinor: integer("total_amount_minor").default(0).notNull(),
    licence: text("licence"),
    ipTerms: text("ip_terms").notNull(),
    nda: boolean("nda").default(false).notNull(),
    notAcademicAttestedAt: timestamp("not_academic_attested_at").notNull(),
    status: text("status").default("proposed").notNull(),
    builderAcceptedAt: timestamp("builder_accepted_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    byBuilder: index("engagements_builder_status_idx").on(t.builderId, t.status),
    byRequester: index("engagements_requester_status_idx").on(t.requesterId, t.status),
}));

export const gigResponses = pgTable("gig_responses", {
    id: uuid("id").defaultRandom().primaryKey(),
    gigId: uuid("gig_id").notNull().references(() => gigs.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    note: text("note").notNull(),
    status: text("status").default("new").notNull(),
    engagementId: uuid("engagement_id").references(() => engagements.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    uniqGigUser: unique("gig_responses_gig_user_unique").on(t.gigId, t.userId),
}));

export const milestones = pgTable("milestones", {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id").notNull().references(() => engagements.id),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    amountMinor: integer("amount_minor").default(0).notNull(),
    dueAt: timestamp("due_at"),
    status: text("status").default("open").notNull(),
    deliverableLinks: jsonb("deliverable_links").$type<string[]>().default([]).notNull(),
    note: text("note"),
    submittedAt: timestamp("submitted_at"),
    acceptanceDeadline: timestamp("acceptance_deadline"),
    acceptedAt: timestamp("accepted_at"),
    disputedAt: timestamp("disputed_at"),
    disputeReason: text("dispute_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    byEngagement: index("milestones_engagement_idx").on(t.engagementId, t.position),
    byDeadline: index("milestones_deadline_idx").on(t.status, t.acceptanceDeadline),
}));

export const paymentConfirmations = pgTable("payment_confirmations", {
    id: uuid("id").defaultRandom().primaryKey(),
    milestoneId: uuid("milestone_id").notNull().unique().references(() => milestones.id),
    method: text("method").notNull(),
    externalReference: text("external_reference"),
    payerConfirmedAt: timestamp("payer_confirmed_at"),
    payeeConfirmedAt: timestamp("payee_confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id").notNull().references(() => engagements.id),
    reviewerId: uuid("reviewer_id").notNull().references(() => users.id),
    revieweeId: uuid("reviewee_id").notNull().references(() => users.id),
    onTime: integer("on_time").notNull(),
    communication: integer("communication").notNull(),
    quality: integer("quality").notNull(),
    wouldWorkAgain: boolean("would_work_again").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    uniqReviewer: unique("reviews_engagement_reviewer_unique").on(t.engagementId, t.reviewerId),
    byReviewee: index("reviews_reviewee_idx").on(t.revieweeId),
}));

export const engagementMessages = pgTable("engagement_messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id").notNull().references(() => engagements.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    flag: text("flag"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    byThread: index("engagement_messages_thread_idx").on(t.engagementId, t.createdAt),
}));

export const integrityFlags = pgTable("integrity_flags", {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    source: text("source").notNull(),
    label: text("label").notNull(),
    score: numeric("score", { precision: 5, scale: 4 }),
    matched: text("matched"),
    status: text("status").default("pending").notNull(),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    byStatus: index("integrity_flags_status_idx").on(t.status, t.createdAt),
}));

// ---------- REPORTS ----------
export const reports = pgTable("reports", {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id").notNull().references(() => users.id),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    communityId: uuid("community_id").references(() => communities.id),
    reason: text("reason").notNull(),
    classification: text("classification"),
    status: reportStatusEnum("status").default("pending").notNull(),
    resolution: text("resolution"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});