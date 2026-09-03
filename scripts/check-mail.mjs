/* ==================================================================
   MAIL SETUP CHECKER

   Run:  npm run mail:check
         npm run mail:check -- you@somewhere-else.com

   Sends one real message through Resend using exactly the config the
   app uses, and prints Resend's own error verbatim when it fails.

   This exists because the failure that actually bites — Resend
   refusing to deliver anywhere except your account address until a
   sending domain is verified — surfaces in the app as a generic
   "Could not send that", by design: the real error names the account
   and the domain, and none of that belongs in a response the browser
   can read. So it gets printed here instead, where only you can see
   it.
   ================================================================== */

import { readFileSync, existsSync } from "node:fs";

const ENV_FILE = ".env.local";

function loadEnv(file) {
    if (!existsSync(file)) return {};
    const out = {};
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        /* Strip surrounding quotes but nothing else — an API key is opaque and
           trimming inside it would corrupt a legitimate value. */
        out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
}

/* Never print a key. Enough characters to tell two apart, not enough to use. */
function mask(v) {
    if (!v) return "not set";
    return `set (${v.length} chars, ${v.slice(0, 3)}…${v.slice(-2)})`;
}

const env = { ...loadEnv(ENV_FILE), ...process.env };

/* Kept in step with contactForm.email in src/lib/site.ts. Duplicated rather
   than imported because this is a plain .mjs script and site.ts is TypeScript
   with a path alias — a build step to read one string is not worth it. */
const SITE_EMAIL = "ambudlahiriofficial@outlook.com";

const from = env.CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>";
const to = process.argv[2] || env.CONTACT_TO_EMAIL || SITE_EMAIL;

console.log("\nConfiguration");
console.log("  RESEND_API_KEY      ", mask(env.RESEND_API_KEY));
console.log("  VERIFY_SECRET       ", mask(env.VERIFY_SECRET));
console.log("  CONTACT_FROM_EMAIL  ", env.CONTACT_FROM_EMAIL || "not set → onboarding@resend.dev");
console.log("  CONTACT_TO_EMAIL    ", env.CONTACT_TO_EMAIL || `not set → ${SITE_EMAIL}`);
console.log(`\n  Sending as   ${from}`);
console.log(`  Sending to   ${to}\n`);

if (!env.RESEND_API_KEY) {
    console.error(`No RESEND_API_KEY. Add it to ${ENV_FILE} and try again.\n`);
    process.exit(1);
}

if (!env.CONTACT_FROM_EMAIL) {
    console.log(
        "Note: no verified sending domain configured, so this is still in Resend's\n" +
        "testing mode — it will only deliver to your Resend account address, and\n" +
        "visitor verification codes will not send.\n",
    );
}

const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
        from,
        to: [to],
        subject: "Portfolio mail check",
        text: `Sent by npm run mail:check at ${new Date().toISOString()}.\n\nIf this arrived, the contact form will reach the same inbox.`,
    }),
});

const body = await res.text();

if (res.ok) {
    console.log(`✓ Sent. HTTP ${res.status}. Check ${to}.\n`);
    if (env.CONTACT_TO_EMAIL) {
        console.log(
            `Reminder: CONTACT_TO_EMAIL is overriding the destination. Remove it\n` +
            `(or leave it unset in production) to deliver to ${SITE_EMAIL}.\n`,
        );
    }
    process.exit(0);
}

console.error(`✗ Failed. HTTP ${res.status}`);
console.error(`  ${body}\n`);

if (res.status === 403 && body.includes("verify a domain")) {
    console.error(
        "This is the testing-mode restriction. To send anywhere else:\n" +
        "  1. Add a domain you own at https://resend.com/domains\n" +
        "  2. Add the DNS records Resend gives you, and wait for it to go green\n" +
        `  3. Set CONTACT_FROM_EMAIL in ${ENV_FILE}, e.g.\n` +
        '     CONTACT_FROM_EMAIL="Ambud Lahiri <hello@yourdomain.com>"\n' +
        "  4. Re-run this check\n",
    );
}

process.exit(1);
