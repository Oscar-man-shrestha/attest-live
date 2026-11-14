import crypto from "crypto";
import jwt from "jsonwebtoken";
import { CAMPUS_DOMAIN } from "../../../packages/types";
import { CampusError, signInCampusEmail } from "./campusService";

const JWT_SECRET = process.env.JWT_SECRET || "embedra_super_secret_jwt_key_2026";
const AUTHORITY = "https://login.microsoftonline.com/organizations/oauth2/v2.0";

type MicrosoftConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    campusTenantId: string;
};

type IdTokenClaims = {
    aud?: string;
    tid?: string;
    nonce?: string;
    exp?: number;
    email?: string;
    preferred_username?: string;
    upn?: string;
    name?: string;
};

function config(): MicrosoftConfig {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    const campusTenantId = process.env.MICROSOFT_CAMPUS_TENANT_ID;
    if (!clientId || !clientSecret || !redirectUri || !campusTenantId) {
        throw new CampusError(503, "College Outlook sign-in is not set up on this server");
    }
    return { clientId, clientSecret, redirectUri, campusTenantId };
}

export function microsoftSignInUrl(next: string | undefined) {
    const { clientId, redirectUri } = config();
    const nonce = crypto.randomBytes(16).toString("hex");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
    const state = jwt.sign({ nonce, next: safeNext, purpose: "microsoft-login" }, JWT_SECRET, { expiresIn: "10m" });
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: "openid profile email",
        state,
        nonce,
        prompt: "select_account",
        domain_hint: CAMPUS_DOMAIN,
    });
    return { url: `${AUTHORITY}/authorize?${params.toString()}`, state };
}

export async function completeMicrosoftSignIn(code: string, state: string) {
    const { clientId, clientSecret, redirectUri, campusTenantId } = config();

    let statePayload: { nonce: string; next?: string; purpose: string };
    try {
        statePayload = jwt.verify(state, JWT_SECRET) as typeof statePayload;
    } catch {
        throw new CampusError(401, "The sign-in link expired. Start again.");
    }
    if (statePayload.purpose !== "microsoft-login") {
        throw new CampusError(401, "The sign-in link expired. Start again.");
    }

    const response = await fetch(`${AUTHORITY}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            scope: "openid profile email",
        }),
    });
    const body = (await response.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
    if (!response.ok || !body.id_token) {
        console.error("Microsoft token exchange failed:", body.error_description ?? response.status);
        throw new CampusError(401, "Microsoft did not confirm that sign-in. Try again.");
    }

    // The id_token came straight from Microsoft's token endpoint over TLS, so its claims are trusted without a signature check.
    const claims = jwt.decode(body.id_token) as IdTokenClaims | null;
    if (!claims || claims.aud !== clientId || claims.nonce !== statePayload.nonce) {
        throw new CampusError(401, "Microsoft did not confirm that sign-in. Try again.");
    }
    if (claims.tid !== campusTenantId) {
        throw new CampusError(403, "College Outlook sign-in only works for Amrita accounts. Use the email code instead.");
    }

    const email = (claims.email || claims.preferred_username || claims.upn || "").trim().toLowerCase();
    const result = await signInCampusEmail(email, claims.name, "microsoft");
    return { ...result, next: statePayload.next ?? null };
}
