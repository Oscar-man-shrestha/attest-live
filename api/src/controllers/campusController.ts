import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
    addInterestSchema,
    addTaskSchema,
    branchPopularityQuerySchema,
    commentsQuerySchema,
    reactionSchema,
    reassignTaskSchema,
    sprintCommentSchema,
    feedQuerySchema,
    invitePersonSchema,
    peopleQuerySchema,
    interactionSchema,
    campusProfileSchema,
    checkInSchema,
    createOfferSchema,
    createProblemSchema,
    createSprintIdeaSchema,
    documentIdSchema,
    draftSchema,
    freshLineSchema,
    uploadDocumentSchema,
    inviteMemberSchema,
    microsoftCallbackSchema,
    removeMemberSchema,
    reportSchema,
    requestCodeSchema,
    resolveReportSchema,
    respondInviteSchema,
    saveSchema,
    tryoutSchema,
    updateTaskSchema,
    verifyCodeSchema,
} from "../../../packages/types";
import { CampusError } from "../services/campusService";
import * as campus from "../services/campusService";
import * as microsoft from "../services/microsoftAuth";
import * as recommender from "../services/recommender";
import * as documentsService from "../services/documentService";
import * as peers from "../services/peers";
import * as social from "../services/social";
import * as profiles from "../services/profileService";

function sendError(res: Response, error: unknown) {
    if (error instanceof CampusError) {
        return res.status(error.status).json({ error: error.message, ...(error.extra ?? {}) });
    }
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
}

const PROFILE_FIELD_ERRORS: Record<string, string> = {
    displayName: "Add your name",
    branch: "Pick your branch",
    semester: "Pick your semester",
    skills: "Up to 8 skills, each under 40 characters",
    interests: "Up to 20 interests",
    twoWeekLine: "Write at least one short sentence about what you could build or help with in two weeks",
    githubUrl: "Use your GitHub profile link, like https://github.com/username",
    siteUrl: "The portfolio link must start with https://",
    linkedinUrl: "Use your LinkedIn profile link, like https://www.linkedin.com/in/name",
    degree: "Pick your degree",
    graduationYear: "Graduation year looks wrong",
    cgpa: "CGPA is on a 10-point scale",
    headline: "Keep the headline under 120 characters",
    projects: "Up to 6 projects. Each needs a title, and links must start with https://",
    certifications: "Up to 10 certifications. Each needs a name, and links must start with https://",
    experience: "Up to 6 roles. Each needs a role and an organisation",
};

function userId(req: AuthenticatedRequest) {
    return req.user?.userId ?? "";
}

export const requestCode = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = requestCodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Use a campus email", details: parsed.error.flatten() });
    try {
        return res.json(await campus.requestCampusCode(parsed.data.email));
    } catch (error) {
        return sendError(res, error);
    }
};

export const verifyCode = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check the email and the 6-digit code", details: parsed.error.flatten() });
    try {
        return res.json(await campus.verifyCampusCode(parsed.data.email, parsed.data.code));
    } catch (error) {
        return sendError(res, error);
    }
};

export const microsoftStart = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const next = typeof req.query.next === "string" ? req.query.next : undefined;
        return res.json(microsoft.microsoftSignInUrl(next));
    } catch (error) {
        return sendError(res, error);
    }
};

export const microsoftCallback = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = microsoftCallbackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "The sign-in link is incomplete. Start again." });
    try {
        return res.json(await microsoft.completeMicrosoftSignIn(parsed.data.code, parsed.data.state));
    } catch (error) {
        return sendError(res, error);
    }
};

export const saveProfile = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = campusProfileSchema.safeParse(req.body);
    if (!parsed.success) {
        const field = String(parsed.error.issues[0]?.path[0] ?? "");
        return res.status(400).json({ error: PROFILE_FIELD_ERRORS[field] ?? "Check the profile fields", field, details: parsed.error.flatten() });
    }
    try {
        return res.json(await campus.saveProfile(userId(req), parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const listIdeas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const result = await campus.listIdeas(userId(req), req.query as Record<string, string>);
        return res.json({ ...result, ideas: await campus.withForkCounts(await social.withEngagement(userId(req), result.ideas)) });
    } catch (error) {
        return sendError(res, error);
    }
};

export const feed = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = feedQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Bad cursor" });
    try {
        const result = await recommender.forYouFeed(userId(req), parsed.data.cursor, parsed.data.campus === "1");
        return res.json({ ...result, ideas: await campus.withForkCounts(await social.withEngagement(userId(req), result.ideas)) });
    } catch (error) {
        return sendError(res, error);
    }
};

