import path from "path";
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";

import authRoutes from "./routes/authRoutes";
import healthRoutes from "./routes/healthRoutes";
import lookupRoutes from "./routes/lookupRoutes";
import ideaRoutes from "./routes/ideaRoutes";
import groupRoutes from "./routes/groupRoutes";
import contributionRoutes from "./routes/contributionRoutes";
import userRoutes from "./routes/userRoutes";
import campusRoutes from "./routes/campusRoutes";
import { setupSocketIO } from "./sockets/groupSocket";
import { startEmbeddingWorker } from "./queues/embeddingQueue";
import { startDocumentWorker } from "./queues/documentQueue";
import { startDay7Worker } from "./queues/day7Queue";
import { startMarketplaceWorker } from "./queues/marketplaceQueue";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Launch safety: never run production on the fallback signing secret that is written in this repo.
if (process.env.NODE_ENV === "production") {
    const secret = process.env.JWT_SECRET ?? "";
    if (secret.length < 32 || secret === "embedra_super_secret_jwt_key_2026" || /replace-with/i.test(secret)) {
        console.error("Refusing to start: set JWT_SECRET to a random string of at least 32 characters in production.");
        process.exit(1);
    }
    if (process.env.ATTEST_TEST_LOGIN_EMAIL || process.env.ATTEST_TEST_LOGIN_CODE) {
        console.warn("ATTEST_TEST_LOGIN_* is set but ignored in production. Remove it from the environment.");
    }
}

const app = express();
const PORT = Number(process.env.PORT || 5001);
const isProd = process.env.NODE_ENV === "production";

function parseAllowedOrigins(): string[] {
    const raw = process.env.WEB_ORIGIN || process.env.CORS_ORIGINS || "http://localhost:3001";
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
const allowedOrigins = parseAllowedOrigins();

if (isProd) {
    const secret = process.env.JWT_SECRET || "";
    if (!secret || secret === "embedra_super_secret_jwt_key_2026") {
        console.error("[boot] JWT_SECRET must be set to a strong unique value in production");
        process.exit(1);
    }
    if (!process.env.DATABASE_URL) {
        console.error("[boot] DATABASE_URL is required in production");
        process.exit(1);
    }
    if (!process.env.WEB_ORIGIN && !process.env.CORS_ORIGINS) {
        console.error("[boot] WEB_ORIGIN (or CORS_ORIGINS) is required in production");
        process.exit(1);
    }
}

app.use(cors({
    origin(origin, callback) {
        // Non-browser clients (curl, health checks) send no Origin
        if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true,
}));
app.disable("x-powered-by");
// Basic security headers (the API only serves JSON).
app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (isProd) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    next();
});
app.use(express.json({ limit: "2mb" }));

const server = http.createServer(app);

const io = new SocketIOServer(server, {
    cors: {
        origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
        methods: ["GET", "POST", "PATCH", "DELETE"],
        credentials: true,
    },
});

setupSocketIO(io);

app.use(healthRoutes);
app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", lookupRoutes);
app.use("/api/v1/ideas", ideaRoutes);
app.use("/api/v1/groups", groupRoutes);
app.use("/api/v1/contributions", contributionRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/campus", campusRoutes);

server.listen(PORT, () => {
    console.log(`Attest API listening on port ${PORT}`);
    console.log(`CORS origins: ${allowedOrigins.join(", ")}`);
    startEmbeddingWorker();
    startDocumentWorker();
    startDay7Worker();
    startMarketplaceWorker();
});

export { app, server, io };
export default app;
