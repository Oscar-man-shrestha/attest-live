import { and, count, db, documents, eq, gt } from "../../../packages/db/index";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, type DocumentExtraction } from "../../../packages/types";
import { nudgeDocuments } from "../queues/documentQueue";
import { CampusError, requireUser } from "./campusService";

const UPLOADS_PER_HOUR = 5;
const BRIEF_UPLOADS_PER_HOUR = 3;

type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };
type DocumentKind = "resume" | "certificate" | "idea_brief";

export async function uploadDocument(userId: string, kind: DocumentKind, file: UploadedFile | undefined) {
    await requireUser(userId);
    if (!file) throw new CampusError(400, "Attach a PDF, PNG or JPG");
    if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) throw new CampusError(415, "Use a PDF, PNG or JPG");
    if (file.size > DOCUMENT_MAX_BYTES) throw new CampusError(413, "Files are capped at 5 MB");

    const hourAgo = new Date(Date.now() - 60 * 60_000);
    const [recent] = await db.select({ n: count() }).from(documents)
        .where(and(eq(documents.userId, userId), gt(documents.createdAt, hourAgo)));
    if (Number(recent?.n ?? 0) >= UPLOADS_PER_HOUR) throw new CampusError(429, "Five uploads an hour is the cap. Try again later.");

    if (kind === "idea_brief") {
        const [briefs] = await db.select({ n: count() }).from(documents)
            .where(and(eq(documents.userId, userId), eq(documents.kind, "idea_brief"), gt(documents.createdAt, hourAgo)));
        if (Number(briefs?.n ?? 0) >= BRIEF_UPLOADS_PER_HOUR) {
            throw new CampusError(429, "Three idea-brief uploads an hour is the cap. Try again later.");
        }
    }

    const [doc] = await db.insert(documents).values({
        userId,
        kind,
        filename: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        content: file.buffer,
    }).returning({ id: documents.id, status: documents.status });
    nudgeDocuments();
    return { id: doc.id, status: doc.status };
}

export async function getDocument(userId: string, id: string) {
    const [doc] = await db.select({
        id: documents.id,
        userId: documents.userId,
        kind: documents.kind,
        filename: documents.filename,
        status: documents.status,
        result: documents.result,
        error: documents.error,
    }).from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.userId !== userId) throw new CampusError(404, "Upload not found");
    return {
        id: doc.id,
        kind: doc.kind as DocumentKind,
        filename: doc.filename,
        status: doc.status as "queued" | "parsed" | "failed",
        result: (doc.result as DocumentExtraction | null) ?? null,
        error: doc.error,
    };
}