export const similar = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const result = await recommender.similarIdeas(userId(req), String(req.params.id));
        return res.json({ ideas: await campus.withForkCounts(await social.withEngagement(userId(req), result.ideas)) });
    } catch (error) {
        return sendError(res, error);
    }
};

export const interaction = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Bad signal" });
    try {
        return res.json(await recommender.recordInteraction(userId(req), parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const relatedInterests = async (_req: AuthenticatedRequest, res: Response) => {
    return res.json(recommender.relatedInterests());
};

export const addInterest = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = addInterestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Pick an interest from the list" });
    try {
        return res.json(await recommender.addInterest(userId(req), parsed.data.label));
    } catch (error) {
        return sendError(res, error);
    }
};

export const people = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = peopleQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Scope is all, branch or cohort" });
    try {
        return res.json(await peers.studentsLikeYou(userId(req), parsed.data.scope, parsed.data.cursor));
    } catch (error) {
        return sendError(res, error);
    }
};

export const invitePerson = async (req: AuthenticatedRequest, res: Response) => {
    const person = documentIdSchema.safeParse(req.params.id);
    const parsed = invitePersonSchema.safeParse(req.body);
    if (!person.success) return res.status(404).json({ error: "Student not found" });
    if (!parsed.success) return res.status(400).json({ error: "Pick one of your ideas" });
    try {
        return res.json(await peers.invitePerson(userId(req), person.data, parsed.data.ideaId));
    } catch (error) {
        return sendError(res, error);
    }
};

export const branchPopularity = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = branchPopularityQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Unknown branch" });
    try {
        return res.json(await peers.branchPopularity(parsed.data.branch));
    } catch (error) {
        return sendError(res, error);
    }
};

export const uploadDocument = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = uploadDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Say whether this is a resume, certificate, or idea brief" });
    try {
        return res.status(202).json(await documentsService.uploadDocument(userId(req), parsed.data.kind, req.file));
    } catch (error) {
        return sendError(res, error);
    }
};

export const getDocument = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Upload not found" });
    try {
        return res.json(await documentsService.getDocument(userId(req), id.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const getIdea = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const result = await campus.getIdea(userId(req), String(req.params.id));
        const [idea] = await social.withEngagement(userId(req), [result.idea]);
        return res.json({ idea });
    } catch (error) {
        return sendError(res, error);
    }
};

export const listComments = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    const parsed = commentsQuerySchema.safeParse(req.query);
    if (!id.success) return res.status(404).json({ error: "Idea not found" });
    if (!parsed.success) return res.status(400).json({ error: "Sort is top or new" });
    try {
        return res.json(await social.listComments(userId(req), id.data, parsed.data.sort, parsed.data.cursor));
    } catch (error) {
        return sendError(res, error);
    }
};

export const addComment = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    const parsed = sprintCommentSchema.safeParse(req.body);
    if (!id.success) return res.status(404).json({ error: "Idea not found" });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Write a comment" });
    try {
        return res.status(201).json(await social.addComment(userId(req), id.data, parsed.data.body, parsed.data.parentId));
    } catch (error) {
        return sendError(res, error);
    }
};

export const listReplies = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    const parsed = feedQuerySchema.safeParse(req.query);
    if (!id.success || !parsed.success) return res.status(404).json({ error: "Comment not found" });
    try {
        return res.json(await social.listReplies(userId(req), id.data, parsed.data.cursor));
    } catch (error) {
        return sendError(res, error);
    }
};

