// The one place the sign-in secret is read.
// It is read at call time, not when a module loads, so it always sees the value from .env
// or the host environment. The fallback exists only for local development; production
// refuses to start without a strong JWT_SECRET (see index.ts) and this throws as a backstop.
const DEV_FALLBACK = "embedra_super_secret_jwt_key_2026";

export function jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET is not set");
    }
    return DEV_FALLBACK;
}
