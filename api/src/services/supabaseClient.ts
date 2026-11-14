import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function isPublishableOrAnonKey(key: string): boolean {
    if (key.startsWith("sb_publishable_")) return true;
    const parts = key.split(".");
    if (parts.length < 2) return false;
    try {
        const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { role?: string };
        return payload.role === "anon";
    } catch {
        return false;
    }
}

/**
 * Server-side Storage client. Prefer the service role / secret key so uploads
 * bypass Storage RLS. A publishable/anon key only works if bucket policies allow writes.
 */
function resolveSupabaseKey(): string {
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
        process.env.SUPABASE_SECRET_KEY?.trim() ||
        "";
    if (!key) {
        console.warn("[supabase] Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY — image uploads will fail");
    } else if (isPublishableOrAnonKey(key)) {
        console.warn(
            "[supabase] Using a publishable/anon key for Storage. Prefer SUPABASE_SERVICE_ROLE_KEY (sb_secret_… or service_role JWT) so uploads are not blocked by RLS.",
        );
    }
    return key;
}

export const supabase: SupabaseClient = createClient(process.env.SUPABASE_URL ?? "", resolveSupabaseKey());
export const supabaseBucket = process.env.SUPABASE_BUCKET_NAME ?? "embedra-images";

export function storageUploadErrorMessage(error: { message?: string } | null | undefined): string {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("row-level security") || msg.includes("access denied") || msg.includes("unauthorized")) {
        return "Image storage rejected the upload. Ask an admin to set SUPABASE_SERVICE_ROLE_KEY (not the publishable key) or add Storage write policies.";
    }
    if (msg.includes("bucket") || msg.includes("not found")) {
        return "Image storage is not configured. Ask an admin to check the Supabase bucket.";
    }
    if (msg.includes("payload too large") || msg.includes("exceeded") || msg.includes("file size")) {
        return "Image is too large. Use a PNG, JPG, or WebP under 5 MB.";
    }
    if (msg.includes("mime") || msg.includes("content type")) {
        return "Use PNG, JPG, or WebP only.";
    }
    return "Image upload failed. Try again with a PNG, JPG, or WebP under 5 MB.";
}
