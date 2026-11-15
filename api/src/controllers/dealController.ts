import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth";
import {
    appealSchema,
    cancelEngagementSchema,
    confirmAdultSchema,
    createEngagementSchema,
    createGigSchema,
    cursorQuerySchema,
    gigListQuerySchema,
    gigResponseSchema,
    disputeMilestoneSchema,
    engagementMessageSchema,
    privacySchema,
    recordPaymentSchema,
    resolveIntegrityFlagSchema,
    reviewSchema,
    submitMilestoneSchema,
    suspendUserSchema,
    updateHandleSchema,
} from "../../../packages/types";
import { CampusError } from "../services/campusService";
import * as deals from "../services/dealService";
import * as gigs from "../services/gigService";

const idSchema = z.string().uuid();

function sendError(res: Response, error: unknown) {
    if (error instanceof CampusError) {
        return res.status(error.status).json({ error: error.message, ...(error.extra ?? {}) });
    }
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
}

function firstIssue(error: z.ZodError) {
    const issue = error.issues[0];
    return issue ? issue.message : "Check the form and try again";
}

/** Wraps a handler: validates :id (when present) and body/query with Zod, maps CampusError to JSON. */
function handle<T extends z.ZodTypeAny | null>(
    schema: T,
    source: "body" | "query",
    run: (userId: string, id: string, input: T extends z.ZodTypeAny ? z.infer<T> : undefined) => Promise<unknown>,
) {
    return async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!.userId;
            let id = "";
            if (req.params.id !== undefined) {
                const parsedId = idSchema.safeParse(req.params.id);
                if (!parsedId.success) return res.status(404).json({ error: "Not found" });
                id = parsedId.data;
            }
            let input: unknown = undefined;
            if (schema) {
                const parsed = schema.safeParse(source === "body" ? req.body ?? {} : req.query ?? {});
                if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error), details: parsed.error.flatten() });
                input = parsed.data;
            }
            const result = await run(userId, id, input as never);
            return res.json(result);
        } catch (error) {
            return sendError(res, error);
        }
    };
}

// Deals (engagements)
export const createEngagement = handle(createEngagementSchema, "body", (userId, _id, input) => deals.createEngagement(userId, input));
export const listEngagements = handle(cursorQuerySchema, "query", (userId, _id, input) => deals.listEngagements(userId, input));
export const getEngagement = handle(null, "body", (userId, id) => deals.getEngagement(userId, id));
export const acceptEngagement = handle(null, "body", (userId, id) => deals.acceptEngagement(userId, id));
export const cancelEngagement = handle(cancelEngagementSchema, "body", (userId, id, input) => deals.cancelEngagement(userId, id, input.reason));
export const reviewEngagement = handle(reviewSchema, "body", (userId, id, input) => deals.submitReview(userId, id, input));
export const listMessages = handle(cursorQuerySchema, "query", (userId, id, input) => deals.listMessages(userId, id, input));
export const postMessage = handle(engagementMessageSchema, "body", (userId, id, input) => deals.postMessage(userId, id, input.body));

// Gigs (quick freelancing)
export const listGigs = handle(gigListQuerySchema, "query", (userId, _id, input) => gigs.listGigs(userId, input));
export const createGig = handle(createGigSchema, "body", (userId, _id, input) => gigs.createGig(userId, input));
export const getGig = handle(null, "body", (userId, id) => gigs.getGig(userId, id));
export const respondToGig = handle(gigResponseSchema, "body", (userId, id, input) => gigs.respondToGig(userId, id, input.note));
export const closeGig = handle(null, "body", (userId, id) => gigs.closeGig(userId, id));
export const acceptGigResponse = handle(null, "body", (userId, id) => gigs.acceptResponse(userId, id));
export const declineGigResponse = handle(null, "body", (userId, id) => gigs.declineResponse(userId, id));

// Milestones
export const submitMilestone = handle(submitMilestoneSchema, "body", (userId, id, input) => deals.submitMilestone(userId, id, input));
export const acceptMilestone = handle(null, "body", (userId, id) => deals.acceptMilestone(userId, id));
export const disputeMilestone = handle(disputeMilestoneSchema, "body", (userId, id, input) => deals.disputeMilestone(userId, id, input.reason));
export const recordPayment = handle(recordPaymentSchema, "body", (userId, id, input) => deals.recordPayment(userId, id, input));
export const confirmPayment = handle(null, "body", (userId, id) => deals.confirmPaymentReceived(userId, id));

// Reviews + deal record on profiles
export const personReviews = handle(null, "body", async (_userId, id) => ({ reviews: await deals.reviewSummaryFor(id), deals: await deals.dealRecordFor(id) }));

// Account
export const setHandle = handle(updateHandleSchema, "body", (userId, _id, input) => deals.setHandle(userId, input.handle));
export const confirmAdult = handle(confirmAdultSchema, "body", (userId) => deals.confirmAdult(userId));
export const setPrivacy = handle(privacySchema, "body", (userId, _id, input) => deals.setPrivacy(userId, input.showInstitution));
export const appeal = handle(appealSchema, "body", (userId, _id, input) => deals.appealSuspension(userId, input.text));

// Moderation (admin)
export const listIntegrityFlags = handle(cursorQuerySchema, "query", (userId, _id, input) => deals.listIntegrityFlags(userId, input));
export const resolveIntegrityFlag = handle(resolveIntegrityFlagSchema, "body", (userId, id, input) => deals.resolveIntegrityFlag(userId, id, input.action));
export const suspendUser = handle(suspendUserSchema, "body", (userId, id, input) => deals.suspendUser(userId, id, input.reason));
export const unsuspendUser = handle(null, "body", (userId, id) => deals.unsuspendUser(userId, id));

/** Suspended users can read and appeal, but not write (RULES 3). */
export async function writeGuard(req: AuthenticatedRequest, res: Response, next: () => void) {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    if (req.path === "/me/appeal") return next();
    try {
        if (req.user && await deals.isSuspended(req.user.userId)) {
            return res.status(403).json({ error: "Your account is suspended. You can still read and send an appeal.", suspended: true });
        }
    } catch (error) {
        return sendError(res, error);
    }
    return next();
}
