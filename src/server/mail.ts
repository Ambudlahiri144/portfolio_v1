
/* ==================================================================
   MAIL

   Resend's REST API over plain fetch — no SDK.

   The `resend` package is a thin wrapper around this one POST, and
   adding a dependency to send a single request is not a trade worth
   making in a project whose only other runtime deps are the ones that
   draw the page.
   ================================================================== */

import { contactForm } from "@/lib/site";

const ENDPOINT = "https://api.resend.com/emails";

export type MailResult =
    | { ok: true }
    | { ok: false; reason: "unconfigured" | "failed"; detail?: string };

/**
 * True when the mail credentials are present.
 *
 * Every route checks this first and answers 503 rather than pretending. A
 * contact form that silently swallows messages is worse than one that says it
 * is not connected yet.
 */
export function mailConfigured() {
    return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Where mail actually goes.
 *
 * site.ts holds the real address; CONTACT_TO_EMAIL overrides it per
 * environment. That override exists because Resend will not deliver anywhere
 * except the address the account was registered with until a sending domain is
 * verified — so local development has to point somewhere else, and doing that
 * by editing site.ts is a change that eventually gets committed by accident.
 */
export function recipient() {
    return process.env.CONTACT_TO_EMAIL?.trim() || contactForm.email;
}

export async function sendMail({
    to,
    subject,
    text,
    replyTo,
}: {
    to: string;
    subject: string;
    text: string;
    /** Set to the visitor's address so a reply in the mail client just works. */
    replyTo?: string;
}): Promise<MailResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, reason: "unconfigured" };

    /* Resend will only send from a domain you have verified with them. Until
       that is set up, onboarding@resend.dev works — but it can only deliver to
       the address the Resend account itself was registered with, which is fine
       for a personal contact form and nothing else. */
    const from = process.env.CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>";

    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject,
                text,
                ...(replyTo ? { reply_to: replyTo } : {}),
            }),
        });

        if (!res.ok) {
            /* Read the body for the log, not for the caller — Resend's errors
               can name the account and the domain, and none of that belongs in
               a response the browser can see. */
            const detail = await res.text().catch(() => "");
            console.error("[mail] send failed", res.status, detail);
            return { ok: false, reason: "failed" };
        }

        return { ok: true };
    } catch (err) {
        console.error("[mail] send threw", err);
        return { ok: false, reason: "failed" };
    }
}
