import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth";
import * as campus from "../controllers/campusController";
import * as deals from "../controllers/dealController";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES } from "../../../packages/types";

const router = Router();

const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, (DOCUMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)),
}).single("file");

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const ideaImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)),
}).single("image");

function singleDocument(req: Request, res: Response, next: NextFunction) {
    documentUpload(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "Files are capped at 5 MB" });
        }
        if (error) return res.status(400).json({ error: "Send one file in the \"file\" field" });
        next();
    });
}

function singleIdeaImage(req: Request, res: Response, next: NextFunction) {
    ideaImageUpload(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "Images are capped at 5 MB — compress or use a smaller photo" });
        }
        if (error) return res.status(400).json({ error: "Use one PNG, JPG, or WebP under 5 MB (not HEIC or PDF)" });
        next();
    });
}

const profileMediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)),
}).single("image");

function singleProfileMedia(req: Request, res: Response, next: NextFunction) {
    profileMediaUpload(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "Images are capped at 5 MB — compress or use a smaller photo" });
        }
        if (error) return res.status(400).json({ error: "Use one PNG, JPG, or WebP under 5 MB (not HEIC or PDF)" });
        next();
    });
}

router.use(authenticateToken);
router.use(deals.writeGuard);

// Marketplace Phase 1 — deals, milestones, off-platform payment records, reviews, scoped threads
router.get("/engagements", deals.listEngagements);
router.post("/engagements", deals.createEngagement);
router.get("/engagements/:id", deals.getEngagement);
router.post("/engagements/:id/accept", deals.acceptEngagement);
router.post("/engagements/:id/cancel", deals.cancelEngagement);
router.post("/engagements/:id/review", deals.reviewEngagement);
router.get("/engagements/:id/messages", deals.listMessages);
router.post("/engagements/:id/messages", deals.postMessage);
router.post("/milestones/:id/submit", deals.submitMilestone);
router.post("/milestones/:id/accept", deals.acceptMilestone);
router.post("/milestones/:id/dispute", deals.disputeMilestone);
router.post("/milestones/:id/payment", deals.recordPayment);
router.post("/milestones/:id/payment/confirm", deals.confirmPayment);
router.get("/people/:id/record", deals.personReviews);

// Demand signal and team thread
router.post("/ideas/:id/want", deals.wantIdea(true));
router.delete("/ideas/:id/want", deals.wantIdea(false));
router.get("/ideas/:id/thread", deals.listTeamMessages);
router.post("/ideas/:id/thread", deals.postTeamMessage);

// Gigs board
router.get("/gigs", deals.listGigs);
router.post("/gigs", deals.createGig);
router.get("/gigs/:id", deals.getGig);
router.post("/gigs/:id/respond", deals.respondToGig);
router.post("/gigs/:id/close", deals.closeGig);
router.post("/gig-responses/:id/accept", deals.acceptGigResponse);
router.post("/gig-responses/:id/decline", deals.declineGigResponse);

// Kits (organiser need lists)
router.get("/kits", deals.listKits);
router.post("/kits", deals.createKit);
router.get("/kits/:id", deals.getKit);
router.post("/kits/:id/needs", deals.addKitNeed);
router.post("/kits/:id/close", deals.closeKit);

// Account settings
router.put("/me/handle", deals.setHandle);
router.post("/me/adult", deals.confirmAdult);
router.put("/me/privacy", deals.setPrivacy);
router.post("/me/appeal", deals.appeal);

// Moderation (admin only)
router.get("/admin/integrity", deals.listIntegrityFlags);
router.post("/admin/integrity/:id", deals.resolveIntegrityFlag);
router.post("/admin/users/:id/suspend", deals.suspendUser);
router.post("/admin/users/:id/unsuspend", deals.unsuspendUser);

router.post("/documents", singleDocument, campus.uploadDocument);
router.get("/documents/:id", campus.getDocument);

router.put("/profile", campus.saveProfile);
router.get("/ideas", campus.listIdeas);
router.post("/ideas", campus.createIdea);
router.get("/feed", campus.feed);
router.post("/interactions", campus.interaction);
router.post("/profile/interests", campus.addInterest);
router.get("/interests/related", campus.relatedInterests);
router.get("/interests/popular", campus.branchPopularity);
router.get("/people", campus.people);
router.get("/people/:id", campus.personProfile);
router.get("/people/:id/ideas", campus.personIdeas);
router.post("/people/:id/follow", campus.followPerson);
router.delete("/people/:id/follow", campus.unfollowPerson);
router.post("/people/:id/invite", campus.invitePerson);
router.post("/profile/media/:slot", singleProfileMedia, campus.uploadProfileMedia);
router.get("/ideas/:id/comments", campus.listComments);
router.post("/ideas/:id/comments", campus.addComment);
router.post("/ideas/:id/share", campus.share);
router.get("/comments/:id/replies", campus.listReplies);
router.delete("/comments/:id", campus.deleteComment);
router.post("/reactions", campus.react(true));
router.delete("/reactions", campus.react(false));
router.get("/ideas/:id/similar", campus.similar);
router.get("/ideas/:id", campus.getIdea);
router.post("/ideas/:id/images", singleIdeaImage, campus.uploadIdeaImage);
router.delete("/ideas/:id/images/:imageId", campus.deleteIdeaImage);
router.get("/ideas/:id/work", campus.work);
router.post("/ideas/:id/tasks", campus.addTask);
router.post("/ideas/:id/check-in", campus.checkIn);
router.post("/ideas/:id/ship", campus.ship);
router.post("/ideas/:id/invite", campus.invite);
router.post("/ideas/:id/leave", campus.leave);
router.post("/ideas/:id/remove", campus.removeMember);
router.post("/ideas/:id/fork", campus.fork);

router.get("/problems", campus.listProblems);
router.post("/problems", campus.createProblem);
router.get("/problems/:id", campus.getProblem);
router.post("/problems/:id/fresh-line", campus.freshLine);

router.post("/offers", campus.createOffer);
router.get("/offers/:id", campus.getOffer);
router.post("/offers/:id/accept", campus.acceptOffer);
router.post("/offers/:id/decline", campus.declineOffer);
router.post("/offers/:id/tryout", campus.assignTryout);

router.get("/inbox", campus.inbox);
router.get("/inbox/badge", campus.inboxBadge);
router.post("/notices/read-all", campus.markAllNoticesRead);
router.post("/notices/:id/read", campus.markNoticeRead);
router.get("/invites/:id", campus.getInvite);
router.post("/invites/:id", campus.respondInvite);

router.post("/tasks/:id/start", campus.startTask);
router.patch("/tasks/:id", campus.updateTask);
router.patch("/tasks/:id/assignee", campus.reassignTask);
router.post("/tasks/:id/submit", campus.submitTask);
router.post("/tasks/:id/sign", campus.signTask);
router.post("/tasks/:id/dispute", campus.disputeTask);

router.get("/proof", campus.proof);
router.get("/proof/:id", campus.proof);
router.post("/proof", campus.publishProof);

router.post("/reports", campus.fileReport);
router.get("/reports", campus.listReports);
router.post("/reports/:id/resolve", campus.resolveReport);

router.post("/saves", campus.saveTarget);
router.delete("/saves", campus.unsaveTarget);
router.get("/saves", campus.listSaved);

router.get("/help", campus.help);
router.post("/draft", campus.draft);

export default router;
