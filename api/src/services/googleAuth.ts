/**
 * Sign in with Google (OpenID Connect, authorization-code flow).
 * The academic-email rule still applies: only verified university addresses get in (RULES 1).
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { isAcademicEmail } from "../../../packages/types";
import { CampusError, signInCampusEmail } from "./campusService";

const JWT_SECRET = process.env.JWT_SECRET || "embedra_super_secret_jwt_key_2026";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type GoogleClaims = {
    iss?: string;
    aud?: string;
    nonce?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
};

function firstWebOrigin() {
    const raw = process.env.WEB_ORIGIN || process.env.CORS_ORIGINS || "http://localhost:3001";
    return raw.split(",")[0].trim().replace(/\/$/, "");
}

export function googleConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function config() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new CampusError(503, "Google sign-in is not set up on this server");
    // Must match an "Authorized redirect URI" on the Google OAuth client exactly.
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${firstWebOrigin()}/login/google/callback`;
    return { clientId, clientSecret, redirectUri };
}

export function googleSignInUrl(next: string | undefined) {
    const { clientId, redirectUri } = config();
    const nonce = crypto.randomBytes(16).toString("hex");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
    const state = jwt.sign({ nonce, next: safeNext, purpose: "google-login" }, JWT_SECRET, { expiresIn: "10m" });
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        prompt: "select_account",
        access_type: "online",
    });
    return { url: `${AUTH_URL}?${params.toString()}`, state };
}

/** Checks the ID token's claims. Returns the verified, lowercased university email. Pure, so it can be tested without Google. */
export function validateGoogleClaims(claims: GoogleClaims | null, clientId: string, nonce: string, now = Date.now()) {
    if (!claims || claims.aud !== clientId || claims.nonce !== nonce || !ISSUERS.includes(claims.iss ?? "")) {
        throw new CampusError(401, "Google did not confirm that sign-in. Try again.");
    }
    if (!claims.exp || claims.exp * 1000 < now) throw new CampusError(401, "The sign-in link expired. Start again.");
    const email = (claims.email ?? "").trim().toLowerCase();
    const verified = claims.email_verified === true || claims.email_verified === "true";
    if (!email || !verified) throw new CampusError(403, "Google hasn't verified that email address. Use the email code instead.");
    if (!isAcademicEmail(email)) {
        throw new CampusError(403, "That's a personal Google account. Attest needs your university account: pick it in Google's account chooser, or use the email code with your university address.");
    }
    return email;
}

export async function completeGoogleSignIn(code: string, state: string) {
    const { clientId, clientSecret, redirectUri } = config();

    let statePayload: { nonce: string; next?: string; purpose: string };
    try {
        statePayload = jwt.verify(state, JWT_SECRET) as typeof statePayload;
    } catch {
        throw new CampusError(401, "The sign-in link expired. Start again.");
    }
    if (statePayload.purpose !== "google-login") throw new CampusError(401, "The sign-in link expired. Start again.");

    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
        }),
    });
    const body = (await response.json().catch(() => ({}))) as { id_token?: string; error_description?: string; error?: string };
    if (!response.ok || !body.id_token) {
        console.error("Google token exchange failed:", body.error_description ?? body.error ?? response.status);
        throw new CampusError(401, "Google did not confirm that sign-in. Try again.");
    }

    // The id_token came straight from Google's token endpoint over TLS, so its claims are trusted without a signature check.
    const claims = jwt.decode(body.id_token) as GoogleClaims | null;
    const email = validateGoogleClaims(claims, clientId, statePayload.nonce);
    const result = await signInCampusEmail(email, claims?.name, "google");
    return { ...result, next: statePayload.next ?? null };
}
