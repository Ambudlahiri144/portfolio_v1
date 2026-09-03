import { NextResponse } from "next/server";
import { hireFields } from "@/lib/site";
import { mailConfigured, recipient, sendMail } from "@/server/mail";
import {
    checkToken,
    issueToken,
    looksLikeEmail,
    makeCode,
    normalise,
    rateLimit,
    verifyConfigured,
} from "@/server/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientKey(req: Request) {
    const fwd = req.headers.get("x-forwarded-for");
    return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
    if (!verifyConfigured() || !mailConfigured()) {
        return NextResponse.json(
            {
                error:
                    "Verification is not connected yet. Set RESEND_API_KEY and VERIFY_SECRET in .env.local.",
            },
            { status: 503 },
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const action = typeof b.action === "string" ? b.action : "";
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 200) : "";

    if (!looksLikeEmail(email)) {
        return NextResponse.json(
            { error: "That email address does not look right." },
            { status: 400 },
        );
    }

    /* ---- step 1: send a code ---------------------------------------- */
    if (action === "request") {
        /* Limited per address as well as per client. Without the address key,
           one machine could walk a list of other people's inboxes and have
           this endpoint mail all of them. */
        const ok =
            rateLimit(`verify:ip:${clientKey(req)}`, 6, 15 * 60 * 1000) &&
            rateLimit(`verify:to:${normalise(email)}`, 4, 15 * 60 * 1000);

        if (!ok) {
            return NextResponse.json(
                { error: "Too many codes requested. Try again in a few minutes." },
                { status: 429 },
            );
        }

        const code = makeCode();
        const token = issueToken(email, code);
        if (!token) {
            return NextResponse.json(
                { error: "Verification is not configured." },
                { status: 503 },
            );
        }

        const sent = await sendMail({
            to: email,
            subject: `${code} is your verification code`,
            text: [
                `Your verification code is ${code}.`,
                "",
                "It expires in 10 minutes. If you did not ask for this, you can ignore this email.",
            ].join("\n"),
        });

        if (!sent.ok) {
            return NextResponse.json(
                { error: "Could not send the code. Please try again." },
                { status: 502 },
            );
        }

        /* The token is opaque and useless without the code, which only reached
           the inbox — so handing it to the client is safe and is what makes
           the whole flow stateless. */
        return NextResponse.json({ ok: true, token });
    }

    /* ---- step 2: check it ------------------------------------------- */
    if (action === "confirm") {
        if (!rateLimit(`confirm:${normalise(email)}`, 8, 15 * 60 * 1000)) {
            return NextResponse.json(
                { error: "Too many attempts. Request a new code." },
                { status: 429 },
            );
        }

        const code = typeof b.code === "string" ? b.code.trim().slice(0, 12) : "";
        const token = typeof b.token === "string" ? b.token.slice(0, 300) : "";
        const fieldId = typeof b.field === "string" ? b.field.slice(0, 60) : "";

        const outcome = checkToken(email, code, token);
        if (outcome !== "ok") {
            const message =
                outcome === "expired"
                    ? "That code has expired. Request a new one."
                    : "That code is not right.";
            return NextResponse.json({ error: message }, { status: 400 });
        }

        const field = hireFields.find((f) => f.id === fieldId);

        /* Tells you someone took a CV, and which one. The download itself is
           the point of the flow; this is the part that makes it worth gating. */
        void sendMail({
            to: recipient(),
            subject: `CV downloaded — ${field?.label ?? "unknown field"}`,
            text: [
                `${normalise(email)} verified their address and downloaded the CV.`,
                `Field: ${field?.label ?? (fieldId || "unspecified")}`,
            ].join("\n"),
            replyTo: normalise(email),
        }).catch(() => {
            /* Swallowed on purpose. The visitor verified successfully; failing
               their download because a notification to me bounced would be
               punishing them for my problem. */
        });

        return NextResponse.json({ ok: true, resume: field?.resume || "" });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