export const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Comment not found" });
    try {
        return res.json(await social.deleteComment(userId(req), id.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const react = (on: boolean) => async (req: AuthenticatedRequest, res: Response) => {
    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Say what you are liking" });
    try {
        return res.json(await social.setReaction(userId(req), parsed.data.targetType, parsed.data.targetId, on));
    } catch (error) {
        return sendError(res, error);
    }
};

export const share = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Idea not found" });
    try {
        await recommender.recordInteraction(userId(req), { ideaId: id.data, kind: "share" });
        return res.json({ shares: await social.shareCount(id.data) });
    } catch (error) {
        return sendError(res, error);
    }
};

export const personProfile = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Profile not found" });
    try {
        return res.json(await profiles.campusProfile(userId(req), id.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const personIdeas = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    const parsed = feedQuerySchema.safeParse(req.query);
    if (!id.success || !parsed.success) return res.status(404).json({ error: "Profile not found" });
    try {
        return res.json(await profiles.profilePosts(userId(req), id.data, parsed.data.cursor));
    } catch (error) {
        return sendError(res, error);
    }
};

export const followPerson = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Profile not found" });
    try {
        return res.json(await profiles.followPerson(userId(req), id.data, true));
    } catch (error) {
        return sendError(res, error);
    }
};

export const unfollowPerson = async (req: AuthenticatedRequest, res: Response) => {
    const id = documentIdSchema.safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ error: "Profile not found" });
    try {
        return res.json(await profiles.followPerson(userId(req), id.data, false));
    } catch (error) {
        return sendError(res, error);
    }
};

export const uploadProfileMedia = async (req: AuthenticatedRequest, res: Response) => {
    const slot = req.params.slot === "cover" || req.params.slot === "avatar" ? req.params.slot : null;
    if (!slot) return res.status(400).json({ error: "Use avatar or cover" });
    try {
        return res.status(201).json(await profiles.uploadProfileMedia(userId(req), slot, req.file));
    } catch (error) {
        return sendError(res, error);
    }
};

export const createIdea = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = userId(req);
        const rawContact = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim() : "";
        // Empty contact field → fall back to the sign-in mailbox so Post idea never fails on blank email.
        const contactEmail = rawContact || (await campus.requireUser(uid)).email;
        const parsed = createSprintIdeaSchema.safeParse({ ...req.body, contactEmail });
        if (!parsed.success) {
            const flat = parsed.error.flatten();
            const first = Object.entries(flat.fieldErrors).flatMap(([key, msgs]) => (msgs || []).map((m) => `${key}: ${m}`))[0]
                || flat.formErrors[0]
                || "Check the public brief";
            return res.status(400).json({ error: first, details: flat });
        }
        return res.status(201).json(await campus.createIdea(uid, parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const uploadIdeaImage = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.status(201).json(await campus.uploadSprintIdeaImage(userId(req), String(req.params.id), req.file));
    } catch (error) {
        return sendError(res, error);
    }
};

export const deleteIdeaImage = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.deleteSprintIdeaImage(userId(req), String(req.params.id), String(req.params.imageId)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const listProblems = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.listProblems(userId(req), req.query as Record<string, string>));
    } catch (error) {
        return sendError(res, error);
    }
};

