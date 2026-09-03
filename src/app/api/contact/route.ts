import { NextResponse } from "next/server";
import { mailConfigured, recipient, sendMail } from "@/server/mail";
import { looksLikeEmail, normalise, rateLimit } from "@/server/verify";

/* Node, not edge — verify.ts uses node:crypto for the HMAC and the CSPRNG, and
   this route shares its rate limiter. */
export const runtime = "nodejs";

/* Never prerendered, never cached. Without this the route is a candidate for
   static optimisation at build time and every visitor gets the same answer. */
export const dynamic = "force-dynamic";

const MAX_LEN = {
    name: 120,
    email: 200,
    topic: 200,
    message: 5000,
    capacity: 200,
} as const;

function clientKey(req: Request) {
    /* Behind a proxy the socket address is the proxy's. x-forwarded-for's first
       entry is the original client — spoofable in general, which is why this
       only feeds a best-effort limiter and nothing security-critical. */
    const fwd = req.headers.get("x-forwarded-for");
    return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function str(v: unknown, max: number) {
    return typeof v === "string" ? v.trim().slice(0, max) : "";
}



export async function POST(req: Request) {
    if (!rateLimit(`contact:${clientKey(req)}`, 5, 10 * 60 * 1000)) {
        return NextResponse.json(
            { error: "Too many messages just now. Try again in a few minutes." },
            { status: 429 },
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const b = body as Record<string, unknown>;

    /* Everything is length-capped on arrival. These strings end up in an email
       body, and an unbounded field is a free way to make the mail API reject
       the send — or to run up the bill. */
    const kind = str(b.kind, 40) || "message";
    const name = str(b.name, MAX_LEN.name);
    const email = str(b.email, MAX_LEN.email);
    const topic = str(b.topic, MAX_LEN.topic);
    const message = str(b.message, MAX_LEN.message);
    const capacity = str(b.capacity, MAX_LEN.capacity);
    const field = str(b.field, 60);

    if (!name || !message) {
        return NextResponse.json(
            { error: "Please fill in your name and a message." },
            { status: 400 },
        );
    }
    if (!looksLikeEmail(email)) {
        return NextResponse.json(
            { error: "That email address does not look right." },
            { status: 400 },
        );
    }

    if (!mailConfigured()) {
        return NextResponse.json(
            {
                error:
                    "The mailbox is not connected yet. Set RESEND_API_KEY in .env.local.",
            },
            { status: 503 },
        );
    }

    const subjectFor: Record<string, string> = {
        feedback: `Site feedback from ${name}`,
        connect: `${topic || "New message"} — from ${name}`,
        freelance: `Freelance enquiry from ${name}`,
        hire: `Hiring enquiry (${field || "unspecified"}) from ${name}`,
    };

    const lines = [
        `From: ${name} <${normalise(email)}>`,
        `Type: ${kind}`,
        topic && `Topic: ${topic}`,
        field && `Field: ${field}`,
        capacity && `Capacity: ${capacity}`,
        "",
        message,
    ].filter(Boolean);

    const sent = await sendMail({
        to: recipient(),
        subject: subjectFor[kind] ?? `Portfolio message from ${name}`,
        text: lines.join("\n"),
        replyTo: normalise(email),
    });

    if (!sent.ok) {
        return NextResponse.json(
            { error: "Could not send that. Please try again in a moment." },
            { status: 502 },
        );
    }

    return NextResponse.json({ ok: true });
}
