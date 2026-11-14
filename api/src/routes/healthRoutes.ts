import { Router, Request, Response } from "express";

const router = Router();
const NLP_URL = (process.env.NLP_URL || "http://127.0.0.1:8001").replace(/\/$/, "");

router.get("/health", async (_req: Request, res: Response) => {
    let nlp: "ok" | "down" | "skipped" = "skipped";
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const r = await fetch(`${NLP_URL}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        nlp = r.ok ? "ok" : "down";
    } catch {
        nlp = "down";
    }

    // Always 200 so orchestrator liveness does not restart the API while NLP
    // cold-starts. Surface NLP status in the body for readiness dashboards.
    res.status(200).json({
        status: nlp === "down" ? "degraded" : "ok",
        timestamp: new Date().toISOString(),
        nlp,
        workers: ["embedding", "document", "day7", "mail-inline"],
    });
});

export default router;