export const getProblem = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.getProblem(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const createProblem = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = userId(req);
        const rawContact = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim() : "";
        const contactEmail = rawContact || (await campus.requireUser(uid)).email;
        const parsed = createProblemSchema.safeParse({ ...req.body, contactEmail });
        if (!parsed.success) {
            const flat = parsed.error.flatten();
            const first = Object.entries(flat.fieldErrors).flatMap(([key, msgs]) => (msgs || []).map((m) => `${key}: ${m}`))[0]
                || flat.formErrors[0]
                || "Check the problem";
            return res.status(400).json({ error: first, details: flat });
        }
        return res.status(201).json(await campus.createProblem(uid, parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const freshLine = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = freshLineSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Add one fresh line" });
    try {
        return res.json(await campus.addFreshLine(userId(req), String(req.params.id), parsed.data.freshLine));
    } catch (error) {
        return sendError(res, error);
    }
};

export const createOffer = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createOfferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check the request", details: parsed.error.flatten() });
    try {
        return res.status(201).json(await campus.createOffer(userId(req), parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const getOffer = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.getOffer(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const acceptOffer = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.acceptOffer(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const declineOffer = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.declineOffer(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const assignTryout = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = tryoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A tryout needs a brief and a cap of at most 8 hours" });
    try {
        return res.json(await campus.assignTryout(userId(req), String(req.params.id), parsed.data.brief, parsed.data.hourCap));
    } catch (error) {
        return sendError(res, error);
    }
};

export const inbox = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.getInbox(userId(req)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const inboxBadge = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.inboxBadge(userId(req)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const markNoticeRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.markNoticeRead(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const markAllNoticesRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.markAllNoticesRead(userId(req)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const work = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.getWork(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const addTask = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = addTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check the task" });
    try {
        return res.status(201).json(await campus.addTask(userId(req), String(req.params.id), parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const startTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.startTask(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check the draft" });
    try {
        return res.json(await campus.updateTaskDraft(userId(req), String(req.params.id), parsed.data.description, parsed.data.links));
    } catch (error) {
        return sendError(res, error);
    }
};

export const reassignTask = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = reassignTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Check the assignee" });
    try {
        return res.json(await campus.reassignTask(userId(req), String(req.params.id), parsed.data.assigneeId));
    } catch (error) {
        return sendError(res, error);
    }
};

export const submitTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.submitTask(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const signTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.signTask(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const disputeTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.disputeTask(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const checkIn = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Write done, stuck, and next" });
    try {
        return res.json(await campus.checkIn(userId(req), String(req.params.id), parsed.data));
    } catch (error) {
        return sendError(res, error);
    }
};

export const ship = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.shipIdea(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const invite = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invite a campus email" });
    try {
        return res.status(201).json(await campus.inviteMember(userId(req), String(req.params.id), parsed.data.email));
    } catch (error) {
        return sendError(res, error);
    }
};

export const getInvite = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.getInvite(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const respondInvite = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = respondInviteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Accept or decline" });
    try {
        return res.json(await campus.respondInvite(userId(req), String(req.params.id), parsed.data.action));
    } catch (error) {
        return sendError(res, error);
    }
};

export const leave = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.leaveTeam(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const removeMember = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = removeMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A removal needs a person and a reason" });
    try {
        return res.json(await campus.removeMember(userId(req), String(req.params.id), parsed.data.userId, parsed.data.reason));
    } catch (error) {
        return sendError(res, error);
    }
};

export const fork = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.status(201).json(await campus.forkIdea(userId(req), String(req.params.id)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const proof = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const subject = String(req.params.id || userId(req));
        return res.json(await campus.proofLines(userId(req), subject));
    } catch (error) {
        return sendError(res, error);
    }
};

export const publishProof = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.publishProof(userId(req), Boolean(req.body?.published)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const fileReport = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Report spam or copied work" });
    try {
        return res.status(201).json(await campus.fileReport(userId(req), parsed.data.targetType, parsed.data.targetId, parsed.data.reason));
    } catch (error) {
        return sendError(res, error);
    }
};

export const listReports = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json(await campus.listReports(userId(req)));
    } catch (error) {
        return sendError(res, error);
    }
};

export const resolveReport = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = resolveReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Restore the card or leave it hidden" });
    try {
        return res.json(await campus.resolveReport(userId(req), String(req.params.id), parsed.data.action));
    } catch (error) {
        return sendError(res, error);
    }
};

export const saveTarget = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a card to save" });
    try {
        return res.json(await campus.saveTarget(userId(req), parsed.data.targetType, parsed.data.targetId));
    } catch (error) {
        return sendError(res, error);
    }
};

export const unsaveTarget = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a card" });
    try {
        return res.json(await campus.unsaveTarget(userId(req), parsed.data.targetType, parsed.data.targetId));
    } catch (error) {
        return sendError(res, error);
    }
};

export const listSaved = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const result = await campus.listSaved(userId(req), typeof req.query.cursor === "string" ? req.query.cursor : undefined);
        return res.json({ ...result, ideas: await campus.withForkCounts(await social.withEngagement(userId(req), result.ideas)) });
    } catch (error) {
        return sendError(res, error);
    }
};

export const help = async (_req: AuthenticatedRequest, res: Response) => {
    return res.json(campus.helpAnswers());
};

export const draft = async (req: AuthenticatedRequest, res: Response) => {
    const parsed = draftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Add a few notes to draft from" });
    try {
        return res.json(await campus.draftText(parsed.data.kind, parsed.data.notes));
    } catch (error) {
        return sendError(res, error);
    }
};
