type MailJob = { to: string; subject: string; text: string };

type Queued = MailJob & {
    resolve: () => void;
    reject: (error: unknown) => void;
};

export class MailDeliveryError extends Error {
    retryable: boolean;
    constructor(message: string, retryable = false) {
        super(message);
        this.name = "MailDeliveryError";
        this.retryable = retryable;
    }
}

const pending: Queued[] = [];
let pumping = false;

const MISSING_KEY = "Email codes are temporarily unavailable. Please try again later.";
const UNVERIFIED_FROM = "Email codes are temporarily unavailable. Please try again later.";
const TRY_AGAIN = "The login code could not be sent. Try again in a moment.";

/** Fire-and-forget. Failures are logged and do not include the message body. */
export function enqueueMail(job: MailJob) {
    void schedule(job).catch((error) => {
        const message = error instanceof Error ? error.message : "Mail delivery failed";
        console.error(message);
    });
}

/** Queue a message and resolve only after the provider accepts it. */
export function deliverMail(job: MailJob): Promise<void> {
    return schedule(job);
}

function schedule(job: MailJob): Promise<void> {
    return new Promise((resolve, reject) => {
        pending.push({ ...job, resolve, reject });
        void pump();
    });
}

async function pump() {
    if (pumping) return;
    pumping = true;
    try {
        while (pending.length > 0) {
            const job = pending.shift();
            if (!job) break;
            try {
                await deliver(job);
                job.resolve();
            } catch (error) {
                job.reject(error);
            }
        }
    } finally {
        pumping = false;
        if (pending.length > 0) void pump();
    }
}

function configuredSender(): { key: string; from: string } {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) throw new MailDeliveryError(MISSING_KEY);
    const from = process.env.RESEND_FROM?.trim();
    if (!from || /resend\.dev/i.test(from)) throw new MailDeliveryError(UNVERIFIED_FROM);
    return { key, from };
}

async function deliver(job: MailJob) {
    const { key, from } = configuredSender();
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            await postOnce(key, from, job);
            return;
        } catch (error) {
            last = error;
            const retryable = error instanceof MailDeliveryError && error.retryable;
            if (!retryable || attempt === 1) throw error;
        }
    }
    throw last;
}

async function postOnce(key: string, from: string, job: MailJob) {
    let response: Response;
    try {
        response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ from, to: job.to, subject: job.subject, text: job.text }),
        });
    } catch {
        throw new MailDeliveryError(TRY_AGAIN, true);
    }
    if (response.ok) return;
    const body = await response.text();
    throw classify(response.status, body);
}

function classify(status: number, body: string): MailDeliveryError {
    const sandbox = /verify a domain|testing emails|only send testing|not verified|resend\.com\/domains/i.test(body);
    if (sandbox) {
        console.error(`Mail delivery failed (resend sandbox, HTTP ${status})`);
        return new MailDeliveryError(UNVERIFIED_FROM);
    }
    if (status === 401 || status === 403) {
        console.error(`Mail delivery failed (resend auth, HTTP ${status})`);
        return new MailDeliveryError("The mail provider rejected RESEND_API_KEY.");
    }
    if (status === 400 || status === 422) {
        console.error(`Mail delivery failed (resend from-address, HTTP ${status})`);
        return new MailDeliveryError(UNVERIFIED_FROM);
    }
    const retryable = status === 429 || status >= 500;
    console.error(`Mail delivery failed (resend, HTTP ${status})`);
    return new MailDeliveryError(TRY_AGAIN, retryable);
}
