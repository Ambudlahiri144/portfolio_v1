import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/* ==================================================================
   EMAIL VERIFICATION — stateless

   The code is never stored. Instead the server hands the client a
   signed token that says "an HMAC of (this email + this code + this
   expiry) equals X", and checks the visitor's typed code against it
   on the way back.

   Why not a Map of codes?

   Because this deploys to serverless. Each request can land on a
   different instance with its own fresh memory, so a code written by
   the instance that sent the email is frequently missing from the one
   that receives the confirmation — the flow fails perhaps half the
   time, and only in production. A signed token needs no shared
   storage at all, so every instance can verify what any other issued.
   ================================================================== */

/* Long enough to fetch an email and type six digits, short enough that a
   leaked token is worthless by the time anyone finds it. */
const TTL_MS = 10 * 60 * 1000;

function secret() {
    const s = process.env.VERIFY_SECRET;
    /* No fallback default. A hardcoded development secret is exactly the kind
       of thing that survives to production and turns the signature into
       decoration — anyone who reads the source could then mint their own
       "verified" tokens. Missing means the feature is off. */
    if (!s) return null;
    return s;
}

export function verifyConfigured() {
    return Boolean(secret());
}

/* Six digits, uniformly distributed. randomInt is CSPRNG-backed; Math.random
   is not, and a predictable code defeats the entire point of sending one. */
export function makeCode() {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function sign(email: string, code: string, expires: number, key: string) {
    return createHmac("sha256", key)
        /* Newline-delimited so the parts cannot be shuffled into each other —
           concatenating them raw would let a crafted email absorb the code. */
        .update(`${normalise(email)}\n${code}\n${expires}`)
        .digest("hex");
}

/* Addresses are compared after normalising, so the token issued for
   "Someone@Example.com " cannot be rejected because they typed it differently
   the second time. */
export function normalise(email: string) {
    return email.trim().toLowerCase();
}

/** Issues the token that travels to the client alongside the emailed code. */
export function issueToken(email: string, code: string) {
    const key = secret();
    if (!key) return null;
    const expires = Date.now() + TTL_MS;
    return `${expires}.${sign(email, code, expires, key)}`;
}

export type VerifyOutcome = "ok" | "expired" | "mismatch" | "malformed" | "off";

export function checkToken(
    email: string,
    code: string,
    token: string,
): VerifyOutcome {
    const key = secret();
    if (!key) return "off";

    const dot = token.indexOf(".");
    if (dot < 1) return "malformed";

    const expires = Number(token.slice(0, dot));
    const mac = token.slice(dot + 1);
    if (!Number.isFinite(expires) || !mac) return "malformed";
    if (Date.now() > expires) return "expired";

    const expected = sign(email, code, expires, key);

    /* timingSafeEqual, not ===. String comparison exits at the first differing
       byte, which leaks how much of a guess was correct; over enough attempts
       that is enough to recover the digest a byte at a time. It also throws on
       a length mismatch, so that is checked first. */
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(mac, "utf8");
    if (a.length !== b.length) return "mismatch";
    return timingSafeEqual(a, b) ? "ok" : "mismatch";
}

/* ------------------------------------------------------------------
   Best-effort rate limiting

   In-memory, and therefore per-instance — the same caveat that ruled
   out storing codes this way. It is here to blunt a casual loop, not
   to stop a determined attacker; on serverless a real limiter needs
   shared storage (Upstash, Vercel KV, a database). What actually
   keeps the codes safe is that they expire in ten minutes and the
   token is signed with a secret the client never sees.
   ------------------------------------------------------------------ */

const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
        hits.set(key, recent);
        return false;
    }

    recent.push(now);
    hits.set(key, recent);

    /* The map would otherwise grow forever on a long-lived instance. Cheap to
       sweep and it only runs when the map is already large. */
    if (hits.size > 500) {
        for (const [k, v] of hits) {
            if (v.every((t) => now - t >= windowMs)) hits.delete(k);
        }
    }

    return true;
}

/* Deliberately loose. This is a shape check to reject obvious junk before it
   reaches the mail API, not an attempt to decide what a valid address is —
   the RFC grammar allows far stranger addresses than any regex people write
   for this, and the only real proof an address works is that the code arrives. */
export function looksLikeEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
